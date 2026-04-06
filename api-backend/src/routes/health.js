/**
 * Health check endpoints.
 * Used for liveness/readiness and API status.
 */

import { Router } from 'express';
import { testConnection } from '../config/db.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'api-backend',
  });
});

router.get('/live', (req, res) => {
  res.status(200).send('ok');
});

router.get('/ready', async (req, res) => {
  try {
    const ok = await testConnection();
    res.json({
      ready: ok,
      database: ok ? 'connected' : 'error',
    });
  } catch (err) {
    res.status(503).json({
      ready: false,
      database: 'error',
      message: err.message || 'Connection failed',
    });
  }
});

export default router;
