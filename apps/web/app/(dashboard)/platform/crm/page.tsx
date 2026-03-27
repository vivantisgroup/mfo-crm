'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePageTitle, useBreadcrumb } from '@/lib/PageTitleContext';
import {
  getAllOrgs, getAllOpportunities, getAllActivities, getSalesTeams, getAllContacts,
  getContactsForOrg, createOrg, createContact, updateOrg, updateOpportunity, seedCrmIfEmpty,
  deleteOrg, deleteContact,
  STAGE_COLORS, STAGE_LABELS, STAGES, ORG_SIZE_LABELS, REGION_LABELS, REGION_COLORS,
  type PlatformOrg, type PlatformContact, type Opportunity, type CrmActivity, type SalesTeam,
  type DealStage, type OrgSize, type SalesRegion,
} from '@/lib/crmService';
import { getAllSubscriptions, type TenantSubscription } from '@/lib/subscriptionService';
import { CommunicationPanel } from '@/components/CommunicationPanel';
import { DashboardTab, PipelineTab, ActivitiesTab, TeamsTab, ReportsTab } from './CrmTabs';

type MainTab  = 'dashboard' | 'pipeline' | 'organizations' | 'contacts' | 'activities' | 'teams' | 'reports';
type PageView = 'list' | 'new-org' | 'org-detail';

const OPEN_STAGES: DealStage[] = ['lead', 'qualification', 'demo', 'proposal', 'negotiation'];

