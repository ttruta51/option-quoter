import 'dotenv/config';
import { config } from './config';
import { yahooService } from './services/yahoo';
import { storageService } from './services/storage';
import { closeDb } from './db';

async function main() {
    console.log('Option Quoter Service Starting...');
    console.log('Tickers to process:', config.tickers);

    try {
        for (const ticker of config.tickers) {
            console.log(`Processing ${ticker}...`);
            const quotes = await yahooService.fetchOptionQuotes(ticker);

            if (quotes.length > 0) {
                await storageService.saveQuotes(quotes);
                console.log(`Saved ${quotes.length} quotes for ${ticker}`);
            } else {
                console.log(`No quotes found for ${ticker}`);
            }
        }
    } catch (error) {
        console.error('Fatal error in main loop:', error);
    } finally {
        console.log('Job finished. Closing DB connection.');
        await closeDb();
    }
}

main().catch(console.error);
