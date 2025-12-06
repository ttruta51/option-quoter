import YahooFinance from 'yahoo-finance2';
import { DateTime } from 'luxon';
import { OptionQuote } from '../models';
import { calculateGreeks, calculateTimeToExpiration } from './greeks';
import { config } from '../config';

// Create a yahooFinance instance for v3 API
const yahooFinance = new YahooFinance();

export class YahooFinanceService {

    /**
     * Fetches option quotes for a given ticker.
     * For SPY, RSP, TLT: fetches expirations up to 70 days out.
     * For other tickers: fetches expirations up to 14 days out.
     */
    async fetchOptionQuotes(ticker: string): Promise<OptionQuote[]> {
        const expirationDays = config.getExpirationDays(ticker);
        console.log(`Fetching options for ${ticker} (expirations up to ${expirationDays} days out)...`);

        try {
            // First, fetch the summary to get available expiration dates and stock price
            const summary = await yahooFinance.options(ticker, {}) as any;

            if (!summary.expirationDates || summary.expirationDates.length === 0) {
                console.log(`No expiration dates found for ${ticker}`);
                return [];
            }

            // Get the current stock price from the quote
            const stockPrice = summary.quote?.regularMarketPrice || summary.quote?.price;
            if (!stockPrice) {
                console.warn(`Warning: Could not get stock price for ${ticker}, Greeks will not be calculated`);
            }

            const now = DateTime.now();
            const maxDaysFromNow = now.plus({ days: expirationDays });

            // Filter expirations: must be in the future and within the configured days
            const targetExpirations = summary.expirationDates.filter((date: Date) => {
                const expDate = DateTime.fromJSDate(new Date(date));
                return expDate >= now.startOf('day') && expDate <= maxDaysFromNow;
            });

            console.log(`Found ${targetExpirations.length} expirations for ${ticker} within ${expirationDays} days.`);

            const allQuotes: OptionQuote[] = [];

            // Fetch data for each target expiration
            for (const expDate of targetExpirations) {
                // v3 API uses 'date' parameter with Date object or timestamp
                const queryOptions = { date: new Date(expDate) };
                const chainResult = await yahooFinance.options(ticker, queryOptions) as any;

                if (!chainResult.options) continue;

                // Process calls and puts
                for (const optionChain of chainResult.options) {
                    const calls = optionChain.calls || [];
                    const puts = optionChain.puts || [];

                    const processOption = (opt: any, type: 'CALL' | 'PUT') => {
                        // Skip if critical data is missing
                        if (!opt.strike || !opt.expiration) return;

                        // Handle expiration - v3 API returns Date objects
                        let expirationDate: string;
                        if (opt.expiration instanceof Date) {
                            expirationDate = DateTime.fromJSDate(opt.expiration).toFormat('yyyy-MM-dd');
                        } else if (typeof opt.expiration === 'number') {
                            expirationDate = DateTime.fromSeconds(opt.expiration).toFormat('yyyy-MM-dd');
                        } else {
                            // Fallback - try to parse as is
                            expirationDate = DateTime.fromJSDate(new Date(opt.expiration)).toFormat('yyyy-MM-dd');
                        }

                        const quote: OptionQuote = {
                            ticker: ticker,
                            expirationDate: expirationDate,
                            strike: opt.strike,
                            type: type,
                            bid: opt.bid || 0,
                            ask: opt.ask || 0,
                            last: opt.lastPrice || 0,
                            volume: opt.volume || 0,
                            openInterest: opt.openInterest || 0,
                            impliedVolatility: opt.impliedVolatility || 0,
                            timestamp: new Date(), // Capture time
                            underlyingLast: stockPrice
                        };

                        // Calculate Greeks if we have all required data
                        if (stockPrice && opt.impliedVolatility && opt.impliedVolatility > 0) {
                            const timeToExpiration = calculateTimeToExpiration(expirationDate);
                            const greeks = calculateGreeks({
                                stockPrice,
                                strikePrice: opt.strike,
                                timeToExpiration,
                                volatility: opt.impliedVolatility,
                                riskFreeRate: config.riskFreeRate,
                                optionType: type === 'CALL' ? 'call' : 'put'
                            });

                            if (greeks) {
                                quote.delta = greeks.delta;
                                quote.probOTM = greeks.probOTM;
                            }
                        }

                        allQuotes.push(quote);
                    };

                    calls.forEach((c: any) => processOption(c, 'CALL'));
                    puts.forEach((p: any) => processOption(p, 'PUT'));
                }
            }

            return allQuotes;

        } catch (error) {
            console.error(`Error fetching options for ${ticker}:`, error);
            return [];
        }
    }
}

export const yahooService = new YahooFinanceService();
