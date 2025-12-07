import fs from 'fs';
import path from 'path';
import { query, closeDb } from './index';

async function setupDatabase() {
    try {
        console.log('Setting up database schema...');

        // Read and execute schema.sql
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await query(schemaSql);

        // Read and execute migrate-greeks.sql if needed
        const migrateGreeksPath = path.join(__dirname, 'migrate-greeks.sql');
        const migrateGreeksSql = fs.readFileSync(migrateGreeksPath, 'utf8');
        await query(migrateGreeksSql);

        // Read and execute migrate-risk-free-rate.sql
        const migrateRiskFreeRatePath = path.join(__dirname, 'migrate-risk-free-rate.sql');
        const migrateRiskFreeRateSql = fs.readFileSync(migrateRiskFreeRatePath, 'utf8');
        await query(migrateRiskFreeRateSql);

        console.log('Database schema applied successfully.');
    } catch (error) {
        console.error('Error setting up database:', error);
        // Don't exit if tables already exist (idempotent)
        if (error instanceof Error && error.message.includes('already exists')) {
            console.log('Tables already exist, skipping...');
        } else {
            throw error;
        }
    } finally {
        await closeDb();
    }
}

if (require.main === module) {
    setupDatabase().catch(console.error);
}

export { setupDatabase };


