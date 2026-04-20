const https = require('https');
const fs = require('fs');
const options = {
  hostname: 'br.tradingview.com',
  port: 443,
  path: '/markets/',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html'
  }
};

const req = https.request(options, (res) => {
  let chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    let html = Buffer.concat(chunks).toString();
    const searchString = 'window.initData = ';
    let startIdx = html.indexOf(searchString);
    if(startIdx !== -1) {
        startIdx += searchString.length;
        let endIdx = html.indexOf('; window.', startIdx);
        if (endIdx === -1) endIdx = html.indexOf('</script>', startIdx);
        let jsonStr = html.substring(startIdx, endIdx);
        try {
            fs.writeFileSync('tv_initData.json', jsonStr);
            console.log("Successfully extracted tv_initData.json of length", jsonStr.length);
        } catch(e) {
            console.error("Parse error:", e);
        }
    } else {
        console.log("Not found.");
    }
  });
});
req.end();
