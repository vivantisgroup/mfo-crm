import re

with open('apps/web/app/(dashboard)/platform/crm/CrmTabs.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Let's insert the new chart definitions inside DashboardTab.
# Let's find: const regionMax = Math.max(1, ...regionRevenue.map(x=>x.v));
old_vars = "const regionMax = Math.max(1, ...regionRevenue.map(x=>x.v));"
new_vars = """const regionMax = Math.max(1, ...regionRevenue.map(x=>x.v));

  // Attribution by Sales User
  const repList = [...new Set(wonOpps.map(o => o.assignedToName ?? o.ownerName ?? 'Unassigned'))];
  const repRevenue = repList.map(r => ({ r, v: wonOpps.filter(o=>(o.assignedToName ?? o.ownerName ?? 'Unassigned')===r).reduce((s,o)=>s+o.valueUsd,0) }));
  
  // Attribution by Manager
  const managerList = [...new Set(teams.map(t=>t.managerName).filter(Boolean))];
  const managerRev = managerList.map(m => {
    const mgrTeams = teams.filter(t=>t.managerName===m);
    const mRegions = mgrTeams.map(t=>t.region);
    const sum = wonOpps.filter(o=>mRegions.includes(o.region)).reduce((s,o)=>s+o.valueUsd,0);
    return { m, v: sum };
  });"""

if "Attribution by Sales User" not in code:
    code = code.replace(old_vars, new_vars)
    # Must also pass teams into DashboardTab
    code = code.replace("export function DashboardTab({ orgs, opps, activities }:", "export function DashboardTab({ orgs, opps, activities, teams }:")

# Let's inject the new charts right next to the Funnel.
old_charts = """        {/* Revenue by region */}
        <div className="card shadow-sm bg-white p-6">
          <div className="font-bold text-slate-900 text-sm mb-4">?? Won Revenue by Region</div>
          <div className="mt-4 flex flex-col gap-4">
            {regionRevenue.filter(r => r.v > 0).sort((a,b)=>b.v-a.v).map((r, i) => {
               const max = Math.max(1, ...regionRevenue.map(rx=>rx.v));
               const pct = Math.round((r.v / max) * 100);
               const colors = ["emerald", "blue", "fuchsia", "indigo", "slate"];
               const c = colors[i % colors.length];
               return (
                 <div key={r.r} className="flex flex-col gap-1.5">
                   <div className="flex justify-between text-xs font-bold">
                     <span className="text-slate-700">{REGION_LABELS[r.r]}</span>
                     <span className="text-slate-900">{valueFormatter(r.v)}</span>
                   </div>
                   <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                     <div className={h-full bg--500} style={{ width: ${pct}%, transition: 'width 0.5s ease-out' }} />
                   </div>
                 </div>
               );
            })}
            {regionRevenue.filter(r => r.v > 0).length === 0 && <div className="text-sm text-slate-500 py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">No closed won revenue yet</div>}
          </div>
        </div>"""

new_charts = """        {/* Revenue by Sales Rep */}
        <div className="card shadow-sm bg-white p-6 border-t-4 border-t-amber-400">
          <div className="font-bold text-slate-900 text-sm mb-4 uppercase tracking-widest text-[10px] text-slate-500">Won Revenue by Sales Rep</div>
          <div className="mt-4 flex flex-col gap-4">
             {repRevenue.filter(r => r.v > 0).sort((a,b)=>b.v-a.v).map((r, i) => {
               const max = Math.max(1, ...repRevenue.map(rx=>rx.v));
               const pct = Math.round((r.v / max) * 100);
               return (
                 <div key={r.r} className="flex flex-col gap-1.5">
                   <div className="flex justify-between text-xs font-bold">
                     <span className="text-slate-800 tracking-tight">{r.r}</span>
                     <span className="text-emerald-600">{valueFormatter(r.v)}</span>
                   </div>
                   <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                     <div className="h-full bg-amber-400" style={{ width: ${pct}% }} />
                   </div>
                 </div>
               );
             })}
             {repRevenue.filter(r=>r.v>0).length===0 && <div className="text-sm text-slate-500 py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">No closed won revenue entirely</div>}
          </div>
        </div>

        {/* Revenue by Sales Manager */}
        <div className="card shadow-sm bg-white p-6 border-t-4 border-t-blue-500">
          <div className="font-bold text-slate-900 text-sm mb-4 uppercase tracking-widest text-[10px] text-slate-500">Won Revenue by Team Manager</div>
          <div className="mt-4 flex flex-col gap-4">
             {managerRev.filter(r => r.v > 0).sort((a,b)=>b.v-a.v).map((r, i) => {
               const max = Math.max(1, ...managerRev.map(rx=>rx.v));
               const pct = Math.round((r.v / max) * 100);
               return (
                 <div key={r.m} className="flex flex-col gap-1.5">
                   <div className="flex justify-between text-xs font-bold">
                     <span className="text-slate-800 tracking-tight">?? {r.m}</span>
                     <span className="text-blue-600">{valueFormatter(r.v)}</span>
                   </div>
                   <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500 text-[8px] flex justify-end pr-1 items-center text-white/90 shadow-sm" style={{ width: ${pct}% }}>{pct}%</div>
                   </div>
                 </div>
               );
             })}
             {managerRev.filter(r=>r.v>0).length===0 && <div className="text-sm text-slate-500 py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">Managers not assigned or no sales.</div>}
          </div>
        </div>"""

if "Won Revenue by Sales Rep" not in code:
    code = code.replace(old_charts, new_charts)
    # Adjust CSS grid container
    code = code.replace("<div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">", "<div className=\"grid grid-cols-1 md:grid-cols-3 gap-6\">")

with open('apps/web/app/(dashboard)/platform/crm/CrmTabs.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'r', encoding='utf-8') as f:
    page_code = f.read()
    page_code = page_code.replace("mainTab==='dashboard' && <DashboardTab orgs={orgs} opps={opps} activities={activities} />", "mainTab==='dashboard' && <DashboardTab orgs={orgs} opps={opps} activities={activities} teams={teams} />")
with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'w', encoding='utf-8') as f:
    f.write(page_code)
print("DashboardTab modernized.")
