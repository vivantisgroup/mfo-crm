const https = require('https');
const options = {
  hostname: 'bondblox.com',
  port: 443,
  path: '/trade-bonds/listed-bonds',
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
    const searchString = '<script id="__NEXT_DATA__" type="application/json">';
    const startIdx = html.indexOf(searchString);
    if (startIdx !== -1) {
        const payloadStart = startIdx + searchString.length;
        const endIdx = html.indexOf('</script>', payloadStart);
        let jsonStr = html.substring(payloadStart, endIdx);
        let data = JSON.parse(jsonStr);
        let bonds = data?.props?.pageProps?.result || data?.props?.pageProps?.fractionalBonds || data?.props?.pageProps?.bonds || [];
        console.log('Total bonds in /listed-bonds:', bonds.length);
        console.log('First bond:', bonds[0]);
    }
  });
});
req.end();
