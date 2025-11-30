import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { config } from '../config';
import { query, closeDb } from './index';

async function createDatabaseIfNotExists() {
    // Connect to default 'postgres' database to check/create our target db
    const client = new Client({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: 'postgres', // Connect to default DB
    });

    try {
        await client.connect();

        // Check if database exists
        const res = await client.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            [config.db.database]
        );

        if (res.rowCount === 0) {
            console.log(`Database '${config.db.database}' does not exist. Creating...`);
            // CREATE DATABASE cannot run in a transaction block, so we can't use parameterized query for the DB name directly in a simple way safely without sanitization, 
            // but since this is a local setup script and config comes from env, we'll trust it or just use simple string interpolation carefully.
            // Note: identifiers should be double-quoted.
            await client.query(`CREATE DATABASE "${config.db.database}"`);
            console.log(`Database '${config.db.database}' created successfully.`);
        } else {
            console.log(`Database '${config.db.database}' already exists.`);
        }
    } catch (err) {
        console.error('Error checking/creating database:', err);
        throw err;
    } finally {
        await client.end();
    }
}

async function setupDatabase() {
    try {
        await createDatabaseIfNotExists();

        console.log('Setting up database schema...');

        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Execute the SQL commands
        // Note: Splitting by ';' might be naive if there are complex statements, 
        // but for this schema it should work fine. 
        // However, pg driver can often handle multiple statements in one query call.
        await query(schemaSql);

        console.log('Database schema applied successfully.');
    } catch (error) {
        console.error('Error setting up database:', error);
        process.exit(1);
    } finally {
        await closeDb();
    }
}

if (require.main === module) {
    setupDatabase();
}

export { setupDatabase };
