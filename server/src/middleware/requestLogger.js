const SLOW_REQUEST_MS = 3000;

const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const roundedElapsedMs = Math.round(elapsedMs);
    const slowMarker = elapsedMs >= SLOW_REQUEST_MS ? ' slow' : '';
    const origin = req.get('origin') || 'no-origin';

    console.log(
      `[request${slowMarker}] ${req.method} ${req.originalUrl} ${res.statusCode} ${roundedElapsedMs}ms origin=${origin}`,
    );
  });

  next();
};

module.exports = requestLogger;
