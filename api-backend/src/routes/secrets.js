import { Router } from 'express';
import crypto from 'crypto';
import { getPool, ensureSystemSecretsTable, ensureSystemsConfigTable, ensureUsersTable, ensureUserSystemPermissionsTable } from '../config/db.js';
import { verifyIdToken } from '../config/firebaseAdmin.js';

const router = Router();

function getIdToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

async function getRequestAuth(req) {
  const idToken = getIdToken(req);
  if (!idToken) return { authenticated: false, isAdmin: false, role: null, firebaseUid: null };
  const verifyResult = await verifyIdToken(idToken);
  if (verifyResult.notConfigured || verifyResult.invalid || !verifyResult.decoded) {
    return { authenticated: false, isAdmin: false, role: null, firebaseUid: null };
  }
  try {
    await ensureUsersTable();
    const pool = getPool();
    const r = await pool.query('SELECT role FROM users WHERE firebase_uid = $1', [verifyResult.decoded.uid]);
    const role = r.rows[0]?.role || null;
    return {
      authenticated: true,
      isAdmin: role === 'admin',
      role,
      firebaseUid: verifyResult.decoded.uid,
    };
  } catch {
    return { authenticated: false, isAdmin: false, role: null, firebaseUid: null };
  }
}

async function hasSystemAccess(pool, systemId, firebaseUid) {
  const r = await pool.query(
    `SELECT 1
     FROM systems_config s
     LEFT JOIN users u ON u.firebase_uid = $2
     LEFT JOIN user_system_permissions usp ON usp.user_id = u.user_id AND usp.system_id = s.system_id
     WHERE s.system_id = $1
       AND (s.created_by_firebase_uid = $2 OR usp.permission_id IS NOT NULL)
     LIMIT 1`,
    [systemId, firebaseUid]
  );
  return Boolean(r.rows[0]);
}

function toIsoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function getEncryptionKeyBuffer() {
  const source =
    process.env.SECRET_ENCRYPTION_KEY ||
    `${process.env.DB_PASSWORD || ''}:${process.env.DB_NAME || 'new_api_db'}:secrets`;
  return crypto.createHash('sha256').update(String(source)).digest();
}

