const https = require('https');
const fs = require('fs');

const data = JSON.stringify({
    "columns": [
        "name", "description", "logoid", "update_mode", "type", "typespecs", "close",
        "pricescale", "minmov", "fractional", "minmove2", "currency", "change",
        "volume", "market_cap_basic", "fundamental_currency_code",
        "price_earnings_ttm", "earnings_per_share_basic_ttm", "sector", "industry", "Recommend.All"
    ],
    "ignore_unknown_fields": false,
    "options": {
        "lang": "pt"
    },
    "range": [0, 50],
    "sort": {
        "sortBy": "market_cap_basic",
        "sortOrder": "desc"
    },
    "markets": ["brazil"]
});

const options = {
    hostname: 'scanner.tradingview.com',
    port: 443,
    path: '/brazil/scan',
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
};

const req = https.request(options, (res) => {
    let chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
        let response = Buffer.concat(chunks).toString();
        fs.writeFileSync('tv_scan.json', response);
        console.log('Saved to tv_scan.json with length:', response.length);
        try {
            let parsed = JSON.parse(response);
            console.log("Returned items:", parsed.data ? parsed.data.length : 0);
            if(parsed.data && parsed.data.length > 0) console.log("First item:", parsed.data[0]);
        } catch(e) { console.log("Not json"); }
    });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
