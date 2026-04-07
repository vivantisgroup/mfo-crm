const fs = require('fs');
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/platform/tenants/page.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "if (mainTab === 'members') getAllUsers().then(setAllPlatformUsers);",
  "if (mainTab === 'members') { getAllUsers().then(setAllPlatformUsers); import('@/lib/tenantMemberService').then(m => m.getAllGlobalMemberships().then(setGlobalMemberships)); }"
);

const jsxTarget = `                <td style={{ padding: '12px 20px' }}>
                  <span style={{ fontSize: 12, padding: '4px 8px', background: 'var(--bg-overlay)', borderRadius: 12, fontWeight: 700 }}>
                    {user.tenantIds?.length ?? 0}
                  </span>
                </td>`;

const jsxReplacement = `                <td style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(() => {
                      const userMemberships = globalMemberships.filter(m => m.uid === user.uid);
                      if (userMemberships.length === 0) return <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No tenants</span>;
                      return userMemberships.map(m => {
                        const t = subs.find(s => s.tenantId === m.tenantId);
                        return (
                          <div key={m.tenantId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{t?.tenantName ?? m.tenantId}</span>
                            <span style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg-overlay)', borderRadius: 12, color: 'var(--text-secondary)' }}>
                              {ROLE_LABELS[m.role] || m.role}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </td>`;

c = c.replace(jsxTarget, jsxReplacement);
fs.writeFileSync(file, c);
console.log('done');
