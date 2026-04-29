/**
 * Route aggregator.
 * Mounts all route modules by purpose (health, systems, external, etc.).
 */

import healthRoutes from './health.js';
import systemsRoutes from './systems.js';
import externalRoutes from './external.js';
import usersRoutes from './users.js';
import adminRoutes from './admin.js';
import secretsRoutes from './secrets.js';

const API_PREFIX = '/api';

/**
 * @param {import('express').Application} app
 * Funtalk is mounted in server.js via mountFuntalk(app) at /api/funtalk (same process, one port).
 */
export function mountRoutes(app) {
  app.use(`${API_PREFIX}/health`, healthRoutes);
  app.use(`${API_PREFIX}/systems`, systemsRoutes);
  app.use(`${API_PREFIX}/external`, externalRoutes);
  app.use(`${API_PREFIX}/users`, usersRoutes);
  app.use(`${API_PREFIX}/admin`, adminRoutes);
  app.use(`${API_PREFIX}/secrets`, secretsRoutes);

  app.get('/', (req, res) => {
    res.json({
      name: 'api-backend',
      version: '1.0.0',
      endpoints: [
        `${API_PREFIX}/health`,
        `${API_PREFIX}/systems`,
        `${API_PREFIX}/external`,
        `${API_PREFIX}/users`,
        `${API_PREFIX}/admin`,
        `${API_PREFIX}/secrets`,
        `${API_PREFIX}/funtalk`,
        `${API_PREFIX}/grading`,
        `${API_PREFIX}/cms`,
      ],
    });
  });
}
