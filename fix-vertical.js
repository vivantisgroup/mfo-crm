const fs = require('fs');

let code = fs.readFileSync('apps/web/lib/verticalRegistry.ts', 'utf8');

// Replace all occurrences of { href: '/suporte', icon: '🎧',  label: 'Suporte' } with { href: '/platform/support', icon: '🎧',  label: 'Support Center' }
code = code.replace(/\{\s*href:\s*'\/suporte',\s*icon:\s*'🎧',\s*label:\s*'Suporte'\s*\}/g, "{ href: '/platform/support', icon: '🎧', label: 'Support Center' }");

fs.writeFileSync('apps/web/lib/verticalRegistry.ts', code);
console.log('Patched vertical registry nav');
