import { yahooService } from './services/yahoo';

async function test() {
    try {
        console.log('Testing Yahoo Finance Service...\n');

        // Test with a popular ticker (SPY - S&P 500 ETF)
        const ticker = 'SPY';
        console.log(`Fetching option quotes for ${ticker}...`);

        const quotes = await yahooService.fetchOptionQuotes(ticker);

        console.log(`\n=== Results ===`);
        console.log(`Total quotes fetched: ${quotes.length}`);

        if (quotes.length > 0) {
            // Group by expiration date
            const byExpiration = quotes.reduce((acc, q) => {
                if (!acc[q.expirationDate]) acc[q.expirationDate] = [];
                acc[q.expirationDate].push(q);
                return acc;
            }, {} as Record<string, typeof quotes>);

            console.log(`\nExpirations found: ${Object.keys(byExpiration).length}`);
            console.log(`Expiration dates: ${Object.keys(byExpiration).join(', ')}`);

            // Show sample quotes from first expiration
            const firstExpiration = Object.keys(byExpiration)[0];
            const sampleQuotes = byExpiration[firstExpiration].slice(0, 5);

            console.log(`\n=== Sample Quotes (${firstExpiration}) ===`);
            sampleQuotes.forEach(q => {
                console.log(`${q.type} Strike: $${q.strike} | Bid: $${q.bid} | Ask: $${q.ask} | Vol: ${q.volume} | IV: ${(q.impliedVolatility * 100).toFixed(2)}%`);
            });
        } else {
            console.log('\nNo quotes found. This could mean:');
            console.log('  - No expirations within 14 days');
            console.log('  - Market is closed');
            console.log('  - API rate limiting');
        }

    } catch (e) {
        console.error('Error testing Yahoo Finance service:', e);
    }
}

test();
