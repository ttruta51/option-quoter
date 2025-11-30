-- Migration script to add delta and prob_otm columns to option_quotes table

-- Add delta and prob_otm columns
ALTER TABLE option_quotes 
ADD COLUMN IF NOT EXISTS delta NUMERIC,
ADD COLUMN IF NOT EXISTS prob_otm NUMERIC;
