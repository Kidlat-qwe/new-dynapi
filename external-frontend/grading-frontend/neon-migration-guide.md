# Neon Database Migration Guide

This guide explains how to migrate your PostgreSQL database to Neon PostgreSQL using the provided migration script.

## Prerequisites

- Node.js installed
- PostgreSQL database with data to migrate
- Neon database account and connection string

## Steps to Migrate

1. **Install Dependencies**

   ```
   npm install
   ```

2. **Run the Migration Script**

   ```
   node neon-migrate.js
   ```

3. **Follow the Prompts**
   - Enter your PostgreSQL connection details when prompted
   - Confirm to drop existing tables and recreate schema
   - Confirm to proceed with data migration

4. **Verify the Migration**

   Use the test connection script to verify that all tables and data were migrated successfully:

   ```
   node test-neon-connection.js
   ```

## Migration Process

The migration script performs these steps:

1. Connects to both the source PostgreSQL database and the target Neon database
2. Creates the database schema in Neon using the structure defined in DATABASE.md
3. Migrates all data from the source database to Neon
4. Updates the .env file with the Neon connection string

## Important Files

- `neon-migrate.js` - The main migration script
- `test-neon-connection.js` - Script to test the Neon database connection
- `DATABASE.md` - Contains the database schema used for migration

## Running the Application with Neon

After successful migration, your application should be configured to use the Neon database automatically. The connection string is added to your .env file during migration.

To start your backend server with the Neon database:

```
cd grades_backend
npm start
```

## PowerShell Command

For Windows PowerShell users, use these commands instead of the ones with && symbols:

```powershell
cd grades_backend
npm start
``` 