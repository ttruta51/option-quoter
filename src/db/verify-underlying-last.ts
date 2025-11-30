import { query, closeDb } from './index';

async function verify() {
    console.log('Verifying underlying_last...');
    try {
        const res = await query(`
            SELECT ticker, underlying_last, time 
            FROM option_quotes 
            ORDER BY time DESC 
            LIMIT 5;
        `);

        console.table(res.rows);

        if (res.rows.length > 0 && res.rows[0].underlying_last != null) {
            console.log('Verification SUCCESS: underlying_last is populated.');
        } else {
            console.log('Verification FAILED: underlying_last is missing or null.');
        }
    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await closeDb();
    }
}

verify();
