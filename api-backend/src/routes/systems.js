/**
 * Systems/database config endpoints.
 * Persists to PostgreSQL systems_config table (see docs/database.md).
 */

import { Router } from 'express';
import { getPool, ensureSystemsConfigTable, ensureSystemRoutesTable, ensureSystemMonitoringConfigTable, ensureUsersTable } from '../config/db.js';
import { testSystemConnection, testSystemConnectionWithLatency, closeSystemPool } from '../config/systemPools.js';
import { verifyIdToken } from '../config/firebaseAdmin.js';
import { sendWebhookNotification, testWebhook } from '../services/notificationService.js';

const router = Router();

function getIdToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/** Returns true if the request has a valid admin user. */
async function checkIsAdmin(req) {
  const idToken = getIdToken(req);
  if (!idToken) return false;
  const verifyResult = await verifyIdToken(idToken);
  if (verifyResult.notConfigured || verifyResult.invalid || !verifyResult.decoded) return false;
  try {
    await ensureUsersTable();
    const pool = getPool();
    const r = await pool.query('SELECT role FROM users WHERE firebase_uid = $1', [verifyResult.decoded.uid]);
    return r.rows[0]?.role === 'admin';
  } catch {
    return false;
  }
}

/** Redact password in responses unless includePassword (e.g. for admin). */
function toSystemResponse(row, includePassword = false) {
  if (!row) return null;
  const { database_password, ...rest } = row;
  return {
    ...rest,
    database_password: includePassword ? (row.database_password ?? null) : (row.database_password ? '[REDACTED]' : null),
  };
}

const HEALTHY_MS = 2000;
const DEGRADED_MS = 5000;

function getStatusFromLatency(latencyMs, ok) {
  if (!ok) return 'down';
  if (latencyMs == null) return 'unknown';
  if (latencyMs < HEALTHY_MS) return 'healthy';
  if (latencyMs < DEGRADED_MS) return 'degraded';
  return 'down';
}

/**
 * Run health checks for all active systems and send automatic notifications when
 * response time is 2000ms+ (degraded) or 5000ms+ (down). Used by GET /health and by the scheduler.
 * @returns {Promise<{ systems: Array }>}
 */
export async function runHealthChecksAndNotify() {
  await ensureSystemsConfigTable();
  await ensureSystemMonitoringConfigTable();
  const pool = getPool();
  const result = await pool.query(
    `SELECT s.system_id, s.system_name, s.system_description, s.api_path_slug, s.database_host, s.database_port,
            s.health_webhook_url,
            m.check_interval_seconds, m.criticality_level, m.webhook_url AS monitoring_webhook_url,
            m.primary_alert_emails, m.monitoring_enabled
     FROM systems_config s
     LEFT JOIN system_monitoring_config m ON m.system_id = s.system_id
     WHERE s.is_active = true ORDER BY s.system_id`
  );
  const systems = [];
  const now = new Date().toISOString();
  for (const row of result.rows) {
    const r = await testSystemConnectionWithLatency(row.system_id);
    const latencyMs = r.ok ? r.latencyMs : (r.latencyMs ?? 99999);
    const status = getStatusFromLatency(latencyMs, r.ok);
    const webhookUrl = (row.monitoring_webhook_url && row.monitoring_webhook_url.trim()) || row.health_webhook_url || null;
    const endpoint = [row.database_host, row.database_port].filter(Boolean).join(':') || null;
    const criticality = (row.criticality_level && row.criticality_level.trim()) || 'medium';
    const item = {
      system_id: row.system_id,
      system_name: row.system_name,
      system_description: row.system_description,
      api_path_slug: row.api_path_slug,
      endpoint,
      ok: r.ok,
      latencyMs: r.latencyMs ?? null,
      message: r.message || null,
      status,
      criticality,
      last_checked_at: now,
      health_webhook_url: webhookUrl,
      check_interval_seconds: row.check_interval_seconds ?? 300,
      primary_alert_emails: row.primary_alert_emails || null,
      monitoring_enabled: row.monitoring_enabled !== false,
    };
    systems.push(item);
    const shouldNotify = (status === 'degraded' || status === 'down') && webhookUrl && row.monitoring_enabled !== false;
    if (shouldNotify) {
      const primaryEmails = row.primary_alert_emails && String(row.primary_alert_emails).trim() ? String(row.primary_alert_emails).trim() : '';
      sendWebhookNotification(
        webhookUrl,
        {
          system_id: row.system_id,
          system_name: row.system_name,
          status,
          latencyMs: item.latencyMs,
          message: r.message,
          criticality,
        },
        primaryEmails
      ).catch((err) => console.error('Health webhook failed:', err.message));
    }
  }
  return { systems };
}

