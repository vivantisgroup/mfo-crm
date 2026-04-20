const fs = require('fs');
const path = require('path');

const dashboardDir = path.join(__dirname, 'apps/web/app/(dashboard)');

function findFiles(dir) {
    let results = [];
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) results.push(...findFiles(p));
        else if (p.endsWith('.tsx')) results.push(p);
    }
    return results;
}

const files = findFiles(dashboardDir);
let patched = 0;

for (const file of files) {
    let text = fs.readFileSync(file, 'utf8');
    
    // Nuke max-width and center-auto locks, replace with full width + responsive padding
    let newText = text.replace(/\bmx-auto\b/g, '')
                      .replace(/\bmax-w-7xl\b/g, 'w-full px-4 lg:px-8')
                      .replace(/\bmax-w-screen-xl\b/g, 'w-full px-4 lg:px-8')
                      .replace(/\bmax-w-6xl\b/g, 'w-full px-4 lg:px-8');
                      
    if (text !== newText) {
        // Clean up double whitespace artifacts
        newText = newText.replace(/className=" /g, 'className="').replace(/  +/g, ' ');
        fs.writeFileSync(file, newText);
        patched++;
        console.log(`[Antigravity OS] Layout Unlocked: ${file}`);
    }
}
console.log(`Total modules converted to Dynamic Layout: ${patched}`);
