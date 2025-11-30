import { query, closeDb } from './index';

async function migrate() {
    console.log('Starting migration: Add underlying_last to option_quotes...');
    try {
        await query(`
            ALTER TABLE option_quotes 
            ADD COLUMN IF NOT EXISTS underlying_last NUMERIC;
        `);
        console.log('Migration successful: Added underlying_last column.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await closeDb();
    }
}

migrate();