/** GET /api/systems/health — health check all systems (DB latency + status). Admin only. */
router.get('/health', async (req, res) => {
  const isAdmin = await checkIsAdmin(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin required' });
  }
  try {
    const { systems } = await runHealthChecksAndNotify();
    res.json({ systems });
  } catch (err) {
    console.error('GET /api/systems/health', err);
    res.status(500).json({ error: 'Health check failed' });
  }
});

/** PATCH /api/systems/:id/health-config — update health webhook URL only (legacy). Admin only. */
router.patch('/:id/health-config', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid system id' });
  const isAdmin = await checkIsAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Admin required' });
  const { health_webhook_url } = req.body || {};
  try {
    await ensureSystemsConfigTable();
    await ensureSystemMonitoringConfigTable();
    const pool = getPool();
    await pool.query(
      `INSERT INTO system_monitoring_config (system_id, webhook_url, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (system_id) DO UPDATE SET webhook_url = EXCLUDED.webhook_url, updated_at = CURRENT_TIMESTAMP`,
      [id, health_webhook_url && String(health_webhook_url).trim() ? String(health_webhook_url).trim() : null]
    );
    const sys = await pool.query('SELECT system_id FROM systems_config WHERE system_id = $1', [id]);
    if (sys.rows.length === 0) return res.status(404).json({ error: 'System not found' });
    res.json({ system_id: id, health_webhook_url: health_webhook_url?.trim() || null });
  } catch (err) {
    console.error('PATCH /api/systems/:id/health-config', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

/** GET /api/systems/:id/monitoring-config — get monitoring config for a system. Admin only. */
router.get('/:id/monitoring-config', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid system id' });
  const isAdmin = await checkIsAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Admin required' });
  try {
    await ensureSystemsConfigTable();
    await ensureSystemMonitoringConfigTable();
    const pool = getPool();
    const sys = await pool.query('SELECT system_id, system_name FROM systems_config WHERE system_id = $1', [id]);
    if (sys.rows.length === 0) return res.status(404).json({ error: 'System not found' });
    const row = await pool.query(
      'SELECT check_interval_seconds, criticality_level, webhook_url, primary_alert_emails, monitoring_enabled, updated_at FROM system_monitoring_config WHERE system_id = $1',
      [id]
    );
    const c = row.rows[0] || {};
    res.json({
      system_id: id,
      system_name: sys.rows[0].system_name,
      check_interval_seconds: c.check_interval_seconds ?? 300,
      criticality_level: c.criticality_level || 'medium',
      webhook_url: c.webhook_url || null,
      primary_alert_emails: c.primary_alert_emails || null,
      monitoring_enabled: c.monitoring_enabled !== false,
      updated_at: c.updated_at || null,
    });
  } catch (err) {
    console.error('GET /api/systems/:id/monitoring-config', err);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

/** PUT /api/systems/:id/monitoring-config — upsert full monitoring config. Admin only. */
router.put('/:id/monitoring-config', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid system id' });
  const isAdmin = await checkIsAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Admin required' });
  const body = req.body || {};
  try {
    await ensureSystemsConfigTable();
    await ensureSystemMonitoringConfigTable();
    const pool = getPool();
    const sys = await pool.query('SELECT system_id, system_name FROM systems_config WHERE system_id = $1', [id]);
    if (sys.rows.length === 0) return res.status(404).json({ error: 'System not found' });
    const checkInterval = body.check_interval_seconds != null ? Number(body.check_interval_seconds) : 300;
    const criticality = (body.criticality_level && String(body.criticality_level).trim()) || 'medium';
    const webhookUrl = (body.webhook_url && String(body.webhook_url).trim()) || null;
    const primaryEmails = (body.primary_alert_emails && String(body.primary_alert_emails).trim()) || null;
    const monitoringEnabled = body.monitoring_enabled !== false;
    await pool.query(
      `INSERT INTO system_monitoring_config (system_id, check_interval_seconds, criticality_level, webhook_url, primary_alert_emails, monitoring_enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (system_id) DO UPDATE SET
         check_interval_seconds = EXCLUDED.check_interval_seconds,
         criticality_level = EXCLUDED.criticality_level,
         webhook_url = EXCLUDED.webhook_url,
         primary_alert_emails = EXCLUDED.primary_alert_emails,
         monitoring_enabled = EXCLUDED.monitoring_enabled,
         updated_at = CURRENT_TIMESTAMP`,
      [id, checkInterval, criticality, webhookUrl, primaryEmails, monitoringEnabled]
    );
    res.json({
      system_id: id,
      system_name: sys.rows[0].system_name,
      check_interval_seconds: checkInterval,
      criticality_level: criticality,
      webhook_url: webhookUrl,
      primary_alert_emails: primaryEmails,
      monitoring_enabled: monitoringEnabled,
    });
  } catch (err) {
    console.error('PUT /api/systems/:id/monitoring-config', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

/** POST /api/systems/:id/test-webhook — send test payload to webhook. Admin only. Body may include webhook_url, primary_alert_emails to test without saving. */
router.post('/:id/test-webhook', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid system id' });
  const isAdmin = await checkIsAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Admin required' });
  const bodyUrl = req.body?.webhook_url && String(req.body.webhook_url).trim();
  const bodyEmails = req.body?.primary_alert_emails != null ? String(req.body.primary_alert_emails).trim() : null;
  try {
    await ensureSystemsConfigTable();
    await ensureSystemMonitoringConfigTable();
    const pool = getPool();
    const sys = await pool.query('SELECT system_id, system_name FROM systems_config WHERE system_id = $1', [id]);
    if (sys.rows.length === 0) return res.status(404).json({ error: 'System not found' });
    let webhookUrl = bodyUrl || null;
    let primaryAlertEmails = bodyEmails;
    if (!webhookUrl || primaryAlertEmails === null) {
      const row = await pool.query(
        'SELECT webhook_url, primary_alert_emails FROM system_monitoring_config WHERE system_id = $1',
        [id]
      );
      const c = row.rows[0];
      if (!webhookUrl) webhookUrl = (c?.webhook_url && c.webhook_url.trim()) || null;
      if (primaryAlertEmails === null) primaryAlertEmails = (c?.primary_alert_emails && String(c.primary_alert_emails).trim()) || '';
    }
    if (!webhookUrl) {
      return res.status(400).json({ error: 'No webhook URL configured or provided' });
    }
    const result = await testWebhook(webhookUrl, {
      system_id: id,
      system_name: sys.rows[0].system_name,
      primary_alert_emails: primaryAlertEmails || undefined,
    });
    if (!result.success) {
      return res.status(502).json({ sent: false, error: result.message || result.error });
    }
    res.json({ sent: true, message: result.message || 'Test webhook sent successfully' });
  } catch (err) {
    console.error('POST /api/systems/:id/test-webhook', err);
    res.status(500).json({ error: err.message || 'Test webhook failed' });
  }
});

/** GET /api/systems — list all systems */
router.get('/', async (req, res) => {
  try {
    await ensureSystemsConfigTable();
    const pool = getPool();
    const result = await pool.query(
      'SELECT system_id, system_name, system_description, database_type, database_host, database_port, database_name, database_user, database_password, database_ssl, is_active, external_base_url, api_path_slug, health_webhook_url, created_at FROM systems_config ORDER BY system_id'
    );
    const isAdmin = await checkIsAdmin(req);
    const list = result.rows.map((row) => toSystemResponse(row, isAdmin));
    res.json({ systems: list });
  } catch (err) {
    console.error('GET /api/systems', err);
    res.status(500).json({ error: 'Failed to list systems' });
  }
});

/** GET /api/systems/:id/connection-test — test DB connection to this system's database */
router.get('/:id/connection-test', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid system id' });
  }
  try {
    const result = await testSystemConnection(id);
    if (result.ok) {
      res.json({ connected: true, message: 'Database connection successful' });
    } else {
      res.status(502).json({ connected: false, message: result.message || 'Connection failed' });
    }
  } catch (err) {
    console.error('GET /api/systems/:id/connection-test', err);
    res.status(500).json({ connected: false, message: err.message || 'Connection test failed' });
  }
});

/** GET /api/systems/:id/routes — list routes for this system */
router.get('/:id/routes', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid system id' });
  }
  try {
    await ensureSystemsConfigTable();
    await ensureSystemRoutesTable();
    const pool = getPool();
    const result = await pool.query(
      'SELECT route_id, system_id, method, path_pattern, description, is_active, created_at FROM system_routes WHERE system_id = $1 ORDER BY path_pattern, method',
      [id]
    );
    res.json({ routes: result.rows });
  } catch (err) {
    console.error('GET /api/systems/:id/routes', err);
    res.status(500).json({ error: 'Failed to list routes' });
  }
});

/** GET /api/systems/:id — get one system */
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid system id' });
  }
  try {
    await ensureSystemsConfigTable();
    const pool = getPool();
    const result = await pool.query(
      'SELECT system_id, system_name, system_description, database_type, database_host, database_port, database_name, database_user, database_password, database_ssl, is_active, external_base_url, api_path_slug, health_webhook_url, created_at FROM systems_config WHERE system_id = $1',
      [id]
    );
    const system = result.rows[0];
    if (!system) {
      return res.status(404).json({ error: 'System not found' });
    }
    const isAdmin = await checkIsAdmin(req);
    res.json(toSystemResponse(system, isAdmin));
  } catch (err) {
    console.error('GET /api/systems/:id', err);
    res.status(500).json({ error: 'Failed to get system' });
  }
});

