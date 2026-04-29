/**
 * Admin-only routes: list/update users, list/create/revoke API tokens.
 * Requires Bearer token and role admin in DB.
 */

import { Router } from 'express';
import crypto from 'crypto';
import { getPool, ensureUsersTable, ensureApiTokenTable, ensureSystemsConfigTable, ensureSystemRequestLogTable, ensureUserSystemPermissionsTable } from '../config/db.js';
import { admin, verifyIdToken, initializeFirebaseAdmin } from '../config/firebaseAdmin.js';

const router = Router();
async function syncUserSystemPermissions(pool, userId, systemIds = []) {
  await pool.query('DELETE FROM user_system_permissions WHERE user_id = $1', [userId]);
  for (const sid of systemIds) {
    await pool.query(
      'INSERT INTO user_system_permissions (user_id, system_id) VALUES ($1, $2) ON CONFLICT (user_id, system_id) DO NOTHING',
      [userId, sid]
    );
  }
}

function getIdToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/** Require valid Firebase token and admin role in DB. Sets req.adminUser. */
async function requireAdmin(req, res, next) {
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
    return res.status(503).json({ error: 'Database not ready', detail: err.message });
  }

  const pool = getPool();
  const userResult = await pool.query(
    'SELECT user_id, role, firebase_uid FROM users WHERE firebase_uid = $1',
    [decoded.uid]
  );
  const row = userResult.rows[0];
  if (!row || row.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  req.adminUser = row;
  next();
}

