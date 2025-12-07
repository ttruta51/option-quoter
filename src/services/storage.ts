import { query } from '../db';
import { OptionQuote } from '../models';

export class StorageService {

    async saveQuotes(quotes: OptionQuote[]): Promise<void> {
        if (quotes.length === 0) return;

        console.log(`Saving ${quotes.length} quotes to database...`);

        // We'll use a batched insert for performance
        // Construct the query dynamically

        // Columns: time, ticker, expiration_date, strike, type, bid, ask, last, volume, open_interest, implied_volatility, delta, prob_otm, underlying_last
        const text = `
      INSERT INTO option_quotes (
        time, ticker, expiration_date, strike, type, 
        bid, ask, last, volume, open_interest, implied_volatility, delta, prob_otm, underlying_last
      ) VALUES 
    `;


        const values: any[] = [];
        const placeholders: string[] = [];

        let paramIndex = 1;

        for (const q of quotes) {
            placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);

            values.push(
                q.timestamp,
                q.ticker,
                q.expirationDate,
                q.strike,
                q.type,
                q.bid,
                q.ask,
                q.last,
                q.volume,
                q.openInterest,
                q.impliedVolatility,
                q.delta ?? null,
                q.probOTM ?? null,
                q.underlyingLast ?? null
            );
        }

        const queryText = `${text} ${placeholders.join(', ')} ON CONFLICT (time, ticker, expiration_date, strike, type) DO NOTHING`;

        try {
            // Note: Postgres has a limit on parameters (usually 65535). 
            // If we have too many quotes, we should chunk them.
            // 13 params per quote -> max ~5000 quotes per batch.
            // Let's chunk it to be safe, say 1000 quotes per batch.

            const BATCH_SIZE = 1000;
            for (let i = 0; i < quotes.length; i += BATCH_SIZE) {
                const chunk = quotes.slice(i, i + BATCH_SIZE);
                await this.saveBatch(chunk);
            }

            console.log('All quotes saved successfully.');
        } catch (error) {
            console.error('Error saving quotes:', error);
            throw error;
        }
    }

    private async saveBatch(chunk: OptionQuote[]) {
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        for (const q of chunk) {
            placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
            values.push(
                q.timestamp,
                q.ticker,
                q.expirationDate,
                q.strike,
                q.type,
                q.bid,
                q.ask,
                q.last,
                q.volume,
                q.openInterest,
                q.impliedVolatility,
                q.delta ?? null,
                q.probOTM ?? null,
                q.underlyingLast ?? null
            );
        }

        const text = `
        INSERT INTO option_quotes (
            time, ticker, expiration_date, strike, type, 
            bid, ask, last, volume, open_interest, implied_volatility, delta, prob_otm, underlying_last
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (time, ticker, expiration_date, strike, type) DO NOTHING
      `;

        await query(text, values);
    }

    /**
     * Save the risk-free rate to the database
     */
    async saveRiskFreeRate(rate: number, source: string = 'yahoo_finance'): Promise<void> {
        try {
            await query(
                'INSERT INTO risk_free_rate (timestamp, rate, source) VALUES (NOW(), $1, $2)',
                [rate, source]
            );
            console.log(`Saved risk-free rate: ${(rate * 100).toFixed(2)}% (source: ${source})`);
        } catch (error) {
            console.error('Error saving risk-free rate:', error);
            // Don't throw - this is not critical for the main workflow
        }
    }
}

export const storageService = new StorageService();
