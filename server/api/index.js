const app = require('../src/app');
const { connectDatabase } = require('../src/config/db');

module.exports = async (req, res) => {
  try {
    await connectDatabase();
  } catch (error) {
    console.error('[Vercel] Database connection error:', error.message);
  }

  return app(req, res);
};