function encryptSecretValue(plainText) {
  const value = plainText == null ? '' : String(plainText);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKeyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecretValue(cipherText) {
  if (cipherText == null) return null;
  const raw = String(cipherText);
  if (!raw.startsWith('enc:v1:')) return raw;
  const parts = raw.split(':');
  if (parts.length !== 5) throw new Error('Invalid encrypted secret format');
  const [, , ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKeyBuffer(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString('utf8');
}

function maskedSecretValue(cipherText) {
  if (!cipherText) return null;
  return '********';
}

async function migratePlaintextSecrets() {
  await ensureSystemSecretsTable();
  const pool = getPool();
  const result = await pool.query(
    `SELECT secret_id, secret_value
     FROM system_secrets
     WHERE secret_value IS NOT NULL
       AND secret_value NOT LIKE 'enc:v1:%'`
  );
  for (const row of result.rows) {
    await pool.query(
      'UPDATE system_secrets SET secret_value = $1, updated_at = CURRENT_TIMESTAMP WHERE secret_id = $2',
      [encryptSecretValue(row.secret_value), row.secret_id]
    );
  }
}

/** Keep DB config fields in system_secrets so Secrets page always has .env equivalents. */
export async function upsertSystemConfigSecrets(systemId) {
  const id = Number(systemId);
  if (Number.isNaN(id)) return;
  await ensureSystemsConfigTable();
  await ensureSystemSecretsTable();

  const pool = getPool();
  const systemResult = await pool.query(
    `SELECT system_id, database_host, database_port, database_name, database_user, database_password, database_ssl
     FROM systems_config WHERE system_id = $1`,
    [id]
  );
  const row = systemResult.rows[0];
  if (!row) return;

  const pairs = [
    ['DB_HOST', row.database_host ?? ''],
    ['DB_PORT', row.database_port != null ? String(row.database_port) : ''],
    ['DB_NAME', row.database_name ?? ''],
    ['DB_USER', row.database_user ?? ''],
    ['DB_PASSWORD', row.database_password ?? ''],
    ['DB_SSL', row.database_ssl ? 'true' : 'false'],
  ];

  for (const [secretKey, secretValue] of pairs) {
    await pool.query(
      `INSERT INTO system_secrets (system_id, secret_key, secret_value, description, is_seeded_from_config, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP)
       ON CONFLICT (system_id, secret_key)
       DO UPDATE SET
         secret_value = EXCLUDED.secret_value,
         description = EXCLUDED.description,
         is_seeded_from_config = TRUE,
         updated_at = CURRENT_TIMESTAMP`,
      [id, secretKey, encryptSecretValue(secretValue), `Auto-synced from systems_config.${secretKey.toLowerCase().replace('db_', 'database_')}`]
    );
  }
}

/** GET /api/secrets?system_id= */
router.get('/', async (req, res) => {
  const auth = await getRequestAuth(req);
  if (!auth.authenticated) return res.status(401).json({ error: 'Authentication required' });
  try {
    await ensureSystemSecretsTable();
    await ensureUserSystemPermissionsTable();
    await migratePlaintextSecrets();
    const pool = getPool();
    const systems = await pool.query('SELECT system_id FROM systems_config ORDER BY system_id');
    for (const s of systems.rows) {
      await upsertSystemConfigSecrets(s.system_id);
    }
    const systemId = req.query.system_id != null ? Number(req.query.system_id) : null;
    const keyLike = req.query.key ? String(req.query.key).trim() : '';

    const conditions = [];
    const values = [];
    let i = 1;
    if (systemId != null && !Number.isNaN(systemId)) {
      conditions.push(`ss.system_id = $${i++}`);
      values.push(systemId);
    }
    if (!auth.isAdmin) {
      conditions.push(`(s.created_by_firebase_uid = $${i} OR EXISTS (
        SELECT 1 FROM users u
        JOIN user_system_permissions usp ON usp.user_id = u.user_id
        WHERE u.firebase_uid = $${i} AND usp.system_id = s.system_id
      ))`);
      values.push(auth.firebaseUid);
      i += 1;
    }
    if (keyLike) {
      conditions.push(`ss.secret_key ILIKE $${i++}`);
      values.push(`%${keyLike}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT ss.secret_id, ss.system_id, s.system_name, s.api_path_slug,
              ss.secret_key, ss.secret_value, ss.description, ss.expires_at,
              ss.is_seeded_from_config, ss.created_at, ss.updated_at
       FROM system_secrets ss
       JOIN systems_config s ON s.system_id = ss.system_id
       ${where}
       ORDER BY s.system_name NULLS LAST, ss.secret_key`,
      values
    );

    res.json({
      secrets: result.rows.map((r) => ({
        ...r,
        secret_value: null,
        secret_value_masked: maskedSecretValue(r.secret_value),
        has_value: Boolean(r.secret_value),
        expires_at: toIsoOrNull(r.expires_at),
        created_at: toIsoOrNull(r.created_at),
        updated_at: toIsoOrNull(r.updated_at),
      })),
    });
  } catch (err) {
    console.error('GET /api/secrets', err);
    res.status(500).json({ error: 'Failed to list secrets' });
  }
});

/** GET /api/secrets/:id/reveal — decrypt and reveal one secret value (admin only). */
router.get('/:id/reveal', async (req, res) => {
  const auth = await getRequestAuth(req);
  if (!auth.authenticated) return res.status(401).json({ error: 'Authentication required' });
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid secret id' });
  try {
    await ensureSystemSecretsTable();
    await ensureUserSystemPermissionsTable();
    const pool = getPool();
    const result = auth.isAdmin
      ? await pool.query(
        'SELECT secret_id, secret_key, secret_value FROM system_secrets WHERE secret_id = $1',
        [id]
      )
      : await pool.query(
        `SELECT ss.secret_id, ss.secret_key, ss.secret_value
         FROM system_secrets ss
         JOIN systems_config s ON s.system_id = ss.system_id
         WHERE ss.secret_id = $1
           AND (
             s.created_by_firebase_uid = $2 OR EXISTS (
               SELECT 1 FROM users u
               JOIN user_system_permissions usp ON usp.user_id = u.user_id
               WHERE u.firebase_uid = $2 AND usp.system_id = s.system_id
             )
           )`,
        [id, auth.firebaseUid]
      );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Secret not found' });
    const revealed = row.secret_value ? decryptSecretValue(row.secret_value) : '';
    res.json({ secret_id: row.secret_id, secret_key: row.secret_key, secret_value: revealed });
  } catch (err) {
    console.error('GET /api/secrets/:id/reveal', err);
    res.status(500).json({ error: 'Failed to reveal secret' });
  }
});

/** POST /api/secrets */
router.post('/', async (req, res) => {
  const auth = await getRequestAuth(req);
  if (!auth.authenticated) return res.status(401).json({ error: 'Authentication required' });
  const body = req.body || {};
  const systemId = Number(body.system_id);
  const secretKey = body.secret_key ? String(body.secret_key).trim() : '';
  if (Number.isNaN(systemId)) return res.status(400).json({ error: 'Valid system_id is required' });
  if (!secretKey) return res.status(400).json({ error: 'secret_key is required' });

  try {
    await ensureSystemSecretsTable();
    await ensureUserSystemPermissionsTable();
    const pool = getPool();
    if (!auth.isAdmin) {
      if (!(await hasSystemAccess(pool, systemId, auth.firebaseUid))) return res.status(403).json({ error: 'Not allowed for this system' });
    }
    const result = await pool.query(
      `INSERT INTO system_secrets (system_id, secret_key, secret_value, description, expires_at, is_seeded_from_config, updated_at)
       VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP)
       ON CONFLICT (system_id, secret_key)
       DO UPDATE SET
         secret_value = EXCLUDED.secret_value,
         description = EXCLUDED.description,
         expires_at = EXCLUDED.expires_at,
         is_seeded_from_config = FALSE,
         updated_at = CURRENT_TIMESTAMP
       RETURNING secret_id, system_id, secret_key, secret_value, description, expires_at, is_seeded_from_config, created_at, updated_at`,
      [
        systemId,
        secretKey,
        body.secret_value != null ? encryptSecretValue(body.secret_value) : null,
        body.description != null ? String(body.description) : null,
        body.expires_at ? new Date(body.expires_at) : null,
      ]
    );
    const row = result.rows[0];
    res.status(201).json({
      ...row,
      secret_value: null,
      secret_value_masked: maskedSecretValue(row.secret_value),
      has_value: Boolean(row.secret_value),
    });
  } catch (err) {
    console.error('POST /api/secrets', err);
    res.status(500).json({ error: 'Failed to save secret' });
  }
});

/** POST /api/secrets/bulk-import */
router.post('/bulk-import', async (req, res) => {
  const auth = await getRequestAuth(req);
  if (!auth.authenticated) return res.status(401).json({ error: 'Authentication required' });

  const systemId = Number(req.body?.system_id);
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (Number.isNaN(systemId)) return res.status(400).json({ error: 'Valid system_id is required' });
  if (items.length === 0) return res.status(400).json({ error: 'items cannot be empty' });

  try {
    await ensureSystemSecretsTable();
    await ensureUserSystemPermissionsTable();
    const pool = getPool();
    if (!auth.isAdmin) {
      if (!(await hasSystemAccess(pool, systemId, auth.firebaseUid))) return res.status(403).json({ error: 'Not allowed for this system' });
    }
    let imported = 0;
    for (const item of items) {
      const key = item?.secret_key ? String(item.secret_key).trim() : '';
      if (!key) continue;
      await pool.query(
        `INSERT INTO system_secrets (system_id, secret_key, secret_value, description, expires_at, is_seeded_from_config, updated_at)
         VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP)
         ON CONFLICT (system_id, secret_key)
         DO UPDATE SET
           secret_value = EXCLUDED.secret_value,
           description = EXCLUDED.description,
           expires_at = EXCLUDED.expires_at,
           is_seeded_from_config = FALSE,
           updated_at = CURRENT_TIMESTAMP`,
        [
          systemId,
          key,
          item.secret_value != null ? encryptSecretValue(item.secret_value) : null,
          item.description != null ? String(item.description) : null,
          item.expires_at ? new Date(item.expires_at) : null,
        ]
      );
      imported += 1;
    }
    res.status(201).json({ imported });
  } catch (err) {
    console.error('POST /api/secrets/bulk-import', err);
    res.status(500).json({ error: 'Bulk import failed' });
  }
});

/** PUT /api/secrets/:id */
router.put('/:id', async (req, res) => {
  const auth = await getRequestAuth(req);
  if (!auth.authenticated) return res.status(401).json({ error: 'Authentication required' });
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid secret id' });
  const body = req.body || {};
  try {
    await ensureSystemSecretsTable();
    await ensureUserSystemPermissionsTable();
    const pool = getPool();
    if (!auth.isAdmin) {
      const own = await pool.query(
        `SELECT ss.secret_id
         FROM system_secrets ss
         JOIN systems_config s ON s.system_id = ss.system_id
         WHERE ss.secret_id = $1
           AND (
             s.created_by_firebase_uid = $2 OR EXISTS (
               SELECT 1 FROM users u
               JOIN user_system_permissions usp ON usp.user_id = u.user_id
               WHERE u.firebase_uid = $2 AND usp.system_id = s.system_id
             )
           )`,
        [id, auth.firebaseUid]
      );
      if (!own.rows[0]) return res.status(403).json({ error: 'Not allowed for this secret' });
    }
    const updates = [];
    const values = [];
    let i = 1;
    const fields = ['secret_key', 'secret_value', 'description', 'expires_at'];
    for (const f of fields) {
      if (body[f] !== undefined) {
        updates.push(`${f} = $${i++}`);
        if (f === 'expires_at') {
          values.push(body[f] ? new Date(body[f]) : null);
        } else if (f === 'secret_value') {
          values.push(body[f] != null ? encryptSecretValue(body[f]) : null);
        } else {
          values.push(body[f] != null ? String(body[f]) : null);
        }
      }
    }
    updates.push(`is_seeded_from_config = FALSE`);
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const result = await pool.query(
      `UPDATE system_secrets SET ${updates.join(', ')} WHERE secret_id = $${i}
       RETURNING secret_id, system_id, secret_key, secret_value, description, expires_at, is_seeded_from_config, created_at, updated_at`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Secret not found' });
    const row = result.rows[0];
    res.json({
      ...row,
      secret_value: null,
      secret_value_masked: maskedSecretValue(row.secret_value),
      has_value: Boolean(row.secret_value),
    });
  } catch (err) {
    console.error('PUT /api/secrets/:id', err);
    res.status(500).json({ error: 'Failed to update secret' });
  }
});

/** DELETE /api/secrets/:id */
router.delete('/:id', async (req, res) => {
  const auth = await getRequestAuth(req);
  if (!auth.authenticated) return res.status(401).json({ error: 'Authentication required' });
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid secret id' });
  try {
    await ensureSystemSecretsTable();
    await ensureUserSystemPermissionsTable();
    const pool = getPool();
    const result = auth.isAdmin
      ? await pool.query('DELETE FROM system_secrets WHERE secret_id = $1 RETURNING secret_id', [id])
      : await pool.query(
        `DELETE FROM system_secrets ss
         USING systems_config s
         WHERE ss.secret_id = $1
           AND s.system_id = ss.system_id
           AND (
             s.created_by_firebase_uid = $2 OR EXISTS (
               SELECT 1 FROM users u
               JOIN user_system_permissions usp ON usp.user_id = u.user_id
               WHERE u.firebase_uid = $2 AND usp.system_id = s.system_id
             )
           )
         RETURNING ss.secret_id`,
        [id, auth.firebaseUid]
      );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Secret not found' });
    res.json({ deleted: true, secret_id: id });
  } catch (err) {
    console.error('DELETE /api/secrets/:id', err);
    res.status(500).json({ error: 'Failed to delete secret' });
  }
});

export default router;
