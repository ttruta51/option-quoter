import 'dotenv/config';
import { config } from './config';
import { yahooService } from './services/yahoo';
import { storageService } from './services/storage';
import { fetchRiskFreeRate } from './services/risk-free-rate';
import { query } from './db';
import { ensureSchema } from './db/schema';

async function connectToDatabase() {
    if (!config.db.clusterArn || !config.db.secretArn) {
        throw new Error('DB_CLUSTER_ARN and DB_SECRET_ARN must be set (see the OptionQuoterStack outputs)');
    }
    console.log('Connecting to database (this wakes the cluster if it is paused)...');
    console.log(`DB Cluster: ${config.db.clusterArn}`);
    console.log(`DB Name: ${config.db.database}`);

    const result = await query('SELECT NOW() as current_time, version() as pg_version');
    console.log('Database connection successful!');
    console.log(`PostgreSQL version: ${result.rows[0].pg_version.substring(0, 50)}...`);
    console.log(`Current time: ${result.rows[0].current_time}`);

    await ensureSchema();
    console.log('✓ Database schema is up to date');
}

/**
 * Fetches option quotes for all configured tickers and saves them.
 * Throws on failure so the Lambda invocation is marked as an error (which triggers the alarm).
 */
export async function runFetch(): Promise<{ totalQuotes: number }> {
    console.log('='.repeat(60));
    console.log('Option Quoter Service Starting...');
    console.log('='.repeat(60));

    // Validate configuration
    console.log('\nConfiguration:');
    if (config.tickers.length === 0) {
        throw new Error('No tickers configured! Set the TICKERS environment variable (e.g., "AAPL,MSFT,GOOGL")');
    }
    console.log(`Tickers to process: ${config.tickers.join(', ')}`);
    if (config.extendedExpirationTickers.length > 0) {
        console.log(`Extended expiration tickers (70 days): ${config.extendedExpirationTickers.join(', ')}`);
        console.log(`Other tickers (14 days): ${config.tickers.filter(t => !config.extendedExpirationTickers.includes(t.toUpperCase())).join(', ') || 'none'}`);
    } else {
        console.log(`All tickers will use 14-day expiration window`);
    }

    await connectToDatabase();

    // Fetch current risk-free rate
    console.log('Fetching current risk-free rate (10-year Treasury yield)...');
    const riskFreeRateResult = await fetchRiskFreeRate();
    config.riskFreeRate = riskFreeRateResult.rate;
    console.log(`Risk-free rate: ${(riskFreeRateResult.rate * 100).toFixed(2)}% (source: ${riskFreeRateResult.source})`);

    // Save risk-free rate to database
    await storageService.saveRiskFreeRate(riskFreeRateResult.rate, riskFreeRateResult.source);

    console.log('\n' + '='.repeat(60));
    console.log('Starting to fetch quotes...');
    console.log('='.repeat(60) + '\n');

    let totalQuotes = 0;
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

    return { totalQuotes };
}

// Allow running locally with `npm run fetch`
if (require.main === module) {
    runFetch().catch((error) => {
        console.error('FATAL ERROR:', error);
        process.exit(1);
    });
}
