const nodemailer = require('nodemailer');
const OTP_EMAIL_TIMEOUT_MS = 12000;

const getEmailConfig = () => {
  const user = String(process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  const pass = String(process.env.EMAIL_PASS || process.env.SMTP_PASS || '')
    .replace(/\s+/g, '')
    .trim();
  const from = String(
    process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      (user ? `Campus Canteen Hub <${user}>` : ''),
  ).trim();

  return { user, pass, from };
};

const buildTransporter = () => {
  const { user, pass } = getEmailConfig();

  if (!user || !pass) {
    throw new Error('Email OTP is not configured. Add EMAIL_USER and EMAIL_PASS to the server environment.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: OTP_EMAIL_TIMEOUT_MS,
    greetingTimeout: OTP_EMAIL_TIMEOUT_MS,
    socketTimeout: OTP_EMAIL_TIMEOUT_MS,
    auth: {
      user,
      pass,
    },
  });
};

const withTimeout = (promise, timeoutMessage) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), OTP_EMAIL_TIMEOUT_MS);
    }),
  ]);

const sendOtpEmail = async ({ email, name, otp }) => {
  const transporter = buildTransporter();
  const { from } = getEmailConfig();

  try {
    await withTimeout(
      transporter.sendMail({
        from,
        to: email,
        subject: 'Campus Canteen Hub OTP',
        text: `Hello ${name}, your Campus Canteen Hub verification code is ${otp}. It will expire in 5 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #24382f;">
            <h2 style="margin-bottom: 12px;">Campus Canteen Hub</h2>
            <p style="margin-bottom: 18px;">Hello ${name}, use this OTP to complete your login.</p>
            <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 18px 22px; border-radius: 16px; background: #eef9f2; color: #1f6f4a; text-align: center;">
              ${otp}
            </div>
            <p style="margin-top: 18px;">This OTP expires in 5 minutes.</p>
            <p style="margin-top: 8px; color: #68756f;">If you did not request this code, you can ignore this email.</p>
          </div>
        `,
      }),
      'OTP email request timed out.',
    );
  } catch (error) {
    console.error('OTP email send failed:', error.message);
    throw new Error(
      'Unable to send OTP right now. Please check your email setup and try again.',
    );
  } finally {
    transporter.close();
  }
};

const verifyOtpEmailTransport = async () => {
  const transporter = buildTransporter();

  try {
    await withTimeout(transporter.verify(), 'OTP email SMTP verification timed out.');
    return true;
  } finally {
    transporter.close();
  }
};

module.exports = sendOtpEmail;
module.exports.verifyOtpEmailTransport = verifyOtpEmailTransport;
module.exports.getEmailConfig = getEmailConfig;
