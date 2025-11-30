async function test() {
    try {
        console.log('Testing direct fetch...');
        const response = await fetch('https://query2.finance.yahoo.com/v7/finance/options/SPY');
        if (!response.ok) {
            console.error('Fetch failed:', response.status, response.statusText);
            const text = await response.text();
            console.error('Body:', text);
            return;
        }
        const data = await response.json();
        console.log('Fetch success!');
        // @ts-ignore
        console.log('Option chain expirations:', data.optionChain.result[0].expirationDates.length);
    } catch (e) {
        console.error('Error fetching:', e);
    }
}

test();
