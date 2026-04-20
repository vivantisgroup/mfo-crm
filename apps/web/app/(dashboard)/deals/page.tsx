'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePageTitle } from '@/lib/PageTitleContext';
import { collection, query, onSnapshot, doc, getDocs, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, ChevronLeft, Target } from 'lucide-react';
import type { DealStage, PipelineStageConfig, Opportunity } from '@/lib/crmService';
import { DEFAULT_PIPELINE_STAGES } from '@/lib/crmService';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';


function fmtMoney(n: number) { if (!n) return '—'; if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`; if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`; return `$${(n/1e3).toFixed(0)}K`; }
function fmtDate(s: string)  { try { return new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); } catch { return s; } }
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{children}</div>;
}

export default function TenantDealsPage() {
  usePageTitle('Pipeline & Deals');
  const { user, tenant } = useAuth();
  const performer = { uid: user?.uid ?? 'unknown', name: user?.name ?? 'Unknown' };

  const [orgs, setOrgs] = useState<any[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageConfig[]>(DEFAULT_PIPELINE_STAGES);

  // States for Pipeline
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    orgId: '', title: '', stage: 'lead' as DealStage, valueUsd: 0,
    probability: 20, closeDate: '', assignedToUid: performer.uid, notes: '', products: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;
    
    // Fetch users (assignees)
    // We fetch global users manually or standard tenant members here? Let's just fetch members of the tenant.
    getDocs(collection(db, 'tenants', tenant.id, 'members')).then(snap => {
         const ms = snap.docs.map(x=>x.data());
         setUsers(ms);
    }).catch(console.error);

    // Snapshot opportunities
    const unsubOpps = onSnapshot(collection(db, 'tenants', tenant.id, 'opportunities'), (snap) => {
      setOpps(snap.docs.map(d => ({ id: d.id, ...d.data() } as Opportunity)));
    });

    // Snapshot orgs
    const unsubOrgs = onSnapshot(collection(db, 'tenants', tenant.id, 'organizations'), (snap) => {
      setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubOpps();
      unsubOrgs();
    };
  }, [tenant?.id]);

  const filtered = useMemo(()=> opps.filter(o=>{
    if (!search) return true;
    const assignee = o.assignedToName ?? o.ownerName ?? '';
    return `${o.orgName} ${o.title} ${assignee}`.toLowerCase().includes(search.toLowerCase());
  }), [opps, search]);

  const openStages = pipelineStages.filter(s => s.id !== 'closed_lost');
  
  if (loading) return <div className="flex h-full items-center justify-center">Loading deals...</div>;

  async function handleCreateOrUpdate(e: React.FormEvent) {
    e.preventDefault(); 
    if (!tenant?.id || !form.orgId || !form.title) return;
    setSaving(true);
    try {
      const org = orgs.find(o=>o.id===form.orgId);
      const assignee = users.find(u => u.uid === form.assignedToUid) || { name: performer.name };

      const baseOpp = {
          ...form,
          orgName:         org?.name ?? '',
          ownerId:         form.assignedToUid,
          ownerName:       assignee?.name ?? performer.name,
          assignedToUid:   form.assignedToUid,
          assignedToName:  assignee?.name ?? performer.name,
          region:          org?.region ?? 'global',
          products:        form.products,
      };

      if (editingOpp) {
        await updateDoc(doc(db, 'tenants', tenant.id, 'opportunities', editingOpp.id), {
           ...baseOpp,
           updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'tenants', tenant.id, 'opportunities'), {
            ...baseOpp,
            contactId:'', contactName:'', lostReason:'', createdBy: performer.uid,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
      }
      
      setShowNew(false);
      setEditingOpp(null);
      setForm({ orgId: '', title:'', stage:'lead', valueUsd:0, probability:20, closeDate:'', assignedToUid: performer.uid, notes:'', products:[] });
    } catch(e) {
      console.error(e);
      toast.error('Failed to save opportunity');
    } finally { setSaving(false); }
  }

  const handleOpenEdit = (opp: Opportunity) => {
    setForm({
       orgId: opp.orgId,
       title: opp.title,
       stage: opp.stage,
       valueUsd: opp.valueUsd || 0,
       probability: opp.probability || 0,
       closeDate: opp.closeDate || '',
       assignedToUid: opp.assignedToUid || opp.ownerId || '',
       notes: opp.notes || '',
       products: opp.products || []
    });
    setEditingOpp(opp);
    setShowNew(true);
  };

  async function handleDrop(e: React.DragEvent, newStage: DealStage) {
    e.preventDefault();
    const oppId = e.dataTransfer.getData('oppId');
    if (!oppId || !tenant?.id) return;
    const opp = opps.find(o => o.id === oppId);
    if (!opp || opp.stage === newStage) return;
    
    try {
      await updateDoc(doc(db, 'tenants', tenant.id, 'opportunities', opp.id), { stage: newStage });
    } catch(err) {
      console.error('Failed to move stage', err);
    }
  }

  const pipelineValue = filtered.filter(o => openStages.some(s=>s.id === o.stage)).reduce((s,o)=>s+(o.valueUsd||0),0);

  return (
      <div className="relative w-full h-full flex flex-col bg-background text-foreground animate-fade-in overflow-y-auto">
         <div className="flex justify-between items-center px-4 lg:px-8 pt-8 pb-4 border-b border-border z-10 w-full mb-6">
            <div className="flex flex-col gap-1">
               <h1 className="text-3xl font-bold tracking-tight">Opportunities</h1>
               <div className="text-sm text-muted-foreground mt-2 flex gap-4 items-center">
                  <div className="flex items-center gap-2">
                     <span className="font-semibold text-foreground">Pipeline:</span> {fmtMoney(pipelineValue)}
                  </div>
               </div>
            </div>
            <Button 
               variant={showNew ? 'secondary' : 'default'}
               onClick={() => {
                  if (showNew) { setShowNew(false); setEditingOpp(null); }
                  else {
                     setForm({ orgId: '', title:'', stage:'lead', valueUsd:0, probability:20, closeDate:'', assignedToUid: performer.uid, notes:'', products:[] });
                     setEditingOpp(null);
                     setShowNew(true);
                  }
               }}
            >
               {showNew ? 'Cancel' : '+ Opportunity'}
            </Button>
         </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col min-h-0">
          <div className="max-w-[1200px] w-full h-full mx-auto flex flex-col gap-6">

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
                  <input required className="input" style={{ width:'100%' }} value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Enterprise Deal..." />
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
                  <FieldLabel>Value (USD)</FieldLabel>
                  <input type="number" min={0} className="input" style={{ width:'100%' }} value={form.valueUsd} onChange={e=>setForm(p=>({...p,valueUsd:+e.target.value}))} />
                </div>
                <div>
                  <FieldLabel>Probability (%)</FieldLabel>
                  <input type="number" min={0} max={100} className="input" style={{ width:'100%' }} value={form.probability} onChange={e=>setForm(p=>({...p,probability:+e.target.value}))} />
                </div>
                <div>
                  <FieldLabel>Close Date</FieldLabel>
                  <input type="date" className="input" style={{ width:'100%' }} value={form.closeDate} onChange={e=>setForm(p=>({...p,closeDate:e.target.value}))} />
                </div>
                <div>
                  <FieldLabel>Assigned To</FieldLabel>
                  <select className="input" style={{ width:'100%' }} value={form.assignedToUid} onChange={e => setForm(p => ({ ...p, assignedToUid: e.target.value }))}>
                    <option value="">— Unassigned —</option>
                    {users.map(u => (
                      <option key={u.uid || u.email} value={u.uid || u.email}>{u.name || u.email}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <FieldLabel>Notes</FieldLabel>
                  <textarea className="input" rows={2} style={{ width:'100%', fontFamily:'inherit', fontSize:13 }} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:14 }}>
                <Button variant="ghost" onClick={()=>{ setShowNew(false); setEditingOpp(null); }}>Cancel</Button>
                <Button variant="default" onClick={handleCreateOrUpdate as any} disabled={saving||!form.orgId||!form.title}>{saving?'…': (editingOpp ? '💾 Save Changes' : '✅ Create')}</Button>
              </div>
            </form>
          )}

          {/* Kanban Board */}
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${openStages.length},minmax(160px,1fr))`, gap:12, overflowX:'auto', minWidth:900, flex: 1, minHeight: 0 }}>
            {openStages.map(stage=>{
              const cards = filtered.filter(o=>o.stage===stage.id);
              const cv    = cards.reduce((s,o)=>s+(o.valueUsd||0),0);
              const c     = stage.color || '#cbd5e1';
              return (
                <div key={stage.id} style={{ display: 'flex', flexDirection: 'column', minHeight: 300 }} onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, stage.id)}>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:`${c}18`, borderRadius:8, marginBottom:8, flexShrink: 0 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:c }}>{stage.label}</span>
                    <span style={{ fontSize:10, color:'var(--text-tertiary)', fontWeight:600 }}>{cards.length} · {fmtMoney(cv)}</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, flex: 1, overflowY: 'auto' }}>
                    {cards.map(opp=> (
                      <div key={opp.id} onClick={()=>{ handleOpenEdit(opp); }}
                        draggable
                        onDragStart={e => e.dataTransfer.setData('oppId', opp.id)}
                        style={{ padding:'8px 10px', background:'var(--bg-elevated)', border:`1px solid ${c}44`, borderLeft:`3px solid ${c}`, borderRadius:10, cursor:'grab', transition:'transform 0.15s', userSelect:'none' }}
                        onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}}
                        onMouseLeave={e=>{e.currentTarget.style.transform='';}}
                      >
                        <div style={{ fontWeight:700, fontSize:10, marginBottom:2 }}>{opp.orgName}</div>
                        <div style={{ fontSize:10, color:'var(--text-secondary)', marginBottom:6 }}>{opp.title}</div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10 }}>
                          <span style={{ fontWeight:700, color:c }}>{fmtMoney(opp.valueUsd||0)}</span>
                          <span style={{ color:'var(--text-tertiary)' }}>{opp.probability||0}%</span>
                        </div>
                        {opp.closeDate && <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:4 }}>📅 {fmtDate(opp.closeDate)}</div>}
                        <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:2 }}>👤 {opp.assignedToName ?? opp.ownerName ?? '—'}</div>
                      </div>
                    ))}
                    {cards.length===0 && <div style={{ padding:'16px', textAlign:'center', color:'var(--text-tertiary)', fontSize:10, border:'1px dashed var(--border)', borderRadius:8 }}>Empty</div>}
                  </div>
                </div>
              );
            })}
          </div>
         </div></div>
      </div>
  );
}
