const fs = require('fs');
const https = require('https');

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    console.log("Fetching manifest...");
    const manifest = await fetchJSON('https://libraries.excalidraw.com/libraries.json');
    let allLibs = [];
    
    // Some libraries might fail if the repository format changed, but we will try.
    // To speed this up, grab a few. If 'voce popule todos' means all, I'll batch them.
    for (let i = 0; i < manifest.length; i++) {
      const libData = manifest[i];
      try {
        const lib = await fetchJSON(`https://libraries.excalidraw.com/libraries/${libData.source}`);
        const items = lib.libraryItems || lib.library || [];
        if (Array.isArray(items)) {
          allLibs.push(...items);
        }
        console.log(`Downloaded ${libData.name || libData.source} - Total items: ${allLibs.length}`);
      } catch (err) {
        console.log(`Failed to download ${libData.source}`);
      }
    }
    
    fs.writeFileSync('apps/web/public/excalidraw-mega-lib.json', JSON.stringify(allLibs));
    console.log("Successfully wrote all libraries to public/excalidraw-mega-lib.json!");
  } catch (err) {
    console.error(err);
  }
}

run();
