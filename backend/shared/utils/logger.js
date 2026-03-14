/**
 * Lightweight logger - only outputs in development to reduce noise and slight perf cost in production.
 * Use for request logging, debug, and non-critical traces. Critical errors can still use console.error.
 */
const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args) => { if (isDev) console.log(...args); },
  warn: (...args) => { if (isDev) console.warn(...args); },
  info: (...args) => { if (isDev) console.info(...args); },
  debug: (...args) => { if (isDev) console.debug(...args); },
  error: (...args) => console.error(...args), // Always log errors
};

export default logger;
