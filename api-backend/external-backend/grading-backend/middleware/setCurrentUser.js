/**
 * Optional middleware: when Bearer token is present (Firebase or JWT from grading login),
 * resolve the current user from the grading DB and set req.user.email so the api-backend
 * can log the actual user in system_request_log (instead of the API token owner).
 * Fallback: when Bearer is a user token (not sk_*) but verification fails, use X-User-Email
 * header if present (frontend sends when logged in). Does not block the request.
 */

import jwt from 'jsonwebtoken';
import { getGradingAdmin } from '../config/firebase.js';
import { pool } from '../db.js';

const JWT_SECRET = process.env.GRADING_JWT_SECRET || 'your_jwt_secret';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function setCurrentUserForLogging(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.slice(7).trim();
    if (!token || token.startsWith('sk_')) return next();

    let email = null;

    // Try Firebase ID token first (grading frontend may send userToken)
    const gradingAdmin = getGradingAdmin();
    if (gradingAdmin) {
      try {
        const decoded = await gradingAdmin.auth().verifyIdToken(token);
        const uid = decoded.uid;
        const r = await pool.query('SELECT email FROM users WHERE firebase_uid = $1 LIMIT 1', [uid]);
        if (r.rows.length > 0) email = r.rows[0].email;
      } catch {
        // not a valid Firebase token, try JWT below
      }
    }

    // Try JWT from grading /auth/login
    if (!email && token.includes('.')) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        const userId = payload.id || payload.user_id;
        if (userId) {
          const r = await pool.query('SELECT email FROM users WHERE user_id = $1 LIMIT 1', [userId]);
          if (r.rows.length > 0) email = r.rows[0].email;
        }
      } catch {
        // ignore
      }
    }

    // Fallback: X-User-Email when Bearer is a user token but verification failed (e.g. Firebase not configured, token expired)
    if (!email) {
      const headerEmail = (req.headers['x-user-email'] || '').trim();
      if (headerEmail && EMAIL_REGEX.test(headerEmail)) email = headerEmail;
    }

    if (email) req.user = { email };
  } catch (err) {
    console.warn('setCurrentUserForLogging:', err.message);
  }
  next();
}
