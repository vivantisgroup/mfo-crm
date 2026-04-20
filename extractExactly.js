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

(async () => {
    const urls = [
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
    ].map(p => `https://bondblox.com${p}`);

    for (const url of urls) {
        try {
            const code = await fetchUrl(url);
            if (code.includes('Cognito') || code.includes('ap-southeast-1_')) {
                console.log('--- FOUND COGNITO INFO IN:', url);
                const poolId = code.match(/ap-southeast-1_[a-zA-Z0-9]+/g);
                if (poolId) console.log('POOL ID:', [...new Set(poolId)]);
                
                // Client ID is typically 26chars
                const cId = code.match(/[a-zA-Z0-9]{26}/g);
                if (cId) console.log('POTENTIAL CLIENT IDs:', [...new Set(cId)].join(', '));
            }
        } catch(e) {}
    }
})();
