const { chromium } = require('playwright');
const companies = ['docusign', 'clicksign', 'certisign'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  for (const c of companies) {
    try {
      await page.goto('https://br.linkedin.com/company/' + c, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const imgUrl = await page.evaluate(() => {
        const meta = document.querySelector('meta[property="og:image"]');
        return meta ? meta.content : null;
      });
      console.log(`${c}_LOGO=` + imgUrl);
    } catch (e) {
      console.log(`${c}_LOGO=error`);
    }
  }
  await browser.close();
})();
