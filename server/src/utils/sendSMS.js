const twilio = require('twilio');

const hasTwilioConfig = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER,
  );

const normalizePhoneNumber = (phone) => {
  if (!phone) {
    return '';
  }

  const trimmedPhone = String(phone).trim();

  if (trimmedPhone.startsWith('+')) {
    return trimmedPhone;
  }

  const digitsOnly = trimmedPhone.replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return `+91${digitsOnly}`;
  }

  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return `+${digitsOnly}`;
  }

  return digitsOnly ? `+${digitsOnly}` : '';
};

let twilioClient = null;

const getTwilioClient = () => {
  if (!hasTwilioConfig()) {
    return null;
  }

  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  return twilioClient;
};

const sendSMS = async (phone, message) => {
  const client = getTwilioClient();
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!client) {
    console.warn('SMS skipped: Twilio credentials are missing.');
    return false;
  }

  if (!normalizedPhone) {
    console.warn('SMS skipped: Student phone number is missing or invalid.');
    return false;
  }

  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: normalizedPhone,
    });

    return true;
  } catch (error) {
    console.error('Twilio SMS send failed:', error.message);
    return false;
  }
};

module.exports = {
  hasTwilioConfig,
  normalizePhoneNumber,
  sendSMS,
};
