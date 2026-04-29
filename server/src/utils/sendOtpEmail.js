const nodemailer = require('nodemailer');

const buildTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email OTP is not configured. Add SMTP settings to the server environment.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    family: 4,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    dnsTimeout: 10000,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const sendOtpEmail = async ({ email, name, otp }) => {
  const transporter = buildTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Your Campus Canteen Hub login OTP',
      text: `Hello ${name}, your login OTP is ${otp}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #24382f;">
          <h2 style="margin-bottom: 12px;">Campus Canteen Hub</h2>
          <p style="margin-bottom: 18px;">Hello ${name}, use this OTP to complete your login.</p>
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 18px 22px; border-radius: 16px; background: #eef9f2; color: #1f6f4a; text-align: center;">
            ${otp}
          </div>
          <p style="margin-top: 18px;">This OTP expires in 10 minutes.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('OTP email send failed:', error.message);
    throw new Error(
      'Unable to send OTP right now. Please check your email setup and try again.',
    );
  } finally {
    transporter.close();
  }
};

module.exports = sendOtpEmail;
