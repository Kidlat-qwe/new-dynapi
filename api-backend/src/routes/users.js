/**
 * User routes: sync Firebase user to PostgreSQL (users table).
 * Email/password auth is handled by Firebase; user records are stored in both Firebase and PG.
 */

import { Router } from 'express';
import { getPool, ensureUsersTable } from '../config/db.js';
import { verifyIdToken } from '../config/firebaseAdmin.js';

const router = Router();

/**
 * Extract Bearer token from Authorization header or body.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getIdToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return req.body?.idToken ?? null;
}

/**
 * POST /api/users/sync
 * Verify Firebase ID token and upsert user into PostgreSQL (users table).
 * Body (optional): { fname, lname, role } — used on insert or to update profile.
 * On conflict (firebase_uid): update last_login and optionally fname, lname, role.
 */
router.post('/sync', async (req, res) => {
  const idToken = getIdToken(req);
  if (!idToken) {
    return res.status(401).json({ error: 'Missing ID token (Authorization: Bearer <token> or body.idToken)' });
  }

  const verifyResult = await verifyIdToken(idToken);
  if (verifyResult.notConfigured) {
    return res.status(503).json({ error: 'Firebase Admin not configured. Add service account JSON to api-backend.' });
  }
  if (verifyResult.invalid) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      hint: process.env.NODE_ENV !== 'production' ? verifyResult.message : undefined,
    });
  }
  const { uid, email } = verifyResult.decoded;
  const { fname, lname, role } = req.body || {};

  try {
    await ensureUsersTable();
  } catch (err) {
    console.error('users/sync ensureUsersTable', err);
    return res.status(503).json({ error: 'Database not ready', detail: err.message });
  }

  const pool = getPool();
  try {
    const result = await pool.query(
      `INSERT INTO users (email, fname, lname, role, firebase_uid, last_login)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (firebase_uid)
       DO UPDATE SET
         last_login = CURRENT_TIMESTAMP,
         email = COALESCE(EXCLUDED.email, users.email),
         fname = COALESCE(NULLIF($2, ''), users.fname),
         lname = COALESCE(NULLIF($3, ''), users.lname),
         role = COALESCE(NULLIF($4, ''), users.role)
       RETURNING user_id, email, fname, lname, role, firebase_uid, last_login, created_at`,
      [email || '', fname ?? '', lname ?? '', role ?? 'user', uid]
    );

    const row = result.rows[0];
    res.json({
      user_id: row.user_id,
      email: row.email,
      fname: row.fname,
      lname: row.lname,
      role: row.role,
      firebase_uid: row.firebase_uid,
      last_login: row.last_login,
      created_at: row.created_at,
    });
  } catch (err) {
    console.error('users/sync', err.code || err.message, err);
    if (err.code === '42P01') {
      return res.status(503).json({
        error: 'Users table not found. Run the schema in docs/database.md on your PostgreSQL database.',
      });
    }
    res.status(500).json({
      error: 'Failed to sync user',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

/**
 * GET /api/users/me
 * Return current user from PG by Firebase ID token.
 * Use to get role and profile from DB (e.g. after page load).
 */
router.get('/me', async (req, res) => {
  const idToken = getIdToken(req);
  if (!idToken) {
    return res.status(401).json({ error: 'Missing ID token' });
  }

  const verifyResult = await verifyIdToken(idToken);
  if (verifyResult.notConfigured) {
    return res.status(503).json({ error: 'Firebase Admin not configured. Add service account JSON to api-backend.' });
  }
  if (verifyResult.invalid) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      hint: process.env.NODE_ENV !== 'production' ? verifyResult.message : undefined,
    });
  }
  const decoded = verifyResult.decoded;

  try {
    await ensureUsersTable();
  } catch (err) {
    console.error('users/me ensureUsersTable', err);
    return res.status(503).json({ error: 'Database not ready', detail: err.message });
  }

  const pool = getPool();
  try {
    const result = await pool.query(
      'SELECT user_id, email, fname, lname, role, firebase_uid, last_login, created_at FROM users WHERE firebase_uid = $1',
      [decoded.uid]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'User not found in database. Call POST /api/users/sync first.' });
    }
    res.json({
      user_id: row.user_id,
      email: row.email,
      fname: row.fname,
      lname: row.lname,
      role: row.role,
      firebase_uid: row.firebase_uid,
      last_login: row.last_login,
      created_at: row.created_at,
    });
  } catch (err) {
    console.error('users/me', err.code || err.message, err);
    if (err.code === '42P01') {
      return res.status(503).json({ error: 'Users table not found' });
    }
    res.status(500).json({
      error: 'Failed to fetch user',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

export default router;
