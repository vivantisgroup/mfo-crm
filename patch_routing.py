import sys

with open('apps/web/app/(dashboard)/admin/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update the fallback layout
old_layout = """      {/* Fallback Priority Configurator */}
      <div style={{ marginBottom: 32, padding: '16px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
        <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Execution Priority & Fallback Order</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {priorityOrder.map((group, idx) => {
            const p = providers.find(prov => prov.group === group);
            if (!p) return null;
            const configured = (allKeys[p.group] || []).filter(k => k.saved).length > 0;
            return (
              <div key={group} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-tertiary)', width: 20 }}>#{idx + 1}</span>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.group}</span>
                  {!configured && <span style={{ fontSize: 10, padding: '2px 6px', background: '#f59e0b22', color: '#d97706', borderRadius: 4, fontWeight: 600 }}>Unconfigured</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => moveUp(idx)}>↑</button>
                  <button className="btn btn-ghost btn-sm" disabled={idx === priorityOrder.length - 1} onClick={() => moveDown(idx)}>↓</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>"""

new_layout = """      {/* Fallback Priority Configurator */}
      <div style={{ marginBottom: 32, padding: '24px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h4 style={{ fontWeight: 800, fontSize: 16 }}>Execution Priority Flow</h4>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>Drag and drop to establish order</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, overflowX: 'auto', paddingBottom: 16, paddingTop: 12, paddingLeft: 10 }}>
          {priorityOrder.map((group, idx) => {
            const p = providers.find(prov => prov.group === group);
            if (!p) return null;
            const configured = (allKeys[p.group] || []).filter(k => k.saved).length > 0;
            return (
              <React.Fragment key={group}>
                <div 
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', idx.toString());
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                    if (fromIdx !== idx && !isNaN(fromIdx)) {
                        const newOrder = [...priorityOrder];
                        const [moved] = newOrder.splice(fromIdx, 1);
                        newOrder.splice(idx, 0, moved);
                        savePriorityOrder(newOrder); // Using existing backend integration
                    }
                  }}
                  className="transition-transform hover:scale-105"
                  style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, 
                    padding: '16px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--border)', minWidth: 140, cursor: 'grab',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative'
                  }}>
                  <div style={{ position: 'absolute', top: -12, left: -12, width: 26, height: 26, borderRadius: 13, background: idx === 0 ? 'var(--brand-500)' : 'var(--bg-elevated)', border: `1px solid ${idx === 0 ? 'var(--brand-500)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: idx === 0 ? 'white' : 'var(--text-tertiary)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    {idx + 1}
                  </div>
                  <span style={{ fontSize: 32 }}>{p.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.group}</span>
                  {!configured ? (
                    <span style={{ fontSize: 10, padding: '4px 8px', background: '#f59e0b22', color: '#d97706', borderRadius: 4, fontWeight: 700, width: '100%', textAlign: 'center' }}>Offline</span>
                  ) : (
                    <span style={{ fontSize: 10, padding: '4px 8px', background: '#10b98122', color: '#10b981', borderRadius: 4, fontWeight: 700, width: '100%', textAlign: 'center' }}>Configured</span>
                  )}
                </div>
                {idx < priorityOrder.length - 1 && (
                  <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>"""

if old_layout not in code:
    print('Failed to find old layout block')
    sys.exit(1)

code = code.replace(old_layout, new_layout)


# 2. Delete AIRoutingPolicySection Function Block
start_routing = code.find('function AIRoutingPolicySection() {')
if start_routing != -1:
    end_routing = code.find('\n}\n', start_routing)
    if end_routing != -1:
        # Also remove the whole section comment before it if it exists
        section_comment = '// ─── Section: Customizations ───────────────────────────────────────────────────\n\n'
        pre_start = code.rfind(section_comment, 0, start_routing)
        if pre_start != -1 and (start_routing - pre_start) < 200:
            start_routing = pre_start
        code = code[:start_routing] + code[end_routing + 3:]

# 3. Clean up the references in CustomizationsSection
code = code.replace("{ id: 'routing', label: 'AI Routing Policy' },\n", '')
code = code.replace("         {activeTab === 'routing' && <AIRoutingPolicySection />}\n\n", '')
code = code.replace("'routing' | ", '')
# change default activeTab if it was routing
code = code.replace("useState<'queues' | 'entities' | 'knowledge' | 'jurisdictions'>('routing')", "useState<'queues' | 'entities' | 'knowledge' | 'jurisdictions'>('queues')")

with open('apps/web/app/(dashboard)/admin/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patch applied.")
