-- Create the option_quotes table
CREATE TABLE IF NOT EXISTS option_quotes (
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
    
    -- Unique constraint to prevent duplicate entries
    UNIQUE (time, ticker, expiration_date, strike, type)
);

-- Create an index on ticker and expiration for faster lookups
CREATE INDEX IF NOT EXISTS idx_option_quotes_ticker_expiry ON option_quotes (ticker, expiration_date, time DESC);
