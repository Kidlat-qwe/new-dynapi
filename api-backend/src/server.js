/**
 * HTTP server entry point.
 * Loads .env from api-backend root first, then app (so DB_PASSWORD etc. are set).
 * Ensures users table exists at startup so signup sync works.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
/** Set QUIET_STARTUP=1 unless VERBOSE_STARTUP=1 (detailed logs from api-backend + embedded systems). */
if (process.env.VERBOSE_STARTUP !== '1') {
  process.env.QUIET_STARTUP = '1';
}

const { default: app } = await import('./app.js');
const { ensureUsersTable, ensureApiTokenTable, ensureSystemsConfigTable, ensureSystemRoutesTable, ensureSystemMonitoringConfigTable, ensureSystemRequestLogTable } = await import('./config/db.js');
const { runHealthChecksAndNotify } = await import('./routes/systems.js');
const { initializeFirebaseAdmin } = await import('./config/firebaseAdmin.js');
const { requireApiTokenForSystem, optionalApiTokenForSystem } = await import('./middleware/apiTokenAuth.js');
const { mountFuntalk } = await import('./funtalkMount.js');
const { mountGrading } = await import('./gradingMount.js');
const { mountCms } = await import('./cmsMount.js');

const PORT = Number(process.env.PORT) || 3000;

// Ensure required tables exist (this also creates API backend's DB pool)
try {
  await ensureUsersTable();
  await ensureApiTokenTable();
  await ensureSystemsConfigTable();
  await ensureSystemRoutesTable();
  await ensureSystemMonitoringConfigTable();
  await ensureSystemRequestLogTable();
  if (process.env.VERBOSE_STARTUP === '1') {
    console.log('Database: users, api_token, systems_config, system_routes, monitoring, request_log — ready');
  }
} catch (err) {
  console.error('Database not ready -', err.message);
  console.error('  Check PostgreSQL is running and .env (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)');
}

// Initialize Firebase Admin first (new-api project) so /api/users/me and /api/admin/* work.
// Funtalk mount will reuse this app when loaded in-process.
initializeFirebaseAdmin();

// Optional API token for /api/funtalk: accept sk_xxx or pass through so Funtalk can validate JWT (Firebase login)
app.use('/api/funtalk', optionalApiTokenForSystem('funtalk'));
// Mount Funtalk at /api/funtalk (same process, one port; DB from systems_config)
const mountedFuntalk = await mountFuntalk(app);

// Require API token for /api/grading (system-scoped)
app.use('/api/grading', requireApiTokenForSystem('grading'));
// Mount Grading at /api/grading (same process, one port; DB from systems_config)
const mountedGrading = await mountGrading(app);

// Optional API token for /api/cms: accept sk_xxx OR pass Firebase ID tokens through for CMS frontend login
app.use('/api/cms', optionalApiTokenForSystem('cms'));
// Alias: CMS frontend currently targets /api/sms
app.use('/api/sms', optionalApiTokenForSystem('cms'));
// Mount CMS at /api/cms (same process, one port; DB from systems_config)
const mountedCms = await mountCms(app);

app.listen(PORT, () => {
  const origin = `http://localhost:${PORT}`;
  if (process.env.VERBOSE_STARTUP === '1') {
    console.log(`api-backend listening on ${origin}`);
  } else {
    const systems = [
      mountedFuntalk && 'Funtalk',
      mountedGrading && 'Grading',
      mountedCms && 'CMS',
    ].filter(Boolean);
    console.log(`API · ${origin}`);
    console.log(systems.length ? `Systems: ${systems.join(' · ')} · connected` : 'Systems: (none mounted — check systems_config)');
  }

  // Auto notification: run health check every 5 min; notify when response time is 2000ms+ (degraded) or 5000ms+ (down)
  const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(() => {
    runHealthChecksAndNotify().catch((err) => console.error('Scheduled health check failed', err));
  }, HEALTH_CHECK_INTERVAL_MS);
  runHealthChecksAndNotify().catch((err) => console.error('Initial health check failed', err));
});