function fmtAum(n: number) { if (!n) return '—'; if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`; return `$${(n/1e6).toFixed(0)}M`; }
function Chip({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:8, background:`${color}20`, color, border:`1px solid ${color}40` }}>{label}</span>;
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{children}</div>;
}

// ─── New Org form ─────────────────────────────────────────────────────────────
function NewOrgView({ onBack, onCreated, performer }: { onBack:()=>void; onCreated:(org:PlatformOrg)=>void; performer:{uid:string} }) {
  const [form, setForm] = useState({ name:'', country:'', region:'latam' as any, size:'small' as OrgSize, estAumUsd:0, stage:'lead' as DealStage, assignedTo:'', tags:'', notes:'', website:'', contactName:'', contactEmail:'', contactRole:'', contactPhone:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(p=>({...p,[k]:e.target.type==='number'?Number(e.target.value):e.target.value}));
  useBreadcrumb([{label:'Platform CRM',onClick:onBack},{label:'New Organization'}]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!form.name) return; setLoading(true); setError('');
    try {
      const org = await createOrg({ name:form.name, country:form.country, region:form.region, size:form.size, estAumUsd:form.estAumUsd, stage:form.stage, assignedTo:form.assignedTo, tags:form.tags.split(',').map(t=>t.trim()).filter(Boolean), notes:form.notes, website:form.website, tenantIds:[], createdBy:performer.uid }, performer);
      if (form.contactName && form.contactEmail) await createContact({ orgId:org.id, name:form.contactName, email:form.contactEmail, role:form.contactRole||'', phone:form.contactPhone||'', isPrimary:true, notes:'', createdBy:performer.uid }, performer);
      onCreated(org);
    } catch (err:any) { setError(err.message??'Failed'); } finally { setLoading(false); }
  }

  return (
    <div className="animate-fade-in">
      <h1 style={{ fontSize:22, fontWeight:900, marginBottom:6 }}>🏢 New Organization</h1>
      {error && <div style={{ marginBottom:16, padding:'10px 14px', background:'#ef444415', color:'#ef4444', borderRadius:8, fontSize:13 }}>❌ {error}</div>}
      <form onSubmit={handleCreate} style={{ maxWidth:700 }}>
        <div style={{ background:'var(--bg-elevated)', borderRadius:14, border:'1px solid var(--border)', padding:24, marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:18 }}>Organization Details</div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div><FieldLabel>Organization Name *</FieldLabel><input required className="input" style={{ width:'100%' }} value={form.name} onChange={f('name')} placeholder="Andrade Family Office" /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><FieldLabel>Country</FieldLabel><input className="input" style={{ width:'100%' }} value={form.country} onChange={f('country')} placeholder="Brazil" /></div>
              <div>
                <FieldLabel>Region</FieldLabel>
                <select className="input" style={{ width:'100%' }} value={form.region} onChange={f('region')}>
                  {(['latam','emea','apac','north_america','global'] as const).map(r=><option key={r} value={r}>{REGION_LABELS[r]}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Size</FieldLabel>
                <select className="input" style={{ width:'100%' }} value={form.size} onChange={f('size')}>
                  {(Object.keys(ORG_SIZE_LABELS) as OrgSize[]).map(s=><option key={s} value={s}>{ORG_SIZE_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Deal Stage</FieldLabel>
                <select className="input" style={{ width:'100%' }} value={form.stage} onChange={f('stage')}>
                  {STAGES.map(s=><option key={s} value={s}>{STAGE_LABELS[s].replace(/^.+ /,'')}</option>)}
                </select>
              </div>
              <div><FieldLabel>Est. AUM (USD)</FieldLabel><input type="number" min={0} className="input" style={{ width:'100%' }} value={form.estAumUsd} onChange={f('estAumUsd')} /></div>
              <div><FieldLabel>Assigned To</FieldLabel><input className="input" style={{ width:'100%' }} value={form.assignedTo} onChange={f('assignedTo')} placeholder="Sales rep name" /></div>
              <div><FieldLabel>Website</FieldLabel><input className="input" style={{ width:'100%' }} value={form.website} onChange={f('website')} placeholder="https://…" /></div>
              <div><FieldLabel>Tags (comma-sep)</FieldLabel><input className="input" style={{ width:'100%' }} value={form.tags} onChange={f('tags')} placeholder="hot, enterprise, brazil" /></div>
            </div>
            <div><FieldLabel>Notes</FieldLabel><textarea className="input" rows={2} style={{ width:'100%', fontFamily:'inherit', fontSize:13 }} value={form.notes} onChange={f('notes')} /></div>
          </div>
        </div>

        <div style={{ background:'var(--bg-elevated)', borderRadius:14, border:'1px solid var(--border)', padding:24, marginBottom:24 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>👤 Primary Contact <span style={{ fontWeight:400, color:'var(--text-tertiary)', fontSize:12 }}>(optional)</span></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><FieldLabel>Name</FieldLabel><input className="input" style={{ width:'100%' }} value={form.contactName} onChange={f('contactName')} /></div>
            <div><FieldLabel>Email</FieldLabel><input type="email" className="input" style={{ width:'100%' }} value={form.contactEmail} onChange={f('contactEmail')} /></div>
            <div><FieldLabel>Role</FieldLabel><input className="input" style={{ width:'100%' }} value={form.contactRole} onChange={f('contactRole')} placeholder="CEO / CIO / Partner" /></div>
            <div><FieldLabel>Phone</FieldLabel><input className="input" style={{ width:'100%' }} value={form.contactPhone} onChange={f('contactPhone')} /></div>
          </div>
        </div>

        <div style={{ display:'flex', gap:12 }}>
          <button type="button" className="btn btn-ghost" onClick={onBack} style={{ flex:1 }}>← Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading||!form.name} style={{ flex:2 }}>{loading?'…':'✅ Create Organization'}</button>
        </div>
      </form>
    </div>
  );
}

// ─── Org Detail ───────────────────────────────────────────────────────────────
function OrgDetail({ org:initialOrg, subscriptions, onBack, onUpdated, performer }: { org:PlatformOrg; subscriptions:TenantSubscription[]; onBack:()=>void; onUpdated:()=>void; performer:{uid:string} }) {
  const [org, setOrg]                 = useState(initialOrg);
  const [contacts, setContacts]       = useState<PlatformContact[]>([]);
  const [tab, setTab]                 = useState<'info'|'communications'|'contacts'|'tenants'>('info');
  const [editMode, setEditMode]       = useState(false);
  const [editForm, setEditForm]       = useState({ name:org.name, country:org.country, region:(org as any).region??'global', size:org.size, estAumUsd:org.estAumUsd, stage:org.stage, assignedTo:org.assignedTo, website:org.website??'', tags:org.tags.join(', '), notes:org.notes });
  const [savingEdit, setSavingEdit]   = useState(false);
  const [editMsg, setEditMsg]         = useState('');
  const [showAddC, setShowAddC]       = useState(false);
  const [nc, setNc]                   = useState({ name:'', email:'', role:'', phone:'', isPrimary:false, notes:'' });
  const [addingC, setAddingC]         = useState(false);
  const [contactMsg, setContactMsg]   = useState('');

  useEffect(()=>{ getContactsForOrg(org.id).then(setContacts); }, [org.id]);
  const linkedSubs = subscriptions.filter(s=>org.tenantIds.includes(s.tenantId));
  const stageColor = STAGE_COLORS[org.stage];

  useBreadcrumb([{label:'Platform CRM',onClick:onBack},{label:org.name}]);

  async function saveOrgEdit(e: React.FormEvent) {
    e.preventDefault(); setSavingEdit(true); setEditMsg('');
    try {
      const patch = { ...editForm, size:editForm.size as OrgSize, estAumUsd:Number(editForm.estAumUsd), stage:editForm.stage as DealStage, tags:editForm.tags.split(',').map(t=>t.trim()).filter(Boolean) };
      await updateOrg(org.id, patch);
      setOrg(p=>({...p,...patch})); setEditMode(false); setEditMsg('✅ Saved.'); onUpdated();
    } catch(err:any) { setEditMsg(`❌ ${err.message}`); } finally { setSavingEdit(false); }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault(); setAddingC(true); setContactMsg('');
    try {
      const c = await createContact({ orgId:org.id, name:nc.name, email:nc.email, role:nc.role, phone:nc.phone, isPrimary:nc.isPrimary, notes:nc.notes, createdBy:performer.uid }, performer);
      setContacts(p=>[...p,c]); setNc({name:'',email:'',role:'',phone:'',isPrimary:false,notes:''}); setShowAddC(false); setContactMsg('✅ Contact added.');
    } catch(err:any) { setContactMsg(`❌ ${err.message}`); } finally { setAddingC(false); }
  }

  const ef = (k: keyof typeof editForm) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setEditForm(p=>({...p,[k]:e.target.type==='number'?Number(e.target.value):e.target.value}));

  return (
    <div className="animate-fade-in">
      <div style={{ borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>{org.name}</h1>
            <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:8 }}>{org.country} · {ORG_SIZE_LABELS[org.size]}</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <Chip label={STAGE_LABELS[org.stage].replace(/^.+ /,'')} color={stageColor} />
              {(org as any).region && <Chip label={REGION_LABELS[org.region as import('@/lib/crmService').SalesRegion]} color={REGION_COLORS[org.region as import('@/lib/crmService').SalesRegion]} />}
              {org.tags.map(t=><Chip key={t} label={t} color={t==='hot'?'#ef4444':t==='warm'?'#f59e0b':'#6366f1'} />)}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ fontSize:26, fontWeight:900, color:'#a78bfa' }}>{fmtAum(org.estAumUsd)}</div>
            <button className={`btn btn-sm ${editMode?'btn-ghost':'btn-secondary'}`} onClick={()=>{setEditMode(v=>!v);setEditMsg('');}}>
              {editMode?'✕ Cancel':'✏️ Edit'}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color:'#ef4444' }} onClick={async () => {
              if (!window.confirm('Are you sure you want to delete this organization? This cannot be undone.')) return;
              try { await deleteOrg(org.id); onUpdated(); onBack(); } catch (err: any) { alert(err.message); }
            }}>
              🗑️ Delete
            </button>
          </div>
        </div>
        <div style={{ display:'flex' }}>
          {([{id:'info',label:'📋 Info'},{id:'communications',label:'💬 Comms'},{id:'contacts',label:`👤 Contacts (${contacts.length})`},{id:'tenants',label:`🏢 Tenants (${linkedSubs.length})`}] as const).map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'10px 18px', fontSize:13, background:'none', border:'none', cursor:'pointer', fontWeight:tab===t.id?700:500, borderBottom:`2px solid ${tab===t.id?'var(--brand-500)':'transparent'}`, color:tab===t.id?'var(--brand-500)':'var(--text-secondary)' }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ paddingTop:24 }}>
        {/* Edit form */}
        {editMode && tab==='info' && (
          <form onSubmit={saveOrgEdit} style={{ maxWidth:680, marginBottom:24, padding:'22px 24px', background:'var(--bg-canvas)', borderRadius:14, border:'1px solid var(--border)' }}>
            <div style={{ fontWeight:800, fontSize:14, marginBottom:16 }}>✏️ Edit Organization</div>
            {editMsg && <div style={{ marginBottom:14, padding:'9px 14px', borderRadius:8, fontSize:13, background:editMsg.startsWith('✅')?'#22c55e15':'#ef444415', color:editMsg.startsWith('✅')?'#22c55e':'#ef4444' }}>{editMsg}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ gridColumn:'1/-1' }}><FieldLabel>Name *</FieldLabel><input required className="input" style={{ width:'100%' }} value={editForm.name} onChange={ef('name')} /></div>
              <div><FieldLabel>Country</FieldLabel><input className="input" style={{ width:'100%' }} value={editForm.country} onChange={ef('country')} /></div>
              <div><FieldLabel>Size</FieldLabel><select className="input" style={{ width:'100%' }} value={editForm.size} onChange={ef('size')}>{(Object.keys(ORG_SIZE_LABELS) as OrgSize[]).map(s=><option key={s} value={s}>{ORG_SIZE_LABELS[s]}</option>)}</select></div>
              <div><FieldLabel>Est. AUM (USD)</FieldLabel><input type="number" className="input" style={{ width:'100%' }} value={editForm.estAumUsd} onChange={ef('estAumUsd')} /></div>
              <div><FieldLabel>Stage</FieldLabel><select className="input" style={{ width:'100%' }} value={editForm.stage} onChange={ef('stage')}>{STAGES.map(s=><option key={s} value={s}>{STAGE_LABELS[s].replace(/^.+ /,'')}</option>)}</select></div>
              <div><FieldLabel>Assigned To</FieldLabel><input className="input" style={{ width:'100%' }} value={editForm.assignedTo} onChange={ef('assignedTo')} /></div>
              <div><FieldLabel>Website</FieldLabel><input className="input" style={{ width:'100%' }} value={editForm.website} onChange={ef('website')} /></div>
              <div style={{ gridColumn:'1/-1' }}><FieldLabel>Tags</FieldLabel><input className="input" style={{ width:'100%' }} value={editForm.tags} onChange={ef('tags')} /></div>
              <div style={{ gridColumn:'1/-1' }}><FieldLabel>Notes</FieldLabel><textarea className="input" rows={2} style={{ width:'100%', fontFamily:'inherit', fontSize:13 }} value={editForm.notes} onChange={ef('notes')} /></div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setEditMode(false);setEditMsg('');}}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingEdit||!editForm.name}>{savingEdit?'…':'✅ Save'}</button>
            </div>
          </form>
        )}

        {/* Info */}
        {tab==='info' && !editMode && (
          <div style={{ maxWidth:620 }}>
            {editMsg && <div style={{ marginBottom:16, padding:'9px 14px', borderRadius:8, fontSize:13, background:'#22c55e15', color:'#22c55e' }}>{editMsg}</div>}
            {[{ label:'Est. AUM', value:fmtAum(org.estAumUsd) },{ label:'Deal Stage', value:<Chip label={STAGE_LABELS[org.stage].replace(/^.+ /,'')} color={stageColor} /> },{ label:'Assigned To', value:org.assignedTo||'—' },{ label:'Website', value:org.website?<a href={org.website} target="_blank" rel="noopener" style={{ color:'var(--brand-400)' }}>{org.website}</a>:'—' },{ label:'Linked Tenants', value:org.tenantIds.length },{ label:'Org ID', value:<code style={{ fontSize:11 }}>{org.id}</code> }].map(item=>(
              <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>{item.label}</span>
                <span style={{ fontWeight:600 }}>{item.value}</span>
              </div>
            ))}
            {org.notes && <div style={{ marginTop:16, padding:'12px 14px', background:'var(--bg-canvas)', borderRadius:10, border:'1px solid var(--border)', fontSize:13, color:'var(--text-secondary)', lineHeight:1.6 }}>{org.notes}</div>}
          </div>
        )}

        {/* Comms */}
        {tab==='communications' && <div style={{ height:600, maxWidth:900 }}><CommunicationPanel familyId={org.id} familyName={org.name} linkedRecordType="crm" linkedRecordId={org.id} /></div>}

        {/* Contacts */}
        {tab==='contacts' && (
          <div style={{ maxWidth:720 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>Contacts ({contacts.length})</div>
              <button className="btn btn-primary btn-sm" onClick={()=>{setShowAddC(v=>!v);setContactMsg('');}}>{showAddC?'✕ Cancel':'+ Add Contact'}</button>
            </div>
            {contactMsg && <div style={{ marginBottom:14, padding:'9px 14px', borderRadius:8, fontSize:13, background:contactMsg.startsWith('✅')?'#22c55e15':'#ef444415', color:contactMsg.startsWith('✅')?'#22c55e':'#ef4444' }}>{contactMsg}</div>}
            {showAddC && (
              <form onSubmit={handleAddContact} style={{ marginBottom:20, padding:'18px 20px', background:'var(--bg-canvas)', borderRadius:12, border:'1px solid var(--border)' }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:14 }}>👤 New Contact</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div><FieldLabel>Name *</FieldLabel><input required className="input" style={{ width:'100%' }} value={nc.name} onChange={e=>setNc(p=>({...p,name:e.target.value}))} /></div>
                  <div><FieldLabel>Email *</FieldLabel><input required type="email" className="input" style={{ width:'100%' }} value={nc.email} onChange={e=>setNc(p=>({...p,email:e.target.value}))} /></div>
                  <div><FieldLabel>Role / Title</FieldLabel><input className="input" style={{ width:'100%' }} value={nc.role} onChange={e=>setNc(p=>({...p,role:e.target.value}))} placeholder="CEO / CIO" /></div>
                  <div><FieldLabel>Phone</FieldLabel><input className="input" style={{ width:'100%' }} value={nc.phone} onChange={e=>setNc(p=>({...p,phone:e.target.value}))} /></div>
                </div>
                <div style={{ display:'flex', gap:10, marginTop:12 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setShowAddC(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={addingC||!nc.name||!nc.email}>{addingC?'…':'✅ Save'}</button>
                </div>
              </form>
            )}
            {contacts.length===0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', border:'1px dashed var(--border)', borderRadius:12, color:'var(--text-tertiary)' }}>No contacts yet.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {contacts.map(c=>(
                  <div key={c.id} style={{ padding:'14px 16px', background:'var(--bg-elevated)', borderRadius:10, border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13 }}>{c.name}{c.isPrimary&&<span style={{ fontSize:10, color:'#6366f1', marginLeft:8 }}>★ PRIMARY</span>}</div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{c.role}</div>
                      <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>{c.email}{c.phone?` · ${c.phone}`:''}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={async () => {
                      if (!window.confirm('Delete contact?')) return;
                      try { await deleteContact(c.id); setContacts(p => p.filter(x => x.id !== c.id)); setContactMsg('✅ Contact deleted.'); }
                      catch (err: any) { setContactMsg(`❌ ${err.message}`); }
                    }}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tenants */}
        {tab==='tenants' && (
          <div style={{ maxWidth:680 }}>
            {linkedSubs.length===0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', border:'1px dashed var(--border)', borderRadius:12, color:'var(--text-tertiary)' }}>No tenants linked yet.</div>
            ) : linkedSubs.map(sub=>{
              const sc: Record<string,string> = { trial:'#f59e0b', active:'#22c55e', past_due:'#ef4444', suspended:'#94a3b8', cancelled:'#64748b' };
              return (
                <div key={sub.tenantId} style={{ padding:'14px 16px', border:'1px solid var(--border)', borderRadius:10, marginBottom:8, background:'var(--bg-elevated)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div><div style={{ fontWeight:700, fontSize:13 }}>{sub.tenantName}</div><code style={{ fontSize:10, color:'var(--text-tertiary)' }}>{sub.tenantId}</code></div>
                    <Chip label={sub.status} color={sc[sub.status]??'#94a3b8'} />
                  </div>
                  <div style={{ marginTop:8, display:'flex', gap:12, fontSize:11, color:'var(--text-secondary)' }}>
                    <span>📋 {sub.planId}</span><span>👥 {sub.licensedSeats} seats</span><span>📅 {sub.subscriptionStart?.slice(0,10)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Global Contacts tab ──────────────────────────────────────────────────────
function ContactsTab({ contacts, orgs, onDeleted }: { contacts:PlatformContact[]; orgs:PlatformOrg[]; onDeleted: () => void; }) {
  const [search,   setSearch]   = useState('');
  const [orgF,     setOrgF]     = useState('all');
  const [primaryF, setPrimaryF] = useState(false);
  const [sortKey,  setSortKey]  = useState<'name'|'org'|'role'|'email'>('name');
  const [sortDir,  setSortDir]  = useState<'asc'|'desc'>('asc');

  const filtered = useMemo(() => {
    let list = contacts.filter(c => {
      if (primaryF && !c.isPrimary) return false;
      if (orgF !== 'all' && c.orgId !== orgF) return false;
      if (!search) return true;
      return `${c.name} ${c.email} ${c.role} ${c.phone ?? ''}`.toLowerCase().includes(search.toLowerCase());
    });
    list = [...list].sort((a, b) => {
      let va = '', vb = '';
      if (sortKey === 'name')  { va = a.name; vb = b.name; }
      if (sortKey === 'email') { va = a.email; vb = b.email; }
      if (sortKey === 'role')  { va = a.role; vb = b.role; }
      if (sortKey === 'org')   {
        va = orgs.find(o=>o.id===a.orgId)?.name ?? '';
        vb = orgs.find(o=>o.id===b.orgId)?.name ?? '';
      }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [contacts, search, orgF, primaryF, sortKey, sortDir, orgs]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  const sortIcon = (key: typeof sortKey) => sortKey===key ? (sortDir==='asc'?'↑':'↓') : '↕';

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        <input className="input" placeholder="🔍 Search contacts…" value={search}
          onChange={e=>setSearch(e.target.value)} style={{ flex:1, minWidth:180 }} />
        <select className="input" value={orgF} onChange={e=>setOrgF(e.target.value)} style={{ minWidth:160 }}>
          <option value="all">All Organizations</option>
          {orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer', whiteSpace:'nowrap', color:'var(--text-secondary)' }}>
          <input type="checkbox" checked={primaryF} onChange={e=>setPrimaryF(e.target.checked)}
            style={{ accentColor:'var(--brand-500)' }} />
          Primary only
        </label>
        <div style={{ fontSize:12, color:'var(--text-tertiary)', whiteSpace:'nowrap' }}>
          {filtered.length} of {contacts.length} contacts
        </div>
      </div>

      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--bg-elevated)', borderBottom:'1px solid var(--border)' }}>
              {([
                { key:'name',  label:'Name' },
                { key:'role',  label:'Role' },
                { key:'email', label:'Email' },
                { key:null,    label:'Phone' },
                { key:'org',   label:'Organization' },
                { key:null,    label:'Primary' },
              ] as {key:typeof sortKey|null;label:string}[]).map(h=>(
                <th key={h.label}
                  onClick={h.key ? ()=>toggleSort(h.key!) : undefined}
                  style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700,
                    color: h.key ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    textTransform:'uppercase', cursor:h.key?'pointer':'default',
                    userSelect:'none', whiteSpace:'nowrap' }}
                >
                  {h.label}{h.key ? ` ${sortIcon(h.key)}` : ''}
                </th>
              ))}
              <th style={{ padding:'10px 14px', textAlign:'right', fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c=>{
              const org = orgs.find(o=>o.id===c.orgId);
              return (
                <tr key={c.id} style={{ borderBottom:'1px solid var(--border)', fontSize:13 }}>
                  <td style={{ padding:'10px 14px', fontWeight:700 }}>{c.name}</td>
                  <td style={{ padding:'10px 14px', color:'var(--text-secondary)' }}>{c.role || '—'}</td>
                  <td style={{ padding:'10px 14px' }}><a href={`mailto:${c.email}`} style={{ color:'var(--brand-400)', fontSize:12 }}>{c.email}</a></td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-secondary)' }}>{c.phone ?? '—'}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-secondary)' }}>{org?.name ?? '—'}</td>
                  <td style={{ padding:'10px 14px' }}>{c.isPrimary&&<Chip label="★ Primary" color="#6366f1" />}</td>
                  <td style={{ padding:'10px 14px', textAlign:'right' }}>
                    <button className="btn btn-ghost btn-sm" style={{ color:'#ef4444', padding:'4px 8px' }} onClick={async () => {
                      if (!window.confirm('Delete contact?')) return;
                      try { await deleteContact(c.id); onDeleted(); } catch(err: any) { alert(err.message); }
                    }}>🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0 && <div style={{ padding:'40px', textAlign:'center', color:'var(--text-tertiary)' }}>No contacts match your filters.</div>}
      </div>
    </div>
  );
}

// ─── Org list / kanban ────────────────────────────────────────────────────────
function OrgListTab({ orgs, onOpen }: { orgs:PlatformOrg[]; onOpen:(o:PlatformOrg)=>void }) {
  const [search, setSearch] = useState('');
  const [stageF, setStageF] = useState<DealStage|'all'>('all');
  const [regionF, setRegionF] = useState('all');
  const [kanban, setKanban] = useState(true);

  const filtered = useMemo(()=> orgs.filter(o=>{
    if (stageF!=='all' && o.stage!==stageF) return false;
    if (regionF!=='all' && (o as any).region!==regionF) return false;
    const q = search.toLowerCase();
    return !q || `${o.name} ${o.country} ${o.tags.join(' ')}`.toLowerCase().includes(q);
  }), [orgs, search, stageF, regionF]);

  const pipelineStages = STAGES.filter(s=>s!=='closed_lost');

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
        <input className="input" placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1, minWidth:180 }} />
        <select className="input" value={stageF} onChange={e=>setStageF(e.target.value as any)}>
          <option value="all">All Stages</option>
          {STAGES.map(s=><option key={s} value={s}>{STAGE_LABELS[s].replace(/^.+ /,'')}</option>)}
        </select>
        <select className="input" value={regionF} onChange={e=>setRegionF(e.target.value)}>
          <option value="all">All Regions</option>
          {(['latam','emea','apac','north_america','global'] as const).map(r=><option key={r} value={r}>{REGION_LABELS[r]}</option>)}
        </select>
        <div style={{ display:'flex', gap:4, background:'var(--bg-canvas)', borderRadius:8, padding:3, border:'1px solid var(--border)' }}>
          <button onClick={()=>setKanban(true)} className={`btn btn-sm ${kanban?'btn-secondary':'btn-ghost'}`} style={{ border:'none' }}>📌 Kanban</button>
          <button onClick={()=>setKanban(false)} className={`btn btn-sm ${!kanban?'btn-secondary':'btn-ghost'}`} style={{ border:'none' }}>📋 List</button>
        </div>
      </div>

      {kanban ? (
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${pipelineStages.length},minmax(160px,1fr))`, gap:12, overflowX:'auto', minWidth:900 }}>
          {pipelineStages.map(stage=>{
            const cards = filtered.filter(o=>o.stage===stage);
            const c = STAGE_COLORS[stage];
            return (
              <div key={stage}>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:`${c}18`, borderRadius:8, marginBottom:8 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:c }}>{STAGE_LABELS[stage].replace(/^.+ /,'')}</span>
                  <span style={{ fontSize:10, color:'var(--text-tertiary)', fontWeight:600 }}>{cards.length}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {cards.map(org=>(
                    <div key={org.id} onClick={()=>onOpen(org)}
                      style={{ padding:'12px 14px', background:'var(--bg-elevated)', border:`1px solid ${c}44`, borderLeft:`3px solid ${c}`, borderRadius:10, cursor:'pointer', transition:'transform 0.15s' }}
                      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='';}}
                    >
                      <div style={{ fontWeight:700, fontSize:12, marginBottom:2 }}>{org.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-secondary)' }}>{org.country} · {fmtAum(org.estAumUsd)}</div>
                      {(org as any).region && <div style={{ fontSize:10, color:REGION_COLORS[org.region as SalesRegion], marginTop:4, fontWeight:600 }}>{REGION_LABELS[org.region as SalesRegion]}</div>}
                      {org.tenantIds.length>0 && <div style={{ fontSize:10, color:'#22c55e', marginTop:4 }}>🏢 {org.tenantIds.length} tenant{org.tenantIds.length!==1?'s':''}</div>}
                    </div>
                  ))}
                  {cards.length===0 && <div style={{ padding:'16px', textAlign:'center', color:'var(--text-tertiary)', fontSize:11, border:'1px dashed var(--border)', borderRadius:8 }}>Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg-elevated)', borderBottom:'1px solid var(--border)' }}>
                {['Organization','Stage','Region','Country','Est. AUM','Tenants','Assigned'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-tertiary)', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(org=>{
                const c = STAGE_COLORS[org.stage];
                const rc = REGION_COLORS[(org.region ?? 'global') as SalesRegion];
                return (
                  <tr key={org.id} onClick={()=>onOpen(org)} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }} className="hover-lift">
                    <td style={{ padding:'10px 14px', fontWeight:700, fontSize:13, borderLeft:`3px solid ${c}` }}>{org.name}</td>
                    <td style={{ padding:'10px 14px' }}><Chip label={STAGE_LABELS[org.stage].replace(/^.+ /,'')} color={c} /></td>
                    <td style={{ padding:'10px 14px' }}><Chip label={REGION_LABELS[(org.region ?? 'global') as SalesRegion]} color={rc} /></td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-secondary)' }}>{org.country}</td>
                    <td style={{ padding:'10px 14px', fontSize:13, fontWeight:700, color:'#a78bfa' }}>{fmtAum(org.estAumUsd)}</td>
                    <td style={{ padding:'10px 14px', fontSize:12 }}>{org.tenantIds.length>0?<span style={{ color:'#22c55e', fontWeight:700 }}>🏢 {org.tenantIds.length}</span>:'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-secondary)' }}>{org.assignedTo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Comboboxes (re-exported for tenants page) ────────────────────────────────
export function OrgCombobox({ orgs, value, onChange, placeholder='Search organizations…' }: { orgs:PlatformOrg[]; value:string; onChange:(id:string,name:string)=>void; placeholder?:string }) {
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
                <div style={{ fontSize:11, color:STAGE_COLORS[o.stage] }}>{STAGE_LABELS[o.stage].replace(/^.+ /,'')}</div>
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
  const { user } = useAuth();
  const performer = { uid: user?.uid??'unknown', name: user?.name??'Sales Rep' };

  const [orgs,       setOrgs]       = useState<PlatformOrg[]>([]);
  const [contacts,   setContacts]   = useState<PlatformContact[]>([]);
  const [opps,       setOpps]       = useState<Opportunity[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [teams,      setTeams]      = useState<SalesTeam[]>([]);
  const [subs,       setSubs]       = useState<TenantSubscription[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [mainTab, setMainTab]     = useState<MainTab>('dashboard');
  const [view,    setView]        = useState<PageView>('list');
  const [selected, setSelected]   = useState<PlatformOrg|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o,c,opp,act,t,s] = await Promise.all([
        getAllOrgs(), getAllContacts(), getAllOpportunities(), getAllActivities(), getSalesTeams(), getAllSubscriptions(),
      ]);
      setOrgs(o); setContacts(c); setOpps(opp); setActivities(act); setTeams(t); setSubs(s);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);

  async function handleSeed() {
    const seeded = await seedCrmIfEmpty(performer);
    if (seeded) await load(); else alert('CRM already has data — seed skipped.');
  }

  function openOrg(org: PlatformOrg) { setSelected(org); setView('org-detail'); }
  function goList()                   { setSelected(null); setView('list'); }

  const kpis = useMemo(()=>({
    orgs: orgs.length,
    openDeals: opps.filter(o=>OPEN_STAGES.includes(o.stage)).length,
    pipelineValue: opps.filter(o=>OPEN_STAGES.includes(o.stage)).reduce((s,o)=>s+o.valueUsd,0),
    wonRevenue: opps.filter(o=>o.stage==='closed_won').reduce((s,o)=>s+o.valueUsd,0),
    tenants: subs.length,
  }), [orgs, opps, subs]);

  // ── Org detail view ───────────────────────────────────────────────────────────
  if (view==='org-detail' && selected) {
    return (
      <div style={{ maxWidth:1400, margin:'0 auto' }}>
        <OrgDetail org={selected} subscriptions={subs} onBack={goList} onUpdated={load} performer={performer} />
      </div>
    );
  }
  if (view==='new-org') {
    return (
      <div style={{ maxWidth:1400, margin:'0 auto' }}>
        <NewOrgView performer={performer} onBack={goList} onCreated={org=>{setOrgs(p=>[org,...p]);openOrg(org);}} />
      </div>
    );
  }

  const MAIN_TABS: {id:MainTab;label:string}[] = [
    {id:'dashboard',      label:'📊 Dashboard'},
    {id:'pipeline',       label:`🎯 Pipeline (${opps.filter(o=>OPEN_STAGES.includes(o.stage)).length})`},
    {id:'organizations',  label:`🏢 Orgs (${orgs.length})`},
    {id:'contacts',       label:`👤 Contacts (${contacts.length})`},
    {id:'activities',     label:`📅 Activities (${activities.length})`},
    {id:'teams',          label:`👥 Teams (${teams.length})`},
    {id:'reports',        label:'📈 Reports'},
  ];

  const fmtM = (n:number) => n>=1e9?`$${(n/1e9).toFixed(1)}B`:n>=1e6?`$${(n/1e6).toFixed(1)}M`:`$${(n/1e3).toFixed(0)}K`;

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Action toolbar + KPI strip */}
      <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:8, marginBottom:12 }}>
        <button className="btn btn-ghost btn-sm" onClick={handleSeed} title="Seed sample data">↑ Seed</button>
        <button className="btn btn-ghost btn-sm" onClick={load} title="Refresh">↻</button>
        <button className="btn btn-primary btn-sm" onClick={()=>{setView('new-org');}}>+ New Org</button>
      </div>

      {/* Top KPI strip */}
      {!loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
          {[
            {label:'Organizations',  value:kpis.orgs,              color:'#6366f1'},
            {label:'Open Deals',     value:kpis.openDeals,         color:'#f59e0b'},
            {label:'Pipeline Value', value:fmtM(kpis.pipelineValue),color:'#a78bfa'},
            {label:'Won Revenue',    value:fmtM(kpis.wonRevenue),  color:'#22c55e'},
            {label:'Active Tenants', value:kpis.tenants,           color:'#22d3ee'},
          ].map(k=>(
            <div key={k.label} style={{ padding:'12px 16px', background:'var(--bg-elevated)', border:`1px solid ${k.color}33`, borderRadius:12 }}>
              <div style={{ fontSize:10, color:'var(--text-tertiary)', textTransform:'uppercase', fontWeight:700, letterSpacing:'0.07em', marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:20, fontWeight:900, color:k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:24, overflowX:'auto', gap:0 }}>
        {MAIN_TABS.map(t=>(
          <button key={t.id} onClick={()=>setMainTab(t.id)} style={{ padding:'10px 16px', fontSize:13, background:'none', border:'none', cursor:'pointer', whiteSpace:'nowrap', fontWeight:mainTab===t.id?700:500, borderBottom:`2px solid ${mainTab===t.id?'var(--brand-500)':'transparent'}`, color:mainTab===t.id?'var(--brand-500)':'var(--text-secondary)', transition:'color 0.15s' }}>{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div style={{ textAlign:'center', padding:80, color:'var(--text-tertiary)' }}>Loading…</div>
      ) : (
        <>
          {mainTab==='dashboard'     && <DashboardTab orgs={orgs} opps={opps} activities={activities} />}
          {mainTab==='pipeline'      && <PipelineTab orgs={orgs} opps={opps} onOppClick={()=>{}} onCreateOpp={o=>setOpps(p=>[o,...p])} performer={performer} />}
          {mainTab==='organizations' && <OrgListTab orgs={orgs} onOpen={openOrg} />}
          {mainTab==='contacts'      && <ContactsTab contacts={contacts} orgs={orgs} onDeleted={load} />}
          {mainTab==='activities'    && <ActivitiesTab activities={activities} orgs={orgs} onCreated={a=>setActivities(p=>[a,...p])} performer={performer} />}
          {mainTab==='teams'         && <TeamsTab teams={teams} onCreated={t=>setTeams(p=>[...p,t])} />}
          {mainTab==='reports'       && <ReportsTab orgs={orgs} opps={opps} activities={activities} teams={teams} />}
        </>
      )}

      {/* Empty state */}
      {!loading && orgs.length===0 && (
        <div style={{ textAlign:'center', padding:'60px 40px', background:'var(--bg-surface)', borderRadius:16, border:'1px solid var(--border)', marginTop:24 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🏢</div>
          <h2 style={{ fontWeight:800, marginBottom:8 }}>No CRM data yet</h2>
          <p style={{ color:'var(--text-secondary)', marginBottom:20 }}>Seed sample data or create your first organization.</p>
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button className="btn btn-secondary" onClick={handleSeed}>↑ Seed Sample Data</button>
            <button className="btn btn-primary" onClick={()=>setView('new-org')}>+ New Organization</button>
          </div>
        </div>
      )}
    </div>
  );
}
