/**
 * Mount CMS backend routes in-process at /api/cms.
 * Uses one port (the API backend's). DB config comes from systems_config (run migration first).
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import { existsSync } from 'fs';
import { getPool, ensureSystemsConfigTable } from './config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_PREFIX = '/api';
const CMS_SLUG = 'cms';

const ENV_KEYS = [
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL', 'CMS_EMBEDDED',
  'FIREBASE_ADMIN_SDK_PATH', 'FIREBASE_PROJECT_ID',
];

function saveEnv() {
  const saved = {};
  for (const k of ENV_KEYS) {
    if (process.env[k] !== undefined) saved[k] = process.env[k];
  }
  return saved;
}

function restoreEnv(saved) {
  for (const k of ENV_KEYS) {
    if (saved[k] !== undefined) {
      process.env[k] = saved[k];
    } else {
      delete process.env[k];
    }
  }
}

function setCmsEnv(row) {
  process.env.DB_HOST = String(row.database_host || 'localhost');
  process.env.DB_PORT = String(row.database_port ?? 5432);
  process.env.DB_NAME = String(row.database_name || 'psms_db');
  process.env.DB_USER = String(row.database_user || 'postgres');
  process.env.DB_PASSWORD = String(row.database_password ?? '');
  process.env.DB_SSL = row.database_ssl ? 'true' : 'false';
  process.env.CMS_EMBEDDED = '1';
  // Firebase Admin for psms-b9ca7 — cms-backend's firebase.js reads these when initializing the 'cms' named app
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'psms-b9ca7';
  // Absolute path to the CMS Admin SDK JSON (if present) so firebase.js finds it regardless of cwd
  const cmsAdminJsonPath = path.join(
    __dirname, '..', 'external-backend', 'cms-backend', 'config',
    'psms-b9ca7-firebase-adminsdk-fbsvc-0923308123.json'
  );
  if (existsSync(cmsAdminJsonPath)) {
    process.env.FIREBASE_ADMIN_SDK_PATH = cmsAdminJsonPath;
  } else {
    // Don't force a missing path: cms-backend will fall back to env-based credentials if available.
    delete process.env.FIREBASE_ADMIN_SDK_PATH;
    if (process.env.QUIET_STARTUP !== '1') {
      console.warn('CMS: FIREBASE_ADMIN_SDK_PATH not set (Admin SDK JSON not found). Set FIREBASE_ADMIN_SDK_PATH or Firebase env vars for psms-b9ca7.');
    }
  }
}

/**
 * Load CMS router and mount at /api/cms.
 * @param {import('express').Application} app
 */
export async function mountCms(app) {
  await ensureSystemsConfigTable();
  const pool = getPool();
  const result = await pool.query(
    `SELECT system_id, database_host, database_port, database_name, database_user, database_password, database_ssl
     FROM systems_config WHERE api_path_slug = $1 AND is_active = true LIMIT 1`,
    [CMS_SLUG]
  );
  const row = result.rows[0];
  if (!row || !row.database_name) {
    const handler = (req, res) => {
      res.status(503).json({
        error: 'CMS not configured',
        hint: 'Run: node scripts/migrate-cms-to-api.js',
      });
    };
    // Backward + current paths (cms-frontend currently targets /api/sms)
    app.use(`${API_PREFIX}/cms`, handler);
    app.use(`${API_PREFIX}/sms`, handler);
    if (process.env.QUIET_STARTUP !== '1') {
      console.log('CMS: not configured (mount placeholder at /api/cms and /api/sms). Run migration to enable.');
    }
    return false;
  }

  const savedEnv = saveEnv();
  try {
    setCmsEnv(row);
    const cmsRoutesPath = path.join(__dirname, '..', 'external-backend', 'cms-backend', 'routes', 'index.js');
    const url = pathToFileURL(cmsRoutesPath).href;
    const { default: cmsRouter } = await import(url);
    // Backward + current paths (cms-frontend currently targets /api/sms)
    app.use(`${API_PREFIX}/cms`, cmsRouter);
    app.use(`${API_PREFIX}/sms`, cmsRouter);
    if (process.env.QUIET_STARTUP !== '1') {
      console.log('CMS: mounted at /api/cms and /api/sms (same process, DB from systems_config)');
    }
    return true;
  } finally {
    restoreEnv(savedEnv);
  }
}
