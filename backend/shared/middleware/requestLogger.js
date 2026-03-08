/**
 * Request/Response logging middleware for API debugging.
 * Helps detect if Flutter/mobile clients are hitting the server correctly.
 * Logs: method, path, origin, auth presence, status code, duration.
 */

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const path = req.originalUrl || req.url;
  const origin = req.headers.origin || req.headers.Origin || '(no origin)';
  const hasAuth = !!(req.headers.authorization || req.headers.Authorization);
  const hasRefresh = !!(req.headers['x-refresh-token'] || req.headers['X-Refresh-Token']);

  // Log immediately when request arrives (so we see it even if response hangs)
  console.log(`[API] IN  ${req.method} ${path} origin=${origin}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API] OUT ${req.method} ${path} → ${res.statusCode} ${duration}ms`);
    if (res.statusCode >= 400) {
      console.warn(`[API] Error: ${res.statusCode} for ${req.method} ${path}`);
    }
  });

  next();
};

export default requestLogger;
