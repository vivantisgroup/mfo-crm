const fs = require('fs');

let code = fs.readFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', 'utf8');

code = code.replace(
  `import { getAllTenants, TenantRecord } from '@/lib/platformService';`,
  `import { getAllSubscriptions, TenantSubscription } from '@/lib/subscriptionService';`
);

code = code.replace(
  `const [tenantsList, setTenantsList] = useState<TenantRecord[]>([]);`,
  `const [tenantsList, setTenantsList] = useState<TenantSubscription[]>([]);`
);

code = code.replace(
  `getAllTenants().then(setTenantsList);`,
  `getAllSubscriptions().then(setTenantsList);`
);

fs.writeFileSync('apps/web/app/(dashboard)/platform/support/page.tsx', code);
console.log('Fixed tenant dropdown to match active subscriptions');
