/**
 * API token authentication for system-scoped access (e.g. Postman).
 * Accepts Authorization: Bearer sk_xxx or X-API-Key: sk_xxx.
 * Records request count and response time for admin stats.
 */

import crypto from 'crypto';
import { getPool, ensureApiTokenTable, ensureSystemRequestLogTable } from '../config/db.js';

/**
 * Path relative to the mounted system (for admin System Logs).
 * CMS is served at both /api/cms and /api/sms but systems_config.api_path_slug is `cms`.
 */
function getLoggedRoute(slug, req) {
  const pathOnly = (req.originalUrl || req.url || '').split('?')[0];
  if (slug === 'cms') {
    const stripped = pathOnly.replace(/^\/api\/(?:cms|sms)/, '') || '/';
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }
  const escaped = String(slug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripped = pathOnly.replace(new RegExp(`^/api/${escaped}`), '') || '/';
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

/** Fire-and-forget: update request_count, total_response_time_ms, last_used_at for token. */
function recordTokenUsage(apiTokenId, responseTimeMs) {
  if (!apiTokenId) return;
  const pool = getPool();
  pool.query(
    `UPDATE api_token SET request_count = COALESCE(request_count, 0) + 1,
      total_response_time_ms = COALESCE(total_response_time_ms, 0) + $1,
      last_used_at = CURRENT_TIMESTAMP
     WHERE api_token_id = $2`,
    [Math.max(0, Math.round(responseTimeMs)), apiTokenId]
  ).catch((err) => console.error('apiTokenAuth record usage', err.message));
}

/**
 * Fire-and-forget: log request to system_request_log for admin System Logs.
 * With api_token_id: uses req.user.email when set by downstream, else API token owner from users table.
 * Without api_token_id (Firebase/JWT-only): logs req.user email when present (optional systems).
 */
function logSystemRequest(slug, apiTokenId, req, responseTimeMs, statusCode) {
  if (!slug) return;
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'HEAD' || method === 'OPTIONS') return;

  const route = getLoggedRoute(slug, req);
  const responseTimeRounded = Math.max(0, Math.round(responseTimeMs));
  const currentUserEmail = req.user && (req.user.email || req.user.user_email);
  const pool = getPool();
  ensureSystemRequestLogTable()
    .then(() => {
      if (apiTokenId) {
        if (currentUserEmail && currentUserEmail !== 'api-token@gateway') {
          return pool.query(
            `INSERT INTO system_request_log (api_token_id, user_email, system_slug, method, route, status_code, response_time_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [apiTokenId, String(currentUserEmail).trim(), slug, method, route, statusCode ?? null, responseTimeRounded]
          );
        }
        return pool.query(
          `INSERT INTO system_request_log (api_token_id, user_email, system_slug, method, route, status_code, response_time_ms)
           SELECT t.api_token_id, u.email, $1, $2, $3, $4, $5
           FROM api_token t
           LEFT JOIN users u ON u.firebase_uid = t.firebase_uid
           WHERE t.api_token_id = $6`,
          [slug, method, route, statusCode ?? null, responseTimeRounded, apiTokenId]
        );
      }
      const emailForLog =
        currentUserEmail && String(currentUserEmail).trim() && currentUserEmail !== 'api-token@gateway'
          ? String(currentUserEmail).trim()
          : null;
      return pool.query(
        `INSERT INTO system_request_log (api_token_id, user_email, system_slug, method, route, status_code, response_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [null, emailForLog, slug, method, route, statusCode ?? null, responseTimeRounded]
      );
    })
    .catch((err) => console.error('apiTokenAuth log request', err.message));
}

function getApiKeyFromRequest(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ') && auth.slice(7).startsWith('sk_')) {
    return auth.slice(7);
  }
  const key = req.headers['x-api-key'];
  if (key && typeof key === 'string' && key.startsWith('sk_')) {
    return key;
  }
  return null;
}

/**
 * Returns middleware that requires a valid API token scoped to the system with the given api_path_slug.
 * Use before mounting a system's router (e.g. /api/funtalk).
 * @param {string} slug - systems_config.api_path_slug (e.g. 'funtalk')
 */
export function requireApiTokenForSystem(slug) {
  return async (req, res, next) => {
    const rawToken = getApiKeyFromRequest(req);
    if (!rawToken) {
      return res.status(401).json({
        error: 'API token required',
        hint: 'Use Authorization: Bearer sk_xxx or header X-API-Key: sk_xxx',
      });
    }
    try {
      await ensureApiTokenTable();
    } catch (err) {
      return res.status(503).json({ error: 'Database not ready', detail: err.message });
    }
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const pool = getPool();
    let tokenRow;
    try {
      const r = await pool.query(
        'SELECT api_token_id, permissions, expires_at, is_active FROM api_token WHERE token_hash = $1',
        [tokenHash]
      );
      tokenRow = r.rows[0];
    } catch (err) {
      console.error('apiTokenAuth lookup', err);
      return res.status(500).json({ error: 'Token validation failed' });
    }
    if (!tokenRow || !tokenRow.is_active) {
      return res.status(401).json({ error: 'Invalid or inactive API token' });
    }
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return res.status(401).json({ error: 'API token expired' });
    }
    const sysResult = await pool.query(
      'SELECT system_id FROM systems_config WHERE api_path_slug = $1 AND is_active = true LIMIT 1',
      [slug]
    );
    const systemId = sysResult.rows[0]?.system_id;
    if (systemId == null) {
      return res.status(503).json({ error: 'System not configured', slug });
    }
    if (Number(tokenRow.permissions) !== Number(systemId)) {
      return res.status(403).json({
        error: 'This token is not valid for this system',
        hint: 'Create a token for the correct system in Admin > API tokens.',
      });
    }
    req.apiToken = tokenRow;
    req._apiTokenStartMs = Date.now();
    res.once('finish', () => {
      const elapsed = Date.now() - req._apiTokenStartMs;
      recordTokenUsage(tokenRow.api_token_id, elapsed);
      logSystemRequest(slug, tokenRow.api_token_id, req, elapsed, res.statusCode);
    });
    next();
  };
}

/**
 * Optional API token for a system: if Bearer sk_xxx or X-API-Key is present, validate and set req.apiToken.
 * Otherwise call next() so the downstream app (e.g. Funtalk) can validate JWT or other auth.
 * Always records system_request_log on response finish: with api_token_id when sk_ was used, else Firebase/JWT user only.
 * @param {string} slug - systems_config.api_path_slug (e.g. 'funtalk')
 */
export function optionalApiTokenForSystem(slug) {
  return async (req, res, next) => {
    const startMs = Date.now();

    const attachOptionalFinishLogger = () => {
      if (req._optionalSystemLogFinishAttached) return;
      req._optionalSystemLogFinishAttached = true;
      res.once('finish', () => {
        const elapsed = Date.now() - startMs;
        const tokenId = req.apiToken?.api_token_id ?? null;
        if (tokenId) {
          recordTokenUsage(tokenId, elapsed);
        }
        logSystemRequest(slug, tokenId, req, elapsed, res.statusCode);
      });
    };

    const rawToken = getApiKeyFromRequest(req);
    if (!rawToken) {
      attachOptionalFinishLogger();
      return next();
    }
    try {
      await ensureApiTokenTable();
    } catch (err) {
      return res.status(503).json({ error: 'Database not ready', detail: err.message });
    }
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const pool = getPool();
    let tokenRow;
    try {
      const r = await pool.query(
        'SELECT api_token_id, permissions, expires_at, is_active FROM api_token WHERE token_hash = $1',
        [tokenHash]
      );
      tokenRow = r.rows[0];
    } catch (err) {
      console.error('apiTokenAuth lookup', err);
      return res.status(500).json({ error: 'Token validation failed' });
    }
    if (!tokenRow || !tokenRow.is_active || (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date())) {
      attachOptionalFinishLogger();
      return next();
    }
    const sysResult = await pool.query(
      'SELECT system_id FROM systems_config WHERE api_path_slug = $1 AND is_active = true LIMIT 1',
      [slug]
    );
    const systemId = sysResult.rows[0]?.system_id;
    if (systemId == null || Number(tokenRow.permissions) !== Number(systemId)) {
      attachOptionalFinishLogger();
      return next();
    }
    req.apiToken = tokenRow;
    attachOptionalFinishLogger();
    next();
  };
}
