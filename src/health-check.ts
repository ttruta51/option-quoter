import 'dotenv/config';
import { query } from './db';

export interface HealthCheckResult {
    success: boolean;
    message: string;
    details: {
        quotesCount: number;
        tickersFound: string[];
        tickersMissing: string[];
        riskFreeRateSource: string | null;
        lastQuoteTime: string | null;
    };
}

export async function healthCheck(): Promise<HealthCheckResult> {
    const expectedTickers = (process.env.TICKERS || '')
        .split(',')
        .map(t => t.trim().toUpperCase())
        .filter(t => t.length > 0);

    if (expectedTickers.length === 0) {
        return {
            success: false,
            message: 'No tickers configured in TICKERS environment variable',
            details: {
                quotesCount: 0,
                tickersFound: [],
                tickersMissing: [],
                riskFreeRateSource: null,
                lastQuoteTime: null
            }
        };
    }

    try {
        // Check for quotes saved today (or most recent trading day)
        const quotesResult = await query(`
            SELECT
                COUNT(*) as count,
                MAX(time)::text as last_time
            FROM option_quotes
            WHERE time >= NOW() - INTERVAL '24 hours'
        `);

        const quotesCount = parseInt(quotesResult.rows[0].count, 10);
        const lastQuoteTime: string | null = quotesResult.rows[0].last_time ?? null;

        const tickersResult = await query(`
            SELECT DISTINCT ticker
            FROM option_quotes
            WHERE time >= NOW() - INTERVAL '24 hours'
        `);
        const tickersFound: string[] = tickersResult.rows.map(r => r.ticker);

        // Check risk-free rate
        const riskFreeResult = await query(`
            SELECT source, timestamp
            FROM risk_free_rate
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            ORDER BY timestamp DESC
            LIMIT 1
        `);

        const riskFreeRateSource = riskFreeResult.rows[0]?.source || null;

        // Find missing tickers
        const tickersMissing = expectedTickers.filter(
            t => !tickersFound.map((f: string) => f.toUpperCase()).includes(t)
        );

        // Determine success
        const success = quotesCount > 0 &&
                       tickersMissing.length === 0 &&
                       riskFreeRateSource === 'yahoo_finance';

        let message = '';
        if (quotesCount === 0) {
            message = 'CRITICAL: No quotes saved in the last 24 hours!';
        } else if (tickersMissing.length > 0) {
            message = `WARNING: Missing data for tickers: ${tickersMissing.join(', ')}`;
        } else if (riskFreeRateSource !== 'yahoo_finance') {
            message = `WARNING: Risk-free rate using fallback (${riskFreeRateSource || 'none'})`;
        } else {
            message = `OK: ${quotesCount} quotes saved for ${tickersFound.length} tickers`;
        }

        return {
            success,
            message,
            details: {
                quotesCount,
                tickersFound,
                tickersMissing,
                riskFreeRateSource,
                lastQuoteTime
            }
        };

    } catch (error) {
        return {
            success: false,
            message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: {
                quotesCount: 0,
                tickersFound: [],
                tickersMissing: expectedTickers,
                riskFreeRateSource: null,
                lastQuoteTime: null
            }
        };
    }
}

export function printHealthCheck(result: HealthCheckResult) {
    console.log('='.repeat(60));
    console.log('Option Quoter Health Check');
    console.log('='.repeat(60));
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('');
    console.log(`Status: ${result.success ? '✓ HEALTHY' : '✗ UNHEALTHY'}`);
    console.log(`Message: ${result.message}`);
    console.log('');
    console.log('Details:');
    console.log(`  Quotes count (24h): ${result.details.quotesCount}`);
    console.log(`  Tickers found: ${result.details.tickersFound.join(', ') || 'none'}`);
    console.log(`  Tickers missing: ${result.details.tickersMissing.join(', ') || 'none'}`);
    console.log(`  Risk-free rate source: ${result.details.riskFreeRateSource || 'none'}`);
    console.log(`  Last quote time: ${result.details.lastQuoteTime || 'none'}`);
    console.log('');
    console.log('='.repeat(60));
}

// Allow running locally with `npm run health-check`
if (require.main === module) {
    healthCheck()
        .then(result => {
            printHealthCheck(result);
            if (!result.success) process.exit(1);
        })
        .catch(error => {
            console.error('Health check failed:', error);
            process.exit(1);
        });
}
