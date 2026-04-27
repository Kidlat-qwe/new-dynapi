import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const dbHost = process.env.DB_HOST || 'localhost';
const isLocalDb =
  dbHost === 'localhost' ||
  dbHost === '127.0.0.1' ||
  dbHost === '::1';

/** Neon / RDS / most cloud Postgres require TLS (sslmode=require). Local dev usually does not. */
const useSsl =
  process.env.DB_SSL === 'false' || process.env.DB_SSL === '0'
    ? false
    : process.env.DB_SSL === 'true' ||
      process.env.DB_SSL === '1' ||
      !isLocalDb;

const sslConfig = useSsl
  ? {
      ssl: {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      },
    }
  : {};

// Database connection pool
const pool = new Pool({
  host: dbHost,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'funtalk_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  /** Neon pooler rejects `-c search_path=...` in startup options; set search_path in transactions where needed */
  ...sslConfig,
});

// Neon pooler rejects `-c search_path=...` in startup options; set per session so
// unqualified names (e.g. userstbl) resolve to public.
pool.on('connect', (client) => {
  client.query('SET search_path TO public, pg_catalog').catch((err) => {
    console.error('Failed to set search_path on new pool client:', err.message);
  });
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Query helper function
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Get a client from the pool for transactions
export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
    console.error(`The last executed query on this client was: ${client.lastQuery}`);
  }, 5000);
  
  // Monkey patch the query method to log the query when a client is checked out
  client.query = (...args) => {
    client.lastQuery = args;
    return query(...args);
  };
  
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release();
  };
  
  return client;
};

export default pool;

