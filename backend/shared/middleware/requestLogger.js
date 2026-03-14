import { logger } from '../utils/logger.js';

/**
 * Request/Response logging middleware for API debugging (dev only for performance).
 * Logs: method, path, status code, duration.
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const path = req.originalUrl || req.url;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.log(`[API] ${req.method} ${path} → ${res.statusCode} ${duration}ms`);
    if (res.statusCode >= 400) {
      logger.warn(`[API] Error: ${res.statusCode} for ${req.method} ${path}`);
    }
  });

  next();
};

export default requestLogger;
