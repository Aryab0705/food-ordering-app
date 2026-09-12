/**
 * sendOtpEmail.js
 * Production OTP delivery via Gmail SMTP (Nodemailer).
 *
 * Required env variables:
 *   SMTP_HOST     — SMTP host (e.g., smtp.gmail.com)
 *   SMTP_PORT     — SMTP port (587 for TLS, 465 for SSL)
 *   SMTP_SECURE   — SSL/TLS connection (true for 465, false for 587) - optional
 *   SMTP_USER     — SMTP username (email address)
 *   SMTP_PASS     — SMTP password (app password for Gmail)
 *   SMTP_FROM     — Sender address (e.g., "Campus Canteen Hub <your@gmail.com>")
 */

'use strict';

const os = require('os');
const dns = require('dns');

// Filter os.networkInterfaces only while requiring nodemailer so its internal
// isFamilySupported(6) check evaluates to false on platforms without IPv6 egress (Render).
const origNetworkInterfaces = os.networkInterfaces;

os.networkInterfaces = () => {
  const ifaces = origNetworkInterfaces.call(os);
  const filtered = {};

  for (const [name, addrs] of Object.entries(ifaces)) {
    filtered[name] = addrs.filter(
      (addr) => addr.family === 'IPv4' || addr.family === 4
    );
  }

  return filtered;
};

const nodemailer = require('nodemailer');

// Restore original os.networkInterfaces immediately so no other module is affected
os.networkInterfaces = origNetworkInterfaces;

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const getRequiredEnv = (name) => {
  const value = (process.env[name] || '').trim();

  if (!value) {
    throw new Error(`${name} is not set. Add it to your environment variables.`);
  }

  return value;
};

// Google shows app passwords as four space-separated groups ("abcd efgh ijkl mnop")
// and they get pasted verbatim. Those spaces travel into the AUTH PLAIN command and
// Gmail replies "535-5.7.8 Username and Password not accepted", which reads like a
// wrong password rather than a formatting problem. Strip whitespace only when what
// remains is exactly the 16-character app-password shape, so a real passphrase that
// legitimately contains spaces is left untouched.
const readSmtpPassword = () => {
  const raw = getRequiredEnv('SMTP_PASS');
  const compact = raw.replace(/\s+/g, '');

  if (raw !== compact && /^[a-z0-9]{16}$/i.test(compact)) {
    console.log('[SMTP] Stripped spaces from SMTP_PASS (Gmail app-password format).');
    return compact;
  }

  return raw;
};

// Gmail returns the same 535 for a revoked password, a password belonging to a
// different account, and 2-Step Verification being off. Spell out the fix order.
const logAuthFailureHelp = () => {
  console.error('--- Gmail rejected the SMTP login. This is a credentials problem. Check, in order:');
  console.error(`  1. The app password must belong to ${process.env.SMTP_USER || 'SMTP_USER'} itself,`);
  console.error('     not to another Google account.');
  console.error('  2. 2-Step Verification must be ON for that account, or app passwords do not exist.');
  console.error('  3. App passwords are revoked when the account password changes. Generate a new one');
  console.error('     at https://myaccount.google.com/apppasswords and paste the 16 characters.');
  console.error('  4. A normal Gmail password will never work here — only an app password.');
};


// Create reusable transporter object
const createTransporter = () => {
  const host = getRequiredEnv('SMTP_HOST');
  const port = parseInt(getRequiredEnv('SMTP_PORT'), 10);
  const secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: getRequiredEnv('SMTP_USER'),
      pass: readSmtpPassword(),
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000,   // 5 seconds
    socketTimeout: 10000,   // 10 seconds
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML email template
// ─────────────────────────────────────────────────────────────────────────────

const buildHtml = (name, otp, expiresInMinutes) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Campus Canteen Hub — OTP</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1f6f4a 0%,#2a9d6e 100%);
                        padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;letter-spacing:0.5px;">
                🍽️ Campus Canteen Hub
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:16px;color:#374151;">
                Hello <strong>${name}</strong>,
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Use the one-time passcode below to complete your login.
                This code is valid for <strong>${expiresInMinutes} minutes</strong>.
              </p>

              <!-- OTP box -->
              <div style="background:#eef9f2;border:2px dashed #2a9d6e;
                           border-radius:12px;padding:24px;text-align:center;
                           margin-bottom:28px;">
                <p style="margin:0 0 6px;font-size:12px;color:#6b7280;
                            text-transform:uppercase;letter-spacing:1px;">
                  Your OTP Code
                </p>
                <p style="margin:0;font-size:40px;font-weight:700;
                            letter-spacing:12px;color:#1f6f4a;">
                  ${otp}
                </p>
              </div>

              <p style="margin:0 0 8px;font-size:14px;color:#9ca3af;line-height:1.5;">
                ⚠️ Never share this code with anyone. Campus Canteen Hub staff
                will <strong>never</strong> ask for your OTP.
              </p>
              <p style="margin:0;font-size:14px;color:#9ca3af;">
                If you did not request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;
                        border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} Campus Canteen Hub &nbsp;·&nbsp;
                This is an automated message — please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─────────────────────────────────────────────────────────────────────────────
