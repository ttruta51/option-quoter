import { query } from './index';

// Idempotent schema, applied at the start of every fetch run so a fresh
// cluster needs no manual setup step. Kept in TypeScript (not a .sql file)
// so it is bundled into the Lambda; the Data API runs one statement per call.
const SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS option_quotes (
        id SERIAL PRIMARY KEY,
        time TIMESTAMPTZ NOT NULL,
        ticker TEXT NOT NULL,
        expiration_date DATE NOT NULL,
        strike NUMERIC NOT NULL,
        type TEXT NOT NULL, -- 'CALL' or 'PUT'
        bid NUMERIC,
        ask NUMERIC,
        last NUMERIC,
        volume INTEGER,
        open_interest INTEGER,
        implied_volatility NUMERIC,
        delta NUMERIC,
        prob_otm NUMERIC,
        underlying_last NUMERIC,
        UNIQUE (time, ticker, expiration_date, strike, type)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_option_quotes_ticker_expiry ON option_quotes (ticker, expiration_date, time DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_option_quotes_time ON option_quotes (time DESC)`,
    `CREATE TABLE IF NOT EXISTS risk_free_rate (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        rate NUMERIC NOT NULL,
        source TEXT -- e.g., 'yahoo_finance', 'treasury_gov', 'fallback'
    )`,
    `CREATE INDEX IF NOT EXISTS idx_risk_free_rate_timestamp ON risk_free_rate (timestamp DESC)`,
];

export async function ensureSchema(): Promise<void> {
    for (const statement of SCHEMA_STATEMENTS) {
        await query(statement);
    }
}

if (require.main === module) {
    ensureSchema()
        .then(() => console.log('Database schema applied successfully.'))
        .catch((error) => {
            console.error('Error setting up database:', error);
            process.exit(1);
        });
}
