import 'dotenv/config';
import { config } from './config';
import { yahooService } from './services/yahoo';
import { storageService } from './services/storage';
import { query, closeDb } from './db';

async function testDatabaseConnection() {
    try {
        console.log('Testing database connection...');
        console.log(`DB Host: ${config.db.host}:${config.db.port}`);
        console.log(`DB Name: ${config.db.database}`);
        console.log(`DB User: ${config.db.user}`);
        console.log(`DB Password: ${config.db.password ? '***' + config.db.password.slice(-3) : 'NOT SET'}`);
        
        // Validate host format
        if (!config.db.host || config.db.host.trim() === '') {
            console.error('ERROR: DB_HOST is empty or not set!');
            return false;
        }
        
        if (config.db.host.includes('postgresql://') || config.db.host.includes('postgres://')) {
            console.error('ERROR: DB_HOST should be just the hostname, not a full connection string!');
            console.error('Example: db.xxxxx.supabase.co (not postgresql://postgres:pass@db.xxxxx...)');
            return false;
        }
        
        const result = await query('SELECT NOW() as current_time, version() as pg_version');
        console.log('Database connection successful!');
        console.log(`PostgreSQL version: ${result.rows[0].pg_version.substring(0, 50)}...`);
        console.log(`Current time: ${result.rows[0].current_time}`);
        return true;
    } catch (error) {
        console.error('Database connection failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            if (error.message.includes('EAI_AGAIN') || error.message.includes('getaddrinfo')) {
                console.error('\n⚠️  DNS Resolution Error - This usually means:');
                console.error('   1. DB_HOST is incorrect or incomplete');
                console.error('   2. DB_HOST should be just the hostname (e.g., db.xxxxx.supabase.co)');
                console.error('   3. Make sure there are no extra spaces or characters');
                console.error('   4. For Supabase, use the host from: Project Settings → Database → Connection string');
            }
        }
        return false;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('Option Quoter Service Starting...');
    console.log('='.repeat(60));
    
    // Validate configuration
    console.log('\nConfiguration:');
    console.log(`Tickers to process: ${config.tickers.length > 0 ? config.tickers.join(', ') : 'NONE - CHECK TICKERS SECRET!'}`);
    console.log(`Risk-free rate: ${config.riskFreeRate}`);
    
    if (config.tickers.length === 0) {
        console.error('\nERROR: No tickers configured!');
        console.error('Please set the TICKERS secret in GitHub Actions (e.g., "AAPL,MSFT,GOOGL")');
        process.exit(1);
    }
    
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        console.error('\nERROR: Cannot connect to database. Check your database credentials in GitHub Secrets.');
        process.exit(1);
    }
    
    // Check if table exists
    try {
        const tableCheck = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'option_quotes'
            );
        `);
        if (!tableCheck.rows[0].exists) {
            console.error('\nERROR: option_quotes table does not exist!');
            console.error('Please run the SQL scripts in Supabase SQL Editor to create the table.');
            process.exit(1);
        }
        console.log('✓ option_quotes table exists');
    } catch (error) {
        console.error('Error checking table:', error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Starting to fetch quotes...');
    console.log('='.repeat(60) + '\n');

    let totalQuotes = 0;
    try {
        for (const ticker of config.tickers) {
            console.log(`\n[${ticker}] Processing...`);
            const quotes = await yahooService.fetchOptionQuotes(ticker);

            if (quotes.length > 0) {
                console.log(`[${ticker}] Fetched ${quotes.length} quotes, saving to database...`);
                await storageService.saveQuotes(quotes);
                console.log(`[${ticker}] ✓ Successfully saved ${quotes.length} quotes`);
                totalQuotes += quotes.length;
            } else {
                console.log(`[${ticker}] ⚠ No quotes found (this might be normal if market is closed or no options available)`);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`Job completed successfully! Total quotes saved: ${totalQuotes}`);
        console.log('='.repeat(60));
    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('FATAL ERROR in main loop:');
        console.error('='.repeat(60));
        console.error(error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        process.exit(1);
    } finally {
        console.log('\nClosing database connection...');
        await closeDb();
    }
}

main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
