const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Log all network requests to catch the API call if possible
  page.on('request', request => {
     if (request.url().includes('prod/bond/search') || request.url().includes('api.bondblox')) {
         console.log('CAUGHT SEARCH REQUEST:', request.url());
         console.log('HEADERS:', request.headers());
     }
  });

  console.log('Navigating to login...');
  await page.goto('https://bondblox.com/webapp/home', { waitUntil: 'networkidle2' });
  
  // Try to click login or find the inputs
  // The user said the page is https://bondblox.com/webapp/home and to login
  await page.waitForSelector('input[type="email"]', { timeout: 10000 }).catch(() => console.log('No email input found immediately'));
  
  const emailInputs = await page.$$('input[type="email"]');
  if (emailInputs.length > 0) {
      console.log('Typing email...');
      await emailInputs[0].type('marcelo.gavazzi@gmail.com');
      
      console.log('Typing password...');
      const passwordInputs = await page.$$('input[type="password"]');
      if (passwordInputs.length > 0) {
          await passwordInputs[0].type('BOM@rce1inh0OX');
      }
      
      console.log('Clicking submit...');
      const buttons = await page.$$('button');
      for(const b of buttons) {
          const text = await page.evaluate(el => el.textContent, b);
          if (text && text.toLowerCase().includes('login')) {
              await b.click();
              break;
          }
      }
  }

  // Wait for login to process
  console.log('Waiting for login to process...');
  await new Promise(r => setTimeout(r, 6000));
  
  // Dump local storage
  const ls = await page.evaluate(() => JSON.stringify(window.localStorage));
  console.log('LOCALSTORAGE:', ls.substring(0, 500) + '...');
  
  // Extract token specifically
  const token = await page.evaluate(() => {
      let cognitoToken = null;
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('CognitoIdentityServiceProvider') && key.includes('accessToken')) {
              cognitoToken = localStorage.getItem(key);
          }
      }
      return cognitoToken;
  });
  
  if (token) {
      console.log('FOUND TOKEN:', token.substring(0, 50) + '...');
      // Write to file
      require('fs').writeFileSync('bondblox_token_puppeteer.txt', token);
  } else {
      console.log('No token found in localStorage.');
  }

  await browser.close();
  console.log('Done.');
})();
