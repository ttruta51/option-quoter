/**
 * Service to fetch the current risk-free rate (10-year Treasury yield)
 * Uses Yahoo Finance to get ^TNX (10-Year Treasury Note yield)
 */

import YahooFinance from 'yahoo-finance2';

// Fallback rate if API fails (4.5% as decimal)
const FALLBACK_RATE = 0.045;

const yahooFinance = new YahooFinance();

export interface RiskFreeRateResult {
    rate: number;
    source: string;
}

/**
 * Fetches the current 10-year Treasury yield from Yahoo Finance (^TNX)
 * Returns the rate as a decimal (e.g., 0.045 for 4.5%) and the source
 */
export async function fetchRiskFreeRate(): Promise<RiskFreeRateResult> {
    try {
        // ^TNX is the Yahoo Finance symbol for 10-Year Treasury Note yield
        const quote = await yahooFinance.quote('^TNX');
        
        if (!quote) {
            throw new Error('No quote data returned from Yahoo Finance');
        }
        
        // The quote should have a regularMarketPrice or price field
        const ratePercent = quote.regularMarketPrice || quote.price || quote.regularMarketPreviousClose;
        
        if (!ratePercent || ratePercent <= 0) {
            throw new Error(`Invalid rate value: ${ratePercent}`);
        }
        
        // Convert percentage to decimal (e.g., 4.5 -> 0.045)
        const rate = ratePercent / 100;
        
        if (isNaN(rate) || rate <= 0) {
            throw new Error(`Invalid rate value: ${ratePercent}`);
        }
        
        return { rate, source: 'yahoo_finance' };
        
    } catch (error) {
        console.warn(`Warning: Failed to fetch risk-free rate from Yahoo Finance:`, error instanceof Error ? error.message : error);
        // Try alternative method
        return await fetchRiskFreeRateAlternative();
    }
}

/**
 * Alternative method: Fetch from Treasury.gov API
 * This uses a simpler JSON endpoint as fallback
 */
async function fetchRiskFreeRateAlternative(): Promise<RiskFreeRateResult> {
    try {
        // Try using Treasury.gov fiscal data API
        const url = 'https://api.fiscaldata.treasury.gov/services/api/v1/accounting/od/avg_interest_rates?filter=security_desc:eq:"Treasury 10-Year"&sort=-record_date&page[size]=1';
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Treasury API returned status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            const rateString = data.data[0].avg_interest_rate_amt;
            if (rateString) {
                const rate = parseFloat(rateString) / 100;
                if (!isNaN(rate) && rate > 0) {
                    return { rate, source: 'treasury_gov' };
                }
            }
        }
        
        throw new Error('No valid rate found in Treasury API');
        
    } catch (error) {
        console.warn(`Alternative API also failed, using fallback rate: ${(FALLBACK_RATE * 100).toFixed(2)}%`);
        return { rate: FALLBACK_RATE, source: 'fallback' };
    }
}