/** POST /api/systems — create system */
router.post('/', async (req, res) => {
  const body = req.body || {};
  try {
    await ensureSystemsConfigTable();
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO systems_config (
        system_name, system_description, database_type, database_host, database_port,
        database_name, database_user, database_password, database_ssl, is_active, external_base_url, api_path_slug
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING system_id, system_name, system_description, database_type, database_host, database_port, database_name, database_user, database_password, database_ssl, is_active, external_base_url, api_path_slug, created_at`,
      [
        body.system_name ?? null,
        body.system_description ?? null,
        body.database_type ?? null,
        body.database_host ?? null,
        body.database_port != null ? Number(body.database_port) : null,
        body.database_name ?? null,
        body.database_user ?? null,
        body.database_password ?? null,
        Boolean(body.database_ssl),
        body.is_active !== false,
        body.external_base_url ?? null,
        body.api_path_slug ?? null,
      ]
    );
    const row = result.rows[0];
    res.status(201).json(toSystemResponse(row));
  } catch (err) {
    console.error('POST /api/systems', err);
    res.status(500).json({ error: 'Failed to create system' });
  }
});

/** PUT /api/systems/:id — update system */
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid system id' });
  }
  const body = req.body || {};
  try {
    await ensureSystemsConfigTable();
    const pool = getPool();
    const updates = [];
    const values = [];
    let i = 1;
    const fields = [
      'system_name',
      'system_description',
      'database_type',
      'database_host',
      'database_port',
      'database_name',
      'database_user',
      'database_ssl',
      'is_active',
      'external_base_url',
      'api_path_slug',
      'health_webhook_url',
    ];
    for (const f of fields) {
      if (f === 'database_port' && body[f] !== undefined) {
        updates.push(`${f} = $${i++}`);
        values.push(body[f] != null ? Number(body[f]) : null);
      } else if (f === 'database_ssl' || f === 'is_active') {
        if (body[f] !== undefined) {
          updates.push(`${f} = $${i++}`);
          values.push(Boolean(body[f]));
        }
      } else if (body[f] !== undefined) {
        updates.push(`${f} = $${i++}`);
        values.push(body[f] ?? null);
      }
    }
    if (body.database_password !== undefined) {
      updates.push('database_password = $' + i++);
      values.push(body.database_password ?? null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    values.push(id);
    const result = await pool.query(
      `UPDATE systems_config SET ${updates.join(', ')} WHERE system_id = $${i}
       RETURNING system_id, system_name, system_description, database_type, database_host, database_port, database_name, database_user, database_password, database_ssl, is_active, external_base_url, api_path_slug, health_webhook_url, created_at`,
      values
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'System not found' });
    }
    await closeSystemPool(id);
    res.json(toSystemResponse(row));
  } catch (err) {
    console.error('PUT /api/systems/:id', err);
    res.status(500).json({ error: 'Failed to update system' });
  }
});

/** DELETE /api/systems/:id — delete system */
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid system id' });
  }
  try {
    await ensureSystemsConfigTable();
    const pool = getPool();
    const result = await pool.query('DELETE FROM systems_config WHERE system_id = $1 RETURNING system_id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'System not found' });
    }
    await closeSystemPool(id);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/systems/:id', err);
    res.status(500).json({ error: 'Failed to delete system' });
  }
});

export default router;