// sendOtpEmail — public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a login OTP to the user's email address via Gmail SMTP.
 *
 * @param {{ email: string, name: string, otp: string, expiresInMinutes?: number }} params
 * @throws {Error} if SMTP configuration is missing or sending fails
 */
const sendOtpEmail = async ({ email, name, otp, expiresInMinutes = 5 }) => {
  const from = getRequiredEnv('SMTP_FROM');
  const transporter = createTransporter();

  try {
    const info = await transporter.sendMail({
      from,
      to: email,
      subject: 'Your Campus Canteen Hub login OTP',
      text: `Hello ${name}, your Campus Canteen Hub login OTP is: ${otp}\n\nThis code expires in ${expiresInMinutes} minutes. Do not share it with anyone.`,
      html: buildHtml(name, otp, expiresInMinutes),
    });

    // ✅ Success — log message ID, never log the OTP
    console.log(`[SMTP] ✅ Email sent to ${email} — id: ${info.messageId}`);

  } catch (err) {
    // No stack dump here: the classified message below plus the checklist is what
    // actually helps, and the raw nodemailer stack buried the useful line.
    console.error('[SMTP] ❌ Send failed:', {
      message: err.message,
      code: err.code,
      responseCode: err.responseCode,
      command: err.command,
    });

    // Classify errors for a clean user-facing message
    if (err.code === 'EAUTH' || err.code === 'EAUTHENTICATIONFAILED' || err.responseCode === 535) {
      logAuthFailureHelp();
      throw new Error('Unable to send OTP: email service authentication failed. Check SMTP_USER and SMTP_PASS.');
    }

    if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT') {
      throw new Error('Unable to send OTP: could not connect to email server. Check SMTP_HOST and SMTP_PORT.');
    }

    if (err.code === 'EDNS' || err.code === 'ENOTFOUND') {
      throw new Error('Unable to send OTP: DNS lookup failed for SMTP server. Check SMTP_HOST.');
    }

    if (err.code === 'ETLS') {
      throw new Error('Unable to send OTP: TLS/SSL handshake failed. Check SMTP_SECURE and SMTP_PORT.');
    }

    if (err.responseCode === 550 || err.responseCode === 553) {
      throw new Error('Unable to send OTP: sender address rejected by SMTP server. Check SMTP_FROM.');
    }

    if (err.responseCode === 554) {
      throw new Error('Unable to send OTP: recipient address rejected by SMTP server.');
    }

    throw new Error('Unable to send OTP right now. Please try again in a moment.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// verifyEmailConfig — startup health check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates SMTP configuration at server startup and confirms the credentials
 * actually authenticate. Previously this only checked that the env vars existed,
 * so a revoked Gmail app password stayed invisible until a real user tried to log
 * in — the failure showed up as a silent missing email rather than a boot error.
 *
 * @returns {Promise<boolean>}
 */
const verifyEmailConfig = async () => {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('[SMTP] ❌ Missing required environment variables:', missing.join(', '));
    console.error('[SMTP]    OTP login will not work until these are set.');
    return false;
  }

  const port = parseInt(process.env.SMTP_PORT, 10);
  if (port !== 587 && port !== 465) {
    console.warn('[SMTP] ⚠  SMTP_PORT should be 587 (TLS) or 465 (SSL).');
  }

  try {
    await createTransporter().verify();
    console.log(`[SMTP] ✅ Authenticated as ${process.env.SMTP_USER} — OTP emails will send.`);
    return true;
  } catch (error) {
    console.error('[SMTP] ❌ SMTP login failed:', error.message);

    if (error.code === 'EAUTH' || error.responseCode === 535) {
      logAuthFailureHelp();
    }

    console.error('[SMTP]    Until this is fixed, login will answer 502 rather than pretend');
    console.error('[SMTP]    the OTP was sent. Set AUTH_DEBUG_OTP=true in .env to print the');
    console.error('[SMTP]    OTP to this terminal and keep working locally.');
    return false;
  }
};

module.exports = sendOtpEmail;
module.exports.verifyEmailConfig = verifyEmailConfig;

