/**
 * User routes: sync Firebase user to PostgreSQL (users table).
 * Email/password auth is handled by Firebase; user records are stored in both Firebase and PG.
 */

import { Router } from 'express';
import crypto from 'crypto';
import { getPool, ensureUsersTable, ensureApiTokenTable, ensureSystemsConfigTable, ensureUserSystemPermissionsTable, ensureSystemSecretsTable, ensureSystemRequestLogTable } from '../config/db.js';
import { verifyIdToken } from '../config/firebaseAdmin.js';

const router = Router();
const EXPIRATION_OPTIONS = { '3d': 3, '7d': 7, '30d': 30, none: null };

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

async function requireAuthenticatedUser(req, res, next) {
  const idToken = getIdToken(req);
  if (!idToken) return res.status(401).json({ error: 'Missing ID token' });
  const verifyResult = await verifyIdToken(idToken);
  if (verifyResult.notConfigured) {
    return res.status(503).json({ error: 'Firebase Admin not configured. Add service account JSON to api-backend.' });
  }
  if (verifyResult.invalid || !verifyResult.decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  try {
    await ensureUsersTable();
    const pool = getPool();
    const result = await pool.query(
      'SELECT user_id, firebase_uid, role, email FROM users WHERE firebase_uid = $1',
      [verifyResult.decoded.uid]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'User not found in database. Call POST /api/users/sync first.' });
    req.currentUser = row;
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resolve user', detail: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
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

/** GET /api/users/api-tokens — list current user's API tokens */
router.get('/api-tokens', requireAuthenticatedUser, async (req, res) => {
  try {
    await ensureApiTokenTable();
    await ensureSystemsConfigTable();
    const pool = getPool();
    const result = await pool.query(
      `SELECT t.api_token_id, t.firebase_uid, t.token_name, t.token_prefix, t.permissions, t.expires_at, t.last_used_at, t.is_active, t.created_at,
              COALESCE(t.request_count, 0)::bigint AS request_count,
              COALESCE(t.total_response_time_ms, 0)::bigint AS total_response_time_ms,
              s.system_name AS system_name
       FROM api_token t
       LEFT JOIN systems_config s ON s.system_id = t.permissions
       WHERE t.firebase_uid = $1
       ORDER BY t.created_at DESC`,
      [req.currentUser.firebase_uid]
    );
    res.json({ tokens: result.rows });
  } catch (err) {
    console.error('users/api-tokens', err);
    res.status(500).json({ error: 'Failed to list tokens' });
  }
});

/** GET /api/users/dashboard-stats — user-scoped dashboard metrics */
router.get('/dashboard-stats', requireAuthenticatedUser, async (req, res) => {
  const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 7));
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().slice(0, 10);
  try {
    await ensureSystemsConfigTable();
    await ensureUserSystemPermissionsTable();
    await ensureSystemSecretsTable();
    await ensureApiTokenTable();
    await ensureSystemRequestLogTable();
    const pool = getPool();
    const scopeParams = [req.currentUser.firebase_uid, req.currentUser.user_id];
    const scopeWithDateParams = [req.currentUser.firebase_uid, req.currentUser.user_id, fromStr];

    const [systemsRes, secretsRes, tokenStatsRes, requestStatsRes, topSystemsRes, requestTrendsRes] = await Promise.all([
      pool.query(
        `WITH accessible_systems AS (
           SELECT DISTINCT s.system_id, s.is_active
           FROM systems_config s
           LEFT JOIN user_system_permissions usp ON usp.system_id = s.system_id AND usp.user_id = $2
           WHERE s.created_by_firebase_uid = $1 OR usp.permission_id IS NOT NULL
         )
         SELECT COUNT(*)::int AS total_systems,
                COUNT(*) FILTER (WHERE is_active = true)::int AS active_systems
         FROM accessible_systems`,
        scopeParams
      ),
      pool.query(
        `WITH accessible_systems AS (
           SELECT DISTINCT s.system_id
           FROM systems_config s
           LEFT JOIN user_system_permissions usp ON usp.system_id = s.system_id AND usp.user_id = $2
           WHERE s.created_by_firebase_uid = $1 OR usp.permission_id IS NOT NULL
         )
         SELECT COUNT(*)::int AS total_secrets
         FROM system_secrets ss
         JOIN accessible_systems a ON a.system_id = ss.system_id`,
        scopeParams
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total_tokens,
                COUNT(*) FILTER (WHERE is_active = true)::int AS active_tokens,
                COALESCE(SUM(COALESCE(request_count, 0)), 0)::bigint AS total_token_requests,
                COALESCE(SUM(COALESCE(total_response_time_ms, 0)), 0)::bigint AS total_response_time_ms
         FROM api_token
         WHERE firebase_uid = $1`,
        [req.currentUser.firebase_uid]
      ),
      pool.query(
        `WITH accessible_systems AS (
           SELECT DISTINCT s.system_id, s.api_path_slug
           FROM systems_config s
           LEFT JOIN user_system_permissions usp ON usp.system_id = s.system_id AND usp.user_id = $2
           WHERE s.created_by_firebase_uid = $1 OR usp.permission_id IS NOT NULL
         )
         SELECT COUNT(*)::bigint AS total_requests,
                COALESCE(ROUND(AVG(l.response_time_ms))::int, 0) AS avg_response_ms
         FROM system_request_log l
         JOIN accessible_systems a ON a.api_path_slug = l.system_slug
         WHERE l.created_at >= $3::timestamp`,
        scopeWithDateParams
      ),
      pool.query(
        `WITH accessible_systems AS (
           SELECT DISTINCT s.system_id, s.system_name, s.api_path_slug
           FROM systems_config s
           LEFT JOIN user_system_permissions usp ON usp.system_id = s.system_id AND usp.user_id = $2
           WHERE s.created_by_firebase_uid = $1 OR usp.permission_id IS NOT NULL
         )
         SELECT a.system_id, a.system_name, COUNT(l.log_id)::int AS requests
         FROM accessible_systems a
         LEFT JOIN system_request_log l
           ON l.system_slug = a.api_path_slug
          AND l.created_at >= $3::timestamp
         GROUP BY a.system_id, a.system_name
         ORDER BY requests DESC, a.system_name ASC
         LIMIT 5`,
        scopeWithDateParams
      ),
      pool.query(
        `WITH accessible_systems AS (
           SELECT DISTINCT s.api_path_slug
           FROM systems_config s
           LEFT JOIN user_system_permissions usp ON usp.system_id = s.system_id AND usp.user_id = $2
           WHERE s.created_by_firebase_uid = $1 OR usp.permission_id IS NOT NULL
         )
         SELECT DATE(l.created_at) AS date,
                COUNT(*)::int AS total_requests,
                COUNT(*) FILTER (WHERE l.status_code >= 200 AND l.status_code < 300)::int AS successful_requests,
                COUNT(*) FILTER (WHERE l.status_code >= 400 OR l.status_code IS NULL)::int AS failed_requests,
                COALESCE(ROUND(AVG(l.response_time_ms))::int, 0) AS avg_response_ms
         FROM system_request_log l
         JOIN accessible_systems a ON a.api_path_slug = l.system_slug
         WHERE l.created_at >= $3::timestamp
         GROUP BY DATE(l.created_at)
         ORDER BY DATE(l.created_at)`,
        scopeWithDateParams
      ),
    ]);

    const tokenStats = tokenStatsRes.rows[0] || {};
    const totalTokenRequests = Number(tokenStats.total_token_requests || 0);
    const totalResponseTimeMs = Number(tokenStats.total_response_time_ms || 0);
    const avgTokenResponseMs = totalTokenRequests > 0 ? Math.round(totalResponseTimeMs / totalTokenRequests) : 0;

    res.json({
      days,
      from_date: fromStr,
      systems: systemsRes.rows[0] || { total_systems: 0, active_systems: 0 },
      secrets: secretsRes.rows[0] || { total_secrets: 0 },
      tokens: {
        total_tokens: Number(tokenStats.total_tokens || 0),
        active_tokens: Number(tokenStats.active_tokens || 0),
        total_requests: totalTokenRequests,
        avg_response_ms: avgTokenResponseMs,
      },
      traffic: {
        total_requests: Number(requestStatsRes.rows[0]?.total_requests || 0),
        avg_response_ms: Number(requestStatsRes.rows[0]?.avg_response_ms || 0),
      },
      top_systems: topSystemsRes.rows || [],
      request_trends: requestTrendsRes.rows || [],
    });
  } catch (err) {
    console.error('users/dashboard-stats', err);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

/** POST /api/users/api-tokens — create token for one of current user's systems */
router.post('/api-tokens', requireAuthenticatedUser, async (req, res) => {
  const { token_name, system_id, expiration } = req.body || {};
  if (!token_name || typeof token_name !== 'string' || !token_name.trim()) {
    return res.status(400).json({ error: 'token_name is required' });
  }
  const systemId = Number(system_id);
  if (Number.isNaN(systemId)) return res.status(400).json({ error: 'system_id must be a number' });
  if (!expiration || !Object.prototype.hasOwnProperty.call(EXPIRATION_OPTIONS, expiration)) {
    return res.status(400).json({ error: 'expiration is required; use 3d, 7d, 30d, or none' });
  }
  try {
    await ensureApiTokenTable();
    await ensureSystemsConfigTable();
    await ensureUserSystemPermissionsTable();
    const pool = getPool();
    const ownSystem = req.currentUser.role === 'admin'
      ? await pool.query('SELECT system_id FROM systems_config WHERE system_id = $1', [systemId])
      : await pool.query(
        `SELECT s.system_id
         FROM systems_config s
         LEFT JOIN user_system_permissions usp ON usp.system_id = s.system_id AND usp.user_id = $2
         WHERE s.system_id = $1
           AND (s.created_by_firebase_uid = $3 OR usp.permission_id IS NOT NULL)`,
        [systemId, req.currentUser.user_id, req.currentUser.firebase_uid]
      );
    if (!ownSystem.rows[0]) return res.status(403).json({ error: 'You can only create tokens for your systems' });

    const days = EXPIRATION_OPTIONS[expiration];
    let expiresAt = null;
    if (days != null) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      expiresAt = expiresAt.toISOString();
    }
    const plainToken = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
    const tokenPrefix = plainToken.slice(0, 12);
    const result = await pool.query(
      `INSERT INTO api_token (firebase_uid, token_name, token_hash, token_prefix, permissions, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING api_token_id, firebase_uid, token_name, token_prefix, permissions, expires_at, is_active, created_at`,
      [req.currentUser.firebase_uid, token_name.trim(), tokenHash, tokenPrefix, systemId, expiresAt]
    );
    res.status(201).json({ ...result.rows[0], token: plainToken, message: 'Copy the token now; it will not be shown again.' });
  } catch (err) {
    console.error('users/create-token', err);
    res.status(500).json({ error: 'Failed to create token' });
  }
});

/** PATCH /api/users/api-tokens/:id — revoke own token */
router.patch('/api-tokens/:id', requireAuthenticatedUser, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid token id' });
  try {
    const pool = getPool();
    const result = await pool.query(
      'UPDATE api_token SET is_active = false WHERE api_token_id = $1 AND firebase_uid = $2 RETURNING api_token_id, is_active',
      [id, req.currentUser.firebase_uid]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Token not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('users/revoke-token', err);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

/** DELETE /api/users/api-tokens/:id — delete own token */
router.delete('/api-tokens/:id', requireAuthenticatedUser, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid token id' });
  try {
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM api_token WHERE api_token_id = $1 AND firebase_uid = $2 RETURNING api_token_id',
      [id, req.currentUser.firebase_uid]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Token not found' });
    res.json({ deleted: true, api_token_id: result.rows[0].api_token_id });
  } catch (err) {
    console.error('users/delete-token', err);
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

export default router;
