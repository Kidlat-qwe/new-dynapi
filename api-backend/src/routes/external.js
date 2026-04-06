/**
 * External backend integrations.
 * Lists systems managed by the API (systems_config with optional external_base_url)
 * and their routes (stored in system_routes after migration).
 */

import { Router } from 'express';
import { getPool, ensureSystemsConfigTable, ensureSystemRoutesTable } from '../config/db.js';

const router = Router();

/** GET /api/external — info and link to managed systems */
router.get('/', (req, res) => {
  res.json({
    message: 'External backends managed by the API system.',
    systems: '/api/external/systems',
    hint: 'Run scripts/migrate-funtalk-to-api.js to migrate Funtalk config and routes.',
  });
});

/**
 * GET /api/external/systems — list systems (external + in-process).
 * In-process systems get base_url = request origin + /api/{api_path_slug}.
 * Frontends (e.g. Funtalk) can call this to get their API base URL.
 */
router.get('/systems', async (req, res) => {
  try {
    await ensureSystemsConfigTable();
    await ensureSystemRoutesTable();
    const pool = getPool();
    const origin = `${req.protocol}://${req.get('host') || req.get('x-forwarded-host') || 'localhost:3000'}`.replace(/\/$/, '');

    const result = await pool.query(
      `SELECT s.system_id, s.system_name, s.system_description, s.external_base_url, s.api_path_slug, s.is_active,
              (SELECT COUNT(*) FROM system_routes r WHERE r.system_id = s.system_id AND r.is_active = true) AS route_count
       FROM systems_config s
       WHERE s.is_active = true
       ORDER BY s.system_id`
    );
    const systems = result.rows.map((row) => {
      const base_url = row.api_path_slug
        ? `${origin}/api/${row.api_path_slug}`
        : (row.external_base_url || null);
      return {
        system_id: row.system_id,
        system_name: row.system_name,
        system_description: row.system_description,
        api_path_slug: row.api_path_slug,
        external_base_url: row.external_base_url,
        base_url: base_url || undefined,
        is_active: row.is_active,
        route_count: Number(row.route_count),
        routes_url: `/api/systems/${row.system_id}/routes`,
      };
    });
    res.json({ systems });
  } catch (err) {
    console.error('GET /api/external/systems', err);
    res.status(500).json({ error: 'Failed to list external systems' });
  }
});

export default router;
