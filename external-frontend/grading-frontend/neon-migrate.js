import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pkg;

// Neon database connection string
const neonConnectionString = 'postgresql://neondb_owner:npg_4z8ePRbJqwFX@ep-twilight-hill-a1hfyfgl-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to get all tables from a database
async function getTables(pool) {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;
  
  try {
    const result = await pool.query(query);
    return result.rows.map(row => row.table_name);
  } catch (error) {
    console.error('Error fetching tables:', error);
    throw error;
  }
}

// Function to extract SQL commands from the DATABASE.md file
function extractSqlCommands(content) {
  // Remove markdown code blocks if they exist
  const sqlContent = content.replace(/```sql/g, '').replace(/```/g, '');
  
  // Regex to find CREATE TABLE statements
  const createTableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.([\w_]+)/gi;
  const createTableMatches = [...sqlContent.matchAll(createTableRegex)];
  
  // Extract table names from CREATE TABLE statements
  const tables = createTableMatches.map(match => match[1]);
  
  return {
    content: sqlContent,
    tables: tables
  };
}

// Function to create the database schema from the SQL content
async function createDatabaseSchema(pool, sqlContent) {
  console.log('Creating database schema...');
  
  try {
    // First try to execute the entire script as a transaction
    try {
      await pool.query('BEGIN');
      await pool.query(sqlContent);
      await pool.query('COMMIT');
      console.log('Schema creation completed successfully!');
      return true;
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Error executing SQL as a transaction:', error.message);
      console.log('Will try to execute statements individually...');
    }
    
    // If transaction fails, split the SQL content and execute statements individually
    const statements = sqlContent.split(';').filter(stmt => stmt.trim() !== '');
    
    let success = 0;
    let failure = 0;
    
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
        success++;
      } catch (error) {
        console.error(`Error executing statement: ${error.message}`);
        console.error(`Statement: ${stmt.substring(0, 100)}...`);
        failure++;
      }
    }
    
    console.log(`Schema creation completed with ${success} successful statements and ${failure} failures.`);
    return true;
  } catch (error) {
    console.error('Error creating database schema:', error);
    return false;
  }
}

// Function to get all data from a table
async function getTableData(pool, tableName) {
  try {
    const query = `SELECT * FROM "${tableName}";`;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error(`Error fetching data from table ${tableName}:`, error);
    return [];
  }
}

// Function to insert data into a table
async function insertData(pool, tableName, data) {
  if (data.length === 0) {
    console.log(`No data to insert for table ${tableName}.`);
    return;
  }
  
  try {
    // For batch inserts
    const batchSize = 50;
    let insertedCount = 0;
    
    // Get column names from the first row
    const columns = Object.keys(data[0]);
    const columnsList = columns.map(c => `"${c}"`).join(', ');
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const valuesList = [];
      const values = [];
      
      batch.forEach((row, rowIndex) => {
        const rowPlaceholders = [];
        
        columns.forEach((col, colIndex) => {
          const paramIndex = rowIndex * columns.length + colIndex + 1;
          rowPlaceholders.push(`$${paramIndex}`);
          values.push(row[col]);
        });
        
        valuesList.push(`(${rowPlaceholders.join(', ')})`);
      });
      
      const query = `INSERT INTO "${tableName}" (${columnsList}) VALUES ${valuesList.join(', ')} ON CONFLICT DO NOTHING;`;
      
      try {
        await pool.query(query, values);
        insertedCount += batch.length;
        console.log(`Inserted ${insertedCount}/${data.length} rows into table ${tableName}...`);
      } catch (error) {
        console.error(`Error batch inserting into table ${tableName}:`, error.message);
        
        // Try inserting one row at a time
        for (const row of batch) {
          try {
            const singleInsertColumns = Object.keys(row);
            const singleInsertColumnsList = singleInsertColumns.map(c => `"${c}"`).join(', ');
            const singleInsertPlaceholders = singleInsertColumns.map((_, i) => `$${i + 1}`).join(', ');
            const singleInsertValues = singleInsertColumns.map(c => row[c]);
            
            const singleQuery = `INSERT INTO "${tableName}" (${singleInsertColumnsList}) VALUES (${singleInsertPlaceholders}) ON CONFLICT DO NOTHING;`;
            await pool.query(singleQuery, singleInsertValues);
            insertedCount++;
          } catch (singleError) {
            console.error(`Error inserting a single row into ${tableName}:`, singleError.message);
          }
        }
      }
    }
    
    console.log(`Completed inserting ${insertedCount} rows into table ${tableName}.`);
  } catch (error) {
    console.error(`Error inserting data into table ${tableName}:`, error);
  }
}

