import pkg from 'pg';
import dotenv from 'dotenv';

// When run embedded (api-backend mount), env is set by the host; skip .env to avoid overwriting
if (!process.env.GRADING_EMBEDDED) {
  dotenv.config();
}

const { Pool } = pkg;

// Use connection string if available, otherwise use individual parameters
export const pool = process.env.DB_CONNECTION_STRING
  ? new Pool({ connectionString: process.env.DB_CONNECTION_STRING })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    }); 