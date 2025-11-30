import * as bs from 'black-scholes';

/**
 * Calculate option Greeks using Black-Scholes model
 */
export interface GreeksInput {
    stockPrice: number;
    strikePrice: number;
    timeToExpiration: number; // in years
    volatility: number; // implied volatility (as decimal, e.g., 0.3 for 30%)
    riskFreeRate: number; // as decimal, e.g., 0.05 for 5%
    optionType: 'call' | 'put';
}

export interface GreeksOutput {
    delta: number;
    probOTM: number; // Probability of expiring Out of The Money
}

/**
 * Calculate option Greeks including Delta and Probability OTM
 */
export function calculateGreeks(input: GreeksInput): GreeksOutput | null {
    try {
        const { stockPrice, strikePrice, timeToExpiration, volatility, riskFreeRate, optionType } = input;

        // Validate inputs
        if (stockPrice <= 0 || strikePrice <= 0 || timeToExpiration <= 0 || volatility <= 0) {
            console.warn('Invalid input for Greeks calculation:', input);
            return null;
        }

        // Calculate d1 and d2 from Black-Scholes formula
        const sqrtT = Math.sqrt(timeToExpiration);
        const d1 = (Math.log(stockPrice / strikePrice) + (riskFreeRate + volatility * volatility / 2) * timeToExpiration) / (volatility * sqrtT);
        const d2 = d1 - volatility * sqrtT;

        // Use the stdNormCDF from black-scholes library if available
        const cdf = (bs as any).stdNormCDF || cumulativeNormalDistribution;

        // Calculate delta using cumulative normal distribution
        // Delta for call = N(d1)
        // Delta for put = N(d1) - 1
        const nd1 = cdf(d1);
        const delta = optionType === 'call' ? nd1 : nd1 - 1;

        // Calculate probability OTM using d2
        // For calls: probITM = N(d2), probOTM = 1 - N(d2)
        // For puts: probITM = 1 - N(d2), probOTM = N(d2)
        const nd2 = cdf(d2);
        const probOTM = optionType === 'call' ? 1 - nd2 : nd2;

        return {
            delta,
            probOTM
        };
    } catch (error) {
        console.error('Error calculating Greeks:', error);
        return null;
    }
}

/**
 * Cumulative normal distribution function
 * Uses approximation for standard normal CDF
 */
function cumulativeNormalDistribution(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    return x > 0 ? 1 - probability : probability;
}

/**
 * Calculate time to expiration in years
 */
export function calculateTimeToExpiration(expirationDate: string): number {
    const now = new Date();
    const expiry = new Date(expirationDate);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const years = diffDays / 365;

    return Math.max(years, 0.001); // Minimum 0.001 years to avoid division by zero
}
