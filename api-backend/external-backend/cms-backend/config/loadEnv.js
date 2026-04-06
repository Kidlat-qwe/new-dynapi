import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/**
 * When mounted inside api-backend (cmsMount.js), DB_* and Firebase paths are set by the host.
 * Do not load cms-backend/.env or it would overwrite systems_config values.
 */
if (process.env.CMS_EMBEDDED === '1') {
  if (process.env.QUIET_STARTUP !== '1') {
    console.log('🔧 CMS embedded in api-backend: skipping cms-backend/.env (DB from systems_config)');
  }
} else {
  loadCmsBackendEnv();
}

function loadCmsBackendEnv() {
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = resolve(__dirname, '..');
const envPath = resolve(backendDir, '.env');

// Read NODE_ENV directly from .env file so DB choice always follows the file (avoids PM2/shell overriding on Linode)
let nodeEnv = 'development';
if (existsSync(envPath)) {
  try {
    const content = readFileSync(envPath, 'utf8');
    const match = content.match(/^\s*NODE_ENV\s*=\s*(.+?)\s*$/m);
    if (match) {
      const val = match[1].trim().replace(/^["']|["']$/g, '');
      if (val === 'production' || val === 'development') nodeEnv = val;
    }
  } catch (_) {}
}

// Load .env for all vars; override so .env wins over process env
dotenv.config({ path: envPath, override: true });

// Sync process.env.NODE_ENV to what we read from file (so rest of app sees it)
process.env.NODE_ENV = nodeEnv;

const suffix = nodeEnv.toUpperCase();

// Map DB_*_DEVELOPMENT / DB_*_PRODUCTION to DB_* based on NODE_ENV from file
const dbKeys = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL'];
for (const key of dbKeys) {
  const modeValue = process.env[`${key}_${suffix}`];
  if (modeValue !== undefined && modeValue !== '') {
    process.env[key] = modeValue;
  }
}

if (process.env.QUIET_STARTUP !== '1') {
  console.log(`🔧 NODE_ENV=${nodeEnv} (from .env file) | DB: ${process.env.DB_NAME || '(not set)'}`);
}
}
