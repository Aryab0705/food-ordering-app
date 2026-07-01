/**
 * sendOtpEmail.js
 * Production OTP delivery via Resend (HTTPS API — works on all cloud hosts).
 *
 * Why Resend instead of Gmail SMTP?
 *   Cloud free-tier hosts (Render, Railway, Fly.io) commonly block outbound
 *   ports 465 and 587, so direct SMTP connections time out at the TCP level.
 *   Resend sends email over HTTPS (port 443), which is never firewalled.
 *   Also avoids IPv6 connection issues that plague Gmail SMTP on Render.
 *
 * Required env variables:
 *   RESEND_API_KEY  — from https://resend.com/api-keys
 *   RESEND_FROM     — verified sender address, e.g. "Campus Canteen Hub <noreply@yourdomain.com>"
 *                     For production, use a sender on a domain verified in Resend.
 *                     The resend.dev sandbox sender is not valid for real user OTPs.
 */

'use strict';

const { Resend } = require('resend');

const RESEND_SANDBOX_DOMAIN = 'resend.dev';

const extractEmailAddress = (sender) => {
  const match = String(sender || '').match(/<([^<>]+)>/);
  return (match ? match[1] : sender || '').trim();
};

const getRequiredEnv = (name) => {
  const value = (process.env[name] || '').trim();

  if (!value) {
    throw new Error(`${name} is not set. Add it to your environment variables.`);
  }

  return value;
};

const getResendFrom = () => getRequiredEnv('RESEND_FROM');

const isResendSandboxSender = (sender) =>
  extractEmailAddress(sender).toLowerCase().endsWith(`@${RESEND_SANDBOX_DOMAIN}`);

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
 * Sends a login OTP to the user's email address via the Resend HTTP API.
 *
 * @param {{ email: string, name: string, otp: string }} params
 * @throws {Error} if the API key is missing or Resend rejects the request
 */
const sendOtpEmail = async ({ email, name, otp }) => {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const from = getResendFrom();

  // ── Startup / per-call diagnostic log (no secret exposed) ─────────────────
  console.log('[Resend] sendOtpEmail called:', {
    apiKeyExists: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.slice(0, 8) + '…' : 'MISSING',
    from,
    to: email,
  });

  // ── Missing API key ────────────────────────────────────────────────────────
  if (!apiKey) {
    const msg = 'RESEND_API_KEY is not set. Add it to your Render environment variables.';
    console.error('[Resend] ❌', msg);
    throw new Error('Unable to send OTP right now. Email service is not configured.');
  }

  if (isResendSandboxSender(from)) {
    throw new Error(
      `Unable to send OTP: sender address ${extractEmailAddress(from)} is not verified for this recipient. Set RESEND_FROM to an address on a verified Resend domain.`,
    );
  }

  // ── Send via Resend HTTPS API ──────────────────────────────────────────────
  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to:      [email],
      subject: 'Your Campus Canteen Hub login OTP',
      text:    `Hello ${name}, your Campus Canteen Hub login OTP is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
      html:    buildHtml(name, otp),
    });

    if (error) {
      // Resend returned an API-level error (bad key, unverified domain, etc.)
      console.error('[Resend] ❌ API error:', {
        name:       error.name,
        message:    error.message,
        statusCode: error.statusCode,
      });
      const resendError = new Error(error.message || 'Resend rejected the email request.');
      resendError.name = error.name || 'ResendError';
      resendError.statusCode = error.statusCode;
      throw resendError;
    }

    // ✅ Success — log message ID, never log the OTP
    console.log(`[Resend] ✅ Email sent to ${email} — id: ${data.id}`);

  } catch (err) {
    // ── Full error dump for Render logs ──────────────────────────────────────
    console.error('[Resend] SEND FAILED — full error:', {
      message:    err.message,
      name:       err.name,
      statusCode: err.statusCode,
      stack:      err.stack,
    });
    // Classify errors for a clean user-facing message
    if (
      err.statusCode === 422 ||
      (err.message || '').toLowerCase().includes('resend.dev') ||
      (err.message || '').toLowerCase().includes('verify a domain') ||
      (err.message || '').toLowerCase().includes('only send testing emails') ||
      (err.message || '').toLowerCase().includes('domain') ||
      (err.message || '').toLowerCase().includes('sender')
    ) {
      throw new Error(
        `Unable to send OTP: sender address ${extractEmailAddress(from)} is not verified for this recipient. Set RESEND_FROM to an address on a verified Resend domain.`,
      );
    }

    if (
      err.statusCode === 401 ||
      err.statusCode === 403 ||
      (err.message || '').toLowerCase().includes('api key') ||
      (err.message || '').toLowerCase().includes('unauthorized')
    ) {
      throw new Error('Unable to send OTP: email service authentication failed. Check RESEND_API_KEY.');
    }

    throw new Error('Unable to send OTP right now. Please try again in a moment.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// verifyEmailConfig — startup health check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates Resend configuration at server startup.
 * Does NOT make a live network call — just confirms env vars are present
 * and the API key has the expected format.
 *
 * @returns {Promise<boolean>}
 */
const verifyEmailConfig = async () => {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const from = getResendFrom();

  console.log('[Resend] ── Startup config audit ───────────────────────────');
  console.log({
    RESEND_API_KEY: apiKey
      ? `${apiKey.slice(0, 8)}… (${apiKey.length} chars)`
      : '⚠ MISSING',
    RESEND_FROM:    from,
  });
  console.log('[Resend] ─────────────────────────────────────────────────────');

  if (!apiKey) {
    console.error('[Resend] ❌ RESEND_API_KEY is not set.');
    console.error('[Resend]    1. Create a free account at https://resend.com');
    console.error('[Resend]    2. Generate an API key at https://resend.com/api-keys');
    console.error('[Resend]    3. Add RESEND_API_KEY to your Render environment variables.');
    return false;
  }

  if (!apiKey.startsWith('re_')) {
    console.error('[Resend] ❌ RESEND_API_KEY does not start with "re_" — it may be invalid.');
    console.error('[Resend]    Verify the key at https://resend.com/api-keys');
    return false;
  }

  if (isResendSandboxSender(from)) {
    console.error('[Resend] RESEND_FROM uses resend.dev, which is for testing only.');
    console.error('[Resend] To send OTPs to users, set RESEND_FROM to an address on a verified Resend domain.');
    return false;
  }

  if (!process.env.RESEND_FROM) {
    console.warn('[Resend] ⚠  RESEND_FROM is not set.');
    console.warn(`[Resend]    Using sandbox sender: ${from}`);
    console.warn('[Resend]    Sandbox emails only deliver to your Resend account email.');
    console.warn('[Resend]    To send to any address, verify a domain at https://resend.com/domains');
  }

  console.log('[Resend] ✅ Configuration looks valid — OTP emails should work.');
  return true;
};

module.exports = sendOtpEmail;
module.exports.verifyEmailConfig = verifyEmailConfig;

