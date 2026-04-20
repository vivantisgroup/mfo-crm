const fs = require('fs');
const file = 'c:/MFO-CRM/apps/web/app/(dashboard)/platform/tenants/page.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /<td style=\{\{ padding: '12px 20px' \}\}>\s*<span style=\{\{ fontSize: 12, padding: '4px 8px', background: 'var\(--bg-overlay\)', borderRadius: 12, fontWeight: 700 \}\}>\s*\{user\.tenantIds\?\.length \?\? 0\}\s*<\/span>\s*<\/td>/,
  `                <td style={{ padding: '12px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(() => {
                      const userMemberships = globalMemberships.filter(m => m.uid === user.uid);
                      if (userMemberships.length === 0) return <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No tenants</span>;
                      return userMemberships.map(m => {
                        const t = subs.find(s => s.tenantId === m.tenantId);
                        return (
                          <div key={m.tenantId} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-overlay)', padding: '4px 10px', borderRadius: 8, width: 'fit-content' }}>
                            <span style={{ fontSize: 12, fontWeight: 800 }}>{t?.tenantName ?? m.tenantId}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] || m.role}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </td>`
);

fs.writeFileSync(file, c);
console.log('done');
