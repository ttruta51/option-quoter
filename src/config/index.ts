import 'dotenv/config';

// Parse tickers that should fetch options up to 70 days out (default is 14 days)
const extendedExpirationTickers = (process.env.EXTENDED_EXPIRATION_TICKERS || '')
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);

export const config = {
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'option_quotes',
    },
    tickers: (process.env.TICKERS || '').split(',').map(t => t.trim()).filter(t => t.length > 0),
    // Risk-free rate is now fetched dynamically, but we keep this for backward compatibility
    // It will be set at runtime by fetching from Treasury.gov
    riskFreeRate: 0.045, // This will be overridden at runtime
    // Get expiration days for a ticker (70 for extended tickers, 14 for others)
    getExpirationDays: (ticker: string): number => {
        return extendedExpirationTickers.includes(ticker.toUpperCase()) ? 70 : 14;
    },
};
