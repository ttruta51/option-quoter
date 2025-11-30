import yahooFinance from 'yahoo-finance2';

console.log('Keys:', Object.keys(yahooFinance));
// @ts-ignore
console.log('Proto keys:', Object.keys(Object.getPrototypeOf(yahooFinance)));

async function test() {
    try {
        // @ts-ignore
        if (typeof yahooFinance._request === 'function') {
            console.log('Has _request method');
        }
    } catch (e) {
        console.error(e);
    }
}

test();
