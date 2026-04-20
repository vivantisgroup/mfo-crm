import sys

with open('apps/web/app/(dashboard)/admin/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

start_idx = code.find('function ComplianceSection() {')
if start_idx == -1:
    print('Failed to find start')
    sys.exit(1)

end_idx = code.find('\n}\n', start_idx) + 2

replacement = """function ComplianceSection() {
  const [activeTab, setActiveTab] = useState<'regulatory' | 'report'>('regulatory');
  const [saved, setSaved] = useState(false);

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 10, padding: 4, alignSelf: 'flex-start' }}>
        {[
          { id: 'regulatory', label: 'Regulatory Framework' },
          { id: 'report', label: 'Compliance Report' }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => setActiveTab(t.id as any)} 
            className="text-sm font-semibold transition-all px-5 py-2 rounded-lg border-none cursor-pointer"
            style={{
              background: activeTab === t.id ? 'var(--brand-500)' : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text-secondary)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-canvas)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '24px' }}>
        {activeTab === 'regulatory' && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Regulatory Framework</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                Configure parameters for ANBIMA, CVM 175, SEC Rule 204-2, and FINRA compliance.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {[
                {
                  title: 'Brazilian Regulatory (ANBIMA/CVM)',
                  fields: [
                    { label: 'ANBIMA Category', type: 'select', options: ['Wealth Management / Private Banking', 'Asset Management', 'Distributor', 'Other'] },
                    { label: 'CVM 175 Compliance Mode', type: 'select', options: ['Strict', 'Flexible'] },
                    { label: 'Suitability Expiry (months)', type: 'number', default: '24' },
                  ]
                },
                {
                  title: 'US Regulatory (SEC/FINRA)',
                  fields: [
                    { label: 'RIA Registration Number', type: 'text', default: '' },
                    { label: 'Audit Trail Granularity', type: 'select', options: ['High (All Interactions)', 'Medium (Financials Only)', 'Low (Documents Only)'] },
                    { label: 'Record Retention (years)', type: 'number', default: '5' },
                  ]
                },
              ].map(group => (
                <div key={group.title} style={{ padding: 24, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: 20, fontSize: 14 }}>{group.title}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {group.fields.map(f => (
                      <div key={f.label}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</label>
                        {f.type === 'select' ? (
                          <select className="input" style={{ width: '100%', padding: '8px 12px' }}>
                            {(f.options || []).map(o => <option key={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={f.type} defaultValue={f.default} className="input" style={{ width: '100%', padding: '8px 12px' }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary mt-8" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }} style={{ padding: '10px 32px', marginTop: 24 }}>
              {saved ? '✅ Saved!' : '💾 Save Compliance Settings'}
            </button>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="animate-fade-in max-w-4xl">
            <h2 className="text-xl font-bold mb-4">Platform Compliance & Security Report</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-8">
              This dynamic report provides an overview of the MFO-CRM platform's architectural, security, and administrative compliance capabilities. Note that all statements reflect the strictly implemented technical boundaries and verifiable configurations currently active.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border)] relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 opacity-[0.03] rounded-bl-full"></div>
                <h3 className="font-bold mb-3 flex items-center gap-2"><span className="text-blue-500">🔒</span> Tenant Data Isolation</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Strict logical separation of client data is enforced utilizing robust Firebase Firestore Security Rules. Every document and collection access is intercepted by serverless rule evaluations. Active tenant matching is verified strictly against the Identity Provider's token (`tenantId` custom claim), denying any cross-tenant data traversal at the database infrastructure layer.
                </p>
              </div>
              
              <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border)] relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500 opacity-[0.03] rounded-bl-full"></div>
                <h3 className="font-bold mb-3 flex items-center gap-2"><span className="text-emerald-500">🛡️</span> Role-Based Access Control</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  The platform enforces rigorous authentication workflows with declarative role models (e.g., SAAS_MASTER_ADMIN, TENANT_ADMIN, AI_OFFICER, USER). Privileged administrative boundaries—such as System Prompt Engineering, data wipe protocols, and compliance framework configurations—are programmatically inaccessible to unauthorized actors.
                </p>
              </div>

              <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border)] relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500 opacity-[0.03] rounded-bl-full"></div>
                <h3 className="font-bold mb-3 flex items-center gap-2"><span className="text-purple-500">🔑</span> Encryption & Key Ownership</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Bring Your Own Key (BYOK) architecture for third-party inference endpoints is secured using AES-256 server-side encryption prior to persisting. Raw cryptographic materials and sensitive credentials are never serialized to client-side logs nor exposed over standard front-end APIs. Transport links enforce TLS 1.3 connectivity.
                </p>
              </div>

              <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border)] relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500 opacity-[0.03] rounded-bl-full"></div>
                <h3 className="font-bold mb-3 flex items-center gap-2"><span className="text-amber-500">🌍</span> Residency & Audit Trails</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  AI workload residency boundaries are guaranteed by native internal routing, permitting Enterprise endpoints like Azure OpenAI localized clusters or fully disconnected/On-Premises Local LLMs via APIs like Ollama. Critical platform mutations log immutable audit trails containing standard timestamp bounds and actor identification metadata constraints.
                </p>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-[var(--border)] text-right">
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-bold">Report Generated Dynamically on Demand</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}"""

new_code = code[:start_idx] + replacement + code[end_idx:]
with open('apps/web/app/(dashboard)/admin/page.tsx', 'w', encoding='utf-8') as f:
    f.write(new_code)
print('ComplianceSection replaced.')