// The main migration function
async function migrateDatabase() {
  console.log('PostgreSQL to Neon Database Migration');
  console.log('====================================');
  
  try {
    // Ask for PostgreSQL connection details
    console.log('\nPlease enter your PostgreSQL connection details:');
    const pgUser = await askQuestion('Username [postgres]: ') || 'postgres';
    const pgPassword = await askQuestion('Password: ');
    if (!pgPassword) {
      console.error('Password is required. Aborting migration.');
      rl.close();
      return;
    }
    const pgHost = await askQuestion('Host [localhost]: ') || 'localhost';
    const pgPort = await askQuestion('Port [5432]: ') || '5432';
    const pgDatabase = await askQuestion('Database name [GradingSystem]: ') || 'GradingSystem';
    
    // Source database connection
    const sourceConfig = {
      user: pgUser,
      host: pgHost,
      database: pgDatabase,
      password: pgPassword,
      port: parseInt(pgPort, 10)
    };
    
    console.log('\nConnecting to source database...');
    const sourcePool = new Pool(sourceConfig);
    
    // Test the connection
    try {
      await sourcePool.query('SELECT 1');
      console.log('Source database connection successful!');
    } catch (error) {
      console.error('Error connecting to source database:', error);
      rl.close();
      return;
    }
    
    // Target database connection
    console.log('\nConnecting to target Neon database...');
    const targetPool = new Pool({ connectionString: neonConnectionString });
    
    // Test the connection
    try {
      await targetPool.query('SELECT 1');
      console.log('Target database connection successful!');
    } catch (error) {
      console.error('Error connecting to target database:', error);
      rl.close();
      sourcePool.end();
      return;
    }
    
    console.log('\nStarting database migration...');
    
    // Step 1: Read the DATABASE.md file
    const schemaFile = path.join(__dirname, 'DATABASE.md');
    console.log(`Reading schema from ${schemaFile}...`);
    
    if (!fs.existsSync(schemaFile)) {
      console.error(`Schema file ${schemaFile} not found!`);
      rl.close();
      sourcePool.end();
      targetPool.end();
      return;
    }
    
    const schemaContent = fs.readFileSync(schemaFile, 'utf8');
    const { content: sqlContent, tables: schemaTableNames } = extractSqlCommands(schemaContent);
    
    console.log(`Found ${schemaTableNames.length} tables in the schema: ${schemaTableNames.join(', ')}`);
    
    // Ask if we should drop existing tables
    const targetTables = await getTables(targetPool);
    
    if (targetTables.length > 0) {
      console.log(`\nFound ${targetTables.length} existing tables in target database: ${targetTables.join(', ')}`);
      const resetChoice = await askQuestion('Do you want to drop existing tables and recreate schema? (y/n): ');
      
      if (resetChoice.toLowerCase() === 'y') {
        // Drop all tables
        for (const tableName of targetTables) {
          try {
            await targetPool.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
            console.log(`Dropped table ${tableName}`);
          } catch (error) {
            console.error(`Error dropping table ${tableName}:`, error.message);
          }
        }
        
        // Create schema from the DATABASE.md file
        const schemaSuccess = await createDatabaseSchema(targetPool, sqlContent);
        if (!schemaSuccess) {
          console.error('Schema creation failed. Aborting migration.');
          rl.close();
          sourcePool.end();
          targetPool.end();
          return;
        }
      }
    } else {
      // Create schema from the DATABASE.md file
      const schemaSuccess = await createDatabaseSchema(targetPool, sqlContent);
      if (!schemaSuccess) {
        console.error('Schema creation failed. Aborting migration.');
        rl.close();
        sourcePool.end();
        targetPool.end();
        return;
      }
    }
    
    // Step 2: Get tables from source database
    const sourceTables = await getTables(sourcePool);
    console.log(`\nFound ${sourceTables.length} tables in source database: ${sourceTables.join(', ')}`);
    
    // Step 3: Confirm data migration
    const confirmMigration = await askQuestion('\nReady to migrate data. Proceed? (y/n): ');
    if (confirmMigration.toLowerCase() !== 'y') {
      console.log('Migration cancelled.');
      rl.close();
      sourcePool.end();
      targetPool.end();
      return;
    }
    
    // Step 4: Determine order of tables (tables with dependencies should come later)
    // For simplicity, we'll use a predefined order
    const tableOrder = [
      'school_year',
      'subject',
      'users',
      'class',
      'class_student',
      'class_subject',
      'activities',
      'activity_scores',
      'computed_grades',
      'grading_criteria',
      'student_attendance',
      'student_grade',
      'student_status'
    ];
    
    // Sort tables based on the predefined order
    const orderedTables = [];
    
    // First add tables in the predefined order if they exist
    for (const tableName of tableOrder) {
      if (sourceTables.includes(tableName)) {
        orderedTables.push(tableName);
      }
    }
    
    // Then add any remaining tables not in the predefined order
    for (const tableName of sourceTables) {
      if (!orderedTables.includes(tableName)) {
        orderedTables.push(tableName);
      }
    }
    
    console.log(`\nMigrating data in the following order: ${orderedTables.join(', ')}`);
    
    // Step 5: Migrate data for each table
    for (const tableName of orderedTables) {
      console.log(`\nMigrating data for table ${tableName}...`);
      
      // Get data from source table
      const data = await getTableData(sourcePool, tableName);
      console.log(`Retrieved ${data.length} rows from table ${tableName}.`);
      
      // Insert data into target table
      await insertData(targetPool, tableName, data);
    }
    
    // Step 6: Update the .env file with the connection string
    const envPath = path.join(__dirname, 'grades_backend', '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      if (!envContent.includes('DB_CONNECTION_STRING')) {
        envContent += '\n# Neon Database Connection String\n';
        envContent += `DB_CONNECTION_STRING=${neonConnectionString}\n`;
        fs.writeFileSync(envPath, envContent);
        console.log('\nUpdated .env file with Neon connection string.');
      }
    }
    
    console.log('\nDatabase migration completed successfully!');
    
    // Close connections
    sourcePool.end();
    targetPool.end();
    rl.close();
    
  } catch (error) {
    console.error('Migration failed:', error);
    rl.close();
  }
}

// Run the migration
migrateDatabase(); 