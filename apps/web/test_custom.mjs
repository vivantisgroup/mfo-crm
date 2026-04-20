import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function test() {
  try {
    const result = await yahooFinance.search('SPY');
    console.log("Search worked! Quotes:", result.quotes.length);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

test();
