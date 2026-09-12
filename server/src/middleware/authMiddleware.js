const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('Not authorized, token missing');
  }

  const token = authHeader.split(' ')[1];

  if (!process.env.JWT_SECRET) {
    res.status(500);
    throw new Error('JWT_SECRET is not configured');
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // An expired or tampered token is a client-side auth problem. Letting
    // jwt.verify throw uncaught produced a 500, so the browser could never
    // tell "logged out" apart from "server broken" and never cleared the session.
    res.status(401);
    throw new Error('Not authorized, token failed');
  }

  req.user = await User.findById(decoded.userId).select('-password -loginOtpHash -loginOtpExpiresAt -loginOtpAttempts');

  if (!req.user) {
    res.status(401);
    throw new Error('Not authorized, user not found');
  }

  next();
});

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    res.status(403);
    throw new Error('You do not have access to this resource');
  }

  next();
};

module.exports = {
  protect,
  authorize,
};
