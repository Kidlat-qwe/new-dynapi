-- Creates system_secrets table for admin Secrets page.
-- Run on the same database used by api-backend (DB_NAME in api-backend/.env).

BEGIN;

CREATE TABLE IF NOT EXISTS system_secrets (
  secret_id SERIAL PRIMARY KEY,
  system_id INT NOT NULL REFERENCES systems_config(system_id) ON DELETE CASCADE,
  secret_key VARCHAR(255) NOT NULL,
  secret_value TEXT,
  description TEXT,
  expires_at TIMESTAMP,
  is_seeded_from_config BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(system_id, secret_key)
);

CREATE INDEX IF NOT EXISTS idx_system_secrets_system_id ON system_secrets(system_id);
CREATE INDEX IF NOT EXISTS idx_system_secrets_key ON system_secrets(secret_key);

COMMIT;
