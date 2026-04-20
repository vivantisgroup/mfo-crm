const fs = require('fs');

let layout = fs.readFileSync('apps/web/app/(dashboard)/layout.tsx', 'utf8');

// Replace in HREF_ICON_MAP  
layout = layout.replace(`'/suporte': Headset,`, `'/platform/support': Headset,`);

// Replace in PLATFORM_NAV
layout = layout.replace(`{ href: '/suporte', icon: Headset, label: 'Suporte' }`, `{ href: '/platform/support', icon: Headset, label: 'Support Center' }`);

fs.writeFileSync('apps/web/app/(dashboard)/layout.tsx', layout);
console.log('Fixed Support Center routing links');
