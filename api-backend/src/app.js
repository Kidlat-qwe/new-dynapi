/**
 * Express application setup.
 * CORS enabled for frontend origin; mounts middleware and routes.
 */

import express from 'express';
import cors from 'cors';
import { mountRoutes } from './routes/index.js';

const app = express();

/** Comma-separated in CORS_ORIGIN, e.g. http://localhost:5173,http://localhost:5174 */
function getAllowedCorsOrigins() {
  const raw = process.env.CORS_ORIGIN;
  if (raw && String(raw).trim()) {
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ['http://localhost:5173', 'http://localhost:5174'];
}

const allowedCorsOrigins = getAllowedCorsOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedCorsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-User-Email',
      'Cache-Control',
      'Pragma',
    ],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mountRoutes(app);

export default app;
