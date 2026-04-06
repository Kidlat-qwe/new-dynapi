/**
 * Simple logger for api-backend (info, warn, error).
 */

function log(level, ...args) {
  const prefix = `[${new Date().toISOString()}] [${level}]`;
  if (level === 'error') {
    console.error(prefix, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

export default {
  info(...args) {
    log('INFO', ...args);
  },
  warn(...args) {
    log('WARN', ...args);
  },
  error(...args) {
    log('ERROR', ...args);
  },
};
