'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { RichTextRenderer } from '@/components/RichTextRenderer';
import {
  type PlatformOrg, type Opportunity, type CrmActivity, type SalesTeam,
  STAGE_LABELS, STAGE_COLORS, STAGES, REGION_LABELS, REGION_COLORS,
  ACTIVITY_ICONS, ACTIVITY_LABELS, ACTIVITY_TYPES,
  createActivity, updateActivity, updateOpportunity, type ActivityType, type DealStage,
  getAllOrgs, getAllOpportunities, getAllActivities, getSalesTeams, createOpportunity, createSalesTeam,
  getPlatformSalesUsers, type SalesUser,
  type PipelineStageConfig, DEFAULT_PIPELINE_STAGES,
} from '@/lib/crmService';
import { getAllSubscriptions } from '@/lib/subscriptionService';

// ─── Shared helpers ───────────────────────────────────────────────────────────
function fmtMoney(n: number) { if (!n) return '—'; if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`; if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`; return `$${(n/1e3).toFixed(0)}K`; }
function fmtDate(s: string)  { try { return new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); } catch { return s; } }
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{children}</div>;
}
function Chip({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:8, background:`${color}20`, color, border:`1px solid ${color}40` }}>{label}</span>;
}
const OPEN_STAGES: DealStage[] = ['lead','qualification','demo','proposal','negotiation'];

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
export function DashboardTab({ orgs, opps, activities, pipelineStages = DEFAULT_PIPELINE_STAGES }: { orgs: PlatformOrg[]; opps: Opportunity[]; activities: CrmActivity[]; pipelineStages?: PipelineStageConfig[] }) {
  const openStageIds = pipelineStages.filter(s => s.id !== 'closed_lost').map(s=>s.id);
  const openOpps = opps.filter(o => openStageIds.includes(o.stage));
  const wonOpps  = opps.filter(o => o.stage === 'closed_won');
  const pipelineValue = openOpps.reduce((s,o) => s+o.valueUsd,0);
  const weightedValue = openOpps.reduce((s,o) => s+o.valueUsd*(o.probability/100),0);
  const winRate = opps.length ? Math.round((wonOpps.length/opps.filter(o=>o.stage==='closed_won'||o.stage==='closed_lost').length||0)*100) : 0;
  const avgDeal = wonOpps.length ? wonOpps.reduce((s,o)=>s+o.valueUsd,0)/wonOpps.length : 0;

  // Stage funnel
  const funnelStages = pipelineStages.filter(s => s.id !== 'closed_lost');
  const funnelMax = Math.max(1, ...funnelStages.map(s => opps.filter(o=>o.stage===s.id).length));

  // Region breakdown
  const regions = ['latam','emea','apac','north_america','global'] as const;
  const regionRevenue = regions.map(r => ({ r, v: wonOpps.filter(o=>o.region===r).reduce((s,o)=>s+o.valueUsd,0) }));
  const regionMax = Math.max(1, ...regionRevenue.map(x=>x.v));

  // Industry breakdown
  const indMap: Record<string, number> = {};
  wonOpps.forEach(o => {
    const org = orgs.find(x => x.id === o.orgId);
    const ind = org?.industry || 'Other';
    indMap[ind] = (indMap[ind] || 0) + o.valueUsd;
  });
  const industryData = Object.entries(indMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a,b) => b.value - a.value);

  // Recent activities  
  const recentActs = [...activities].slice(0,5);

  const kpis = [
    { label:'Pipeline Value',     value: fmtMoney(pipelineValue),  color:'#6366f1' },
    { label:'Weighted Pipeline',  value: fmtMoney(weightedValue),  color:'#8b5cf6' },
    { label:'Closed Won (ARR)',   value: fmtMoney(wonOpps.reduce((s,o)=>s+o.valueUsd,0)), color:'#22c55e' },
    { label:'Win Rate',           value: `${winRate}%`,             color:'#f59e0b' },
    { label:'Avg Deal Size',      value: fmtMoney(avgDeal),         color:'#22d3ee' },
    { label:'Open Deals',         value: openOpps.length,           color:'#a78bfa' },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ padding:'14px 18px', background:'var(--bg-elevated)', border:`1px solid ${k.color}33`, borderRadius:12 }}>
            <div style={{ fontSize:10, color:'var(--text-tertiary)', textTransform:'uppercase', fontWeight:700, letterSpacing:'0.07em', marginBottom:4 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:900, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20 }}>
        {/* Funnel */}
        <div style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:14, border:'1px solid var(--border)' }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:16 }}>🎯 Pipeline Funnel</div>
          {funnelStages.map(s => {
            const count  = opps.filter(o=>o.stage===s.id).length;
            const value  = opps.filter(o=>o.stage===s.id).reduce((t,o)=>t+o.valueUsd,0);
            const pct    = Math.round((count/funnelMax)*100);
            const c      = s.color;
            return (
              <div key={s.id} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                  <span style={{ fontWeight:600 }}>{s.label.replace(/^.+ /,'')}</span>
                  <span style={{ color:'var(--text-tertiary)' }}>{count} · {fmtMoney(value)}</span>
                </div>
                <div style={{ height:8, borderRadius:999, background:'var(--bg-canvas)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.max(pct,2)}%`, background:c, borderRadius:999, transition:'width 0.5s' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Revenue by region */}
        <div style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:14, border:'1px solid var(--border)' }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:16 }}>🌍 Won Revenue by Region</div>
          {regionRevenue.map(({r,v}) => {
            const pct = Math.round((v/regionMax)*100);
            const c   = REGION_COLORS[r];
            return (
              <div key={r} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                  <span style={{ fontWeight:600 }}>{REGION_LABELS[r]}</span>
                  <span style={{ color:'var(--text-tertiary)' }}>{fmtMoney(v)}</span>
                </div>
                <div style={{ height:8, borderRadius:999, background:'var(--bg-canvas)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.max(pct,v>0?2:0)}%`, background:c, borderRadius:999, transition:'width 0.5s' }} />
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Industry Vertical */}
        <div style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:14, border:'1px solid var(--border)' }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:16 }}>🏢 Value by Industry Vertical</div>
          {industryData.length === 0 ? (
             <div style={{ textAlign:'center', color:'var(--text-tertiary)', fontSize:13, marginTop:20 }}>No classified wins.</div>
          ) : (
             <div className="mt-4">
                {/* BarList component assumed to be available or replaced with custom implementation */}
             </div>
          )}
        </div>
      </div>

      {/* Deals closing soon + Recent activity */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:14, border:'1px solid var(--border)' }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:14 }}>⏰ Deals Closing Soon (≤30d)</div>
          {openOpps
            .filter(o => {
              const d = Math.ceil((new Date(o.closeDate).getTime()-Date.now())/86400000);
              return d>=0 && d<=30;
            })
            .sort((a,b)=>a.closeDate.localeCompare(b.closeDate))
            .slice(0,5)
            .map(o => (
              <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                <div>
                  <div style={{ fontWeight:600 }}>{o.orgName}</div>
                  <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{fmtDate(o.closeDate)} · {o.assignedToName ?? o.ownerName ?? '—'}</div>
                </div>
                <div style={{ fontWeight:700, color: pipelineStages.find(s=>s.id===o.stage)?.color || '#6366f1' }}>{fmtMoney(o.valueUsd)}</div>
              </div>
            ))}
          {openOpps.filter(o=>{ const d=Math.ceil((new Date(o.closeDate).getTime()-Date.now())/86400000); return d>=0&&d<=30; }).length===0 &&
            <div style={{ textAlign:'center', padding:20, color:'var(--text-tertiary)', fontSize:13 }}>No deals closing in 30 days.</div>}
        </div>
        <div style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:14, border:'1px solid var(--border)' }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:14 }}>📅 Recent Activities</div>
          {recentActs.map(a => (
            <div key={a.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
              <span style={{ fontSize:16 }}>{ACTIVITY_ICONS[a.type]}</span>
              <div>
                <div style={{ fontWeight:600 }}>{a.subject}</div>
                <div style={{ color:'var(--text-tertiary)' }}>{a.orgName} · {a.performedByName} · {fmtDate(a.scheduledAt)}</div>
              </div>
            </div>
          ))}
          {recentActs.length===0 && <div style={{ textAlign:'center', padding:20, color:'var(--text-tertiary)', fontSize:13 }}>No activities yet.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline (Opportunity Kanban) Tab ────────────────────────────────────────
export function PipelineTab({
  orgs, opps, subs = [], onOppClick, onCreateOpp, onUpdateOpp, performer, filterOrgId, onReturn,
  pipelineStages = DEFAULT_PIPELINE_STAGES, onUpdatePipelineStages,
}: {
  orgs: PlatformOrg[]; opps: Opportunity[]; subs?: any[];
  onOppClick?:(o:Opportunity)=>void;
  onCreateOpp:(o:Opportunity)=>void;
  onUpdateOpp?:(o:Opportunity)=>void;
  performer:{uid:string;name:string};
  filterOrgId?: string | null;
  onReturn?: () => void;
  pipelineStages?: PipelineStageConfig[];
  onUpdatePipelineStages?: (stages: PipelineStageConfig[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configStages, setConfigStages] = useState<PipelineStageConfig[]>(pipelineStages);
  const [form, setForm] = useState({
    orgId: filterOrgId || '', title:'', stage:'lead' as DealStage, valueUsd:0,
    probability:20, closeDate:'', assignedToUid: performer.uid, notes:'', products:[] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);

  useEffect(() => {
    getPlatformSalesUsers().then(setSalesUsers).catch(() => {});
  }, []);

  const filtered = useMemo(()=> opps.filter(o=>{
    if (filterOrgId && o.orgId !== filterOrgId) return false;
    if (!search) return true;
    const assignee = o.assignedToName ?? o.ownerName ?? '';
    return `${o.orgName} ${o.title} ${assignee}`.toLowerCase().includes(search.toLowerCase());
  }), [opps, search, filterOrgId]);

  const openStages = pipelineStages.filter(s => s.id !== 'closed_lost');
  const openStageIds = openStages.map(s => s.id);

  async function handleCreateOrUpdate(e: React.FormEvent) {
    e.preventDefault(); if (!form.orgId || !form.title) return;
    setSaving(true);
    try {
      const org = orgs.find(o=>o.id===form.orgId);
      const assignee = salesUsers.find(u => u.uid === form.assignedToUid);
      
      if (editingOpp) {
        // Edit flow
        const updates = {
          ...form,
          orgName:         org?.name ?? '',
          ownerId:         form.assignedToUid,
          ownerName:       assignee?.displayName ?? performer.name,
          assignedToUid:   form.assignedToUid,
          assignedToName:  assignee?.displayName ?? performer.name,
          assignedToDept:  assignee?.department,
          region:          org?.region ?? 'global',
          products:        form.products,
        };
        await updateOpportunity(editingOpp.id, updates);
        if (onUpdateOpp) onUpdateOpp({ ...editingOpp, ...updates });
      } else {
        // Create flow
        const opp = await createOpportunity({
          ...form,
          orgName:         org?.name ?? '',
          ownerId:         form.assignedToUid,
          ownerName:       assignee?.displayName ?? performer.name,
          assignedToUid:   form.assignedToUid,
          assignedToName:  assignee?.displayName ?? performer.name,
          assignedToDept:  assignee?.department,
          region:          org?.region ?? 'global',
          products:        form.products,
          contactId:'', contactName:'', lostReason:'', createdBy: performer.uid,
        }, performer);
        onCreateOpp(opp);
      }
      
      setShowNew(false);
      setEditingOpp(null);
      setForm({ orgId: filterOrgId || '', title:'', stage:'lead', valueUsd:0, probability:20, closeDate:'', assignedToUid: performer.uid, notes:'', products:[] });
    } finally { setSaving(false); }
  }

  const handleOpenEdit = (opp: Opportunity) => {
    setForm({
       orgId: opp.orgId,
       title: opp.title,
       stage: opp.stage,
       valueUsd: opp.valueUsd,
       probability: opp.probability,
       closeDate: opp.closeDate || '',
       assignedToUid: opp.assignedToUid || opp.ownerId || '',
       notes: opp.notes || '',
       products: opp.products || []
    });
    setEditingOpp(opp);
    setShowNew(true);
  };

  const pipelineValue = filtered.filter(o => openStageIds.includes(o.stage)).reduce((s,o)=>s+o.valueUsd,0);

  async function handleDrop(e: React.DragEvent, newStage: DealStage) {
    e.preventDefault();
    const oppId = e.dataTransfer.getData('oppId');
    if (!oppId || !onUpdateOpp) return;
    const opp = opps.find(o => o.id === oppId);
    if (!opp || opp.stage === newStage) return;
    
    // Optimistic update
    onUpdateOpp({ ...opp, stage: newStage });
    try {
      await updateOpportunity(opp.id, { stage: newStage });
    } catch {
      // rollback on error
      onUpdateOpp(opp);
    }
  }

  const filteredOrg = filterOrgId ? orgs.find(o => o.id === filterOrgId) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {filterOrgId && filteredOrg && (
        <div className="bg-white border-b border-slate-200 shadow-sm flex items-center px-8 py-3 mb-6 -mx-6 -mt-6 cursor-pointer hover:bg-slate-50 transition-colors z-10" onClick={onReturn}>
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                <ChevronLeft size={16} />
                Back to {filteredOrg.name} Details
            </div>
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
        <div className="header-search cursor-text max-w-md w-full" style={{ flex: 1 }}>
          <Search size={16} className="text-tertiary shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals…" className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-primary placeholder-tertiary" />
        </div>
        <div style={{ fontSize:13, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
          Open: <strong style={{ color:'#6366f1' }}>{fmtMoney(pipelineValue)}</strong>
        </div>
        {onUpdatePipelineStages && (
           <button className="btn btn-ghost btn-sm" onClick={() => { setConfigStages(pipelineStages); setShowConfig(true); }}>⚙️ Queues</button>
        )}
        <button className="btn btn-primary btn-sm" onClick={()=>{
           if (showNew) { setShowNew(false); setEditingOpp(null); }
           else {
              setForm({ orgId: filterOrgId || '', title:'', stage:'lead', valueUsd:0, probability:20, closeDate:'', assignedToUid: performer.uid, notes:'', products:[] });
              setEditingOpp(null);
              setShowNew(true);
           }
        }}>{showNew ? '✕ Cancel' : '+ Opportunity'}</button>
      </div>

      {showNew && (
        <form onSubmit={handleCreateOrUpdate} style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)', marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>{editingOpp ? '✏️ Edit Opportunity' : '🎯 New Opportunity'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <FieldLabel>Organization *</FieldLabel>
              <select required className="input" style={{ width:'100%' }} value={form.orgId} onChange={e=>setForm(p=>({...p,orgId:e.target.value}))}>
                <option value="">Select org…</option>
                {orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Title *</FieldLabel>
              <input required className="input" style={{ width:'100%' }} value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Enterprise Annual — Org Name" />
            </div>
            <div>
              <FieldLabel>Stage</FieldLabel>
              <select className="input" style={{ width:'100%' }} value={form.stage} onChange={e=>{
                const newStageId = e.target.value as DealStage;
                const pStage = pipelineStages.find(s=>s.id === newStageId);
                setForm(p=>({...p, stage: newStageId, probability: pStage?.probability ?? 50 }));
              }}>
                {pipelineStages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Contract Value (USD)</FieldLabel>
              <input type="number" min={0} className="input" style={{ width:'100%' }} value={form.valueUsd} onChange={e=>setForm(p=>({...p,valueUsd:+e.target.value}))} />
            </div>
            <div>
              <FieldLabel>Probability (%)</FieldLabel>
              <input type="number" min={0} max={100} className="input" style={{ width:'100%' }} value={form.probability} onChange={e=>setForm(p=>({...p,probability:+e.target.value}))} />
            </div>
            <div>
              <FieldLabel>Expected Close Date</FieldLabel>
              <input type="date" className="input" style={{ width:'100%' }} value={form.closeDate} onChange={e=>setForm(p=>({...p,closeDate:e.target.value}))} />
            </div>
            <div>
              <FieldLabel>Assigned To</FieldLabel>
              <select
                className="input"
                style={{ width:'100%' }}
                value={form.assignedToUid}
                onChange={e => setForm(p => ({ ...p, assignedToUid: e.target.value }))}
              >
                <option value="">— Unassigned —</option>
                {salesUsers.map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName}{u.department ? ` · ${u.department}` : ''}{u.jobTitle ? ` (${u.jobTitle})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <FieldLabel>Notes</FieldLabel>
              <div className="mt-1"><RichTextEditor value={form.notes} onChange={(html)=>setForm(p=>({...p,notes:html}))} /></div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:14 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={()=>{ setShowNew(false); setEditingOpp(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving||!form.orgId||!form.title}>{saving?'…': (editingOpp ? '💾 Save Changes' : '✅ Create')}</button>
          </div>
        </form>
      )}

      {/* Kanban */}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${openStages.length},minmax(170px,1fr))`, gap:12, overflowX:'auto', minWidth:900 }}>
        {openStages.map(stage=>{
          const cards = filtered.filter(o=>o.stage===stage.id);
          const cv    = cards.reduce((s,o)=>s+o.valueUsd,0);
          const c     = stage.color || '#cbd5e1';
          return (
            <div key={stage.id} style={{ minHeight: 400 }} onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, stage.id)}>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:`${c}18`, borderRadius:8, marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:700, color:c }}>{stage.label}</span>
                <span style={{ fontSize:10, color:'var(--text-tertiary)', fontWeight:600 }}>{cards.length} · {fmtMoney(cv)}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {cards.map(opp=> {
                  const org = orgs.find(o => o.id === opp.orgId);
                  const isTrial = org?.tenantIds?.some((tid: string) => subs?.some(s => s.tenantId === tid && s.status === 'trial'));
                  return (
                  <div key={opp.id} onClick={()=>{ if (onOppClick) onOppClick(opp); handleOpenEdit(opp); }}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('oppId', opp.id)}
                    style={{ padding:'12px 14px', background:'var(--bg-elevated)', border:`1px solid ${c}44`, borderLeft:`3px solid ${c}`, borderRadius:10, cursor:'grab', transition:'transform 0.15s', userSelect:'none' }}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='';}}
                  >
                    <div style={{ fontWeight:700, fontSize:12, marginBottom:2, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                       <span>{opp.orgName}</span>
                       {isTrial && <span style={{ fontSize:9, background:'#fce7f3', color:'#ec4899', padding:'2px 4px', borderRadius:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Trial</span>}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:6 }}>{opp.title}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                      <span style={{ fontWeight:700, color:c }}>{fmtMoney(opp.valueUsd)}</span>
                      <span style={{ color:'var(--text-tertiary)' }}>{opp.probability}%</span>
                    </div>
                    {opp.closeDate && <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:4 }}>📅 {fmtDate(opp.closeDate)}</div>}
                    <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:2 }}>👤 {opp.assignedToName ?? opp.ownerName ?? '—'}</div>
                  </div>
                  );
                })}
                {cards.length===0 && <div style={{ padding:'16px', textAlign:'center', color:'var(--text-tertiary)', fontSize:11, border:'1px dashed var(--border)', borderRadius:8 }}>Empty</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Closed lost */}
      {filtered.filter(o=>o.stage==='closed_lost').length>0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ fontWeight:700, fontSize:12, color:'#ef4444', marginBottom:10 }}>❌ Closed Lost</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {filtered.filter(o=>o.stage==='closed_lost').map(opp=>(
              <div key={opp.id} onClick={()=>onOppClick?.(opp)} style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', background:'var(--bg-elevated)', borderRadius:8, cursor:'pointer', border:'1px solid #ef444422' }}>
                <div><div style={{ fontWeight:600, fontSize:13 }}>{opp.orgName} — {opp.title}</div><div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{opp.lostReason}</div></div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-tertiary)' }}>{fmtMoney(opp.valueUsd)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfig && onUpdatePipelineStages && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ background:'white', width:'100%', maxWidth:600, borderRadius:20, padding:24, boxShadow:'0 20px 40px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>Pipeline Queues</h3>
            <p style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:20 }}>Configure your sales pipeline progression below. Stages are globally applied to this tenant's CRM.</p>
            
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:'50vh', overflowY:'auto', paddingRight:8, marginBottom:20 }}>
              {configStages.map((stage, idx) => (
                <div key={idx} style={{ display:'flex', gap:8, alignItems:'center', background:'var(--bg-canvas)', padding:10, borderRadius:12 }}>
                  <div style={{ cursor:'ns-resize', color:'var(--text-tertiary)', paddingInline:4 }}>↕</div>
                  <input className="input" style={{ width:100, fontSize:12 }} placeholder="id_code" value={stage.id} onChange={e=>{const c=[...configStages]; c[idx].id=e.target.value.toLowerCase().replace(/\s+/g,'_'); setConfigStages(c);}} disabled={stage.id==='closed_won'||stage.id==='closed_lost'} />
                  <input className="input" style={{ flex:1, fontSize:13 }} placeholder="Stage Label" value={stage.label} onChange={e=>{const c=[...configStages]; c[idx].label=e.target.value; setConfigStages(c);}} />
                  <input type="number" className="input" style={{ width:70, fontSize:13 }} placeholder="Prob %" value={stage.probability} onChange={e=>{const c=[...configStages]; c[idx].probability=+e.target.value; setConfigStages(c);}} />
                  <input type="color" style={{ width:32, height:32, cursor:'pointer', border:'none', borderRadius:4, padding:0, background:'transparent' }} value={stage.color} onChange={e=>{const c=[...configStages]; c[idx].color=e.target.value; setConfigStages(c);}} />
                  <button onClick={()=>{const c=[...configStages]; c.splice(idx,1); setConfigStages(c);}} disabled={stage.id==='closed_won'||stage.id==='closed_lost'} style={{ color:'#ef4444', background:'none', border:'none', fontSize:16, opacity: (stage.id==='closed_won'||stage.id==='closed_lost')? 0.2 : 1, cursor:'pointer' }}>×</button>
                </div>
              ))}
              <div style={{ marginTop:8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfigStages([...configStages, { id: `stage_${configStages.length+1}`, label: 'New Stage', color: '#cbd5e1', probability: 50 }])}>+ Add Queue Stage</button>
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, borderTop:'1px solid var(--border)', paddingTop:16 }}>
              <button className="btn btn-ghost" onClick={() => setShowConfig(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { onUpdatePipelineStages(configStages); setShowConfig(false); }}>Save Pipeline</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Activities Tab ───────────────────────────────────────────────────────────
export function ActivitiesTab({
  activities, orgs, onCreated, onUpdateActivity, performer,
}: { activities: CrmActivity[]; orgs: PlatformOrg[]; onCreated:(a:CrmActivity)=>void; onUpdateActivity?:(a:CrmActivity)=>void; performer:{uid:string;name:string}; }) {
  const [typeF, setTypeF]   = useState<ActivityType|'all'>('all');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew]= useState(false);
  const [saving, setSaving]  = useState(false);
  
  const initialForm = { orgId:'', type:'call' as ActivityType, direction:'outbound' as 'inbound'|'outbound'|'internal', subject:'', body:'', outcome:'', scheduledAt: new Date().toISOString().slice(0,16) };
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string|null>(null);

  const filtered = useMemo(()=> activities.filter(a => {
    if (typeF!=='all' && a.type!==typeF) return false;
    if (search && !`${a.subject} ${a.orgName} ${a.performedByName} ${a.body}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [activities, typeF, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!form.orgId||!form.subject) return;
    setSaving(true);
    try {
      const org = orgs.find(o=>o.id===form.orgId);
      const act = await createActivity({
        orgId:form.orgId, orgName:org?.name??'', type:form.type, direction:form.direction,
        subject:form.subject, body:form.body, outcome:form.outcome,
        scheduledAt:new Date(form.scheduledAt).toISOString(),
        completedAt:new Date(form.scheduledAt).toISOString(),
        performedByUid:performer.uid, performedByName:performer.name,
      }, performer);
      onCreated(act);
      setShowNew(false);
      setForm(initialForm);
    } finally { setSaving(false); }
  }

  async function handleEditAction(e: React.FormEvent) {
    e.preventDefault(); if (!form.orgId||!form.subject||!editingId||!onUpdateActivity) return;
    setSaving(true);
    try {
      const org = orgs.find(o=>o.id===form.orgId);
      const patch = { ...form, orgName:org?.name, scheduledAt:new Date(form.scheduledAt).toISOString() };
      await updateActivity(editingId, patch);
      const old = activities.find(a=>a.id===editingId);
      if (old) onUpdateActivity({ ...old, ...patch } as CrmActivity);
      setEditingId(null);
      setForm(initialForm);
    } finally { setSaving(false); }
  }

  return (
    <div>
      {/* Toolbar */}
        <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
          <div className="header-search cursor-text max-w-md w-full" style={{ flex: 1, minWidth: 180 }}>
            <Search size={16} className="text-tertiary shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activities…" className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-primary placeholder-tertiary" />
          </div>
        <select className="input" value={typeF} onChange={e=>setTypeF(e.target.value as any)}>
          <option value="all">All Types</option>
          {ACTIVITY_TYPES.map(t=><option key={t} value={t}>{ACTIVITY_ICONS[t]} {ACTIVITY_LABELS[t]}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={()=>{setShowNew(v=>!v);setEditingId(null);setForm(initialForm);}}>{showNew?'✕ Cancel':'+ Log Activity'}</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Master Column */}
        <div className="lg:col-span-1" style={{ display:'flex', flexDirection:'column', gap:10, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: 4 }}>
          {filtered.length===0 ? (
            <div style={{ textAlign:'center', padding:'40px 20px', border:'1px dashed var(--border)', borderRadius:12, color:'var(--text-tertiary)' }}>No activities found.</div>
          ) : filtered.map(a=>{
             const initials = (a.performedByName || 'U').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
             const avatarColor = `hsl(${((a.performedByName?.length || 0) * 40) % 360}, 65%, 45%)`;
             const isSelected = editingId === a.id;

             return (
               <div 
                 key={a.id} 
                 onClick={() => {
                    setEditingId(a.id); setShowNew(false);
                    setForm({ orgId:a.orgId, type:a.type, direction:a.direction, subject:a.subject, body:a.body, outcome:a.outcome||'', scheduledAt:new Date(a.scheduledAt).toISOString().slice(0,16) });
                 }}
                 style={{ padding:'14px 16px', background:'var(--bg-elevated)', borderRadius:12, border: isSelected ? '2px solid var(--brand-500)' : '1px solid var(--border)', cursor:'pointer', transition:'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                 className="hover-lift"
               >
                 <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                    <div style={{ position:'relative', flexShrink:0 }}>
                       <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor, color: 'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, letterSpacing: '0.05em', boxShadow:'inset 0 0 0 1px rgba(0,0,0,0.1)' }}>
                         {initials}
                       </div>
                       <div style={{ position:'absolute', bottom:-2, right:-4, background:'var(--bg-elevated)', borderRadius:'50%', padding:2, fontSize:10, boxShadow:'0 0 0 2px var(--bg-elevated)' }}>
                         {ACTIVITY_ICONS[a.type]}
                       </div>
                    </div>
                    
                    <div style={{ flex:1, minWidth:0 }}>
                       <div style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom: 2 }}>
                         {a.subject}
                       </div>
                       <div style={{ fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom: 4 }}>
                         {a.orgName}
                       </div>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <Chip label={a.direction} color={a.direction==='inbound'?'#22c55e':a.direction==='outbound'?'#6366f1':'#94a3b8'} />
                         <span style={{ fontSize:11, color:'var(--text-tertiary)', fontWeight:600 }}>
                           {fmtDate(a.scheduledAt)}
                         </span>
                       </div>
                    </div>
                 </div>
               </div>
             );
          })}
        </div>

        {/* Detail Column */}
        <div className="lg:col-span-2" style={{ position: 'sticky', top: 20 }}>
          {(showNew || editingId) ? (
            <form onSubmit={editingId ? handleEditAction : handleCreate} style={{ padding:'24px', background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)' }}>
              <div style={{ fontWeight:800, fontSize:16, marginBottom:20, display: 'flex', alignItems: 'center', gap: 8 }}>
                {ACTIVITY_ICONS[form.type]} {editingId ? 'Edit Activity Details' : 'Log New Activity'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div>
                  <FieldLabel>Organization *</FieldLabel>
                  <select required className="input" style={{ width:'100%' }} value={form.orgId} onChange={e=>setForm(p=>({...p,orgId:e.target.value}))}>
                    <option value="">Select org…</option>
                    {orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Type</FieldLabel>
                  <select className="input" style={{ width:'100%' }} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value as ActivityType}))}>
                    {ACTIVITY_TYPES.map(t=><option key={t} value={t}>{ACTIVITY_ICONS[t]} {ACTIVITY_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Direction</FieldLabel>
                  <select className="input" style={{ width:'100%' }} value={form.direction} onChange={e=>setForm(p=>({...p,direction:e.target.value as any}))}>
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                    <option value="internal">Internal</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Date &amp; Time</FieldLabel>
                  <input type="datetime-local" className="input" style={{ width:'100%' }} value={form.scheduledAt} onChange={e=>setForm(p=>({...p,scheduledAt:e.target.value}))} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <FieldLabel>Subject *</FieldLabel>
                  <input required className="input" style={{ width:'100%', fontSize: 15, fontWeight: 600 }} value={form.subject} onChange={e=>setForm(p=>({...p,subject:e.target.value}))} placeholder="e.g. Discovery call with CEO" />
                </div>
                <div className="col-span-2">
                  <FieldLabel>Message Body</FieldLabel>
                  <div className="mt-1"><RichTextEditor value={form.body} onChange={(html)=>setForm(p=>({...p,body:html}))} /></div>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <FieldLabel>Outcome</FieldLabel>
                  <input className="input" style={{ width:'100%' }} value={form.outcome} onChange={e=>setForm(p=>({...p,outcome:e.target.value}))} placeholder="e.g. Follow-up scheduled, No answer, Positive" />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:24, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <button type="button" className="btn btn-ghost" onClick={()=>{setShowNew(false); setEditingId(null); setForm(initialForm);}}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving||!form.orgId||!form.subject}>{saving?'Saving…':(editingId?'💾 Save Changes':'✅ Log Activity')}</button>
              </div>
            </form>
          ) : (
            <div style={{ padding: '80px 20px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px dashed var(--border)' }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.8 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No Activity Selected</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 300, margin: '0 auto' }}>Select an activity from the sequence to view and edit details, or click "+ Log Activity" to create a new one.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sales Teams Tab ──────────────────────────────────────────────────────────
export function TeamsTab({ teams, onCreated }: { teams: SalesTeam[]; onCreated:(t:SalesTeam)=>void; }) {
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving]   = useState(false);
  const regions = ['latam','emea','apac','north_america','global'] as const;
  const [form, setForm] = useState({ name:'', region:'latam' as typeof regions[number], managerName:'', memberNames:'', description:'', quota:0 });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const team = await createSalesTeam({
        name: form.name, region: form.region, managerId:'manual', managerName: form.managerName,
        memberIds:[], memberNames: form.memberNames.split(',').map(s=>s.trim()).filter(Boolean),
        description: form.description, quota: form.quota,
      });
      onCreated(team);
      setShowNew(false);
      setForm({ name:'', region:'latam', managerName:'', memberNames:'', description:'', quota:0 });
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowNew(v=>!v)}>{showNew?'✕ Cancel':'+ New Team'}</button>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)', marginBottom:24 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>👥 New Sales Team</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><FieldLabel>Team Name *</FieldLabel><input required className="input" style={{ width:'100%' }} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="EMEA Sales" /></div>
            <div>
              <FieldLabel>Region</FieldLabel>
              <select className="input" style={{ width:'100%' }} value={form.region} onChange={e=>setForm(p=>({...p,region:e.target.value as any}))}>
                {regions.map(r=><option key={r} value={r}>{REGION_LABELS[r]}</option>)}
              </select>
            </div>
            <div><FieldLabel>Manager</FieldLabel><input className="input" style={{ width:'100%' }} value={form.managerName} onChange={e=>setForm(p=>({...p,managerName:e.target.value}))} placeholder="Jane Smith" /></div>
            <div><FieldLabel>Annual Quota (USD)</FieldLabel><input type="number" className="input" style={{ width:'100%' }} value={form.quota} onChange={e=>setForm(p=>({...p,quota:+e.target.value}))} /></div>
            <div style={{ gridColumn:'1/-1' }}><FieldLabel>Members (comma-separated)</FieldLabel><input className="input" style={{ width:'100%' }} value={form.memberNames} onChange={e=>setForm(p=>({...p,memberNames:e.target.value}))} placeholder="Alice, Bob, Carol" /></div>
            <div style={{ gridColumn:'1/-1' }}><FieldLabel>Description</FieldLabel><input className="input" style={{ width:'100%' }} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} /></div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:14 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setShowNew(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving||!form.name}>{saving?'…':'✅ Create Team'}</button>
          </div>
        </form>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
        {teams.map(team=>{
          const c = REGION_COLORS[team.region];
          return (
            <div key={team.id} style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:14, border:`1px solid ${c}44`, borderTop:`3px solid ${c}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:14 }}>{team.name}</div>
                  <Chip label={REGION_LABELS[team.region]} color={c} />
                </div>
                <div style={{ fontSize:18, fontWeight:900, color:c }}>{fmtMoney(team.quota)}</div>
              </div>
              {team.description && <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:12, lineHeight:1.5 }}>{team.description}</div>}
              <div style={{ fontSize:11, color:'var(--text-tertiary)', marginBottom:6 }}>👔 Manager: <strong style={{ color:'var(--text-primary)' }}>{team.managerName}</strong></div>
              {team.memberNames.length>0 && (
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                  {team.memberNames.map(m=>(
                    <div key={m} style={{ padding:'3px 10px', borderRadius:20, background:`${c}15`, border:`1px solid ${c}33`, fontSize:11, fontWeight:600, color:c }}>{m}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {teams.length===0 && <div style={{ textAlign:'center', padding:'40px 20px', border:'1px dashed var(--border)', borderRadius:12, color:'var(--text-tertiary)', gridColumn:'1/-1' }}>No teams yet. Click "+ New Team" to create the first one.</div>}
      </div>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
export function ReportsTab({ orgs, opps, activities, teams }: { orgs:PlatformOrg[]; opps:Opportunity[]; activities:CrmActivity[]; teams:SalesTeam[] }) {
  // Win rate by rep
  const repNameFn = (o: Opportunity) => o.assignedToName ?? o.ownerName ?? 'Unassigned';
  const owners = [...new Set(opps.map(repNameFn))];
  const ownerStats = owners.map(name=>{
    const owned = opps.filter(o=>repNameFn(o)===name);
    const won   = owned.filter(o=>o.stage==='closed_won').length;
    const total = owned.filter(o=>o.stage==='closed_won'||o.stage==='closed_lost').length;
    const pipeline = owned.filter(o=>OPEN_STAGES.includes(o.stage)).reduce((s,o)=>s+o.valueUsd*(o.probability/100),0);
    return { name, won, total, winRate: total?Math.round((won/total)*100):0, pipeline };
  }).sort((a,b)=>b.winRate-a.winRate);

  // Activity by type
  const actByType = ACTIVITY_TYPES.map(t=>({ type:t, count:activities.filter(a=>a.type===t).length })).filter(x=>x.count>0);
  const actMax = Math.max(1,...actByType.map(x=>x.count));

  // Stage conversion
  const stageConv = STAGES.slice(0,-1).map((s,i)=>{
    const from = opps.filter(o=>STAGES.indexOf(o.stage)>=i).length;
    const next  = opps.filter(o=>STAGES.indexOf(o.stage)>i).length;
    return { from:s, count:opps.filter(o=>o.stage===s).length, convRate: from?Math.round((next/from)*100):0 };
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* Win Rate by Rep */}
      <div style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:14, border:'1px solid var(--border)' }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>🏆 Win Rate by Sales Rep</div>
        {ownerStats.length===0 && <div style={{ color:'var(--text-tertiary)', fontSize:13 }}>No closed deals yet.</div>}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
          {ownerStats.map(s=>(
            <div key={s.name} style={{ padding:'14px 16px', background:'var(--bg-canvas)', borderRadius:10, border:'1px solid var(--border)' }}>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>{s.name}</div>
              <div style={{ fontSize:22, fontWeight:900, color:'#22c55e', marginBottom:4 }}>{s.winRate}%</div>
              <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{s.won}/{s.total} closed · Pipeline: {fmtMoney(s.pipeline)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Activity breakdown */}
        <div style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:14, border:'1px solid var(--border)' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>📅 Activity Breakdown</div>
          {actByType.map(({type,count})=>(
            <div key={type} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                <span>{ACTIVITY_ICONS[type]} {ACTIVITY_LABELS[type]}</span>
                <span style={{ fontWeight:700 }}>{count}</span>
              </div>
              <div style={{ height:6, borderRadius:999, background:'var(--bg-canvas)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.round((count/actMax)*100)}%`, background:'#6366f1', borderRadius:999 }} />
              </div>
            </div>
          ))}
          {actByType.length===0 && <div style={{ color:'var(--text-tertiary)', fontSize:13 }}>No activities logged yet.</div>}
        </div>

        {/* Stage conversion */}
        <div style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:14, border:'1px solid var(--border)' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>🔄 Stage Conversion Rate</div>
          {stageConv.map(({from, count, convRate})=>(
            <div key={from} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
              <span style={{ color: STAGE_COLORS[from] }}>{STAGE_LABELS[from].replace(/^.+ /,'')}</span>
              <span style={{ color:'var(--text-tertiary)', fontSize:11 }}>{count} deals</span>
              <span style={{ fontWeight:700, color: convRate>50?'#22c55e':convRate>25?'#f59e0b':'#ef4444' }}>{convRate}% →</span>
            </div>
          ))}
        </div>
      </div>

      {/* Team quota summary */}
      {teams.length>0 && (
        <div style={{ padding:'20px 22px', background:'var(--bg-elevated)', borderRadius:14, border:'1px solid var(--border)' }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>💰 Team Quota Overview</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--bg-canvas)', borderBottom:'1px solid var(--border)' }}>
                  {['Team','Region','Manager','Members','Quota','Won Revenue','Attainment'].map(h=>(
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map(team=>{
                  const teamWon = opps.filter(o=>o.stage==='closed_won'&&o.region===team.region).reduce((s,o)=>s+o.valueUsd,0);
                  const attain = team.quota?Math.round((teamWon/team.quota)*100):0;
                  const c = REGION_COLORS[team.region];
                  return (
                    <tr key={team.id} style={{ borderBottom:'1px solid var(--border)', fontSize:13 }}>
                      <td style={{ padding:'10px 12px', fontWeight:700 }}>{team.name}</td>
                      <td style={{ padding:'10px 12px' }}><Chip label={REGION_LABELS[team.region]} color={c} /></td>
                      <td style={{ padding:'10px 12px', color:'var(--text-secondary)' }}>{team.managerName}</td>
                      <td style={{ padding:'10px 12px', color:'var(--text-secondary)' }}>{team.memberNames.length}</td>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:'#a78bfa' }}>{fmtMoney(team.quota)}</td>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:'#22c55e' }}>{fmtMoney(teamWon)}</td>
                      <td style={{ padding:'10px 12px', fontWeight:700, color:attain>=100?'#22c55e':attain>=70?'#f59e0b':'#ef4444' }}>{attain}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
