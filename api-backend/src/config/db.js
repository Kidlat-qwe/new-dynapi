/**
 * PostgreSQL database configuration.
 * Uses env vars; matches pgAdmin connection (host, port, database, user, password).
 */

import pg from 'pg';

const { Pool } = pg;

const dbHost = String(process.env.DB_HOST || 'localhost');

/** Neon and most cloud Postgres require TLS. Set DB_SSL=false for local dev without SSL. */
function useSslForHost(host) {
  const h = (host || '').toLowerCase();
  return h.includes('neon') || h.includes('neon.tech') || h.includes('supabase.co');
}

const useSSL =
  process.env.DB_SSL === 'true'
    ? true
    : process.env.DB_SSL === 'false'
      ? false
      : useSslForHost(dbHost);

const dbConfig = {
  host: dbHost,
  port: Number(process.env.DB_PORT) || 5432,
  database: String(process.env.DB_NAME || 'new_api_db'),
  user: String(process.env.DB_USER || 'postgres'),
  password: String(process.env.DB_PASSWORD ?? ''),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
};

/** Pool instance; create once, reuse. */
let pool = null;

/**
 * @returns {pg.Pool}
 */
export function getPool() {
  if (!pool) {
    pool = new Pool(dbConfig);
  }
  return pool;
}

/**
 * Test connection (e.g. for health check).
 * @returns {Promise<boolean>}
 */
export async function testConnection() {
  const client = await getPool().connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}

const USERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    fname VARCHAR(100),
    mname VARCHAR(100),
    lname VARCHAR(100),
    role VARCHAR(50),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
  );
`;

const API_TOKEN_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS api_token (
    api_token_id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) NOT NULL,
    token_name VARCHAR(255),
    token_hash VARCHAR(512) NOT NULL,
    token_prefix VARCHAR(50),
    permissions INT,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const SYSTEMS_CONFIG_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS systems_config (
    system_id SERIAL PRIMARY KEY,
    system_name VARCHAR(255),
    system_description TEXT,
    database_type VARCHAR(50),
    database_host VARCHAR(255),
    database_port INT,
    database_name VARCHAR(255),
    database_user VARCHAR(255),
    database_password VARCHAR(255),
    database_ssl BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    external_base_url VARCHAR(512),
    api_path_slug VARCHAR(64) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const SYSTEM_ROUTES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS system_routes (
    route_id SERIAL PRIMARY KEY,
    system_id INT NOT NULL REFERENCES systems_config(system_id) ON DELETE CASCADE,
    method VARCHAR(10) NOT NULL,
    path_pattern VARCHAR(512) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const SYSTEM_MONITORING_CONFIG_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS system_monitoring_config (
    system_id INT PRIMARY KEY REFERENCES systems_config(system_id) ON DELETE CASCADE,
    check_interval_seconds INT DEFAULT 300,
    criticality_level VARCHAR(32) DEFAULT 'medium',
    webhook_url VARCHAR(1024),
    primary_alert_emails TEXT,
    monitoring_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const SYSTEM_REQUEST_LOG_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS system_request_log (
    log_id SERIAL PRIMARY KEY,
    api_token_id INT REFERENCES api_token(api_token_id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    system_slug VARCHAR(64) NOT NULL,
    method VARCHAR(10) NOT NULL,
    route TEXT NOT NULL,
    status_code INT,
    response_time_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;
const SYSTEM_REQUEST_LOG_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_system_request_log_created_at ON system_request_log(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_system_request_log_system_slug ON system_request_log(system_slug);
`;

let usersTableEnsured = false;
let apiTokenTableEnsured = false;
let systemsConfigTableEnsured = false;
let systemRoutesTableEnsured = false;
let systemMonitoringConfigTableEnsured = false;
let systemRequestLogTableEnsured = false;

/**
 * Ensure users table exists (idempotent). Call before user sync/me.
 */
