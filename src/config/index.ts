import 'dotenv/config';

// Parse tickers that should fetch options up to 70 days out (default is 14 days)
const extendedExpirationTickers = (process.env.EXTENDED_EXPIRATION_TICKERS || '')
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);

export const config = {
    db: {
        // Aurora cluster ARN and the Secrets Manager secret holding its credentials (used by the Data API)
        clusterArn: process.env.DB_CLUSTER_ARN || '',
        secretArn: process.env.DB_SECRET_ARN || '',
        database: process.env.DB_NAME || 'option_quotes',
    },
    tickers: (process.env.TICKERS || '').split(',').map(t => t.trim()).filter(t => t.length > 0),
    extendedExpirationTickers,
    // Risk-free rate is now fetched dynamically, but we keep this for backward compatibility
    // It will be set at runtime by fetching from Treasury.gov
    riskFreeRate: 0.045, // This will be overridden at runtime
    // Get expiration days for a ticker (70 for extended tickers, 14 for others)
    getExpirationDays: (ticker: string): number => {
        return extendedExpirationTickers.includes(ticker.toUpperCase()) ? 70 : 14;
    },
};
