import yahooFinance from 'yahoo-finance2';

async function test() {
  try {
    console.log("Searching for SPY...");
    const result = await yahooFinance.search('SPY');
    const quotes = result.quotes || [];
    console.log("Search results:", JSON.stringify(quotes.slice(0, 2), null, 2));

    const symbols = quotes.filter(q => q.isYahooFinance).slice(0, 2).map(q => q.symbol);
    console.log("Symbols to quote:", symbols);

    if (symbols.length > 0) {
      console.log("Fetching quotes...");
      const details = await yahooFinance.quote(symbols);
      console.log("Quote details:", JSON.stringify(details, null, 2));
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
