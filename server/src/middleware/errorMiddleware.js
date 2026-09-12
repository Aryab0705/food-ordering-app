const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Errors thrown by Mongoose, jsonwebtoken or cors carry no res.status(), so
// without this mapping every one of them surfaced to the client as a 500.
const resolveStatusCode = (error, res) => {
  if (error.status || error.statusCode) {
    return error.status || error.statusCode;
  }

  // Malformed ObjectId in a param or body — a bad request, not a server fault.
  if (error.name === 'CastError' || error.name === 'ValidationError') {
    return 400;
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return 401;
  }

  // Unique index violation: duplicate email, duplicate review, etc.
  if (error.code === 11000) {
    return 409;
  }

  return res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
};

const isDatabaseTransportError = (error) => (
  error?.name === 'MongoNetworkError'
  || error?.name === 'MongoServerSelectionError'
  || /(?:tlsv1 alert|ssl routines|connection pool .* cleared|topology was destroyed)/i.test(
    error?.message || '',
  )
);

const errorHandler = (error, req, res, next) => {
  const databaseTransportError = isDatabaseTransportError(error);
  const statusCode = databaseTransportError ? 503 : resolveStatusCode(error, res);

  console.error(`[error] ${req.method} ${req.originalUrl} ${statusCode}: ${error.message}`);

  res.status(statusCode).json({
    // Atlas transport failures contain OpenSSL internals that are neither useful
    // nor safe to display to a customer. The connection monitor will retry while
    // the user receives an actionable response instead.
    message: databaseTransportError
      ? 'The database connection was interrupted. Please retry in a few seconds.'
      : error.message,
    // Fail closed: hosts often leave NODE_ENV unset, and the old check leaked
    // stack traces to the browser whenever it was anything but "production".
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
};

module.exports = {
  notFound,
  errorHandler,
};