export async function ensureUsersTable() {
  if (usersTableEnsured) return;
  const client = await getPool().connect();
  try {
    await client.query(USERS_TABLE_SQL);
    usersTableEnsured = true;
  } finally {
    client.release();
  }
}

/** Add request_count and total_response_time_ms to api_token if missing (for token stats). */
const API_TOKEN_STATS_COLUMNS_SQL = `
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_token' AND column_name = 'request_count') THEN
      ALTER TABLE api_token ADD COLUMN request_count BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_token' AND column_name = 'total_response_time_ms') THEN
      ALTER TABLE api_token ADD COLUMN total_response_time_ms BIGINT DEFAULT 0;
    END IF;
  END $$;
`;

/**
 * Ensure api_token table exists (idempotent). Adds request_count and total_response_time_ms if missing.
 */
export async function ensureApiTokenTable() {
  if (apiTokenTableEnsured) return;
  const client = await getPool().connect();
  try {
    await client.query(API_TOKEN_TABLE_SQL);
    await client.query(API_TOKEN_STATS_COLUMNS_SQL);
    apiTokenTableEnsured = true;
  } finally {
    client.release();
  }
}

/**
 * Ensure systems_config table exists (idempotent). Must run before system_routes.
 * Adds external_base_url column if table existed from an older schema.
 */
export async function ensureSystemsConfigTable() {
  if (systemsConfigTableEnsured) return;
  const client = await getPool().connect();
  try {
    await client.query(SYSTEMS_CONFIG_TABLE_SQL);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE systems_config ADD COLUMN external_base_url VARCHAR(512);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE systems_config ADD COLUMN api_path_slug VARCHAR(64) UNIQUE;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'systems_config' AND column_name = 'creative_at') THEN
          ALTER TABLE systems_config RENAME COLUMN creative_at TO created_at;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'systems_config' AND column_name = 'created_at') THEN
          ALTER TABLE systems_config ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE systems_config ADD COLUMN health_webhook_url VARCHAR(1024);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;
    `);
    systemsConfigTableEnsured = true;
  } finally {
    client.release();
  }
}

/**
 * Ensure system_routes table exists (idempotent). Requires systems_config.
 */
export async function ensureSystemRoutesTable() {
  if (systemRoutesTableEnsured) return;
  const client = await getPool().connect();
  try {
    await client.query(SYSTEM_ROUTES_TABLE_SQL);
    systemRoutesTableEnsured = true;
  } finally {
    client.release();
  }
}

/**
 * Ensure system_monitoring_config table exists (idempotent). Requires systems_config.
 */
export async function ensureSystemMonitoringConfigTable() {
  if (systemMonitoringConfigTableEnsured) return;
  const client = await getPool().connect();
  try {
    await client.query(SYSTEM_MONITORING_CONFIG_TABLE_SQL);
    systemMonitoringConfigTableEnsured = true;
  } finally {
    client.release();
  }
}

/**
 * Ensure system_request_log table exists (for admin system logs).
 */
export async function ensureSystemRequestLogTable() {
  if (systemRequestLogTableEnsured) return;
  const client = await getPool().connect();
  try {
    await client.query(SYSTEM_REQUEST_LOG_TABLE_SQL);
    await client.query(SYSTEM_REQUEST_LOG_INDEX_SQL);
    systemRequestLogTableEnsured = true;
  } finally {
    client.release();
  }
}

/**
 * Get external_base_url for a system by api_path_slug (for proxying).
 * @param {string} slug - e.g. 'funtalk'
 * @returns {Promise<string|null>} Base URL (e.g. http://localhost:3001/api) or null
 */
export async function getProxyBaseUrlBySlug(slug) {
  if (!slug) return null;
  await ensureSystemsConfigTable();
  const client = await getPool().connect();
  try {
    const result = await client.query(
      'SELECT external_base_url FROM systems_config WHERE api_path_slug = $1 AND is_active = true',
      [slug]
    );
    const url = result.rows[0]?.external_base_url;
    return url && url.trim() ? url.trim() : null;
  } finally {
    client.release();
  }
}

export { dbConfig };
