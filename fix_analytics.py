import re

with open('apps/web/app/(dashboard)/platform/analytics/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add SecondaryDock import
if 'SecondaryDock' not in code:
    code = code.replace("import { usePageTitle }", "import { SecondaryDock } from '@/components/SecondaryDock';\nimport { usePageTitle }")

# 2. Add 'reports' to AnalyticsTab
code = code.replace("type AnalyticsTab = 'overview' | 'revenue' | 'expenses' | 'customers' | 'roi';", "type AnalyticsTab = 'overview' | 'revenue' | 'expenses' | 'customers' | 'roi' | 'reports';")

# 3. Modify the return structure to wrap in SecondaryDock
old_tabs_block = """  const TABS: { id: AnalyticsTab; label: string }[] = [
    { id: 'overview',   label: '?? Overview' },
    { id: 'revenue',    label: '?? Revenue' },
    { id: 'expenses',   label: '?? Expenses' },
    { id: 'customers',  label: '?? Customers' },
    { id: 'roi',        label: '?? ROI & Metrics' },
  ];"""

new_tabs_block = """  const TABS: any[] = [
    { id: 'overview',   label: 'Overview', icon: '??' },
    { id: 'revenue',    label: 'Revenue', icon: '??' },
    { id: 'expenses',   label: 'Expenses', icon: '??' },
    { id: 'customers',  label: 'Customers', icon: '??' },
    { id: 'roi',        label: 'ROI & Metrics', icon: '??' },
    { id: 'reports',    label: 'Reports', icon: '??' },
  ];"""

code = code.replace(old_tabs_block, new_tabs_block)

# 4. Strip the old manual tabs mapping and adjust layout widths
manual_tabs_ui = """      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 18px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
            fontWeight: tab === t.id ? 700 : 500,
            borderBottom: 2px solid ,
            color: tab === t.id ? 'var(--brand-500)' : 'var(--text-secondary)',
          }}>{t.label}</button>
        ))}
      </div>"""

new_return_start = """  return (
    <div className="flex flex-col h-full w-full bg-slate-50/50">
      <SecondaryDock tabs={TABS} activeTab={tab} onTabChange={(id) => setTab(id as AnalyticsTab)} />
      <div className="page-wrapper animate-fade-in w-full h-full flex flex-col flex-1 px-4 lg:px-6 pt-6 pb-12 overflow-y-auto">"""

old_return_start = """  return (
    <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>"""

code = code.replace(old_return_start, new_return_start)
code = code.replace(manual_tabs_ui, "")

# Add Reports sub-tab code
reports_ui = """
      {/* -- REPORTS TAB -------------------------------------------------------- */}
      {tab === 'reports' && (
        <div className="animate-fade-in">
           <div className="grid grid-cols-3 gap-6 mt-6">
             <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
               <div className="font-bold mb-4">Performance Packs</div>
               <div className="text-center text-slate-500">
                 <div style={{ fontSize: 40, marginBottom: 12 }}>??</div>
                 <div className="text-sm">Quarterly Performance Packs</div>
                 <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-md text-xs mt-4">View Templates</button>
               </div>
             </div>
             <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
               <div className="font-bold mb-4">Tax & Accounting</div>
               <div className="text-center text-slate-500">
                 <div style={{ fontSize: 40, marginBottom: 12 }}>??</div>
                 <div className="text-sm">Realized gains, K-1 generation</div>
                 <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-md text-xs mt-4">View Templates</button>
               </div>
             </div>
             <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
               <div className="font-bold mb-4">Custom Builder</div>
               <div className="text-center text-slate-500">
                 <div style={{ fontSize: 40, marginBottom: 12 }}>??</div>
                 <div className="text-sm">Drag-and-drop report builder</div>
                 <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-md text-xs mt-4">Open Builder</button>
               </div>
             </div>
           </div>
        </div>
      )}
    </div>
"""

# Replace the final </div> of the component to include reports_ui
if reports_ui not in code:
    code = code.rsplit("</div>\n  );\n}", 1)[0] + reports_ui + "  );\n}"

with open('apps/web/app/(dashboard)/platform/analytics/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Analytics updated.")
