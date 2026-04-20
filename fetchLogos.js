const https = require('https');
const companies = ['docusign', 'clicksign', 'certisign'];
async function fetchLogo(company) {
  return new Promise((resolve) => {
    https.get('https://www.linkedin.com/company/' + company, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/https:\/\/media\.licdn\.com\/dms\/image\/[A-Za-z0-9_-]+\/company-logo_200_200\/0\/[0-9]+[A-Za-z0-9_-]+\?e=[0-9]+&amp;v=beta&amp;t=[A-Za-z0-9_-]+/);
        resolve(match ? match[0].replace(/&amp;/g, '&') : null);
      });
    });
  });
}
async function run() {
  for (const c of companies) {
    console.log(c, await fetchLogo(c));
  }
}
run();
