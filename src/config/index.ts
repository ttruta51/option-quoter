import 'dotenv/config';

export const config = {
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'option_quotes',
    },
    tickers: (process.env.TICKERS || '').split(',').map(t => t.trim()).filter(t => t.length > 0),
    riskFreeRate: parseFloat(process.env.RISK_FREE_RATE || '0.045'),
};
