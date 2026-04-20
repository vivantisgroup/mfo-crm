import re

with open('apps/web/app/(dashboard)/platform/crm/CrmTabs.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update form inside TeamsTab to include commissionPlanText element
if "commissionPlanText:" not in code:
    code = code.replace("const [form, setForm] = useState({ name:'', region:'latam' as typeof regions[number], managerName:'', memberNames:'', description:'', quota:0 });", "const [form, setForm] = useState({ name:'', region:'latam' as typeof regions[number], managerName:'', memberNames:'', description:'', quota:0, commissionPlanText:'' });")

# 2. Update createSalesTeam args inside TeamsTab
old_create = "managerName: form.managerName,\n        memberIds:[], memberNames: form.memberNames.split(',').map(s=>s.trim()).filter(Boolean),\n        description: form.description, quota: form.quota,"
new_create = "managerName: form.managerName,\n        memberIds:[], memberNames: form.memberNames.split(',').map(s=>s.trim()).filter(Boolean),\n        description: form.description, quota: form.quota, commissionPlanText: form.commissionPlanText,"
code = code.replace(old_create, new_create)

# 3. Add commission text input
old_desc = "<div style={{ gridColumn:'1/-1' }}><FieldLabel>Description</FieldLabel><input className=\"input\" style={{ width:'100%' }} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} /></div>"
new_desc = "<div style={{ gridColumn:'1/-1' }}><FieldLabel>Commission Plan / Structure</FieldLabel><input className=\"input\" style={{ width:'100%' }} placeholder=\"e.g. 15% Flat, 2x Accelerator above 100%\" value={form.commissionPlanText} onChange={e=>setForm(p=>({...p,commissionPlanText:e.target.value}))} /></div>\n            <div style={{ gridColumn:'1/-1' }}><FieldLabel>Description</FieldLabel><input className=\"input\" style={{ width:'100%' }} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} /></div>"
code = code.replace(old_desc, new_desc)

# 4. TeamsTab layout restyle
teams_start = code.find("export function TeamsTab")
teams_end = code.find("export function ReportsTab")
if teams_start != -1 and teams_end != -1:
    teams_body = code[teams_start:teams_end]
    new_teams_body = """export function TeamsTab({ teams, opps, onCreated }: { teams: SalesTeam[]; opps: Opportunity[]; onCreated:(t:SalesTeam)=>void; }) {
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving]   = useState(false);
  const regions = ['latam','emea','apac','north_america','global'] as const;
  const [form, setForm] = useState({ name:'', region:'latam' as typeof regions[number], managerName:'', memberNames:'', description:'', quota:0, commissionPlanText:'' });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const team = await createSalesTeam({
        name: form.name, region: form.region, managerId:'manual', managerName: form.managerName,
        memberIds:[], memberNames: form.memberNames.split(',').map(s=>s.trim()).filter(Boolean),
        description: form.description, quota: form.quota, commissionPlanText: form.commissionPlanText,
      });
      onCreated(team);
      setShowNew(false);
      setForm({ name:'', region:'latam', managerName:'', memberNames:'', description:'', quota:0, commissionPlanText:'' });
    } finally { setSaving(false); }
  }

  // Aggregate stats
  const totalQuota = teams.reduce((s,t)=>s+(t.quota||0),0);
  const totalAttain = opps.filter(o=>o.stage==='closed_won').reduce((s,o)=>s+o.valueUsd,0);
  const globalAttainPct = totalQuota ? Math.round((totalAttain/totalQuota)*100) : 0;

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto py-2 pb-10">
      {/* Overview Metric Row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="text-[10px] font-black tracking-widest uppercase text-slate-500 mb-2">Platform Global Quota</div>
          <div className="text-3xl font-black text-slate-900">{fmtMoney(totalQuota)}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="text-[10px] font-black tracking-widest uppercase text-slate-500 mb-2">Global Attainment (Closed Won)</div>
          <div className="text-3xl font-black text-emerald-600">{fmtMoney(totalAttain)}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="text-[10px] font-black tracking-widest uppercase text-slate-500 mb-2">Global Pacing</div>
          <div className="text-3xl font-black text-indigo-600">{globalAttainPct}%</div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2.5 overflow-hidden"><div className="bg-indigo-500 h-full" style={{ width: ${Math.min(100, globalAttainPct)}% }} /></div>
        </div>
      </div>

      <div className="flex items-center justify-between">
         <div>
            <div className="text-lg font-black text-slate-900">Operations: Territories & Commissions</div>
            <div className="text-sm font-medium text-slate-500">Manage sales teams, geographic coverage, and commission structuring.</div>
         </div>
         <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg transition-colors shadow-sm text-sm" onClick={()=>setShowNew(v=>!v)}>
            {showNew?'? Cancel':'+ New Team / Territory'}
         </button>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fade-in relative">
          <div className="font-black text-slate-900 mb-6 bg-slate-50 -mx-6 -mt-6 px-6 py-4 border-b border-slate-100 uppercase tracking-widest text-xs">CREATE TEAM</div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel>Team Name *</FieldLabel><input required className="input w-full" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="EMEA Corporate Sales" /></div>
            <div>
              <FieldLabel>Authorized Territory (Region)</FieldLabel>
              <select className="input w-full font-bold" value={form.region} onChange={e=>setForm(p=>({...p,region:e.target.value as any}))}>
                {regions.map(r=><option key={r} value={r}>{REGION_LABELS[r]}</option>)}
              </select>
            </div>
            <div><FieldLabel>Manager / Director</FieldLabel><input className="input w-full" value={form.managerName} onChange={e=>setForm(p=>({...p,managerName:e.target.value}))} placeholder="Jane Smith" /></div>
            <div><FieldLabel>Annual Quota (USD)</FieldLabel><input type="number" className="input w-full" value={form.quota} onChange={e=>setForm(p=>({...p,quota:+e.target.value}))} /></div>
            <div className="col-span-2"><FieldLabel>Commission Plan / Structure</FieldLabel><input className="input w-full" placeholder="e.g. 15% Flat, 2x Accelerator above 100%" value={form.commissionPlanText} onChange={e=>setForm(p=>({...p,commissionPlanText:e.target.value}))} /></div>
            <div className="col-span-2"><FieldLabel>Assigned Representatives (comma-separated)</FieldLabel><input className="input w-full" value={form.memberNames} onChange={e=>setForm(p=>({...p,memberNames:e.target.value}))} placeholder="Alice, Bob, Carol" /></div>
            <div className="col-span-2"><FieldLabel>Internal Description</FieldLabel><input className="input w-full" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} /></div>
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button type="button" className="btn btn-ghost" onClick={()=>setShowNew(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving||!form.name}>{saving?'Processing...':'? Save Team & Territory'}</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map(team=>{
          const c = REGION_COLORS[team.region];
          const regionWon = opps.filter(o=>o.stage==='closed_won'&&o.region===team.region).reduce((s,o)=>s+o.valueUsd,0);
          const attainPct = team.quota ? Math.round((regionWon/team.quota)*100) : 0;
          
          return (
            <div key={team.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow relative">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: c }} />
              
              <div className="p-6 pb-4">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-black text-lg text-slate-900 tracking-tight">{team.name}</h3>
                    <div className="inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-bold uppercase tracking-widest" style={{ background: ${c}1A, color: c }}>
                      TERRITORY: {REGION_LABELS[team.region]}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-100">
                  <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                    <span>Attainment</span>
                    <span className={attainPct>=100?'text-emerald-600':'text-indigo-600'}>{fmtMoney(regionWon)} / {fmtMoney(team.quota)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ background: attainPct>=100?'#10b981':'#6366f1', width: ${Math.min(100, attainPct)}% }} />
                  </div>
                </div>

                {team.commissionPlanText && (
                  <div className="mb-5 bg-amber-50 rounded-lg p-3 border border-amber-100 text-amber-900 border-l-4 border-l-amber-400">
                    <div className="text-[9px] font-black uppercase tracking-widest text-amber-600/70 mb-0.5">Commission Structure</div>
                    <div className="font-medium text-xs">{team.commissionPlanText}</div>
                  </div>
                )}

                <div className="space-y-3 font-medium text-xs text-slate-600 mb-6">
                  <div className="flex items-center justify-between py-1 border-b border-dashed border-slate-100">
                    <span className="text-slate-400 uppercase text-[10px] font-bold tracking-widest w-24">Manager</span>
                    <span className="font-bold text-slate-900 text-right">{team.managerName}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                     <span className="text-slate-400 uppercase text-[10px] font-bold tracking-widest w-24 whitespace-nowrap">Reps ({team.memberNames.length})</span>
                     <span className="text-right truncate flex-1 ml-2 leading-tight">
                       {team.memberNames.join(' • ')}
                     </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {teams.length===0 && (
          <div className="col-span-3 text-center py-16 text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            <div className="text-4xl mb-3">??</div>
            Configure your first Sales Team & Territory above.
          </div>
        )}
      </div>
    </div>
  );
}

"""
    code = code[:teams_start] + new_teams_body + code[teams_end:]

with open('apps/web/app/(dashboard)/platform/crm/CrmTabs.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("TeamsTab modernized.")
