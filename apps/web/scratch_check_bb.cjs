const https = require('https');
const options = {
  hostname: 'bondblox.com',
  port: 443,
  path: '/trade-bonds/live-market',
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
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let jsonStr = '';
    while ((match = scriptRegex.exec(html)) !== null) {
        const inlineCode = match[1].trim();
        if (inlineCode.startsWith('self.__next_f.push([1,"') && inlineCode.includes('fractionalBonds')) {
            // Ah, App Router!
            console.log("App Router fragment found");
        }
        if (inlineCode.startsWith('{"props":') && inlineCode.includes('"pageProps":')) {
            jsonStr = inlineCode;
            break;
        }
    }
    if (!jsonStr) {
       const searchString = '<script id="__NEXT_DATA__" type="application/json">';
       const startIdx = html.indexOf(searchString);
       if (startIdx !== -1) {
           const payloadStart = startIdx + searchString.length;
           const endIdx = html.indexOf('</script>', payloadStart);
           jsonStr = html.substring(payloadStart, endIdx);
       }
    }
    if (jsonStr) {
      let data = JSON.parse(jsonStr);
      let bonds = data?.props?.pageProps?.result || data?.props?.pageProps?.fractionalBonds || data?.props?.pageProps?.bonds || [];
      console.log('Total bonds in NextJS initial payload:', bonds.length);
      let vale = bonds.filter(b => (b.isn||'').toLowerCase().includes('vale') || (b.ibn||'').toLowerCase().includes('vale'));
      console.log('Vale bonds found:', vale.length);
      if (vale.length > 0) {
        console.log("Sample Vale bond:", vale[0].is, vale[0].isn);
      }
    } else {
      console.log('No JSON found. Checking if App router data is present...');
      if (html.includes('fractionalBonds')) {
         console.log("Yes, fractionalBonds exists somewhere in HTML.");
         // Let's write html to a file to inspect
         require('fs').writeFileSync('bondblox_output.html', html);
         console.log('Saved to bondblox_output.html');
      }
    }
  });
});
req.end();