/** GET /api/admin/users — list all users */
router.get('/users', requireAdmin, async (req, res) => {
  const pool = getPool();
  try {
    await ensureSystemsConfigTable();
    await ensureUserSystemPermissionsTable();
    const result = await pool.query(
      `SELECT u.user_id, u.email, u.fname, u.lname, u.role, u.firebase_uid, u.last_login, u.is_active, u.created_at,
              COALESCE(
                json_agg(
                  json_build_object('system_id', s.system_id, 'system_name', s.system_name)
                ) FILTER (WHERE s.system_id IS NOT NULL),
                '[]'::json
              ) AS system_permissions
       FROM users u
       LEFT JOIN user_system_permissions usp ON usp.user_id = u.user_id
       LEFT JOIN systems_config s ON s.system_id = usp.system_id
       GROUP BY u.user_id
       ORDER BY u.created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('admin/users', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/** POST /api/admin/users — create a user row */
router.post('/users', requireAdmin, async (req, res) => {
  const { email, fname, lname, role, is_active, password, system_permissions } = req.body || {};
  const normalizedEmail = String(email || '').trim();
  const normalizedRole = String(role || 'user').trim() || 'user';
  if (!normalizedEmail) return res.status(400).json({ error: 'email is required' });
  if (!['admin', 'user'].includes(normalizedRole)) {
    return res.status(400).json({ error: 'role must be admin or user' });
  }
  initializeFirebaseAdmin();
  if (!admin.apps.length) {
    return res.status(503).json({ error: 'Firebase Admin not configured' });
  }
  let normalizedUid = '';
  let createdFirebaseUser = false;
  try {
    const fbUser = await admin.auth().getUserByEmail(normalizedEmail);
    normalizedUid = fbUser.uid;
  } catch {
    const normalizedPassword = String(password || '').trim();
    if (!normalizedPassword || normalizedPassword.length < 6) {
      return res.status(400).json({ error: 'Password (min 6 chars) is required for new Firebase account' });
    }
    try {
      const created = await admin.auth().createUser({
        email: normalizedEmail,
        password: normalizedPassword,
        disabled: is_active !== undefined ? !Boolean(is_active) : false,
      });
      normalizedUid = created.uid;
      createdFirebaseUser = true;
    } catch (firebaseCreateErr) {
      console.error('admin/create user firebase', firebaseCreateErr);
      return res.status(400).json({ error: 'Failed to create Firebase account' });
    }
  }
  const pool = getPool();
  try {
    await ensureSystemsConfigTable();
    await ensureUserSystemPermissionsTable();
    const result = await pool.query(
      `INSERT INTO users (email, fname, lname, role, firebase_uid, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING user_id, email, fname, lname, role, firebase_uid, last_login, is_active, created_at`,
      [
        normalizedEmail,
        fname != null ? String(fname).trim() : null,
        lname != null ? String(lname).trim() : null,
        normalizedRole,
        normalizedUid,
        is_active !== undefined ? Boolean(is_active) : true,
      ]
    );
    const createdUser = result.rows[0];
    const permissionIds = Array.isArray(system_permissions)
      ? [...new Set(system_permissions.map((v) => Number(v)).filter((n) => !Number.isNaN(n)))]
      : [];
    if (permissionIds.length) {
      const validSystems = await pool.query(
        'SELECT system_id FROM systems_config WHERE system_id = ANY($1::int[])',
        [permissionIds]
      );
      await syncUserSystemPermissions(pool, createdUser.user_id, validSystems.rows.map((r) => r.system_id));
    }
    res.status(201).json({ ...createdUser, created_firebase_user: createdFirebaseUser });
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'email or firebase_uid already exists' });
    }
    console.error('admin/create user', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/** PATCH /api/admin/users/:id — update user profile/role/status/permissions */
router.patch('/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
  const { email, fname, lname, role, is_active, password, system_permissions } = req.body || {};
  const updates = [];
  const values = [];
  let i = 1;
  if (email !== undefined) {
    updates.push(`email = $${i++}`);
    values.push(email ? String(email).trim() : null);
  }
  if (fname !== undefined) {
    updates.push(`fname = $${i++}`);
    values.push(fname != null ? String(fname).trim() : null);
  }
  if (lname !== undefined) {
    updates.push(`lname = $${i++}`);
    values.push(lname != null ? String(lname).trim() : null);
  }
  if (role !== undefined) {
    updates.push(`role = $${i++}`);
    values.push(role);
  }
  if (is_active !== undefined) {
    updates.push(`is_active = $${i++}`);
    values.push(Boolean(is_active));
  }
  if (updates.length === 0 && system_permissions === undefined && !password) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  values.push(id);
  const pool = getPool();
  try {
    await ensureUserSystemPermissionsTable();
    let row;
    if (updates.length > 0) {
      const result = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${i} RETURNING user_id, email, fname, lname, role, firebase_uid, last_login, is_active, created_at`,
        values
      );
      row = result.rows[0];
    } else {
      const existing = await pool.query(
        'SELECT user_id, email, fname, lname, role, firebase_uid, last_login, is_active, created_at FROM users WHERE user_id = $1',
        [id]
      );
      row = existing.rows[0];
    }
    if (!row) return res.status(404).json({ error: 'User not found' });
    initializeFirebaseAdmin();
    if (admin.apps.length) {
      const fbUpdate = {};
      if (email !== undefined && row.email) fbUpdate.email = row.email;
      if (password && String(password).trim().length >= 6) fbUpdate.password = String(password).trim();
      if (Object.keys(fbUpdate).length) {
        await admin.auth().updateUser(row.firebase_uid, fbUpdate);
      }
    }
    if (system_permissions !== undefined) {
      const permissionIds = Array.isArray(system_permissions)
        ? [...new Set(system_permissions.map((v) => Number(v)).filter((n) => !Number.isNaN(n)))]
        : [];
      const validSystems = permissionIds.length
        ? await pool.query('SELECT system_id FROM systems_config WHERE system_id = ANY($1::int[])', [permissionIds])
        : { rows: [] };
      await syncUserSystemPermissions(pool, row.user_id, validSystems.rows.map((r) => r.system_id));
    }
    res.json(row);
  } catch (err) {
    console.error('admin/patch user', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/** DELETE /api/admin/users/:id — remove user and related permissions */
router.delete('/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
  const pool = getPool();
  try {
    const existing = await pool.query('SELECT firebase_uid FROM users WHERE user_id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'User not found' });
    await pool.query('DELETE FROM users WHERE user_id = $1', [id]);
    initializeFirebaseAdmin();
    if (admin.apps.length) {
      await admin.auth().deleteUser(existing.rows[0].firebase_uid).catch(() => {});
    }
    res.json({ deleted: true, user_id: id });
  } catch (err) {
    console.error('admin/delete user', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/** GET /api/admin/system-logs — paginated list of API requests to external systems (admin only). */
router.get('/system-logs', requireAdmin, async (req, res) => {
  try {
    await ensureSystemRequestLogTable();
  } catch (err) {
    return res.status(503).json({ error: 'Database not ready', detail: err.message });
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const systemSlug = req.query.system_slug && String(req.query.system_slug).trim();
  const userEmail = req.query.user_email && String(req.query.user_email).trim();
  const fromDate = req.query.from_date && String(req.query.from_date).trim();
  const toDate = req.query.to_date && String(req.query.to_date).trim();

  const pool = getPool();
  const conditions = [];
  const values = [];
  let idx = 1;
  if (systemSlug) {
    conditions.push(`l.system_slug = $${idx++}`);
    values.push(systemSlug);
  }
  if (userEmail) {
    conditions.push(`l.user_email ILIKE $${idx++}`);
    values.push(`%${userEmail}%`);
  }
  if (fromDate) {
    conditions.push(`l.created_at >= $${idx++}::timestamp`);
    values.push(fromDate);
  }
  if (toDate) {
    conditions.push(`l.created_at <= $${idx++}::timestamp`);
    values.push(toDate);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM system_request_log l ${where}`,
      values
    );
    const total = countResult.rows[0]?.total ?? 0;

    const result = await pool.query(
      `SELECT l.log_id, l.api_token_id, l.user_email, l.system_slug, s.system_name,
              l.method, l.route, l.status_code, l.response_time_ms, l.created_at
       FROM system_request_log l
       LEFT JOIN systems_config s ON s.api_path_slug = l.system_slug
       ${where}
       ORDER BY l.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );
    res.json({
      logs: result.rows,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error('admin/system-logs', err);
    res.status(500).json({ error: 'Failed to load system logs' });
  }
});

/** GET /api/admin/dashboard-stats — aggregate stats for admin dashboard (systems, requests, users, charts). */
router.get('/dashboard-stats', requireAdmin, async (req, res) => {
  try {
    await ensureSystemsConfigTable();
    await ensureSystemRequestLogTable();
  } catch (err) {
    return res.status(503).json({ error: 'Database not ready', detail: err.message });
  }
  const pool = getPool();
  const days = Math.min(14, Math.max(7, parseInt(req.query.days, 10) || 7));
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().slice(0, 10);

  try {
    const [systemsRes, requestsRes, usersRes, distRes, trendsRes, responseTimeRes, activityRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_active = true)::int AS active FROM systems_config`
      ),
      pool.query(
        `SELECT COUNT(*)::bigint AS total FROM system_request_log WHERE created_at >= $1::timestamp`,
        [fromStr]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT TRIM(user_email))::int AS cnt
         FROM system_request_log
         WHERE created_at >= $1::timestamp
           AND NULLIF(TRIM(user_email), '') IS NOT NULL`,
        [fromStr]
      ),
      pool.query(
        `SELECT COALESCE(s.system_name, l.system_slug) AS system_name, l.system_slug, COUNT(*)::int AS count
         FROM system_request_log l
         LEFT JOIN systems_config s ON s.api_path_slug = l.system_slug
         WHERE l.created_at >= $1::timestamp
         GROUP BY l.system_slug, s.system_name
         ORDER BY count DESC`,
        [fromStr]
      ),
      pool.query(
        `SELECT DATE(created_at) AS date,
          COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300)::int AS successful,
          COUNT(*) FILTER (WHERE status_code >= 400 OR status_code IS NULL)::int AS errors,
          COUNT(*)::int AS total
         FROM system_request_log WHERE created_at >= $1::timestamp
         GROUP BY DATE(created_at) ORDER BY date`,
        [fromStr]
      ),
      pool.query(
        `SELECT DATE(created_at) AS date,
          ROUND(AVG(response_time_ms))::int AS avg_ms,
          COALESCE(MAX(response_time_ms), 0)::int AS max_ms
         FROM system_request_log WHERE created_at >= $1::timestamp AND response_time_ms IS NOT NULL
         GROUP BY DATE(created_at) ORDER BY date`,
        [fromStr]
      ),
      pool.query(
        `SELECT DATE(created_at) AS date,
          COUNT(DISTINCT TRIM(user_email)) FILTER (WHERE NULLIF(TRIM(user_email), '') IS NOT NULL)::int AS active_users,
          COUNT(*)::int AS total_requests
         FROM system_request_log WHERE created_at >= $1::timestamp
         GROUP BY DATE(created_at) ORDER BY date`,
        [fromStr]
      ),
    ]);

    const systemsRow = systemsRes.rows[0];
    const totalSystems = Number(systemsRow?.total) || 0;
    const activeSystems = Number(systemsRow?.active) || 0;
    const totalRequests = Number(requestsRes.rows[0]?.total) || 0;
    const totalUsers = Number(usersRes.rows[0]?.cnt) || 0;

    const systemDistribution = (distRes.rows || []).map((r) => ({
      system_name: r.system_name || r.system_slug || 'Unknown',
      system_slug: r.system_slug,
      count: Number(r.count) || 0,
    }));

    const requestTrends = (trendsRes.rows || []).map((r) => ({
      date: r.date,
      successful: Number(r.successful) || 0,
      errors: Number(r.errors) || 0,
      total: Number(r.total) || 0,
    }));

    const responseTimeTrends = (responseTimeRes.rows || []).map((r) => ({
      date: r.date,
      avg_ms: Number(r.avg_ms) || 0,
      max_ms: Number(r.max_ms) || 0,
    }));

    const userActivity = (activityRes.rows || []).map((r) => ({
      date: r.date,
      active_users: Number(r.active_users) || 0,
      total_requests: Number(r.total_requests) || 0,
    }));

    res.json({
      total_systems: totalSystems,
      active_systems: activeSystems,
      total_requests: totalRequests,
      total_users: totalUsers,
      system_distribution: systemDistribution,
      request_trends: requestTrends,
      response_time_trends: responseTimeTrends,
      user_activity: userActivity,
      from_date: fromStr,
      days,
    });
  } catch (err) {
    console.error('admin/dashboard-stats', err);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

/** GET /api/admin/api-tokens/stats — aggregate stats for dashboard cards (total, active, requests, avg response time). */
router.get('/api-tokens/stats', requireAdmin, async (req, res) => {
  try {
    await ensureApiTokenTable();
  } catch (err) {
    return res.status(503).json({ error: 'Database not ready', detail: err.message });
  }
  const pool = getPool();
  try {
    const r = await pool.query(
      `SELECT
        COUNT(*)::int AS total_tokens,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active_tokens,
        COALESCE(SUM(COALESCE(request_count, 0)), 0)::bigint AS total_requests,
        COALESCE(SUM(COALESCE(total_response_time_ms, 0)), 0)::bigint AS total_response_time_ms
       FROM api_token`
    );
    const row = r.rows[0];
    const totalRequests = Number(row?.total_requests) || 0;
    const totalTimeMs = Number(row?.total_response_time_ms) || 0;
    const avgResponseTimeMs = totalRequests > 0 ? Math.round(totalTimeMs / totalRequests) : null;
    res.json({
      total_tokens: Number(row?.total_tokens) || 0,
      active_tokens: Number(row?.active_tokens) || 0,
      total_requests: totalRequests,
      avg_response_time_ms: avgResponseTimeMs,
    });
  } catch (err) {
    if (err.code === '42P01') return res.status(503).json({ error: 'api_token table missing' });
    console.error('admin/api-tokens/stats', err);
    res.status(500).json({ error: 'Failed to load token stats' });
  }
});

/** GET /api/admin/api-tokens — list API tokens with user email and system name */
router.get('/api-tokens', requireAdmin, async (req, res) => {
  try {
    await ensureApiTokenTable();
    await ensureSystemsConfigTable();
  } catch (err) {
    return res.status(503).json({ error: 'Database not ready', detail: err.message });
  }
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT t.api_token_id, t.firebase_uid, t.token_name, t.token_prefix, t.permissions, t.expires_at, t.last_used_at, t.is_active, t.created_at,
        COALESCE(t.request_count, 0)::bigint AS request_count,
        COALESCE(t.total_response_time_ms, 0)::bigint AS total_response_time_ms,
        u.email AS user_email,
        s.system_name AS system_name
       FROM api_token t
       LEFT JOIN users u ON u.firebase_uid = t.firebase_uid
       LEFT JOIN systems_config s ON s.system_id = t.permissions
       ORDER BY t.created_at DESC`
    );
    res.json({ tokens: result.rows });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({ error: 'api_token or systems_config table missing' });
    }
    console.error('admin/api-tokens', err);
    res.status(500).json({ error: 'Failed to list tokens' });
  }
});

const EXPIRATION_OPTIONS = {
  '3d': 3,
  '7d': 7,
  '30d': 30,
  none: null,
};

/** POST /api/admin/api-tokens — create API token. Body: token_name, system_id, expiration (3d|7d|30d|none). All required. Returns plain token once. */
router.post('/api-tokens', requireAdmin, async (req, res) => {
  try {
    await ensureApiTokenTable();
  } catch (err) {
    return res.status(503).json({ error: 'Database not ready', detail: err.message });
  }
  const { token_name, system_id, expiration } = req.body || {};
  if (!token_name || typeof token_name !== 'string' || !token_name.trim()) {
    return res.status(400).json({ error: 'token_name is required' });
  }
  if (system_id === undefined || system_id === null || system_id === '') {
    return res.status(400).json({ error: 'system_id is required' });
  }
  const systemId = Number(system_id);
  if (Number.isNaN(systemId)) {
    return res.status(400).json({ error: 'system_id must be a number' });
  }
  if (!expiration || !Object.prototype.hasOwnProperty.call(EXPIRATION_OPTIONS, expiration)) {
    return res.status(400).json({ error: 'expiration is required; use 3d, 7d, 30d, or none' });
  }
  const days = EXPIRATION_OPTIONS[expiration];
  let expiresAt = null;
  if (days != null) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    expiresAt = expiresAt.toISOString();
  }
  const firebase_uid = req.adminUser.firebase_uid;
  const plainToken = `sk_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
  const tokenPrefix = plainToken.slice(0, 12);

  const pool = getPool();
  try {
    const result = await pool.query(
      `INSERT INTO api_token (firebase_uid, token_name, token_hash, token_prefix, permissions, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING api_token_id, firebase_uid, token_name, token_prefix, permissions, expires_at, is_active, created_at`,
      [firebase_uid, token_name.trim(), tokenHash, tokenPrefix, systemId, expiresAt]
    );
    const row = result.rows[0];
    res.status(201).json({
      ...row,
      token: plainToken,
      message: 'Copy the token now; it will not be shown again.',
    });
  } catch (err) {
    if (err.code === '42P01') return res.status(503).json({ error: 'api_token table missing' });
    console.error('admin/create token', err);
    res.status(500).json({ error: 'Failed to create token' });
  }
});

/** PATCH /api/admin/api-tokens/:id — revoke (set is_active = false) */
router.patch('/api-tokens/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid token id' });
  const pool = getPool();
  try {
    const result = await pool.query(
      'UPDATE api_token SET is_active = false WHERE api_token_id = $1 RETURNING api_token_id, is_active',
      [id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Token not found' });
    res.json({ api_token_id: row.api_token_id, is_active: row.is_active });
  } catch (err) {
    console.error('admin/revoke token', err);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

/** DELETE /api/admin/api-tokens/:id — permanently delete token */
router.delete('/api-tokens/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid token id' });
  const pool = getPool();
  try {
    const result = await pool.query(
      'DELETE FROM api_token WHERE api_token_id = $1 RETURNING api_token_id',
      [id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Token not found' });
    res.json({ deleted: true, api_token_id: row.api_token_id });
  } catch (err) {
    console.error('admin/delete token', err);
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

export default router;
