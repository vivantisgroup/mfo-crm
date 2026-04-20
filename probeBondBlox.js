const https = require('https');

async function checkEndpoint(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
           url,
           status: res.statusCode,
           snippet: data.substring(0, 500)
        });
      });
    }).on('error', (e) => resolve({ url, error: e.message }));
  });
}

(async () => {
    const endpoints = [
        'https://app.bondblox.com/api/bonds?search=a',
        'https://app.bondblox.com/api/v1/bonds/search?q=a',
        'https://api.bondblox.com/bonds/search?q=a',
        'https://api.bondblox.com/v1/bonds/search?query=a',
        'https://bondblox.com/api/bonds',
        'https://bondblox.com/api/search?q=a',
        'https://app.bondblox.com/api/search?q=a'
    ];
    
    for (const ep of endpoints) {
        const res = await checkEndpoint(ep);
        console.log(`[${res.status || 'ERR'}] ${res.url}`);
        if(res.status === 200 || res.status === 403 || res.status === 401) {
            console.log(res.snippet);
        }
    }
})();
