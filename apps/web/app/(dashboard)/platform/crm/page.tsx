'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePageTitle } from '@/lib/PageTitleContext';
import {
  getAllOrgs, getAllOpportunities, getAllActivities, getSalesTeams, getAllContacts, seedCrmIfEmpty,
  STAGE_COLORS, STAGE_LABELS, ORG_SIZE_LABELS,
  getTenantPipelineStages, updateTenantPipelineStages, type PipelineStageConfig, DEFAULT_PIPELINE_STAGES,
  type PlatformOrg, type PlatformContact, type Opportunity, type CrmActivity, type SalesTeam
} from '@/lib/crmService';
import { getAllSubscriptions, type TenantSubscription } from '@/lib/subscriptionService';
import { DashboardTab, PipelineTab, ActivitiesTab, TeamsTab, ReportsTab } from './CrmTabs';
import { SecondaryDock, type SecondaryDockTab } from '@/components/SecondaryDock';
import { EntitiesTab } from './components/EntitiesTab';
import { LayoutDashboard, Building, Target, Calendar, Users, LineChart } from 'lucide-react';
import { toast } from 'sonner';

const CRM_TABS: SecondaryDockTab[] = [
  { id: 'dashboard',  label: 'Dashboard', icon: LayoutDashboard },
  { id: 'entities',   label: 'Entities', icon: Building },
  { id: 'pipeline',   label: 'Pipeline', icon: Target },
  { id: 'activities', label: 'Activities', icon: Calendar },
  { id: 'teams',      label: 'Teams', icon: Users },
  { id: 'reports',    label: 'Reports', icon: LineChart },
];

