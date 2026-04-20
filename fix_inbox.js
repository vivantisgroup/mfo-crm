const fs = require('fs');
const path = require('path');

function replaceStr(file, from, to) {
  const p = path.join('C:/MFO-CRM/apps/web/app/(dashboard)/inbox', file);
  if (!fs.existsSync(p)) return;
  let code = fs.readFileSync(p, 'utf8');
  if (typeof from === 'string') {
    code = code.split(from).join(to);
  } else {
    code = code.replace(from, to);
  }
  fs.writeFileSync(p, code);
}

replaceStr('page.tsx', "import type { CrmLinkTarget } from '@/app/api/mail/link/route';", "type CrmLinkTarget = any;");
replaceStr('page.tsx', "import('@/app/api/mail/link/route').CrmLinkTarget[]", "any[]");

replaceStr('components/ReadingPane.tsx', "import type { CrmLinkTarget } from '@/app/api/mail/link/route';", "type CrmLinkTarget = any;");
replaceStr('components/CrmLinkPanel.tsx', "import type { CrmLinkTarget } from '@/app/api/mail/link/route';", "type CrmLinkTarget = any;");
// Line 10 of CrmLinkPanel has type RecordType = CrmLinkTarget['type'];
// We'll replace the full declaration
replaceStr('components/CrmLinkPanel.tsx', "type CrmLinkTarget = any;", "type CrmLinkTarget = { id: string; name: string; type: 'contact' | 'org' | 'opportunity' };");

console.log("Inbox patch complete");
