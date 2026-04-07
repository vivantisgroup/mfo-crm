const fs = require('fs');
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/platform/tenants/page.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "const [allPlatformUsers, setAllPlatformUsers] = useState<UserProfile[]>([]);",
  "const [allPlatformUsers, setAllPlatformUsers] = useState<UserProfile[]>([]);\n  const [globalMemberships, setGlobalMemberships] = useState<import('@/lib/tenantMemberService').TenantMember[]>([]);"
);

fs.writeFileSync(file, c);
console.log('done');
