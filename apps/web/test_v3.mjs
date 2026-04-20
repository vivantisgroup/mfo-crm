import { YahooFinance } from 'yahoo-finance2';
const customYahoo = new YahooFinance();

async function test() {
  try {
    const result = await customYahoo.search('SPY');
    console.log("Search worked:", result.quotes[0].symbol);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

test();