// ─── Comboboxes (re-exported for other modules) ──────────────────────────────
export function OrgCombobox({ orgs, value, onChange, placeholder='Search organizations…', pipelineStages=[] }: { orgs:PlatformOrg[]; value:string; onChange:(id:string,name:string)=>void; placeholder?:string; pipelineStages?:PipelineStageConfig[] }) {
  const [q,setQ]       = useState('');
  const [open,setOpen] = useState(false);
  const ref            = useRef<HTMLDivElement>(null);
  const selected       = orgs.find(o=>o.id===value);
  useEffect(()=>{
    function h(e:MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);
  const filtered = useMemo(()=>{ const lq=q.toLowerCase(); return orgs.filter(o=>!lq||o.name.toLowerCase().includes(lq)||o.country.toLowerCase().includes(lq)); },[orgs,q]);
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div className="input" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', userSelect:'none' }} onClick={()=>setOpen(v=>!v)}>
        {selected?<span style={{ fontWeight:600 }}>{selected.name} <span style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:400 }}>· {selected.country}</span></span>:<span style={{ color:'var(--text-tertiary)' }}>{placeholder}</span>}
        <span style={{ color:'var(--text-tertiary)', fontSize:12 }}>▾</span>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, marginTop:4, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.3)', overflow:'hidden' }}>
          <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)' }}>
            <input className="input" autoFocus style={{ width:'100%', padding:'7px 10px', fontSize:13 }} placeholder="Type to filter…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div style={{ maxHeight:240, overflowY:'auto' }}>
            {filtered.length===0?<div style={{ padding:'16px', textAlign:'center', fontSize:13, color:'var(--text-tertiary)' }}>No matches</div>:filtered.map(o=>(
              <div key={o.id} onClick={()=>{onChange(o.id,o.name);setOpen(false);setQ('');}} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }} className="hover-lift">
                <div><div style={{ fontWeight:700, fontSize:13 }}>{o.name}</div><div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{o.country} · {ORG_SIZE_LABELS[o.size]}</div></div>
                <div style={{ fontSize:11, color: pipelineStages.find(s=>s.id===o.stage)?.color || STAGE_COLORS[o.stage] }}>{(pipelineStages.find(s=>s.id===o.stage)?.label || STAGE_LABELS[o.stage] || o.stage).replace(/^.+ /,'')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ContactCombobox({ contacts, value, onChange, disabled=false }: { contacts:PlatformContact[]; value:string; onChange:(id:string,name:string,email:string)=>void; disabled?:boolean }) {
  const [q,setQ]       = useState('');
  const [open,setOpen] = useState(false);
  const ref            = useRef<HTMLDivElement>(null);
  const selected       = contacts.find(c=>c.id===value);
  useEffect(()=>{
    function h(e:MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h);
  },[]);
  const filtered = contacts.filter(c=>!q||c.name.toLowerCase().includes(q.toLowerCase())||c.email.toLowerCase().includes(q.toLowerCase()));
  return (
    <div ref={ref} style={{ position:'relative', opacity:disabled?0.5:1, pointerEvents:disabled?'none':undefined }}>
      <div className="input" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:disabled?'default':'pointer', userSelect:'none' }} onClick={()=>!disabled&&setOpen(v=>!v)}>
        {selected?<span style={{ fontWeight:600 }}>{selected.name} <span style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:400 }}>· {selected.role}</span></span>:<span style={{ color:'var(--text-tertiary)' }}>{disabled?'Select an organization first':'Select contact…'}</span>}
        <span style={{ color:'var(--text-tertiary)', fontSize:12 }}>▾</span>
      </div>
      {open && !disabled && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, marginTop:4, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.3)', overflow:'hidden' }}>
          <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)' }}>
            <input className="input" autoFocus style={{ width:'100%', padding:'7px 10px', fontSize:13 }} placeholder="Filter contacts…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div style={{ maxHeight:200, overflowY:'auto' }}>
            {filtered.length===0?<div style={{ padding:'16px', textAlign:'center', fontSize:13, color:'var(--text-tertiary)' }}>No contacts</div>:filtered.map(c=>(
              <div key={c.id} onClick={()=>{onChange(c.id,c.name,c.email);setOpen(false);setQ('');}} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)' }} className="hover-lift">
                <div style={{ fontWeight:700, fontSize:13 }}>{c.name} {c.isPrimary&&<span style={{ fontSize:10, color:'#6366f1' }}>★ primary</span>}</div>
                <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{c.role} · {c.email}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main CRM Page ────────────────────────────────────────────────────────────
export default function CrmPage() {
  usePageTitle('Platform CRM');
  const { user, tenant } = useAuth();
  const performer = { uid: user?.uid??'unknown', name: user?.name??'Sales Rep' };

  const [orgs,       setOrgs]       = useState<PlatformOrg[]>([]);
  const [contacts,   setContacts]   = useState<PlatformContact[]>([]);
  const [opps,       setOpps]       = useState<Opportunity[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [teams,      setTeams]      = useState<SalesTeam[]>([]);
  const [subs,       setSubs]       = useState<TenantSubscription[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageConfig[]>(DEFAULT_PIPELINE_STAGES);
  const [loading,    setLoading]    = useState(true);

  const [mainTab, setMainTab] = useState<string>('entities');
  const [pipelineFilterOrgId, setPipelineFilterOrgId] = useState<string|null>(null);
  const [entitiesReturnOrgId, setEntitiesReturnOrgId] = useState<string|null>(null);

  const load = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const activeTenantId = tenant?.id || 'mfo-system';
      const [o,c,opp,act,t,s,pl] = await Promise.all([
        getAllOrgs(), getAllContacts(), getAllOpportunities(), getAllActivities(), getSalesTeams(), getAllSubscriptions(),
        getTenantPipelineStages(activeTenantId)
      ]);
      setOrgs(o); setContacts(c); setOpps(opp); setActivities(act); setTeams(t); setSubs(s); setPipelineStages(pl);
    } catch {} finally { if (!isBackground) setLoading(false); }
  }, [tenant?.id]);

  useEffect(()=>{ load(); },[load]);

  async function handleSeed() {
    const seeded = await seedCrmIfEmpty(performer);
    if (seeded) await load(); else toast.error('CRM already has data — seed skipped.');
  }

  async function handleUpdatePipelineStages(newStages: PipelineStageConfig[]) {
    const activeTenantId = tenant?.id || 'mfo-system';
    setPipelineStages(newStages);
    try {
      await updateTenantPipelineStages(activeTenantId, newStages);
    } catch (err) {
      console.error('Failed to update pipeline stages:', err);
    }
  }

  const kpis = useMemo(() => ({
    orgs: orgs.length,
    openDeals: opps.filter(o => ['lead', 'qualification', 'demo', 'proposal', 'negotiation'].includes(o.stage)).length,
    pipelineValue: opps.filter(o => ['lead', 'qualification', 'demo', 'proposal', 'negotiation'].includes(o.stage)).reduce((s,o)=>s+o.valueUsd,0),
    wonRevenue: opps.filter(o => o.stage==='closed_won').reduce((s,o)=>s+o.valueUsd,0),
    tenants: subs.length,
    trials: subs.filter(s => s.status === 'trial').length,
  }), [orgs, opps, subs]);

  const fmtM = (n:number) => n>=1e9?`$${(n/1e9).toFixed(1)}B`:n>=1e6?`$${(n/1e6).toFixed(1)}M`:`$${(n/1e3).toFixed(0)}K`;

  return (
    <div className="flex flex-col absolute inset-0 overflow-hidden bg-slate-50/50 z-0">
      <SecondaryDock 
        tabs={CRM_TABS} 
        activeTab={mainTab} 
        onTabChange={setMainTab} 
      />
      
      <main className="flex-1 flex flex-col min-h-0 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400">Loading CRM Environment…</div>
        ) : (
          <>
            {/* Top KPI strip embedded if not in Entities (Orgs manages its own layout) */}
            {mainTab !== 'entities' && (
              <div className="p-6 pb-0">
                <div className="grid grid-cols-6 gap-3 mb-6">
                  {[
                    {label:'Organizations',  value:kpis.orgs,              color:'#6366f1'},
                    {label:'Open Deals',     value:kpis.openDeals,         color:'#f59e0b'},
                    {label:'Pipeline Value', value:fmtM(kpis.pipelineValue),color:'#a78bfa'},
                    {label:'Won Revenue',    value:fmtM(kpis.wonRevenue),  color:'#10b981'},
                    {label:'Active Tenants', value:kpis.tenants,           color:'#06b6d4'},
                    {label:'Active Trials',  value:kpis.trials,            color:'#ec4899'},
                  ].map(k=>(
                    <div key={k.label} className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                      <div className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider mb-1">{k.label}</div>
                      <div style={{ color: k.color }} className="text-xl font-black">{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab content wrappers */}
            <div className={`flex-1 overflow-y-auto ${mainTab === 'entities' ? '' : 'p-6 pt-0'}`}>
              {mainTab === 'entities' && (
                <EntitiesTab 
                  orgs={orgs} 
                  contacts={contacts} 
                  opps={opps}
                  subscriptions={subs} 
                  performer={performer} 
                  onRefresh={() => load(true)} 
                  returnOrgId={entitiesReturnOrgId}
                  onClearReturnOrg={() => setEntitiesReturnOrgId(null)}
                  onOpenPipeline={(orgId: string) => { setPipelineFilterOrgId(orgId); setMainTab('pipeline'); }}
                  pipelineStages={pipelineStages}
                />
              )}
              {mainTab === 'dashboard'     && <DashboardTab orgs={orgs} opps={opps} activities={activities} pipelineStages={pipelineStages} />}
              {mainTab === 'pipeline'      && <PipelineTab orgs={orgs} opps={opps} subs={subs} filterOrgId={pipelineFilterOrgId} onReturn={() => { setEntitiesReturnOrgId(pipelineFilterOrgId); setPipelineFilterOrgId(null); setMainTab('entities'); }} onCreateOpp={o=>setOpps(p=>[o,...p])} onUpdateOpp={o=>setOpps(p=>p.map(x=>x.id===o.id?o:x))} performer={performer} pipelineStages={pipelineStages} onUpdatePipelineStages={handleUpdatePipelineStages} />}
              {mainTab === 'activities'    && <ActivitiesTab activities={activities} orgs={orgs} onCreated={a=>setActivities(p=>[a,...p])} onUpdateActivity={a=>setActivities(p=>p.map(x=>x.id===a.id?a:x))} performer={performer} />}
              {mainTab === 'teams'         && <TeamsTab teams={teams} onCreated={t=>setTeams(p=>[...p,t])} />}
              {mainTab === 'reports'       && <ReportsTab orgs={orgs} opps={opps} activities={activities} teams={teams} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
