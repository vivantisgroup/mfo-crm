import re

with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Flatten OrgListTab
old_org = code.find("function OrgListTab({ orgs, onOpen }:")
if old_org != -1:
    end_org = code.find("// --- Main Page ----------------", old_org)
    if end_org == -1: end_org = code.find("\nexport default function", old_org)

    new_org = """
function OrgListTab({ orgs, onOpen }: { orgs:PlatformOrg[]; onOpen:(o:PlatformOrg)=>void }) {
  const [search, setSearch] = useState('');
  const [regionF, setRegionF] = useState('all');

  const filtered = useMemo(()=> orgs.filter(o=>{
    if (regionF!=='all' && (o as any).region!==regionF) return false;
    const q = search.toLowerCase();
    return !q || ${o.name}  .toLowerCase().includes(q);
  }), [orgs, search, regionF]);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center gap-4 py-4 px-6 bg-white border-b border-slate-200 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -mt-[7px] text-slate-400" />
          <input className="w-full text-sm pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Search Master Organizations..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="border border-slate-200 rounded-lg text-sm py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={regionF} onChange={e=>setRegionF(e.target.value)}>
          <option value="all">?? Global Data</option>
          {(['latam','emea','apac','north_america'] as const).map(r=><option key={r} value={r}>{REGION_LABELS[r]}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto px-6 h-full pb-10">
        <Card className="p-0 overflow-hidden shadow-sm border border-slate-200 h-full flex flex-col">
          <div className="overflow-x-auto overflow-y-auto flex-1 h-full hidden-scrollbar relative min-h-[500px]">
            <Table className="w-full min-w-[800px]">
              <TableHead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 shadow-sm">
                <TableRow>
                  <TableHeaderCell className="text-[10px] uppercase font-black tracking-widest text-slate-500 py-3">Organization</TableHeaderCell>
                  <TableHeaderCell className="text-[10px] uppercase font-black tracking-widest text-slate-500 py-3">Type</TableHeaderCell>
                  <TableHeaderCell className="text-[10px] uppercase font-black tracking-widest text-slate-500 py-3">Location</TableHeaderCell>
                  <TableHeaderCell className="text-[10px] uppercase font-black tracking-widest text-slate-500 py-3 text-right">Est. AUM</TableHeaderCell>
                  <TableHeaderCell className="text-[10px] uppercase font-black tracking-widest text-slate-500 py-3">Handler</TableHeaderCell>
                  <TableHeaderCell className="text-[10px] uppercase font-black tracking-widest text-slate-500 py-3">Linked Tenants</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(org => (
                  <TableRow key={org.id} onClick={()=>onOpen(org)} className="hover:bg-indigo-50/50 cursor-pointer transition-colors border-b border-slate-100 last:border-0">
                    <TableCell className="font-bold text-slate-900 py-3">
                      <div>{org.name}</div>
                      {org.website && <div className="text-[10px] font-normal text-indigo-500 hover:underline">{org.website}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge size="xs" color={(org as any).orgType === 'supplier' ? 'amber' : (org as any).orgType === 'partner' ? 'purple' : 'blue'} className="uppercase font-bold tracking-widest text-[9px]">
                        {(org as any).orgType || 'Client'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-slate-800 font-semibold text-xs">{org.country}</div>
                      {(org as any).region && <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-0.5">{REGION_LABELS[org.region as SalesRegion]}</div>}
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-700">{fmtAum(org.estAumUsd)}</TableCell>
                    <TableCell className="text-slate-500 font-medium text-xs">{org.assignedTo || '—'}</TableCell>
                    <TableCell>
                      {org.tenantIds?.length > 0 
                        ? <Badge size="xs" color="emerald" className="font-black">?? {org.tenantIds.length}</Badge> 
                        : <span className="text-slate-300 text-xs font-semibold uppercase">None</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length === 0 && <div className="p-12 text-center text-slate-400 font-medium">No master records found.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
"""
    code = code[:old_org] + new_org + "\n" + code[end_org:]

# 2. Add Table imports if missing
if 'Table,' not in code:
    code = code.replace("import { Card, Title,", "import { Card, Title, Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell,")

with open('apps/web/app/(dashboard)/platform/crm/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("CRM page updated successfully.")
