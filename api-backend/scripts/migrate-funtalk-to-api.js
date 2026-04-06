/**
 * Migrates Funtalk backend config and routes into the API system.
 * - Reads database config from external-backend/funtalk-backend/.env
 * - Inserts one systems_config row (Funtalk) and all routes into system_routes.
 *
 * Usage (from api-backend root):
 *   node scripts/migrate-funtalk-to-api.js [path-to-funtalk-.env]
 *
 * Default funtalk .env path: external-backend/funtalk-backend/.env
 * Requires api-backend .env (DB_* for new_api_db) to be loaded first.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiBackendRoot = path.resolve(__dirname, '..');

// Load api-backend .env before importing db.js so getPool() uses correct DB_*
dotenv.config({ path: path.join(apiBackendRoot, '.env') });

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\n/g, '\n');
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function run() {
  const funtalkEnvPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.join(apiBackendRoot, 'external-backend', 'funtalk-backend', '.env');

  console.log('Funtalk .env path:', funtalkEnvPath);
  const funtalkEnv = parseEnvFile(funtalkEnvPath);

  const dbHost = funtalkEnv.DB_HOST || 'localhost';
  const dbPort = Number(funtalkEnv.DB_PORT) || 5432;
  const dbName = funtalkEnv.DB_NAME || 'funtalk_db';
  const dbUser = funtalkEnv.DB_USER || 'postgres';
  const dbPassword = funtalkEnv.DB_PASSWORD ?? '';
  // Single port: Funtalk runs in-process at /api/funtalk on the API backend server. No separate Funtalk port.
  const externalBaseUrl = null;
  const apiPathSlug = 'funtalk';

  const { ensureSystemsConfigTable, ensureSystemRoutesTable, getPool } = await import('../src/config/db.js');
  const { FUNTALK_ROUTES } = await import('./funtalk-routes-manifest.js');

  await ensureSystemsConfigTable();
  await ensureSystemRoutesTable();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT system_id FROM systems_config WHERE system_name = $1 OR api_path_slug = $2 LIMIT 1`,
      ['Funtalk', apiPathSlug]
    );
    let systemId;
    if (existing.rows[0]) {
      systemId = existing.rows[0].system_id;
      await client.query(
        `UPDATE systems_config SET
          system_description = $1, database_type = $2, database_host = $3, database_port = $4,
          database_name = $5, database_user = $6, database_password = $7, database_ssl = $8,
          is_active = true, external_base_url = $9, api_path_slug = $10
         WHERE system_id = $11`,
        [
          'Funtalk Platform Backend API - B2B English Learning (migrated)',
          'PostgreSQL',
          dbHost,
          dbPort,
          dbName,
          dbUser,
          dbPassword,
          false,
          externalBaseUrl,
          apiPathSlug,
          systemId,
        ]
      );
      await client.query('DELETE FROM system_routes WHERE system_id = $1', [systemId]);
      console.log('Updated systems_config:', systemId, 'Funtalk');
    } else {
      const insertSystem = await client.query(
        `INSERT INTO systems_config (
          system_name, system_description, database_type, database_host, database_port,
          database_name, database_user, database_password, database_ssl, is_active, external_base_url, api_path_slug
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING system_id`,
        [
          'Funtalk',
          'Funtalk Platform Backend API - B2B English Learning (migrated)',
          'PostgreSQL',
          dbHost,
          dbPort,
          dbName,
          dbUser,
          dbPassword,
          false,
          true,
          externalBaseUrl,
          apiPathSlug,
        ]
      );
      systemId = insertSystem.rows[0].system_id;
      console.log('Inserted systems_config:', systemId, 'Funtalk');
    }

    let inserted = 0;
    for (const r of FUNTALK_ROUTES) {
      await client.query(
        `INSERT INTO system_routes (system_id, method, path_pattern, description, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [systemId, r.method, r.path_pattern, r.description ?? null]
      );
      inserted++;
    }
    console.log('Upserted system_routes:', inserted, 'routes');

    console.log('Done. System ID:', systemId);
    console.log('API path slug:', apiPathSlug);
    console.log('Funtalk is mounted at /api/funtalk on the API backend (one port). e.g. http://localhost:3000/api/funtalk/users');
    console.log('View routes: GET /api/systems/' + systemId + '/routes');
  } finally {
    client.release();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
