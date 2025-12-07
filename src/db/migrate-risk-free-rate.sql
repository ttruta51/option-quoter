-- Create the risk_free_rate table to track historical risk-free rates
CREATE TABLE IF NOT EXISTS risk_free_rate (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rate NUMERIC NOT NULL,
    source TEXT -- e.g., 'yahoo_finance', 'treasury_gov', 'fallback'
);

-- Create an index on timestamp for faster lookups
CREATE INDEX IF NOT EXISTS idx_risk_free_rate_timestamp ON risk_free_rate (timestamp DESC);

