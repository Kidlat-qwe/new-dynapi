/**
 * Optional middleware: when Bearer token is a user token (not sk_*) and X-User-Email is present,
 * set req.user.email so the api-backend can log the actual user in system_request_log.
 * Does not block the request. The authenticate middleware will overwrite req.user when JWT is valid.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function setCurrentUserForLogging(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.slice(7).trim();
    if (!token || token.startsWith('sk_')) return next();

    const headerEmail = (req.headers['x-user-email'] || '').trim();
    if (headerEmail && EMAIL_REGEX.test(headerEmail)) {
      req.user = { email: headerEmail };
    }
  } catch (err) {
    console.warn('setCurrentUserForLogging:', err.message);
  }
  next();
}
