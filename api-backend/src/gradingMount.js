/**
 * Mount Grading backend routes in-process at /api/grading.
 * Uses one port (the API backend's). DB config comes from systems_config (run migration first).
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import { getPool, ensureSystemsConfigTable } from './config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_PREFIX = '/api';
const GRADING_SLUG = 'grading';

const ENV_KEYS = [
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'GRADING_EMBEDDED',
  'FIREBASE_PROJECT_ID', 'FIREBASE_ADMIN_SDK_PATH',
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

function setGradingEnv(row) {
  process.env.DB_HOST = String(row.database_host || 'localhost');
  process.env.DB_PORT = String(row.database_port ?? 5432);
  process.env.DB_NAME = String(row.database_name || 'lcaportal');
  process.env.DB_USER = String(row.database_user || 'postgres');
  process.env.DB_PASSWORD = String(row.database_password ?? '');
  process.env.GRADING_EMBEDDED = '1';
  process.env.FIREBASE_PROJECT_ID = 'rhet-grading';
}

/**
 * Load Grading router and mount at /api/grading. Call after getPool() has been used.
 * @param {import('express').Application} app
 */
export async function mountGrading(app) {
  await ensureSystemsConfigTable();
  const pool = getPool();
  const result = await pool.query(
    `SELECT system_id, database_host, database_port, database_name, database_user, database_password
     FROM systems_config WHERE api_path_slug = $1 AND is_active = true LIMIT 1`,
    [GRADING_SLUG]
  );
  const row = result.rows[0];
  if (!row || !row.database_name) {
    app.use(`${API_PREFIX}/grading`, (req, res) => {
      res.status(503).json({
        error: 'Grading not configured',
        hint: 'Run: node scripts/migrate-grading-to-api.js',
      });
    });
    if (process.env.QUIET_STARTUP !== '1') {
      console.log('Grading: not configured (mount placeholder at /api/grading). Run migration to enable.');
    }
    return false;
  }

  const savedEnv = saveEnv();
  try {
    setGradingEnv(row);
    const gradingRoutesPath = path.join(__dirname, '..', 'external-backend', 'grading-backend', 'routes', 'index.js');
    const url = pathToFileURL(gradingRoutesPath).href;
    const { default: gradingRouter } = await import(url);
    app.use(`${API_PREFIX}/grading`, gradingRouter);
    if (process.env.QUIET_STARTUP !== '1') {
      console.log('Grading: mounted at /api/grading (same process, DB from systems_config)');
    }
    return true;
  } finally {
    restoreEnv(savedEnv);
  }
}
