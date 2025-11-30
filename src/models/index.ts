export interface OptionQuote {
    ticker: string;
    expirationDate: string; // YYYY-MM-DD
    strike: number;
    type: 'CALL' | 'PUT';
    bid: number;
    ask: number;
    last: number;
    volume: number;
    openInterest: number;
    impliedVolatility: number;
    timestamp: Date;
    delta?: number;
    probOTM?: number;
    underlyingLast?: number;
}
