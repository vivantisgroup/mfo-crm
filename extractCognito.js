const https = require('https');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function findCognitoInfo() {
    try {
        const chunkUrls = [
            "/_next/static/chunks/0~e77__kvy.o7.js",
            "/_next/static/chunks/07smy3ylqaqlc.js",
            "/_next/static/chunks/0lexzrpkdhtpa.js",
            "/_next/static/chunks/0vqz0o15xg46e.js",
            "/_next/static/chunks/02xph_96y4ooe.js",
            "/_next/static/chunks/0onj9_l2483ls.js",
            "/_next/static/chunks/0ars0e0icjkmn.js",
            "/_next/static/chunks/turbopack-0ona4bwxzr6tv.js",
            "/_next/static/chunks/0-rroztgmu-t2.js",
            "/_next/static/chunks/0x73h9buzotwn.js",
            "/_next/static/chunks/0ie6_6d56j654.js",
            "/_next/static/chunks/16p8hjdho36mj.js",
            "/_next/static/chunks/15guczm0ni4fi.js",
            "/_next/static/chunks/12cpnpa~8g4qf.js",
            "/_next/static/chunks/0ku9dlgl1_r1m.js",
            "/_next/static/chunks/0-2pjwls.lv9p.js",
            "/_next/static/chunks/0nibrtxmy.gg2.js",
            "/_next/static/chunks/0k0zf5zvg54b7.js",
            "/_next/static/chunks/0vmfnk-xm2cnv.js",
            "/_next/static/chunks/0e~t~w.6dqdx7.js",
            "/_next/static/chunks/16vsht33n6jx2.js",
            "/_next/static/chunks/0uywgjsfrj9b..js",
            "/_next/static/chunks/127b9v-prjxm9.js",
            "/_next/static/chunks/0bimcvbpfwnjg.js",
            "/_next/static/chunks/134zj7~fcg2z6.js",
            "/_next/static/chunks/04n4h0tsms3em.js",
            "/_next/static/chunks/0j43s8p.plsyx.js",
            "/_next/static/chunks/01b909yvebja7.js",
            "/_next/static/chunks/0scgm1pd~8h9r.js",
            "/_next/static/chunks/04dyj93bj9f4d.js",
            "/_next/static/chunks/0je0p9gq362kb.js",
            "/_next/static/chunks/0mn.gbqyyssq3.js"
        ].map(path => `https://bondblox.com${path}`);
        
        console.log(`Analyzing ${chunkUrls.length} chunks...`);
        
        for (const url of chunkUrls) {
            try {
                const content = await fetchUrl(url);
                // Look for typical Cognito config parameters
                const userPoolMatch = content.match(/(ap-southeast-1_[a-zA-Z0-9]+)/g);
                const clientIdMatch = content.match(/clientId["']?\s*:\s*["']([A-Za-z0-9]{14,32})["']/i) || content.match(/[A-Za-z0-9]{26}/g);
                
                if (userPoolMatch && userPoolMatch.length > 0) {
                    const uniquePools = [...new Set(userPoolMatch)];
                    console.log(`Found in ${url}: UserPools: ${uniquePools.join(', ')}`);
                }
            } catch (e) {
                // ignore
            }
        }
    } catch(e) {
        console.error(e);
    }
}

findCognitoInfo();
