/**
 * sendOtpEmail.js
 * Production OTP delivery via Gmail SMTP (Nodemailer).
 *
 * Required env variables:
 *   SMTP_HOST     — Gmail SMTP host (e.g., smtp.gmail.com)
 *   SMTP_PORT     — SMTP port (e.g., 587 for TLS, 465 for SSL)
 *   SMTP_USER     — Gmail address
 *   SMTP_PASS     — Gmail app password (not your regular password)
 *   SMTP_FROM     — Sender address (e.g., "Campus Canteen Hub <your@gmail.com>")
 */

'use strict';

const nodemailer = require('nodemailer');

const getRequiredEnv = (name) => {
  const value = (process.env[name] || '').trim();

  if (!value) {
    throw new Error(`${name} is not set. Add it to your environment variables.`);
  }

  return value;
};

// Create reusable transporter object
const createTransporter = () => {
  return nodemailer.createTransport({
    host: getRequiredEnv('SMTP_HOST'),
    port: parseInt(getRequiredEnv('SMTP_PORT'), 10),
    secure: parseInt(getRequiredEnv('SMTP_PORT'), 10) === 465, // true for 465, false for other ports
    auth: {
      user: getRequiredEnv('SMTP_USER'),
      pass: getRequiredEnv('SMTP_PASS'),
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML email template
// ─────────────────────────────────────────────────────────────────────────────

const buildHtml = (name, otp) => `
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
                This code is valid for <strong>10 minutes</strong>.
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
 * @param {{ email: string, name: string, otp: string }} params
 * @throws {Error} if SMTP configuration is missing or sending fails
 */
const sendOtpEmail = async ({ email, name, otp }) => {
  const from = getRequiredEnv('SMTP_FROM');

  // ── Startup / per-call diagnostic log (no secret exposed) ─────────────────
  console.log('[SMTP] sendOtpEmail called:', {
    from,
    to: email,
  });

  // ── Send via SMTP ───────────────────────────────────────────────────────────
  const transporter = createTransporter();

  try {
    const info = await transporter.sendMail({
      from,
      to: email,
      subject: 'Your Campus Canteen Hub login OTP',
      text: `Hello ${name}, your Campus Canteen Hub login OTP is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
      html: buildHtml(name, otp),
    });

    // ✅ Success — log message ID, never log the OTP
    console.log(`[SMTP] ✅ Email sent to ${email} — id: ${info.messageId}`);

  } catch (err) {
    // ── Full error dump for logs ──────────────────────────────────────────────
    console.error('[SMTP] SEND FAILED — full error:', {
      message: err.message,
      code: err.code,
      stack: err.stack,
    });

    // Classify errors for a clean user-facing message
    if (err.code === 'EAUTH' || err.code === 'EAUTHENTICATIONFAILED') {
      throw new Error('Unable to send OTP: email service authentication failed. Check SMTP_USER and SMTP_PASS.');
    }

    if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT') {
      throw new Error('Unable to send OTP: could not connect to email server. Check SMTP_HOST and SMTP_PORT.');
    }

    throw new Error('Unable to send OTP right now. Please try again in a moment.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// verifyEmailConfig — startup health check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates SMTP configuration at server startup.
 * Does NOT make a live network call — just confirms env vars are present.
 *
 * @returns {Promise<boolean>}
 */
const verifyEmailConfig = async () => {
  console.log('[SMTP] ── Startup config audit ───────────────────────────');
  console.log({
    SMTP_HOST: process.env.SMTP_HOST || '⚠ MISSING',
    SMTP_PORT: process.env.SMTP_PORT || '⚠ MISSING',
    SMTP_USER: process.env.SMTP_USER || '⚠ MISSING',
    SMTP_PASS: process.env.SMTP_PASS ? '*** (set)' : '⚠ MISSING',
    SMTP_FROM: process.env.SMTP_FROM || '⚠ MISSING',
  });
  console.log('[SMTP] ─────────────────────────────────────────────────────');

  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('[SMTP] ❌ Missing required environment variables:', missing.join(', '));
    console.error('[SMTP]    Add these to your environment variables.');
    return false;
  }

  const port = parseInt(process.env.SMTP_PORT, 10);
  if (port !== 587 && port !== 465) {
    console.warn('[SMTP] ⚠  SMTP_PORT should be 587 (TLS) or 465 (SSL).');
  }

  console.log('[SMTP] ✅ Configuration looks valid — OTP emails should work.');
  return true;
};

module.exports = sendOtpEmail;
module.exports.verifyEmailConfig = verifyEmailConfig;

