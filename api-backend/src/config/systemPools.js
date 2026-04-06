/**
 * Database connection pools for external systems (e.g. Funtalk).
 * Uses credentials from systems_config so the API system can connect to each system's database.
 */

import pg from 'pg';
import { getPool, ensureSystemsConfigTable } from './db.js';

const { Pool } = pg;

/** Cached pools by system_id. Cleared when config may have changed. */
const systemPools = new Map();

/**
 * Get systems_config row by system_id (includes password for connection).
 * @param {number} systemId
 * @returns {Promise<{ database_host, database_port, database_name, database_user, database_password, database_ssl }|null>}
 */
export async function getSystemConfig(systemId) {
  await ensureSystemsConfigTable();
  const pool = getPool();
  const result = await pool.query(
    `SELECT database_host, database_port, database_name, database_user, database_password, database_ssl
     FROM systems_config WHERE system_id = $1 AND is_active = true`,
    [systemId]
  );
  const row = result.rows[0];
  if (!row || !row.database_host || !row.database_name) return null;
  return row;
}

/**
 * Get or create a PostgreSQL pool for the given system's database.
 * The API system uses this to run queries against the external system's DB (e.g. Funtalk's funtalk_db).
 * @param {number} systemId - systems_config.system_id
 * @returns {Promise<pg.Pool|null>} Pool connected to that system's DB, or null if config missing/invalid
 */
export async function getPoolForSystem(systemId) {
  const id = Number(systemId);
  if (Number.isNaN(id)) return null;

  if (systemPools.has(id)) {
    return systemPools.get(id);
  }

  const config = await getSystemConfig(id);
  if (!config) return null;

  const poolConfig = {
    host: String(config.database_host || 'localhost'),
    port: Number(config.database_port) || 5432,
    database: String(config.database_name),
    user: String(config.database_user || 'postgres'),
    password: String(config.database_password ?? ''),
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
  if (config.database_ssl) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(poolConfig);
  systemPools.set(id, pool);

  pool.on('error', (err) => {
    console.error(`System pool ${id} error:`, err.message);
    systemPools.delete(id);
  });

  return pool;
}

/**
 * Test connection to a system's database (e.g. run SELECT 1).
 * @param {number} systemId
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function testSystemConnection(systemId) {
  const r = await testSystemConnectionWithLatency(systemId);
  return { ok: r.ok, message: r.message };
}

/**
 * Test connection and measure latency (ms). Used for health monitoring.
 * @param {number} systemId
 * @returns {Promise<{ ok: boolean, message?: string, latencyMs?: number }>}
 */
export async function testSystemConnectionWithLatency(systemId) {
  const pool = await getPoolForSystem(systemId);
  if (!pool) {
    return { ok: false, message: 'System not found or has no database config' };
  }
  const start = performance.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      const latencyMs = Math.round(performance.now() - start);
      return { ok: true, latencyMs };
    } finally {
      client.release();
    }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return { ok: false, message: err.message || 'Connection failed', latencyMs: latencyMs > 0 ? latencyMs : undefined };
  }
}

/**
 * Invalidate cached pool for a system (e.g. after config update).
 * @param {number} systemId
 */
export async function closeSystemPool(systemId) {
  const id = Number(systemId);
  if (Number.isNaN(id)) return;
  const pool = systemPools.get(id);
  if (pool) {
    systemPools.delete(id);
    await pool.end().catch(() => {});
  }
}
