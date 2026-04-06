/**
 * Mount Funtalk backend routes in-process at /api/funtalk.
 * Uses one port (the API backend's). DB config comes from systems_config (run migration first).
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import { getPool, ensureSystemsConfigTable } from './config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_PREFIX = '/api';
const FUNTALK_SLUG = 'funtalk';

const ENV_KEYS = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'FUNTALK_EMBEDDED'];

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

function setFuntalkEnv(row) {
  process.env.DB_HOST = String(row.database_host || 'localhost');
  process.env.DB_PORT = String(row.database_port ?? 5432);
  process.env.DB_NAME = String(row.database_name || 'funtalk_db');
  process.env.DB_USER = String(row.database_user || 'postgres');
  process.env.DB_PASSWORD = String(row.database_password ?? '');
  process.env.FUNTALK_EMBEDDED = '1'; // so Funtalk database.js does not process.exit on pool error
}

/**
 * Load Funtalk router and mount at /api/funtalk. Call after getPool() has been used (so API backend pool is cached).
 * @param {import('express').Application} app
 */
export async function mountFuntalk(app) {
  await ensureSystemsConfigTable();
  const pool = getPool();
  const result = await pool.query(
    `SELECT system_id, database_host, database_port, database_name, database_user, database_password
     FROM systems_config WHERE api_path_slug = $1 AND is_active = true LIMIT 1`,
    [FUNTALK_SLUG]
  );
  const row = result.rows[0];
  if (!row || !row.database_name) {
    app.use(`${API_PREFIX}/funtalk`, (req, res) => {
      res.status(503).json({
        error: 'Funtalk not configured',
        hint: 'Run: node scripts/migrate-funtalk-to-api.js',
      });
    });
    if (process.env.QUIET_STARTUP !== '1') {
      console.log('Funtalk: not configured (mount placeholder at /api/funtalk). Run migration to enable.');
    }
    return false;
  }

  const savedEnv = saveEnv();
  try {
    setFuntalkEnv(row);
    const funtalkRoutesPath = path.join(__dirname, '..', 'external-backend', 'funtalk-backend', 'routes', 'index.js');
    const url = pathToFileURL(funtalkRoutesPath).href;
    const { default: funtalkRouter } = await import(url);
    app.use(`${API_PREFIX}/funtalk`, funtalkRouter);
    if (process.env.QUIET_STARTUP !== '1') {
      console.log('Funtalk: mounted at /api/funtalk (same process, DB from systems_config)');
    }
    return true;
  } finally {
    restoreEnv(savedEnv);
  }
}
