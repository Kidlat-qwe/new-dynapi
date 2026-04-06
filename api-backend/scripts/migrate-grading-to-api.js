/**
 * Migrates Grading backend config and routes into the API system.
 * - Reads database config from external-backend/grading-backend/.env
 * - Inserts one systems_config row (Grading) and all routes into system_routes.
 *
 * Usage (from api-backend root):
 *   node scripts/migrate-grading-to-api.js [path-to-grading-.env]
 *
 * Default grading .env path: external-backend/grading-backend/.env
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
  const gradingEnvPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.join(apiBackendRoot, 'external-backend', 'grading-backend', '.env');

  console.log('Grading .env path:', gradingEnvPath);
  const gradingEnv = parseEnvFile(gradingEnvPath);

  const dbHost = gradingEnv.DB_HOST || 'localhost';
  const dbPort = Number(gradingEnv.DB_PORT) || 5432;
  const dbName = gradingEnv.DB_NAME || 'lcaportal';
  const dbUser = gradingEnv.DB_USER || 'postgres';
  const dbPassword = gradingEnv.DB_PASSWORD ?? '';
  const externalBaseUrl = null;
  const apiPathSlug = 'grading';

  const { ensureSystemsConfigTable, ensureSystemRoutesTable, getPool } = await import('../src/config/db.js');
  const { GRADING_ROUTES } = await import('./grading-routes-manifest.js');

  await ensureSystemsConfigTable();
  await ensureSystemRoutesTable();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT system_id FROM systems_config WHERE system_name = $1 OR api_path_slug = $2 LIMIT 1`,
      ['Grading', apiPathSlug]
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
          'Grading / LCA Portal Backend - grades, classes, attendance (migrated)',
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
      console.log('Updated systems_config:', systemId, 'Grading');
    } else {
      const insertSystem = await client.query(
        `INSERT INTO systems_config (
          system_name, system_description, database_type, database_host, database_port,
          database_name, database_user, database_password, database_ssl, is_active, external_base_url, api_path_slug
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING system_id`,
        [
          'Grading',
          'Grading / LCA Portal Backend - grades, classes, attendance (migrated)',
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
      console.log('Inserted systems_config:', systemId, 'Grading');
    }

    let inserted = 0;
    for (const r of GRADING_ROUTES) {
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
    console.log('Grading is mounted at /api/grading on the API backend (one port). e.g. http://localhost:3000/api/grading/classes');
    console.log('View routes: GET /api/systems/' + systemId + '/routes');
  } finally {
    client.release();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
