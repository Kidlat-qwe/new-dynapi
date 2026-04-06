import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, 'grades_backend', '.env') });

const { Pool } = pkg;

// Use Neon connection string
const connectionString = process.env.DB_CONNECTION_STRING;
const pool = new Pool({ connectionString });

async function testConnection() {
  try {
    console.log('Testing connection to Neon PostgreSQL database...');
    
    // Attempt a simple query
    const result = await pool.query('SELECT current_database() as db, current_user as user');
    console.log('Connection successful!');
    console.log('Connected to database:', result.rows[0].db);
    console.log('As user:', result.rows[0].user);
    
    // Test listing tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log(`\nFound ${tables.rows.length} tables in the database:`);
    tables.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });
    
    // Count records in each table
    console.log('\nRecord counts by table:');
    for (const row of tables.rows) {
      const tableName = row.table_name;
      const countResult = await pool.query(`SELECT COUNT(*) FROM "${tableName}"`);
      const count = parseInt(countResult.rows[0].count, 10);
      console.log(`${tableName}: ${count} records`);
    }
    
  } catch (error) {
    console.error('Connection test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testConnection(); 