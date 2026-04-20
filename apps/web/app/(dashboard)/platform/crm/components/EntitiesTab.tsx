'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  PlatformOrg, PlatformContact, Opportunity, deleteOrg, deleteContact, createOrg, createContact, updateOrg, updateContact,
  STAGE_COLORS, STAGE_LABELS, STAGES, ORG_SIZE_LABELS, REGION_LABELS, REGION_COLORS, ORG_TYPE_LABELS,
  OrgSize, DealStage, SalesRegion, OrgType, type PipelineStageConfig,
  getAccountPlansForOrg, createAccountPlan, updateAccountPlan, AccountPlan, AccountPlanPeriod
} from '@/lib/crmService';
import { TenantSubscription } from '@/lib/subscriptionService';
import { CommunicationPanel } from '@/components/CommunicationPanel';
import { getEmployees, Employee } from '@/lib/hrService';
import { Search, Plus, Building2, UserCircle2, Mail, Trash2, Edit2, Settings, Landmark, Target, MessageSquare, ChevronRight, Lock, List, LayoutGrid, Tag as TagIcon, Hash, X, Phone, Archive, HelpCircle, MapPin, Globe, Edit3 } from 'lucide-react';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { useAuth } from '@/lib/AuthContext';
import { ROLE_PERMISSIONS } from '@/lib/rbacService';
import Link from 'next/link';
import { ConfirmDialog, type ConfirmOptions } from '@/components/ConfirmDialog';
import { getAllTags, type Tag } from '@/lib/tagService';
import { usePageTitle } from '@/lib/PageTitleContext';
import { useTranslation } from '@/lib/i18n/context';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { RichTextRenderer } from '@/components/RichTextRenderer';
import { toast } from 'sonner';

const COLOR_MAP: Record<string, string> = {
  slate: '#64748b', gray: '#6b7280', zinc: '#717f8b', neutral: '#737373', stone: '#78716c',
  red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308', lime: '#84cc16',
  green: '#22c55e', emerald: '#10b981', teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ba5e9',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef',
  pink: '#ec4899', rose: '#f43f5e',
};

function fmtAum(n: number) { if (!n) return '—'; if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`; return `$${(n/1e6).toFixed(0)}M`; }
function fmtM(n: number) { if (!n) return '$0'; if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`; return `$${(n/1e3).toFixed(0)}K`; }
function Chip({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:8, background:`${color}15`, color, border:`1px solid ${color}30` }}>{label}</span>;
}

function InlineEdit({ value, onSave, multiline = false, textClass = "", inputClass = "", type = "text", canEdit = true, selectOptions = null }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentVal, setCurrentVal] = useState(value);

  useEffect(() => { setCurrentVal(value); }, [value]);

  if (!canEdit) {
    const d = selectOptions ? (selectOptions.find((o:any)=>o.value===value)?.label || value) : value;
    return <span className={textClass}>{d || '—'}</span>;
  }

  const save = () => {
    setIsEditing(false);
    if (currentVal !== value) onSave(currentVal);
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter' && !multiline && type !== 'richtext' && !selectOptions) save();
    if (e.key === 'Escape') { setIsEditing(false); setCurrentVal(value); }
  };

  if (isEditing) {
    if (type === 'richtext') {
       return (
          <div className="w-full relative z-40 bg-white rounded-lg shadow-sm border border-indigo-300">
             <RichTextEditor value={currentVal || ''} onChange={(html) => setCurrentVal(html)} />
             <div className="flex gap-2 justify-end p-2 bg-slate-50 border-t border-slate-100 rounded-b-lg">
                <button onClick={() => { setIsEditing(false); setCurrentVal(value); }} className="px-3 py-1 bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors rounded text-xs font-bold">Cancel</button>
                <button onClick={save} className="px-3 py-1 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors rounded text-xs font-bold shadow hover:shadow-md">Save Changes</button>
             </div>
          </div>
       );
    }
    if (selectOptions) {
      return (
        <select autoFocus value={currentVal} onChange={e=>setCurrentVal(e.target.value)} onBlur={()=>{setIsEditing(false); if(currentVal!==value) onSave(currentVal);}} className={`bg-slate-50 border border-indigo-300 text-slate-800 rounded focus:outline-none focus:ring-2 ring-indigo-500/20 px-1 py-0.5 -ml-1 ${inputClass}`}>
           {selectOptions.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (multiline) {
      return <textarea autoFocus value={currentVal ?? ''} onChange={e=>setCurrentVal(e.target.value)} onBlur={save} onKeyDown={handleKeyDown} className={`w-full bg-slate-50 border border-indigo-300 text-slate-800 rounded focus:outline-none focus:ring-2 ring-indigo-500/20 p-2 text-sm ${inputClass}`} rows={4}/>;
    }
    return <input autoFocus type={type} value={currentVal ?? ''} onChange={e=>setCurrentVal(type==='number'?Number(e.target.value):e.target.value)} onBlur={save} onKeyDown={handleKeyDown} className={`bg-slate-50 border border-indigo-300 text-slate-800 rounded focus:outline-none focus:ring-2 ring-indigo-500/20 px-1.5 py-0.5 -ml-1 w-full max-w-sm ${inputClass}`} />;
  }

  const displayVal = selectOptions ? (selectOptions.find((o:any)=>o.value===value)?.label || value) : value;
  
  if (type === 'richtext') {
     return (
       <div onClick={() => setIsEditing(true)} className={`cursor-text hover:bg-slate-50 rounded transition-colors border border-transparent hover:border-slate-200 outline-none w-full group relative ${textClass}`}>
         <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity bg-indigo-50 p-1.5 rounded-lg border border-indigo-100 shadow-sm"><Edit3 size={14}/></div>
         {value ? <RichTextRenderer content={value} /> : <span className="text-slate-300 italic text-xs block py-2">Click here to add formatting, images, or paste HTML...</span>}
       </div>
     );
  }
  
  return <span onClick={() => setIsEditing(true)} className={`cursor-text hover:bg-slate-100/80 rounded px-1.5 py-0.5 -ml-1.5 transition-colors border border-transparent hover:border-slate-200 outline-none ${textClass}`}>{displayVal || <span className="text-slate-300 italic text-xs px-1">Empty</span>}</span>;
}

interface EntitiesTabProps {
  orgs: PlatformOrg[];
  contacts: PlatformContact[];
  opps: Opportunity[];
  subscriptions: TenantSubscription[];
  performer: { uid: string };
  onRefresh: () => void;
  returnOrgId?: string | null;
  onClearReturnOrg?: () => void;
  onOpenPipeline?: (orgId: string) => void;
  pipelineStages?: PipelineStageConfig[];
}

export function EntitiesTab({ orgs, contacts, opps, subscriptions, performer, onRefresh, returnOrgId, onClearReturnOrg, onOpenPipeline, pipelineStages=[] }: EntitiesTabProps) {
  const { user, tenant } = useAuth();
  const perms = user?.role ? ROLE_PERMISSIONS[user.role] : [];
  const canReadOrg = perms.includes('families:read');
  const canEditOrg = perms.includes('families:write');
  const canReadContact = perms.includes('contacts:read');
  const canEditContact = perms.includes('contacts:write');

  const [activeSubTab, setActiveSubTab] = useState<'all' | 'organizations' | 'contacts'>('organizations');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [typeFilter, setTypeFilter] = useState<'all' | OrgType>('all');
  const [search, setSearch] = useState('');
  
  const { setTitle } = usePageTitle();
  
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => {
    getEmployees().then(setEmployees).catch(() => {});
  }, []);

  const [systemTags, setSystemTags] = useState<Tag[]>([]);
  useEffect(() => {
    if (tenant?.id) {
      getAllTags(tenant.id).then(setSystemTags).catch(() => {});
    }
  }, [tenant?.id]);
  
  const selectedOrg = useMemo(() => orgs.find(o => o.id === selectedOrgId), [orgs, selectedOrgId]);
  const selectedContact = useMemo(() => contacts.find(c => c.id === selectedContactId), [contacts, selectedContactId]);
  const isDetailMode = !!(selectedOrgId || selectedContactId || isCreatingOrg || isCreatingContact);

  useEffect(() => {
    if (!isDetailMode) {
      setTitle('Platform CRM');
      return;
    }
    
    let crumbs: any[] = [];
    crumbs.push({
      label: 'Entities',
      icon: <Building2 size={14} />,
      separator: '/', // Separator between 'Crm' and 'Entities'
      onClick: () => { setSelectedOrgId(null); setSelectedContactId(null); setIsCreatingOrg(false); setIsCreatingContact(false); }
    });
    
    if (selectedOrgId || selectedContact?.orgId) {
      const org = selectedOrg || orgs.find(o => o.id === selectedContact?.orgId);
      crumbs.push({
        label: org?.name || 'Organization',
        separator: <ChevronRight size={14} className="text-slate-400" />, // Separator between 'Entities' and 'Organization'
        onClick: () => { setSelectedContactId(null); if (org) setSelectedOrgId(org.id); }
      });
    }
    
    if (selectedContactId) {
      crumbs.push({ label: selectedContact?.name || 'Contact', icon: <UserCircle2 size={14} className="text-emerald-500" />, separator: <ChevronRight size={14} className="text-slate-400" /> });
    } else if (isCreatingOrg) {
      crumbs.push({ label: 'New Organization', separator: <ChevronRight size={14} className="text-slate-400" /> });
    } else if (isCreatingContact) {
      crumbs.push({ label: 'New Contact', separator: <ChevronRight size={14} className="text-slate-400" /> });
    }
    
    setTitle('Platform CRM', '', crumbs);
  }, [isDetailMode, selectedOrgId, selectedContactId, isCreatingOrg, isCreatingContact, selectedOrg, selectedContact, orgs, setTitle]);

  useEffect(() => {
    if (returnOrgId && orgs.length > 0) {
      setSelectedOrgId(returnOrgId);
      if (onClearReturnOrg) onClearReturnOrg();
    }
  }, [returnOrgId, orgs, onClearReturnOrg]);

  const filteredOrgs = useMemo(() => {
    const q = search.toLowerCase();
    return orgs.filter(o => 
      (!q || o.name.toLowerCase().includes(q) || o.country.toLowerCase().includes(q) || (o.tags && o.tags.some(t => t.toLowerCase().includes(q)))) &&
      (typeFilter === 'all' || o.orgType === typeFilter)
    );
  }, [orgs, search, typeFilter]);

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter(c => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.role && c.role.toLowerCase().includes(q)));
  }, [contacts, search]);


  const entityDist = useMemo(() => {
    const counts: Record<string, number> = { client: 0, prospect: 0, supplier: 0, partner: 0 };
    orgs.forEach(o => { counts[o.orgType || 'client']++; });
    return [
      { name: 'Clients', value: counts.client },
      { name: 'Prospects', value: counts.prospect },
      { name: 'Vendors', value: counts.supplier },
      { name: 'Partners', value: counts.partner }
    ].filter(x => x.value > 0);
  }, [orgs]);

  const geoSpread = useMemo(() => {
    const regions: Record<string, number> = {};
    orgs.forEach(o => { const r = o.region || 'global'; regions[r] = (regions[r] || 0) + 1; });
    return Object.entries(regions)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, value]) => ({ name: REGION_LABELS[name as SalesRegion] || 'Global', value }));
  }, [orgs]);

  const internalAddresses = useMemo(() => {
    const matches: any[] = [];
    orgs.forEach(o => {
        if (o.primaryAddress?.street) {
           matches.push({ id: `o-pri-${o.id}`, name: `${o.name} (Primary)`, type: 'org', addressObj: o.primaryAddress });
        }
    });
    contacts.forEach(c => {
        (c.addresses || []).forEach((a:any) => {
           if (a.street) matches.push({ id: `c-adr-${a.id}`, name: `${c.name} (${a.isPrimary ? 'Primary' : 'Address'})`, type: 'contact', addressObj: a });
        });
    });
    return matches;
  }, [orgs, contacts]);


  return (
    <div className="flex w-full h-full bg-slate-50 relative overflow-hidden">
      {!isDetailMode ? (
        // LIST VIEW
        <div className="flex-1 flex flex-col p-8 lg:px-12 overflow-hidden animate-fade-in bg-slate-50">
           {/* KPI Header Row */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
              <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 border-t-4 border-t-indigo-500">
                <div className="text-sm text-[var(--text-secondary)]">Directory Size</div>
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2"><Building2 size={16} className="text-indigo-400"/><div className="text-sm text-[var(--text-secondary)] font-bold text-slate-700">Organizations</div></div>
                    <span className="font-black text-xl text-slate-800">{orgs.length}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2"><UserCircle2 size={16} className="text-emerald-400"/><div className="text-sm text-[var(--text-secondary)] font-bold text-slate-700">Contacts</div></div>
                    <span className="font-black text-xl text-slate-800">{contacts.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Target size={16} className="text-amber-400"/><div className="text-sm text-[var(--text-secondary)] font-bold text-slate-700">Open Deals</div></div>
                    <span className="font-black text-xl text-slate-800">{(opps||[]).filter(o=>['lead','qualification','demo','proposal','negotiation'].includes(o.stage)).length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 border-t-4 border-t-blue-500">
                <div className="text-sm text-[var(--text-secondary)]">Entity Composition</div>
                <div className="mt-4 flex flex-col gap-4 h-full pb-4">
                  {entityDist.map(item => (
                    <div key={item.name} className="flex flex-col gap-1 w-full">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">{item.name}</span>
                            <span className="font-bold text-slate-800">{item.value}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(5, (item.value / Math.max(1, ...entityDist.map(d=>d.value))) * 100))}%` }}></div>
                        </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 border-t-4 border-t-emerald-500">
                <div className="text-sm text-[var(--text-secondary)]">Geographic Spread</div>
                <div className="mt-4 w-full px-2 flex flex-col gap-4">
                  {geoSpread.map(item => (
                    <div key={item.name} className="flex flex-col gap-1 w-full">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">{item.name}</span>
                            <span className="font-bold text-slate-800">{item.value}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(5, (item.value / Math.max(1, ...geoSpread.map(d=>d.value))) * 100))}%` }}></div>
                        </div>
                    </div>
                  ))}
                </div>
              </div>
           </div>
           
           {/* TabGroup */}
           <div className="border-b border-slate-200 mb-6 shrink-0 flex gap-8">
              <button onClick={() => setActiveSubTab('all')} className={`pb-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${activeSubTab === 'all' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={16}/> All ({orgs.length + contacts.length})</button>
              <button onClick={() => setActiveSubTab('organizations')} className={`pb-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${activeSubTab === 'organizations' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Building2 size={16}/> Organizations ({orgs.length})</button>
              <button onClick={() => setActiveSubTab('contacts')} className={`pb-3 font-bold text-sm transition-all border-b-2 flex items-center gap-2 ${activeSubTab === 'contacts' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><UserCircle2 size={16}/> Contacts ({contacts.length})</button>
           </div>

           {/* Actions Bar */}
           <div className="flex justify-between items-center mb-6 bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0">
             <div className="flex gap-4 items-center">
               <div className="relative w-[350px]">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 pl-9 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50" placeholder={`Search ${activeSubTab}...`} value={search} onChange={e => setSearch(e.target.value)} />
               </div>
               {['all', 'organizations'].includes(activeSubTab) && (
                 <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="bg-slate-50 border border-slate-200 text-slate-600 text-sm font-bold rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none">
                   <option value="all">All Types</option>
                   {Object.keys(ORG_TYPE_LABELS).map(key => <option key={key} value={key}>{ORG_TYPE_LABELS[key as OrgType]}</option>)}
                 </select>
               )}
             </div>
             <div className="flex gap-4 items-center">
               <div className="flex bg-slate-100 p-1 rounded-lg items-center border border-slate-200">
                 <button onClick={()=>setViewMode('list')} className={`p-1 rounded-md transition-all ${viewMode==='list'?'bg-white shadow-sm text-indigo-600':'text-slate-400 hover:text-slate-600'}`} title="List View"><List size={16} /></button>
                 <button onClick={()=>setViewMode('kanban')} className={`p-1 rounded-md transition-all ${viewMode==='kanban'?'bg-white shadow-sm text-indigo-600':'text-slate-400 hover:text-slate-600'}`} title="Card View"><LayoutGrid size={16} /></button>
               </div>
               <div className="h-6 w-px bg-slate-200"></div>
               <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700 h-9 px-4 py-2" onClick={() => { setActiveSubTab('organizations'); setIsCreatingOrg(true); }}><Plus size={14} className="-ml-1" /> New Org</button>
               <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 h-9 px-4 py-2" onClick={() => { setActiveSubTab('contacts'); setIsCreatingContact(true); }}><Plus size={14} className="-ml-1" /> New Contact</button>
             </div>
           </div>
           
           <div className="flex-1 overflow-y-auto pr-4 pb-20 scroll-smooth">
              {/* ORGS */}
              {['all', 'organizations'].includes(activeSubTab) && (
                <div className="mb-10 animate-fade-in-up">
                  {activeSubTab === 'all' && filteredOrgs.length > 0 && <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Organizations</h3>}
                  {filteredOrgs.length > 0 ? (
                    viewMode === 'list' ? (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-slate-50/50">
                            <tr>
                              <th className="font-bold text-slate-500 py-3.5 pl-6 border-b border-slate-200 text-left">Organization</th>
                              <th className="font-bold text-slate-500 py-3.5 border-b border-slate-200 text-left">Type</th>
                              <th className="font-bold text-slate-500 py-3.5 border-b border-slate-200 text-left">Location</th>
                              <th className="font-bold text-slate-500 py-3.5 border-b border-slate-200 text-left">Open Deals</th>
                              <th className="font-bold text-slate-500 py-3.5 text-right pr-6 border-b border-slate-200">Tags</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredOrgs.map(org => {
                              const lock = !canReadOrg;
                              const stageC = pipelineStages.find(s=>s.id===org.stage);
                              const c = stageC?.color || STAGE_COLORS[org.stage] || '#64748b';
                              const activeOpps = (opps||[]).filter(o => o.orgId === org.id && ['lead', 'qualification', 'demo', 'proposal', 'negotiation'].includes(o.stage));
                              const oppsValue = activeOpps.reduce((s,o) => s + o.valueUsd, 0);
                              
                              return (
                                <tr key={org.id} onClick={() => { if(!lock) { setSelectedContactId(null); setSelectedOrgId(org.id); } }} className={`transition-colors border-t border-slate-100 ${lock ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-slate-50/80'}`}>
                                  <td className="pl-6 w-1/4 py-3 align-middle">
                                    <div className="flex items-center gap-3">
                                      {org.logoUrl ? <img src={org.logoUrl} className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-sm" /> : <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black bg-indigo-50 text-indigo-500 text-sm border border-indigo-100">{org.name.charAt(0)}</div>}
                                      <div className="font-bold text-slate-800 flex items-center gap-2">{org.name} {lock && <Lock size={12} className="text-slate-400"/>}</div>
                                    </div>
                                  </td>
                                  <td className="py-3 align-middle">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold border border-slate-200 shadow-sm uppercase tracking-wide">{org.orgType ? ORG_TYPE_LABELS[org.orgType] : 'Client'}</span>
                                  </td>
                                  <td className="text-slate-500 text-sm font-medium py-3 align-middle">{org.country || 'Global'}</td>
                                  <td className="py-3 align-middle">
                                    <div className="flex flex-col w-fit cursor-pointer hover:bg-slate-50 p-1.5 -ml-1.5 rounded-lg transition-colors group" onClick={(e) => { if(onOpenPipeline) { e.stopPropagation(); onOpenPipeline(org.id); } }}>
                                       <span className="text-slate-700 font-bold text-sm tracking-tight group-hover:text-indigo-600 transition-colors">{activeOpps.length} Deal{activeOpps.length===1?'':'s'}</span>
                                       {activeOpps.length > 0 && <span className="text-emerald-600 text-[10px] font-black">{fmtM(oppsValue)}</span>}
                                    </div>
                                  </td>
                                  <td className="text-right pr-6 py-3 align-middle">
                                    <div className="flex gap-1.5 justify-end">
                                      {!(org.tags?.length > 0) ? <span className="text-xs text-slate-400 italic">None</span> : org.tags.slice(0, 3).map(t => <span key={t} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold border border-slate-200">{t}</span>)}
                                      {org.tags?.length > 3 && <span className="px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded text-[10px] font-bold border border-slate-100">+{org.tags.length - 3}</span>}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                      {filteredOrgs.map(org => {
                        const c = STAGE_COLORS[org.stage] || '#64748b';
                        const lock = !canReadOrg;
                        const activeOpps = (opps||[]).filter(o => o.orgId === org.id && ['lead', 'qualification', 'demo', 'proposal', 'negotiation'].includes(o.stage));
                        const oppsValue = activeOpps.reduce((s,o) => s + o.valueUsd, 0);

                        return (
                          <div key={org.id} onClick={() => { if(!lock) { setSelectedContactId(null); setSelectedOrgId(org.id); } }} className={`p-5 rounded-2xl border bg-white ${lock ? 'cursor-not-allowed border-slate-200' : 'cursor-pointer hover-lift border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all'} flex flex-col gap-3 relative overflow-hidden group`}>
                            {lock && <div className="absolute inset-0 z-10 bg-slate-50/70 backdrop-blur-[2px] flex items-center justify-center"><div className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg"><Lock size={14} className="text-indigo-400"/> Protected</div></div>}
                            <div className={`flex justify-between items-start gap-4 ${lock ? 'opacity-40 blur-[3px] grayscale' : ''}`}>
                              {org.logoUrl ? (
                                <img src={org.logoUrl} className="w-10 h-10 rounded-lg object-cover shadow-sm border border-slate-100" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg flex justify-center items-center text-lg font-black bg-indigo-50 text-indigo-500 shrink-0 border border-indigo-100">
                                  {org.name.charAt(0)}
                                </div>
                              )}
                              <span style={{ color: c, background: `${c}15`, border:`1px solid ${c}30` }} className="text-[10px] font-extrabold px-2 py-1 flex items-center rounded-full uppercase whitespace-nowrap shrink-0">
                                 {STAGE_LABELS[org.stage].replace(/^.+ /,'')}
                              </span>
                            </div>
                            <div className={lock ? 'opacity-40 blur-[3px] grayscale' : ''}>
                              <h4 className="font-bold text-base text-slate-800 tracking-tight leading-tight line-clamp-1">{org.name}</h4>
                              <div className="text-[11px] text-slate-400 font-bold mb-1.5 uppercase tracking-wider">{org.orgType ? ORG_TYPE_LABELS[org.orgType] : 'Client'}</div>
                              <div className="text-[12px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
                                 <span>{org.country || 'Global'}</span>
                                 {activeOpps.length > 0 ? <span onClick={(e)=>{ if(onOpenPipeline){ e.stopPropagation(); onOpenPipeline(org.id); }}} className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded cursor-pointer hover:bg-emerald-100 transition-colors">{activeOpps.length} Active Deals</span> : <span onClick={(e)=>{ if(onOpenPipeline){ e.stopPropagation(); onOpenPipeline(org.id); }}} className="font-semibold text-slate-300 hover:text-indigo-400 cursor-pointer transition-colors">No Deals</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    )
                  ) : activeSubTab === 'organizations' && (
                    <div className="text-center p-20 text-slate-400"><Building2 size={48} className="mx-auto mb-4 opacity-20" /><p className="font-medium text-lg text-slate-500">No organizations found.</p></div>
                  )}
                </div>
              )}
              
              {/* CONTACTS */}
              {['all', 'contacts'].includes(activeSubTab) && (
                <div className="animate-fade-in-up">
                  {activeSubTab === 'all' && filteredContacts.length > 0 && <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 mt-8">Contacts</h3>}
                  {filteredContacts.length > 0 ? (
                    viewMode === 'list' ? (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-slate-50/50">
                            <tr>
                              <th className="font-bold text-slate-500 py-3.5 pl-6 border-b border-slate-200 text-left">Contact Name</th>
                              <th className="font-bold text-slate-500 py-3.5 border-b border-slate-200 text-left">Role</th>
                              <th className="font-bold text-slate-500 py-3.5 border-b border-slate-200 text-left">Organization</th>
                              <th className="font-bold text-slate-500 py-3.5 border-b border-slate-200 text-left">Email</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredContacts.map(contact => {
                              const org = orgs.find(o => o.id === contact.orgId);
                              const lock = !canReadContact;
                              return (
                                <tr key={contact.id} onClick={() => { if(!lock) { setSelectedOrgId(null); setSelectedContactId(contact.id); } }} className={`transition-colors border-t border-slate-100 ${lock ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-slate-50/80'}`}>
                                  <td className="pl-6 w-1/3 py-3 align-middle">
                                    <div className="flex items-center gap-3">
                                      {contact.logoUrl ? <img src={contact.logoUrl} className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm" /> : <div className="w-8 h-8 rounded-full flex items-center justify-center font-black bg-slate-100 text-slate-500 text-sm border border-slate-200 shrink-0">{contact.name.charAt(0)}</div>}
                                      <div className="font-bold text-slate-800 flex items-center gap-2">
                                        {contact.name} {lock && <Lock size={12} className="text-slate-400"/>}
                                        {contact.isPrimary && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider bg-emerald-100 text-emerald-700 ml-1">Primary</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="text-slate-500 text-sm font-medium py-3 align-middle">{contact.role || '—'}</td>
                                  <td className="text-slate-600 font-bold py-3 align-middle"><span className="flex items-center gap-1.5"><Building2 size={12} className="text-slate-300"/>{org?.name || 'Independent'}</span></td>
                                  <td className="text-brand-600 font-medium text-sm py-3 align-middle"><span className="flex items-center gap-1.5"><Mail size={12} className="text-brand-300"/>{contact.email}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                      {filteredContacts.map(contact => {
                        const org = orgs.find(o => o.id === contact.orgId);
                        const lock = !canReadContact;
                        return (
                          <div key={contact.id} onClick={() => { if(!lock) { setSelectedOrgId(null); setSelectedContactId(contact.id); } }} className={`p-5 rounded-2xl border bg-white ${lock ? 'cursor-not-allowed border-slate-200' : 'cursor-pointer hover-lift border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all'} flex flex-col gap-3 relative overflow-hidden group`}>
                            {lock && <div className="absolute inset-0 z-10 bg-slate-50/70 backdrop-blur-[2px] flex items-center justify-center"><div className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg"><Lock size={14} className="text-emerald-400"/> Protected</div></div>}
                            <div className={`flex justify-between items-start gap-4 ${lock ? 'opacity-40 blur-[3px] grayscale' : ''}`}>
                              {contact.logoUrl ? (
                                <img src={contact.logoUrl} className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-100" />
                              ) : (
                                <div className="w-10 h-10 rounded-full flex justify-center items-center text-lg font-black shrink-0 bg-slate-50 text-slate-500 border border-slate-200">
                                  {contact.name.charAt(0)}
                                </div>
                              )}
                              {contact.isPrimary && <span className="text-[10px] font-extrabold px-2 py-1 flex items-center rounded-full uppercase whitespace-nowrap shrink-0 bg-emerald-100 text-emerald-700 border border-emerald-200 gap-1"><span className="text-[8px]">★</span> Primary</span>}
                            </div>
                            <div className={lock ? 'opacity-40 blur-[3px] grayscale' : ''}>
                              <h4 className="font-bold text-base text-slate-800 tracking-tight leading-tight line-clamp-1">{contact.name}</h4>
                              <div className="text-[12px] text-slate-500 mt-0.5 mb-2 truncate">{contact.role || 'No formal role'}</div>
                              <div className="text-[11px] text-slate-400 flex flex-col gap-1.5 mt-2 pt-2 border-t border-slate-100">
                                 <span className="truncate flex items-center gap-1.5 font-medium text-slate-500"><Building2 size={12} className="shrink-0 text-slate-300"/> {org?.name || 'Independent'}</span>
                                 <span className="truncate flex items-center gap-1.5 text-brand-600"><Mail size={12} className="shrink-0 text-brand-300"/> {contact.email}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    )
                  ) : activeSubTab === 'contacts' && (
                    <div className="text-center p-20 text-slate-400"><UserCircle2 size={48} className="mx-auto mb-4 opacity-20" /><p className="font-medium text-lg text-slate-500">No contacts found.</p></div>
                  )}
                </div>
              )}
              
              {activeSubTab === 'all' && filteredOrgs.length === 0 && filteredContacts.length === 0 && (
                <div className="text-center p-20 text-slate-400">
                   <Search size={48} className="mx-auto mb-4 opacity-20" />
                   <p className="font-medium text-lg text-slate-500">No entities found.</p>
                </div>
              )}
           </div>
        </div>
      ) : (
        <div className="flex-1 w-full h-full overflow-y-auto bg-slate-50/50 relative animate-fade-in scroll-smooth">
          <div className="pb-20">
            {isCreatingOrg && <NewOrgForm onCreated={(o:any) => { onRefresh(); setIsCreatingOrg(false); setSelectedOrgId(o.id); }} onBack={() => setIsCreatingOrg(false)} performer={performer} employees={employees} />}
            {!isCreatingOrg && !isCreatingContact && selectedOrgId && !selectedContactId && selectedOrg && <OrgDetailView org={selectedOrg} contacts={contacts.filter(c => c.orgId === selectedOrg.id)} subscriptions={subscriptions} onRefresh={onRefresh} performer={performer} employees={employees} onContactClick={setSelectedContactId} systemTags={systemTags} internalAddresses={internalAddresses} />}
            
            {isCreatingContact && <NewContactForm orgs={orgs} onCreated={() => { onRefresh(); setIsCreatingContact(false); }} onBack={() => setIsCreatingContact(false)} performer={performer} />}
            {!isCreatingContact && !isCreatingOrg && selectedContactId && selectedContact && <ContactDetailView contact={selectedContact} orgs={orgs} onRefresh={onRefresh} performer={performer} internalAddresses={internalAddresses} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMS / DETAIL VIEWS
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{children}</div>;
}

function NewOrgForm({ onBack, onCreated, performer, employees }: any) {
  const [form, setForm] = useState({ name:'', country:'', region:'latam' as any, size:'small' as OrgSize, orgType:'client' as OrgType, estAumUsd:0, stage:'lead' as DealStage, assignedTo:'', tags:'', notes:'', website:'', logoUrl:'', phone:'', whatsapp:'', invoiceAddress:'', shippingAddress:'', contactName:'', contactEmail:'', contactRole:'', contactPhone:'', contactWhatsapp:'' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const f = (k: string) => (e: any) => setForm(p=>({...p,[k]:e.target.type==='number'?Number(e.target.value):e.target.value}));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form.name) return; setLoading(true); setError('');
    try {
      const org = await createOrg({ name:form.name, country:form.country, region:form.region, size:form.size, orgType:form.orgType, estAumUsd:form.estAumUsd, stage:form.stage, assignedTo:form.assignedTo, phone:form.phone, whatsapp:form.whatsapp, invoiceAddress:form.invoiceAddress, shippingAddress:form.shippingAddress, tags:form.tags.split(',').map(t=>t.trim()).filter(Boolean), notes:form.notes, website:form.website, logoUrl:form.logoUrl, tenantIds:[], createdBy:performer.uid }, performer);
      if (form.contactName && form.contactEmail) await createContact({ orgId:org.id, name:form.contactName, email:form.contactEmail, role:form.contactRole||'', phone:form.contactPhone||'', whatsapp:form.contactWhatsapp||'', isPrimary:true, notes:'', createdBy:performer.uid }, performer);
      onCreated(org);
    } catch (err:any) { setError(err.message??'Failed'); } finally { setLoading(false); }
  };

  return (
    <div className="p-8 animate-fade-in max-w-4xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-6 flex items-center gap-3"><Building2 className="text-indigo-500" /> New Organization</h1>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">❌ {error}</div>}
      <form onSubmit={handleCreate}>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <div className="col-span-2"><FieldLabel>Organization Name *</FieldLabel><input required className="input w-full" value={form.name} onChange={f('name')} placeholder="Andrade Family Office" /></div>
            <div><FieldLabel>Country</FieldLabel><input className="input w-full" value={form.country} onChange={f('country')} placeholder="Brazil" /></div>
            <div>
              <FieldLabel>Region</FieldLabel>
              <select className="input w-full" value={form.region} onChange={f('region')}>{(['latam','emea','apac','north_america','global'] as const).map(r=><option key={r} value={r}>{REGION_LABELS[r]}</option>)}</select>
            </div>
            <div>
              <FieldLabel>Size</FieldLabel>
              <select className="input w-full" value={form.size} onChange={f('size')}>{(Object.keys(ORG_SIZE_LABELS) as OrgSize[]).map(s=><option key={s} value={s}>{ORG_SIZE_LABELS[s]}</option>)}</select>
            </div>
            <div>
              <FieldLabel>Type</FieldLabel>
              <select className="input w-full" value={form.orgType} onChange={f('orgType')}>{Object.keys(ORG_TYPE_LABELS).map(t=><option key={t} value={t}>{ORG_TYPE_LABELS[t as OrgType]}</option>)}</select>
            </div>
            <div>
              <FieldLabel>Deal Stage</FieldLabel>
              <select className="input w-full" value={form.stage} onChange={f('stage')}>{STAGES.map(s=><option key={s} value={s}>{STAGE_LABELS[s].replace(/^.+ /,'')}</option>)}</select>
            </div>
            <div><FieldLabel>Est. AUM (USD)</FieldLabel><input type="number" min={0} className="input w-full" value={form.estAumUsd} onChange={f('estAumUsd')} /></div>
            <div>
              <FieldLabel>Account Manager</FieldLabel>
              <select className="input w-full" value={form.assignedTo} onChange={f('assignedTo')}>
                <option value="">-- Unassigned --</option>
                {employees?.filter((e:any) => e.department === 'Sales' && e.employmentType === 'Full-Time').map((e:any)=><option key={e.id} value={e.name}>{e.name} ({e.department})</option>)}
              </select>
            </div>
            <div><FieldLabel>Corporate Phone</FieldLabel><input className="input w-full" value={form.phone} onChange={f('phone')} placeholder="+1 555-0199" /></div>
            <div><FieldLabel>Support WhatsApp</FieldLabel><input className="input w-full" value={form.whatsapp} onChange={f('whatsapp')} placeholder="+1 555-0199" /></div>
            <div><FieldLabel>Website</FieldLabel><input className="input w-full" value={form.website} onChange={f('website')} placeholder="https://" /></div>
            <div><FieldLabel>Logo URL</FieldLabel><input className="input w-full" value={form.logoUrl} onChange={f('logoUrl')} placeholder="https://..." /></div>
            <div className="col-span-2"><FieldLabel>Invoice Address</FieldLabel><textarea className="input w-full text-sm" rows={2} value={form.invoiceAddress} onChange={f('invoiceAddress')} placeholder="Billing Dept..." /></div>
            <div className="col-span-2"><FieldLabel>Shipping Address</FieldLabel><textarea className="input w-full text-sm" rows={2} value={form.shippingAddress} onChange={f('shippingAddress')} placeholder="Receiving Dept..." /></div>
            <div className="col-span-2"><FieldLabel>Tags (Comma Separated)</FieldLabel><input className="input w-full" value={form.tags} onChange={f('tags')} placeholder="hot, crypto" /></div>
            <div className="col-span-2"><FieldLabel>Notes</FieldLabel>
               <div className="bg-slate-50 border border-slate-300 rounded focus-within:ring-2 ring-indigo-500/20">
                 <RichTextEditor value={form.notes || ''} onChange={(html) => setForm(p => ({ ...p, notes: html }))} placeholder="Add detailed notes..." />
               </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><UserCircle2 size={16} /> Primary Contact <span className="text-xs text-slate-400 font-medium">(Optional)</span></h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <div><FieldLabel>Name</FieldLabel><input className="input w-full" value={form.contactName} onChange={f('contactName')} /></div>
            <div><FieldLabel>Email</FieldLabel><input type="email" className="input w-full" value={form.contactEmail} onChange={f('contactEmail')} /></div>
            <div><FieldLabel>Role</FieldLabel><input className="input w-full" value={form.contactRole} onChange={f('contactRole')} /></div>
            <div><FieldLabel>Phone</FieldLabel><input className="input w-full" value={form.contactPhone} onChange={f('contactPhone')} /></div>
            <div><FieldLabel>WhatsApp</FieldLabel><input className="input w-full" value={form.contactWhatsapp} onChange={f('contactWhatsapp')} /></div>
          </div>
        </div>
        <div className="flex gap-4 mt-6">
          <button className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50 bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 h-9 px-4 py-2" type="button" onClick={onBack}>Cancel</button>
          <button className="flex-[2] inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 h-9 px-4 py-2" type="submit" disabled={loading || !form.name}>{loading ? 'Creating...' : 'Create Organization'}</button>
        </div>
      </form>
    </div>
  );
}

function OrgDetailView({ org, contacts, subscriptions, onRefresh, performer, employees, onContactClick, systemTags = [], internalAddresses = [] }: any) {
  const [tab, setTab] = useState<'info'|'comms'|'contacts'|'tenants'|'background'|'plan'>('info');
  const [contactViewMode, setContactViewMode] = useState<'list'|'kanban'>('list');
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  
  const { user } = useAuth();
  const perms = user?.role ? ROLE_PERMISSIONS[user.role] : [];
  const canEditOrg = perms.includes('families:write');
  const canDelOrg = perms.includes('families:delete');

  const updateField = async (field: string, val: any) => {
    await updateOrg(org.id, { [field]: val });
    onRefresh();
  };

  const del = async () => {
    setConfirm({
      title: 'Delete Organization',
      message: 'Are you sure you want to permanently delete this organization? All related data, including contacts and history, may be orphaned or destroyed. This cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete Permanently',
      onConfirm: async () => {
        await deleteOrg(org.id); 
        onRefresh();
      },
      onCancel: () => setConfirm(null)
    });
  };

  const linkedSubs = subscriptions.filter((s:any)=>org.tenantIds.includes(s.tenantId));

  const sizeOpts = (Object.keys(ORG_SIZE_LABELS) as OrgSize[]).map(s=>({value:s,label:ORG_SIZE_LABELS[s]}));
  const regionOpts = (['latam','emea','apac','north_america','global']).map(r=>({value:r,label:REGION_LABELS[r as SalesRegion]}));
  const typeOpts = Object.keys(ORG_TYPE_LABELS).map(k=>({value:k,label:ORG_TYPE_LABELS[k as OrgType]}));
  const stageOpts = STAGES.map(s=>({value:s,label:STAGE_LABELS[s].replace(/^.+ /,'')}));
  const empOpts = [{value:'',label:'Unassigned'}, ...(employees||[]).filter((e:any)=>e.department==='Sales' && e.employmentType==='Full-Time').map((e:any)=>({value:e.name,label:e.name}))];

  const primaryTag = org.tags?.[0];
  const secondaryTags = org.tags?.slice(1) || [];

  const handleSetPrimary = (tagName: string) => {
    const newTags = [tagName, ...(org.tags || []).filter((t:string) => t !== tagName)];
    updateField('tags', newTags);
  };
  const handleRemovePrimary = () => {
    const newTags = (org.tags || []).slice(1);
    updateField('tags', newTags);
  };
  const handleToggleSecondary = (tagName: string) => {
    let newTags = [...(org.tags || [])];
    if (!newTags[0]) {
      newTags.push(tagName);
    } else {
      if (newTags.slice(1).includes(tagName)) {
        newTags = [newTags[0], ...newTags.slice(1).filter((t:string) => t !== tagName)];
      } else {
        newTags.push(tagName);
      }
    }
    updateField('tags', Array.from(new Set(newTags)));
  };

  const getTagColor = (name: string) => {
    const st = systemTags.find((t:any) => t.name.toLowerCase() === name.toLowerCase());
    return st?.color ? COLOR_MAP[st.color] : '#cbd5e1';
  };

  return (
    <div className="animate-fade-in w-full h-full flex flex-col">
      <div className="flex justify-between items-start mb-6 px-8">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl shrink-0 overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
            {org.logoUrl ? <img src={org.logoUrl} className="w-full h-full object-cover" /> : <Building2 size={36} className="text-slate-300" />}
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800 mb-2">
               <InlineEdit value={org.name} onSave={(v:string)=>updateField('name',v)} canEdit={canEditOrg} />
            </h1>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-500 flex-wrap">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-black border border-slate-200 uppercase tracking-widest cursor-pointer shadow-sm"><InlineEdit value={org.orgType || 'client'} onSave={(v:any)=>updateField('orgType',v)} canEdit={canEditOrg} selectOptions={typeOpts} /></span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5"><Building2 size={16} className="text-slate-400"/> <InlineEdit value={org.size} onSave={(v:any)=>updateField('size',v)} canEdit={canEditOrg} selectOptions={sizeOpts} /></span>
              <span className="text-slate-300">•</span>
              <span><InlineEdit value={org.country} onSave={(v:string)=>updateField('country',v)} canEdit={canEditOrg} /></span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1"><Globe size={14}/> <InlineEdit value={org.website} onSave={(v:string)=>updateField('website',v)} canEdit={canEditOrg} textClass="text-indigo-500 hover:text-indigo-600 font-semibold" /></span>
              <span className="text-slate-300">•</span>
              <Chip label={STAGE_LABELS[org.stage as DealStage].replace(/^.+ /,'')} color={STAGE_COLORS[org.stage as DealStage]} />
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 shrink-0 flex-wrap justify-end max-w-sm pt-1">
          {contacts.length > 0 && contacts.filter((c:any) => c.isPrimary).slice(0, 2).map((c:any) => (
             <div key={c.id} className="flex flex-col gap-1 border border-slate-200 p-2.5 rounded-xl bg-white shadow-sm min-w-[200px]">
                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                   <span className="truncate max-w-[120px]" title={c.name}>{c.name}</span>
                   <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[9px] uppercase font-black">Primary</span>
                </div>
                {c.email && <div className="text-[11px] flex items-center gap-2 text-slate-500"><Mail size={12}/> <a href={`mailto:${c.email}`} className="text-indigo-600 font-semibold hover:underline truncate max-w-[150px]" title={c.email}>{c.email}</a></div>}
                {c.phone && <div className="text-[11px] flex items-center gap-2 text-slate-500"><MessageSquare size={12}/> <a href={`https://wa.me/${c.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold hover:underline">WhatsApp</a> <span className="text-slate-400">{c.phone}</span></div>}
             </div>
          ))}
          {canDelOrg && <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 disabled:pointer-events-none disabled:opacity-50 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-100 shadow-sm h-8 px-3 py-1.5" onClick={del}><Trash2 size={14} className="text-red-500"/> Delete</button>}
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 mb-6 w-full px-8 overflow-x-auto">
        {[{id:'info',label:'📋 Details'},{id:'comms',label:'💬 Comms'},{id:'contacts',label:`👤 Contacts (${contacts.length})`},{id:'tenants',label:`🏢 Tenants (${linkedSubs.length})`},{id:'background',label:'📖 Org Background'},{id:'plan',label:'🎯 Account Plan'}].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id as any)} className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${tab===t.id ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-slate-500 hover:bg-slate-100/50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-8 pb-10">
        {tab === 'info' && (
          <div className="flex flex-col gap-6 w-full">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h3 className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase mb-1">Strategic Summary</h3>
                <div className="grid grid-cols-4 gap-4">
                   <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5"><Target size={12}/> Revenue</div>
                      <div className="font-extrabold text-xl text-emerald-600 tracking-tight"><InlineEdit type="number" value={org.estAumUsd} onSave={(v:number)=>updateField('estAumUsd',v)} canEdit={canEditOrg} /></div>
                   </div>
                   <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Region</div>
                      <div className="font-bold text-sm text-slate-800 tracking-tight"><InlineEdit value={org.region||'global'} onSave={(v:string)=>updateField('region',v)} canEdit={canEditOrg} selectOptions={regionOpts} /></div>
                   </div>
                   <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Account Manager</div>
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] text-indigo-700">{org.assignedTo ? org.assignedTo[0] : '?'}</div> <InlineEdit value={org.assignedTo||''} onSave={(v:string)=>updateField('assignedTo',v)} canEdit={canEditOrg} selectOptions={empOpts} /></div>
                   </div>
                   <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Deal Stage</div>
                      <div className="font-bold text-slate-800 text-sm"><InlineEdit value={org.stage} onSave={(v:string)=>updateField('stage',v)} canEdit={canEditOrg} selectOptions={stageOpts} /></div>
                   </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <h3 className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase mb-3">Details</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Phone size={10}/> Corp Phone</div>
                    <div className="font-semibold text-xs text-slate-800"><InlineEdit value={org.phone} onSave={(v:string)=>updateField('phone',v)} canEdit={canEditOrg} /></div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><MessageSquare size={10}/> WhatsApp</div>
                    <div className="font-semibold text-xs text-slate-800"><InlineEdit value={org.whatsapp} onSave={(v:string)=>updateField('whatsapp',v)} canEdit={canEditOrg} /></div>
                  </div>
                  <div className="col-span-1">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                       <span>Invoice Address</span>
                       {(org.primaryAddress?.street || org.primaryAddress?.city) && (
                         <button onClick={() => {
                            if (org.primaryAddress) {
                               const p = org.primaryAddress;
                               const formatted = [p.street, p.number, p.complement, p.city, p.state, p.country].filter(Boolean).join(', ');
                               updateField('invoiceAddress', formatted);
                            }
                         }} className="text-[9px] text-indigo-500 hover:text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded cursor-pointer font-bold border border-indigo-200">Copy Primary</button>
                       )}
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed truncate" title={org.invoiceAddress}><InlineEdit textClass="block w-full truncate" value={org.invoiceAddress} onSave={(v:string)=>updateField('invoiceAddress',v)} canEdit={canEditOrg} /></div>
                  </div>
                  <div className="col-span-1 border-l border-slate-100 pl-4 relative">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin size={10} className="text-rose-400"/> Primary Address</div>
                    {org.shippingAddress && !org.primaryAddress && <div className="text-[10px] text-amber-600 mb-1 bg-amber-50 rounded px-1.5 py-0.5 inline-block">Legacy: {org.shippingAddress}</div>}
                    <div className="text-xs text-slate-600 leading-relaxed truncate">
                       <AddressAutocomplete value={org.primaryAddress} onSave={(v:any) => updateField('primaryAddress', v)} canEdit={canEditOrg} internalAddresses={internalAddresses} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-1 space-y-4">
               <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col items-start h-full">
                 <div className="flex justify-between w-full items-center mb-4">
                   <h3 className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">Tags</h3>
                   <Link href="/platform/tags" className="bg-slate-50 text-indigo-600 hover:text-indigo-700 font-bold px-2 py-1 rounded hover:bg-slate-100 border border-slate-200 shadow-sm transition-all flex items-center gap-1"><Settings size={10}/> <span className="text-[9px] uppercase">Manage</span></Link>
                 </div>
                 
                 <div className="w-full mb-5">
                    <div className="text-[10px] text-slate-400 font-black tracking-widest uppercase mb-1.5 flex items-center gap-1.5"><TagIcon size={12} className="text-indigo-400"/> Primary Identity</div>
                    {primaryTag ? (
                       <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm relative group cursor-default"
                            style={{ 
                              color: `color-mix(in srgb, ${getTagColor(primaryTag)} 90%, black)`, 
                              backgroundColor: `color-mix(in srgb, ${getTagColor(primaryTag)} 10%, white)`,
                              border: `1px solid color-mix(in srgb, ${getTagColor(primaryTag)} 30%, transparent)`
                            }}>
                          <Hash size={14} style={{ color: getTagColor(primaryTag) }} />
                          {primaryTag}
                          {canEditOrg && <button onClick={handleRemovePrimary} title="Remove Primary" className="ml-2 w-4 h-4 rounded-full bg-black/5 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"><X size={10}/></button>}
                       </div>
                    ) : (
                       <select className="input text-xs font-bold text-slate-500 w-full p-2 bg-slate-50 border-dashed" value="" onChange={(e)=>handleSetPrimary(e.target.value)} disabled={!canEditOrg}>
                          <option value="" disabled>+ Assign Primary Tag...</option>
                          {systemTags.map((t:any) => <option key={t.id} value={t.name}>{t.name}</option>)}
                       </select>
                    )}
                 </div>

                 <div className="w-full">
                    <div className="text-[10px] text-slate-400 font-black tracking-widest uppercase mb-2">Secondary Labels</div>
                    <div className="flex flex-wrap gap-2 items-center">
                       {secondaryTags.map((t:string) => (
                           <div key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold shadow-sm group border"
                                style={{ 
                                  color: `color-mix(in srgb, ${getTagColor(t)} 90%, black)`, 
                                  backgroundColor: `color-mix(in srgb, ${getTagColor(t)} 5%, white)`,
                                  borderColor: `color-mix(in srgb, ${getTagColor(t)} 20%, transparent)`
                                }}>
                              {t}
                              {canEditOrg && <button onClick={()=>handleToggleSecondary(t)} className="ml-1 opacity-20 group-hover:opacity-100 hover:text-red-500 transition-opacity"><X size={10}/></button>}
                           </div>
                       ))}
                       {canEditOrg && (
                          <select className="border border-dashed border-slate-300 text-slate-400 text-[11px] font-bold bg-transparent rounded-md px-2 py-1 outline-none hover:bg-slate-50 cursor-pointer max-w-[120px]" value="" onChange={(e)=>handleToggleSecondary(e.target.value)}>
                             <option value="" disabled>+ Tag...</option>
                             {systemTags.filter((t:any) => t.name !== primaryTag && !secondaryTags.includes(t.name)).map((t:any) => (
                               <option key={t.id} value={t.name}>{t.name}</option>
                             ))}
                          </select>
                       )}
                    </div>
                 </div>
               </div>
              </div>
            </div>
          </div>
        )}

        {['background', 'plan'].includes(tab) && (
          <AccountPlanDock org={org} updateField={updateField} canEditOrg={canEditOrg} performer={performer} activeTab={tab as 'background'|'plan'} employees={employees} />
        )}

        {tab === 'comms' && (
          <div className="flex flex-col gap-4 h-full">
            <div className="h-[600px] w-full rounded-2xl border border-slate-200 overflow-hidden bg-white mt-2">
              <CommunicationPanel 
                orgId={org.id} 
                familyName={org.name} 
                primaryTag={org.tags?.[0] || undefined} 
              />
            </div>
          </div>
        )}

        {tab === 'contacts' && (
          <div className="space-y-4 max-w-5xl">
            <div className="flex justify-end gap-2 mb-2">
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                <button onClick={() => setContactViewMode('list')} className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${contactViewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}><List size={16} /></button>
                <button onClick={() => setContactViewMode('kanban')} className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${contactViewMode === 'kanban' ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={16} /></button>
              </div>
            </div>
            {contacts.length === 0 ? (
               <div className="text-center p-12 bg-white rounded-2xl border border-dashed border-slate-300">
                 <UserCircle2 size={40} className="mx-auto text-slate-300 mb-4" />
                 <p className="font-bold text-slate-500 mb-2">No Contacts Registered</p>
                 <p className="text-sm text-slate-400">Add an individual to build out the organization graph.</p>
               </div>
            ) : contactViewMode === 'list' ? (
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                 <table className="w-full text-left text-sm border-collapse">
                   <thead className="bg-slate-50 border-b border-slate-200">
                     <tr>
                       <th className="text-xs font-black uppercase text-slate-400 py-3 pl-4">Name</th>
                       <th className="text-xs font-black uppercase text-slate-400 py-3">Role</th>
                       <th className="text-xs font-black uppercase text-slate-400 py-3">Contact</th>
                       <th className="text-xs font-black uppercase text-slate-400 py-3 text-right pr-4">Status</th>
                     </tr>
                   </thead>
                   <tbody>
                     {contacts.map((c:any) => (
                       <tr key={c.id} onClick={() => onContactClick?.(c.id)} className="cursor-pointer hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0">
                         <td className="font-bold text-slate-800 flex items-center gap-3 py-4 pl-4 align-middle">
                           <div className={`w-8 h-8 rounded-full flex justify-center items-center text-xs font-black ${c.isPrimary ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                             {c.logoUrl ? <img src={c.logoUrl} className="w-full h-full object-cover rounded-full" /> : c.name.charAt(0)}
                           </div>
                           {c.name}
                         </td>
                         <td className="text-slate-500 text-sm font-medium align-middle">{c.role || <span className="opacity-40 italic">Unassigned</span>}</td>
                         <td className="text-sm text-slate-500 space-y-1 align-middle">
                           <div className="flex items-center gap-1.5"><Mail size={12} className="text-indigo-400"/> {c.email}</div>
                           {c.phone && <div className="flex items-center gap-1.5"><Phone size={12} className="text-emerald-400"/> {c.phone}</div>}
                         </td>
                         <td className="text-right pr-4 align-middle">
                           {c.isPrimary && <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded font-black tracking-widest uppercase shadow-sm">Primary</span>}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {contacts.map((c:any) => (
                  <div key={c.id} onClick={() => onContactClick?.(c.id)} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex justify-center items-center text-lg font-black ${c.isPrimary ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {c.logoUrl ? <img src={c.logoUrl} className="w-full h-full object-cover rounded-full" /> : c.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-800 group-hover:text-emerald-600 transition-colors">{c.name}</div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{c.role}</div>
                        </div>
                      </div>
                      {c.isPrimary && <div className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded uppercase font-black tracking-widest w-min">Primary</div>}
                    </div>
                    <div className="space-y-1.5 mt-2 pt-3 border-t border-slate-100">
                      <div className="text-sm text-slate-500 flex items-center gap-2"><Mail size={14} className="text-slate-400" /> {c.email}</div>
                      {c.phone && <div className="text-sm text-slate-500 flex items-center gap-2"><MessageSquare size={14} className="text-slate-400" /> {c.phone}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {tab === 'tenants' && (
           <div className="space-y-4 max-w-3xl">
             {linkedSubs.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-2xl border border-dashed border-slate-300">
                  <Settings size={40} className="mx-auto text-slate-300 mb-4" />
                  <p className="font-bold text-slate-500 mb-2">No Deployments</p>
                  <p className="text-sm text-slate-400">This organization has no active SaaS instances.</p>
                </div>
             ) : linkedSubs.map((s:any) => (
                <div key={s.tenantId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between">
                  <div>
                    <div className="font-bold text-slate-800 text-[15px] mb-1">{s.tenantName}</div>
                    <code className="text-[10px] text-slate-400 bg-slate-50 px-2 py-1 rounded">{s.tenantId}</code>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                     <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{s.status}</span>
                     <span className="text-xs font-semibold text-slate-500">{s.planId} • {s.licensedSeats} seats</span>
                  </div>
                </div>
             ))}
           </div>
        )}
      </div>
      {confirm && <ConfirmDialog {...confirm} />}
    </div>
  );
}

// Minimal Contact forms to satisfy creating floating entities.
function NewContactForm({ orgs, onCreated, performer, onBack }: any) {
  const [nc, setNc] = useState({ name:'', email:'', role:'', phone:'', whatsapp:'', birthday:'', preferredName:'', preferredContactMethod:'email' as 'email' | 'phone' | 'whatsapp' | undefined, orgId:'', isPrimary:false, notes:'', tags:'', primaryTag:'', logoUrl:'' });
  const [loading, setLoading] = useState(false);
  const handleAdd = async (e: any) => {
    e.preventDefault(); setLoading(true);
    try {
      const parsedTags = nc.tags.split(',').map(t=>t.trim()).filter(Boolean);
      await createContact({ ...nc, tags: parsedTags, createdBy:performer.uid }, performer);
      onCreated();
    } catch(err) { toast.error('Failed'); } finally { setLoading(false); }
  }
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-6 flex items-center gap-3"><UserCircle2 className="text-emerald-500" /> New Contact</h1>
      <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
         <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <div className="col-span-2"><FieldLabel>Full Name *</FieldLabel><input required className="input w-full" value={nc.name} onChange={e=>setNc(p=>({...p,name:e.target.value}))}/></div>
            <div><FieldLabel>Preferred Name / Alias</FieldLabel><input className="input w-full" value={nc.preferredName} onChange={e=>setNc(p=>({...p,preferredName:e.target.value}))}/></div>
            <div><FieldLabel>Birthday</FieldLabel><input type="date" className="input w-full text-slate-500" value={nc.birthday} onChange={e=>setNc(p=>({...p,birthday:e.target.value}))}/></div>
            <div className="col-span-2"><FieldLabel>Email *</FieldLabel><input required type="email" className="input w-full" value={nc.email} onChange={e=>setNc(p=>({...p,email:e.target.value}))}/></div>
            <div className="col-span-2"><FieldLabel>Link to Organization (Optional)</FieldLabel>
              <select className="input w-full" value={nc.orgId} onChange={e=>setNc(p=>({...p,orgId:e.target.value}))}>
                <option value="">Unlinked (Floating Contact)</option>
                {orgs.map((o:any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="col-span-2"><FieldLabel>Role</FieldLabel><input className="input w-full" value={nc.role} onChange={e=>setNc(p=>({...p,role:e.target.value}))}/></div>
            <div><FieldLabel>Phone</FieldLabel><input className="input w-full" value={nc.phone} onChange={e=>setNc(p=>({...p,phone:e.target.value}))}/></div>
            <div><FieldLabel>WhatsApp</FieldLabel><input className="input w-full" value={nc.whatsapp} onChange={e=>setNc(p=>({...p,whatsapp:e.target.value}))}/></div>
            <div className="col-span-2"><FieldLabel>Notes</FieldLabel>
              <div className="border border-slate-200 mt-1 rounded-xl overflow-hidden bg-slate-50">
                <RichTextEditor value={nc.notes || ''} onChange={(html) => setNc(p => ({ ...p, notes: html }))} />
              </div>
            </div>
            <div className="col-span-2">
              <FieldLabel>Preferred Contact Method</FieldLabel>
              <select className="input w-full" value={nc.preferredContactMethod} onChange={e=>setNc(p=>({...p,preferredContactMethod:e.target.value as any}))}>
                <option value="email">Email</option>
                <option value="phone">Phone Call</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div><FieldLabel>Tags (Comma delimited)</FieldLabel><input className="input w-full" value={nc.tags} onChange={e=>setNc(p=>({...p,tags:e.target.value}))}/></div>
            <div><FieldLabel>Primary Tag</FieldLabel><input className="input w-full" value={nc.primaryTag} onChange={e=>setNc(p=>({...p,primaryTag:e.target.value}))}/></div>
            <div className="col-span-2"><FieldLabel>Logo URL</FieldLabel><input className="input w-full" value={nc.logoUrl} onChange={e=>setNc(p=>({...p,logoUrl:e.target.value}))} placeholder="https://..."/></div>
         </div>
         <div className="flex gap-4 mt-8">
            <button className="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--bg-canvas)] text-[var(--text-secondary)] shadow-sm border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] h-9 px-4 py-2" type="button" onClick={onBack}>Cancel</button>
            <button className="flex-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" type="submit" disabled={loading||!nc.name||!nc.email}>{loading?'Saving...':'Add Contact'}</button>
         </div>
      </form>
    </div>
  )
}

function ContactDetailView({ contact, orgs, onRefresh, performer, internalAddresses = [] }: any) {
  const org = orgs.find((o:any) => o.id === contact.orgId);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const { user, tenant } = useAuth();
  const { t } = useTranslation();
  const perms = user?.role ? ROLE_PERMISSIONS[user.role] : [];
  const canEditContact = perms.includes('contacts:write');
  const canDelContact = perms.includes('contacts:delete');
  const [viewModeAddr, setViewModeAddr] = useState<'list'|'kanban'>('list');
  const [viewModeIds, setViewModeIds] = useState<'list'|'kanban'>('list');
  const [viewModeRels, setViewModeRels] = useState<'list'|'kanban'>('list');

  const updateField = async (field: string, val: any) => {
    await updateContact(contact.id, { [field]: val });
    onRefresh();
  };

  const orgOpts = [{value:'',label:'Unlinked'}, ...orgs.map((o:any)=>({value:o.id,label:o.name}))];

  const updateArr = async (arrName: string, id: string, field: string, value: any, primaryKey?: string, syncKey?: string) => {
    const arr = [...(contact[arrName] || [])];
    const idx = arr.findIndex((x:any) => x.id === id);
    if (idx === -1) return;
    
    if (field === 'isPrimary' && value === true) {
       arr.forEach((x:any) => x.isPrimary = false);
    }
    arr[idx] = { ...arr[idx], [field]: value };
    
    const patch: any = { [arrName]: arr };
    // Synchronize to legacy root field if this item is marked primary or its value changed while it's primary.
    if (syncKey && primaryKey) {
       if (field === 'isPrimary' && value === true) {
          patch[syncKey] = arr[idx][primaryKey];
       } else if (field === primaryKey && arr[idx].isPrimary) {
          patch[syncKey] = value;
       }
    }
    await updateContact(contact.id, patch);
    onRefresh();
  };

  const addArr = async (arrName: string, defaultObj: any) => {
    const arr = [...(contact[arrName] || [])];
    const isFirst = arr.length === 0;
    const newObj = { ...defaultObj, id: crypto.randomUUID(), isPrimary: isFirst };
    
    const patch: any = { [arrName]: [...arr, newObj] };
    
    // Auto sync first item to root strings
    if (isFirst) {
      if (arrName === 'emails') patch['email'] = newObj.value;
      if (arrName === 'phones') patch['phone'] = newObj.value;
    }
    await updateContact(contact.id, patch);
    onRefresh();
  };
  
  const removeArr = async (arrName: string, id: string) => {
    const arr = (contact[arrName] || []).filter((x:any) => x.id !== id);
    await updateField(arrName, arr);
  };

  const copyOrgAddress = async () => {
    if (!org) return;
    const addrParts = [];
    if (org.invoiceAddress) addrParts.push(org.invoiceAddress);
    if (org.country) addrParts.push(org.country);
    
    const newAddr = {
      id: crypto.randomUUID(),
      street: addrParts.join(', '),
      number: '',
      city: '',
      state: '',
      zip: '',
      country: org.country || '',
      isPrimary: !(contact.addresses?.length)
    };
    await updateField('addresses', [...(contact.addresses || []), newAddr]);
  };

  // Sort primary first
  const emails = [...(contact.emails || [])].sort((a,b) => (b.isPrimary?1:0) - (a.isPrimary?1:0));
  const phones = [...(contact.phones || [])].sort((a,b) => (b.isPrimary?1:0) - (a.isPrimary?1:0));
  const addresses = [...(contact.addresses || [])].sort((a,b) => (b.isPrimary?1:0) - (a.isPrimary?1:0));
  const identifications = contact.identifications || [];
  const relationships = contact.relationships || [];

  const relOpts = useMemo(() => {
    const t: any = tenant;
    if (t?.customRelationshipTypes && t.customRelationshipTypes.length > 0) {
       return t.customRelationshipTypes.map((c: string) => ({ value: c, label: c }));
    }
    return [
      { value: 'Family Member', label: t('rel.family_member') as string },
      { value: 'Spouse', label: t('rel.spouse') as string },
      { value: 'Child', label: t('rel.child') as string },
      { value: 'Friend', label: t('rel.friend') as string },
      { value: 'Attorney', label: t('rel.attorney') as string },
      { value: 'Other', label: t('rel.other') as string },
    ];
  }, [(tenant as any)?.customRelationshipTypes, t]);

  return (
    <div className="p-8 max-w-[1200px] mx-auto h-full flex flex-col pt-0 overflow-y-auto">
       <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-200">
         <div className="flex gap-5 items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm w-full">
            <div className={`w-20 h-20 rounded-full shrink-0 flex justify-center items-center text-3xl font-black shadow-inner ${contact.isPrimary ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {contact.logoUrl ? <img src={contact.logoUrl} className="w-full h-full object-cover rounded-full" /> : contact.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-black text-slate-800 mb-1 border-b border-transparent inline-block">
                <InlineEdit value={contact.name} onSave={(v:string)=>updateField('name',v)} canEdit={canEditContact} />
              </h1>
              <div className="flex items-center gap-2 mb-2 font-semibold text-slate-500 flex-wrap">
                 <InlineEdit value={contact.role} onSave={(v:string)=>updateField('role',v)} canEdit={canEditContact} /> 
                 <span className="text-slate-300">•</span>
                 <InlineEdit value={contact.orgId} onSave={(v:string)=>updateField('orgId',v)} selectOptions={orgOpts} canEdit={canEditContact} /> 
                 {contact.isPrimary && <span className="ml-2 font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-widest bg-emerald-100 text-emerald-700">Primary</span>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
               {canDelContact && <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 disabled:pointer-events-none disabled:opacity-50 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 shadow-sm h-8 px-3 py-1.5" onClick={() => {
                  setConfirm({
                    title: 'Delete Contact',
                    message: 'Are you sure you want to delete this contact permanently? This action cannot be undone.',
                    variant: 'danger',
                    confirmLabel: 'Delete',
                    onConfirm: async () => { await deleteContact(contact.id); onRefresh(); },
                    onCancel: () => setConfirm(null)
                  });
               }}><Trash2 size={14} className="text-red-500" /> Delete</button>}
            </div>
         </div>
       </div>

       <div className="w-full">
         <div className="inline-flex h-9 flex-wrap gap-2 items-center justify-start rounded-lg bg-[var(--bg-muted)] text-[var(--text-tertiary)] mb-6">
           <button className="inline-flex items-center gap-2 justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50"><UserCircle2 size={16} className="inline"/> Overview</button>
           <button className="inline-flex items-center gap-2 justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50"><MapPin size={16} className="inline"/> Addresses ({addresses.length})</button>
           <button className="inline-flex items-center gap-2 justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50"><Archive size={16} className="inline"/> Identifications ({identifications.length})</button>
           <button className="inline-flex items-center gap-2 justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-50"><Building2 size={16} className="inline"/> Relationships ({relationships.length})</button>
         </div>
         <div className="mt-2">
            <div className="mt-2 ring-offset-background">
               <div className="grid grid-cols-3 gap-6 animate-fade-in">
                 <div className="col-span-1 space-y-6">
                   <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                      <h3 className="text-sm font-extrabold text-slate-400 tracking-wider uppercase mb-2">Basic Info</h3>
                      <div className="text-sm text-slate-600 space-y-3">
                         <div className="flex items-center"><strong className="w-24 block text-slate-500 text-xs uppercase tracking-wider">Authority</strong> {canEditContact ? <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 rounded" checked={contact.isPrimary||false} onChange={e=>updateField('isPrimary',e.target.checked)} /> Primary Exec</label> : <span>{contact.isPrimary?'Primary':'Standard'}</span>}</div>
                         <div className="flex items-center"><strong className="w-24 block text-slate-500 text-xs uppercase tracking-wider">Pref. Name</strong> <div className="font-medium text-slate-800"><InlineEdit value={contact.preferredName} onSave={(v:string)=>updateField('preferredName',v)} canEdit={canEditContact} /></div></div>
                         <div className="flex items-center"><strong className="w-24 block text-slate-500 text-xs uppercase tracking-wider">Birthday</strong> <div className="font-medium text-slate-800"><InlineEdit type="date" value={contact.birthday} onSave={(v:string)=>updateField('birthday',v)} canEdit={canEditContact} /></div></div>
                         <div className="flex items-center"><strong className="w-24 block text-slate-500 text-xs uppercase tracking-wider">Channel</strong> <div className="font-medium text-slate-800"><InlineEdit value={contact.preferredContactMethod || 'email'} selectOptions={[{value:'email',label:'Email'},{value:'phone',label:'Phone Call'},{value:'whatsapp',label:'WhatsApp'}]} onSave={(v:string)=>updateField('preferredContactMethod',v)} canEdit={canEditContact} /></div></div>
                         <div className="mt-4 border-t border-slate-100 pt-4">
                            <strong className="block text-slate-500 text-xs uppercase tracking-wider mb-2">Profile Notes</strong> 
                            <div className="w-full"><InlineEdit textClass="block w-full" type="richtext" value={contact.notes} onSave={(v:string)=>updateField('notes',v)} canEdit={canEditContact} /></div>
                         </div>
                      </div>
                   </div>
                 </div>
                 
                 <div className="col-span-2 space-y-6">
                   <div className="grid grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                         <h3 className="text-sm font-extrabold text-slate-400 tracking-wider uppercase mb-2 flex justify-between items-center">
                            <span>Emails</span>
                            {canEditContact && <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)] border border-slate-200 shadow-sm h-7 px-2.5 py-1" onClick={()=>addArr('emails', {value:''})}><Plus size={14}/> Add</button>}
                         </h3>
                         {emails.length === 0 && <div className="text-xs text-slate-400 italic">No emails configured.</div>}
                         {emails.map(e => (
                            <div key={e.id} className={`flex items-start gap-3 p-3 rounded-xl border ${e.isPrimary ? 'border-brand-200 bg-brand-50/30' : 'border-slate-100 bg-slate-50'}`}>
                               <Mail size={16} className={e.isPrimary ? 'text-brand-500 mt-1' : 'text-slate-400 mt-1'} />
                               <div className="flex-1 w-full overflow-hidden">
                                  <div className="font-bold text-slate-800"><InlineEdit value={e.value} onSave={(v:string)=>updateArr('emails', e.id, 'value', v, 'value', 'email')} canEdit={canEditContact} placeholder="user@domain.com" /></div>
                                  <div className="flex gap-4 mt-2">
                                     <button onClick={() => updateArr('emails', e.id, 'isPrimary', true, 'value', 'email')} className={`text-[10px] font-black uppercase tracking-widest ${e.isPrimary ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}>{e.isPrimary ? '★ Primary' : 'Set Primary'}</button>
                                     <button onClick={() => removeArr('emails', e.id)} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-500">Remove</button>
                                  </div>
                               </div>
                            </div>
                         ))}
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                         <h3 className="text-sm font-extrabold text-slate-400 tracking-wider uppercase mb-2 flex justify-between items-center">
                            <span>Phone Numbers</span>
                            {canEditContact && <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)] border border-slate-200 shadow-sm h-7 px-2.5 py-1" onClick={()=>addArr('phones', {type:'Tel', value:''})}><Plus size={14}/> Add</button>}
                         </h3>
                         {phones.length === 0 && <div className="text-xs text-slate-400 italic">No phones configured.</div>}
                         {phones.map(p => (
                            <div key={p.id} className={`flex items-start gap-3 p-3 rounded-xl border ${p.isPrimary ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100 bg-slate-50'}`}>
                               {p.type === 'WhatsApp' ? <MessageSquare size={16} className={p.isPrimary ? 'text-emerald-500 mt-1' : 'text-slate-400 mt-1'} /> : <Phone size={16} className={p.isPrimary ? 'text-emerald-500 mt-1' : 'text-slate-400 mt-1'} /> }
                               <div className="flex-1 w-full overflow-hidden">
                                  <div className="flex items-center gap-2 mb-1">
                                     <span className="bg-white border-slate-200 border rounded px-1 text-[10px] font-bold"><InlineEdit selectOptions={[{value:'Tel',label:'Tel'},{value:'Cel',label:'Cel'},{value:'WhatsApp',label:'WhatsApp'}]} value={p.type} onSave={(v:any)=>updateArr('phones', p.id, 'type', v)} canEdit={canEditContact} /></span>
                                  </div>
                                  <div className="font-bold text-slate-800"><InlineEdit value={p.value} onSave={(v:string)=>updateArr('phones', p.id, 'value', v, 'value', 'phone')} canEdit={canEditContact} placeholder="+1 555-0000" /></div>
                                  <div className="flex gap-4 mt-2">
                                     <button onClick={() => updateArr('phones', p.id, 'isPrimary', true, 'value', 'phone')} className={`text-[10px] font-black uppercase tracking-widest ${p.isPrimary ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}>{p.isPrimary ? '★ Primary' : 'Set Primary'}</button>
                                     <button onClick={() => removeArr('phones', p.id)} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-500">Remove</button>
                                  </div>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                 </div>
               </div>
            </div>

            <div className="mt-2 ring-offset-background">
               <div className="animate-fade-in space-y-6">
                 <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-extrabold text-slate-400 tracking-wider uppercase">Saved Addresses</h3>
                    <div className="flex gap-3">
                       <div className="flex bg-slate-100 rounded-lg p-0.5">
                         <button onClick={()=>setViewModeAddr('list')} className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-extrabold transition-all duration-300 ${viewModeAddr==='list'?'bg-white shadow text-slate-800 shadow-sm ring-1 ring-slate-900/5':'text-slate-400 hover:text-slate-600'}`}>List</button>
                         <button onClick={()=>setViewModeAddr('kanban')} className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-extrabold transition-all duration-300 ${viewModeAddr==='kanban'?'bg-white shadow text-slate-800 shadow-sm ring-1 ring-slate-900/5':'text-slate-400 hover:text-slate-600'}`}>Card</button>
                       </div>
                       {org && <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm h-8 px-3 py-1.5" onClick={copyOrgAddress}><Building2 size={14}/> Copy from Org</button>}
                       <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-8 px-3 py-1.5" onClick={()=>addArr('addresses', {street:'', number:'', city:'', state:'', zip:'', country:''})}><Plus size={14}/> Add Address</button>
                    </div>
                 </div>
                 {addresses.length === 0 && <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-slate-300"><MapPin size={40} className="mx-auto text-slate-300 mb-4" /><p className="font-medium text-slate-500">No addresses linked.</p></div>}
                 
                 <div className={`max-h-[350px] overflow-y-auto pr-2 custom-scrollbar ${viewModeAddr === 'kanban' ? 'grid grid-cols-2 gap-4' : 'flex flex-col gap-2'}`}>
                    {addresses.map((a:any) => 
                       viewModeAddr === 'kanban' ? (
                       <div key={a.id} className={`bg-white p-6 rounded-3xl border ${a.isPrimary ? 'border-brand-300 shadow-md ring-1 ring-brand-500/10' : 'border-slate-200 shadow-sm'} flex flex-col gap-4 relative group`}>
                          {a.isPrimary && <div className="absolute -top-3 -right-3 bg-brand-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-md">Primary</div>}
                          
                          <div className="w-full relative min-h-[40px] z-10">
                              <AddressAutocomplete 
                                  value={a} 
                                  onSave={(v:any) => { const merged = { ...a, ...v }; updateField('addresses', addresses.map((old:any) => old.id === a.id ? merged : old)); }} 
                                  canEdit={canEditContact} 
                                  internalAddresses={internalAddresses} 
                              />
                          </div>
                          
                          <div className="flex gap-4 justify-end mt-2 pt-4 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                             {!a.isPrimary && <button onClick={() => updateArr('addresses', a.id, 'isPrimary', true)} className="text-xs font-black uppercase tracking-widest text-brand-600 hover:text-brand-700">Set as Primary</button>}
                             <button onClick={() => removeArr('addresses', a.id)} className="text-xs font-black uppercase tracking-widest text-red-500 hover:text-red-600">Delete</button>
                          </div>
                       </div>
                       ) : (
                       <div key={a.id} className={`bg-white px-2 py-2 rounded-xl border ${a.isPrimary ? 'border-brand-300 bg-brand-50/50 ring-1 ring-brand-500/10' : 'border-slate-200'} flex items-center gap-3 relative group text-sm shadow-sm transition-all hover:border-slate-300`}>
                          <div className="w-8 flex-shrink-0 flex justify-center">{a.isPrimary ? <span className="text-[10px] bg-brand-500 text-white font-black px-2 py-0.5 rounded-full">PRI</span> : <MapPin size={14} className="text-slate-300"/>}</div>
                          <div className="flex-1 min-w-0">
                               <AddressAutocomplete 
                                  value={a} 
                                  onSave={(v:any) => { const merged = { ...a, ...v }; updateField('addresses', addresses.map((old:any) => old.id === a.id ? merged : old)); }} 
                                  canEdit={canEditContact} 
                                  internalAddresses={internalAddresses} 
                              />
                          </div>
                          <div className="flex gap-2 flex-shrink-0 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             {!a.isPrimary && <button onClick={() => updateArr('addresses', a.id, 'isPrimary', true)} className="text-[10px] font-black uppercase tracking-widest text-brand-600 hover:text-brand-700">Set Pri</button>}
                             <button onClick={() => removeArr('addresses', a.id)} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600">Del</button>
                          </div>
                       </div>
                       )
                    )}
                 </div>
               </div>
            </div>

            <div className="mt-2 ring-offset-background">
               <div className="animate-fade-in space-y-6">
                 <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-extrabold text-slate-400 tracking-wider uppercase">Identifications</h3>
                    <div className="flex gap-3">
                       <div className="flex bg-slate-100 rounded-lg p-0.5">
                         <button onClick={()=>setViewModeIds('list')} className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-extrabold transition-all duration-300 ${viewModeIds==='list'?'bg-white shadow text-slate-800 shadow-sm ring-1 ring-slate-900/5':'text-slate-400 hover:text-slate-600'}`}>List</button>
                         <button onClick={()=>setViewModeIds('kanban')} className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-extrabold transition-all duration-300 ${viewModeIds==='kanban'?'bg-white shadow text-slate-800 shadow-sm ring-1 ring-slate-900/5':'text-slate-400 hover:text-slate-600'}`}>Card</button>
                       </div>
                       <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-8 px-3 py-1.5" onClick={()=>addArr('identifications', {idType:'CPF', value:'', issueDate:'', expirationDate:'', country:'Brazil'})}><Plus size={14}/> Add Document</button>
                    </div>
                 </div>
                 {identifications.length === 0 && <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-slate-300"><Archive size={40} className="mx-auto text-slate-300 mb-4" /><p className="font-medium text-slate-500">No IDs documented.</p></div>}
                 
                 <div className={`max-h-[350px] overflow-y-auto pr-2 custom-scrollbar ${viewModeIds === 'kanban' ? 'grid grid-cols-2 gap-4' : 'flex flex-col gap-2'}`}>
                    {identifications.map((i:any) => 
                       viewModeIds === 'kanban' ? (
                       <div key={i.id} className="bg-white px-6 py-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4 relative group">
                          <div className="flex justify-between w-full pb-3 border-b border-slate-100 items-center">
                             <div className="font-black text-slate-800 bg-slate-100 px-3 py-1 rounded text-sm"><InlineEdit selectOptions={[{value:'CPF',label:'CPF'},{value:'RG',label:'RG'},{value:'NIF',label:'NIF / Tax ID'},{value:'Passport',label:'Passport'},{value:'Driver License',label:'Driver License'}]} value={i.idType} onSave={(v:string)=>updateArr('identifications', i.id, 'idType', v)} canEdit={canEditContact} /></div>
                             <div className="font-black text-slate-400 text-[10px] uppercase tracking-widest"><InlineEdit value={i.country} onSave={(v:string)=>updateArr('identifications', i.id, 'country', v)} canEdit={canEditContact} placeholder="Country" /></div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                            <div className="col-span-2"><FieldLabel>Number / Value</FieldLabel><div className="font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100"><InlineEdit value={i.value} onSave={(v:string)=>updateArr('identifications', i.id, 'value', v)} canEdit={canEditContact} placeholder="e.g. 123.456.789-00" /></div></div>
                            <div className="col-span-1"><FieldLabel>Issue Date</FieldLabel><div className="font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100"><InlineEdit type="date" value={i.issueDate} onSave={(v:string)=>updateArr('identifications', i.id, 'issueDate', v)} canEdit={canEditContact} /></div></div>
                            <div className="col-span-1"><FieldLabel>Expiration</FieldLabel><div className="font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100"><InlineEdit type="date" value={i.expirationDate} onSave={(v:string)=>updateArr('identifications', i.id, 'expirationDate', v)} canEdit={canEditContact} /></div></div>
                          </div>
                          
                          <div className="flex gap-4 justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => removeArr('identifications', i.id)} className="text-xs font-black uppercase tracking-widest text-red-500 hover:text-red-600">Remove</button>
                          </div>
                       </div>
                       ) : (
                       <div key={i.id} className="bg-white px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-4 relative group text-sm shadow-sm transition-all hover:border-slate-300 overflow-hidden">
                          <div className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] whitespace-nowrap"><InlineEdit selectOptions={[{value:'CPF',label:'CPF'},{value:'RG',label:'RG'},{value:'NIF',label:'NIF / Tax ID'},{value:'Passport',label:'Passport'},{value:'Driver License',label:'Driver License'}]} value={i.idType} onSave={(v:string)=>updateArr('identifications', i.id, 'idType', v)} canEdit={canEditContact} /></div>
                          <div className="font-bold text-slate-700 w-1/4 truncate"><InlineEdit value={i.value} onSave={(v:string)=>updateArr('identifications', i.id, 'value', v)} canEdit={canEditContact} placeholder="Doc Number" /></div>
                          <div className="font-bold text-slate-500 text-[11px] w-1/6 truncate"><InlineEdit value={i.country} onSave={(v:string)=>updateArr('identifications', i.id, 'country', v)} canEdit={canEditContact} placeholder="Country" /></div>
                          <div className="font-bold text-slate-700 flex-1 truncate text-xs flex gap-2">
                             <span className="text-slate-400">Iss:</span> <InlineEdit type="date" value={i.issueDate} onSave={(v:string)=>updateArr('identifications', i.id, 'issueDate', v)} canEdit={canEditContact} />
                             <span className="text-slate-300">|</span>
                             <span className="text-slate-400">Exp:</span> <InlineEdit type="date" value={i.expirationDate} onSave={(v:string)=>updateArr('identifications', i.id, 'expirationDate', v)} canEdit={canEditContact} />
                          </div>
                          <div className="flex flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => removeArr('identifications', i.id)} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 bg-red-50 px-2 py-1 rounded">Del</button>
                          </div>
                       </div>
                       )
                    )}
                 </div>
               </div>
            </div>

            <div className="mt-2 ring-offset-background">
               <div className="animate-fade-in space-y-6">
                 <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-extrabold text-slate-400 tracking-wider uppercase">Relationships</h3>
                    <div className="flex gap-3">
                       <div className="flex bg-slate-100 rounded-lg p-0.5">
                         <button onClick={()=>setViewModeRels('list')} className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-extrabold transition-all duration-300 ${viewModeRels==='list'?'bg-white shadow text-slate-800 shadow-sm ring-1 ring-slate-900/5':'text-slate-400 hover:text-slate-600'}`}>List</button>
                         <button onClick={()=>setViewModeRels('kanban')} className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-extrabold transition-all duration-300 ${viewModeRels==='kanban'?'bg-white shadow text-slate-800 shadow-sm ring-1 ring-slate-900/5':'text-slate-400 hover:text-slate-600'}`}>Card</button>
                       </div>
                       <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-8 px-3 py-1.5" onClick={()=>addArr('relationships', {name:'', type:'Family Member', isNoCrm:true})}><Plus size={14}/> Add Connection</button>
                    </div>
                 </div>
                 {relationships.length === 0 && <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-slate-300"><UserCircle2 size={40} className="mx-auto text-slate-300 mb-4" /><p className="font-medium text-slate-500">No relationships mapped.</p></div>}
                 
                 <div className={`max-h-[350px] overflow-y-auto pr-2 custom-scrollbar ${viewModeRels === 'kanban' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'flex flex-col gap-2'}`}>
                    {relationships.map((r:any) => 
                       viewModeRels === 'kanban' ? (
                       <div key={r.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col relative group gap-4">
                          <div className="flex justify-between items-start">
                             <div className="text-xs uppercase font-black tracking-widest text-indigo-400"><InlineEdit selectOptions={relOpts} value={r.type} onSave={(v:string)=>updateArr('relationships', r.id, 'type', v)} canEdit={canEditContact} /></div>
                             <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                               <input type="checkbox" className="w-3 h-3 text-slate-400" checked={r.isNoCrm||false} onChange={e=>updateArr('relationships', r.id, 'isNoCrm', e.target.checked)} /> Not in CRM
                             </label>
                          </div>
                          
                          <div><FieldLabel>Name</FieldLabel><div className="font-bold text-slate-800 text-lg bg-slate-50 px-3 py-2 rounded-lg border border-slate-100"><InlineEdit value={r.name} onSave={(v:string)=>updateArr('relationships', r.id, 'name', v)} canEdit={canEditContact} placeholder="Full Name" /></div></div>
                          
                          {!r.isNoCrm && (
                            <div>
                               <FieldLabel>Link to CRM Contact</FieldLabel>
                               <div className="font-bold text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-200/50 mt-1">
                                 {/* Simple input masquerading as CRM link since we don't have a giant dropdown context passed here out of the box, but realistically we could use an input with ID */}
                                 <InlineEdit value={r.crmContactId} onSave={(v:string)=>updateArr('relationships', r.id, 'crmContactId', v)} canEdit={canEditContact} placeholder="Enter Contact ID or Name Reference..." />
                               </div>
                            </div>
                          )}
                          
                          <div>
                             <FieldLabel>Notes / Background</FieldLabel>
                             <div className="mt-1 border border-slate-200 rounded-xl bg-slate-50 max-h-[200px] overflow-y-auto">
                               <RichTextEditor value={r.notes || ''} onChange={(html) => updateArr('relationships', r.id, 'notes', html)} />
                             </div>
                          </div>
                          
                          <div className="flex gap-4 justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => removeArr('relationships', r.id)} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600">Remove Connection</button>
                          </div>
                       </div>
                       ) : (
                       <div key={r.id} className="bg-white px-3 py-2 rounded-xl border border-slate-200 flex flex-col gap-2 relative group text-sm shadow-sm transition-all hover:border-slate-300 overflow-hidden">
                          <div className="flex items-center gap-4 w-full">
                             <div className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px] whitespace-nowrap"><InlineEdit selectOptions={relOpts} value={r.type} onSave={(v:string)=>updateArr('relationships', r.id, 'type', v)} canEdit={canEditContact} /></div>
                             <div className="font-bold text-slate-800 w-1/3 truncate"><InlineEdit value={r.name} onSave={(v:string)=>updateArr('relationships', r.id, 'name', v)} canEdit={canEditContact} placeholder="Full Name" /></div>
                             
                             <div className="flex-1 flex items-center gap-3">
                                <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded">
                                  <input type="checkbox" className="w-3 h-3 text-slate-400 rounded" checked={r.isNoCrm||false} onChange={e=>updateArr('relationships', r.id, 'isNoCrm', e.target.checked)} /> No CRM
                                </label>
                                {!r.isNoCrm && (
                                  <div className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded w-full truncate border border-indigo-100/50">
                                    <InlineEdit value={r.crmContactId} onSave={(v:string)=>updateArr('relationships', r.id, 'crmContactId', v)} canEdit={canEditContact} placeholder="Enter Contact ID..." />
                                  </div>
                                )}
                             </div>
                             <div className="flex flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => removeArr('relationships', r.id)} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 bg-red-50 px-2 py-1 rounded">Del</button>
                             </div>
                          </div>
                          <div className="mt-1 border border-slate-200 rounded-md min-h-[50px] w-full max-h-[150px] overflow-y-auto">
                             <RichTextEditor value={r.notes || ''} onChange={(html) => updateArr('relationships', r.id, 'notes', html)} />
                          </div>
                       </div>

                       )
                    )}
                 </div>
               </div>
            </div>
         </div>
       </div>
       {confirm && <ConfirmDialog {...confirm} />}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT PLAN DOCK
// ─────────────────────────────────────────────────────────────────────────────
function AccountPlanDock({ org, updateField, canEditOrg, performer, activeTab, employees=[] }: any) {
  const [plans, setPlans] = useState<AccountPlan[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAccountPlansForOrg(org.id).then(res => {
      setPlans(res); setLoading(false);
    });
  }, [org.id]);

  const currentPlan = plans.find(p => p.isCurrent);
  const archivedPlans = plans.filter(p => !p.isCurrent);

  const startNewPlan = async () => {
    setLoading(true);
    await createAccountPlan(org.id, {
      title: 'Strategic Account Plan',
      period: 'quarterly',
      executiveSummary: 'New strategic plan initialized. Awaiting executive summary...',
      goals: '- Goal 1:\n- Goal 2:',
    }, performer);
    const updated = await getAccountPlansForOrg(org.id);
    setPlans(updated);
    setLoading(false);
  };

  const updatePlanInfo = async (field: keyof AccountPlan, value: any) => {
    if (!currentPlan) return;
    await updateAccountPlan(currentPlan.id, { [field]: value });
    setPlans(plans.map(p => p.id === currentPlan.id ? { ...p, [field]: value } : p));
  };

  const markReviewed = async (reviewerUid?: string) => {
    if (!currentPlan) return;
    const now = new Date().toISOString();
    let reviewerName = performer.displayName || 'Manager';
    let targetUid = performer.uid;

    if (reviewerUid) {
      const emp = employees.find((e:any) => e.uid === reviewerUid);
      if (emp) {
         reviewerName = emp.displayName || emp.email;
         targetUid = emp.uid;
      }
    }

    await updateAccountPlan(currentPlan.id, {
      reviewDate: now,
      reviewerUid: targetUid,
      reviewerName,
    }, performer);
    setPlans(plans.map(p => p.id === currentPlan.id ? { ...p, reviewDate: now, reviewerUid: targetUid, reviewerName } : p));
  };

  const handleRecall = async (planToRecall: AccountPlan) => {
    setLoading(true);
    await createAccountPlan(org.id, {
      title: planToRecall.title || `V${planToRecall.version} Recalled`,
      period: planToRecall.period,
      executiveSummary: planToRecall.executiveSummary,
      goals: planToRecall.goals,
    }, performer);
    const updated = await getAccountPlansForOrg(org.id);
    setPlans(updated);
    setLoading(false);
  };

  return (
    <div className="w-full">

      {activeTab === 'background' && (
         <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[400px] animate-fade-in">
            <h3 className="text-sm font-extrabold text-slate-400 tracking-wider uppercase mb-5 flex items-center gap-2"><LayoutGrid size={16} /> Historical Context</h3>
            <div className="w-full"><InlineEdit textClass="block w-full" type="richtext" value={org.notes||''} onSave={(v:string)=>updateField('notes',v)} canEdit={canEditOrg} /></div>
         </div>
      )}

      {activeTab === 'plan' && (
         <div className="bg-white rounded-3xl border border-slate-200 shadow-sm min-h-[400px] flex overflow-hidden animate-fade-in">
            <div className="flex-1 p-6 md:p-8 border-r border-slate-100 flex flex-col relative w-full overflow-hidden">
               {loading && <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm shadow-inner"><div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" /></div>}
               
               <div className="flex items-center justify-between mb-8 w-full border-b border-slate-100 pb-5">
                 <div className="flex flex-wrap items-center gap-8">
                   <div>
                     <h3 className="text-[11px] font-black text-indigo-400 tracking-widest uppercase mb-1">Active Flight Plan</h3>
                     <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 border-b border-transparent">
                       {currentPlan ? (
                         <InlineEdit 
                            value={currentPlan.title || `Version ${currentPlan.version}`} 
                            onSave={(v:string) => updatePlanInfo('title', v)} 
                            canEdit={canEditOrg}
                         />
                       ) : 'No Active Plan'}
                       {currentPlan && <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold shadow-sm ${currentPlan.reviewDate ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>{currentPlan.reviewDate ? 'Reviewed' : 'Pending Review'}</span>}
                     </h2>
                   </div>
                   
                   {currentPlan && (
                     <div className="flex items-center gap-4">
                       <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 min-w-[150px]">
                         <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5 flex items-center shrink-0 w-full"><Archive size={12} className="mr-1.5 inline"/> Period / Cadence</div>
                         <div className="font-bold text-slate-700 text-sm flex items-center h-6">
                           <InlineEdit selectOptions={[{value:'monthly',label:'Monthly'},{value:'quarterly',label:'Quarterly'},{value:'semi_annual',label:'Semi-Annual'},{value:'annual',label:'Annual'}]} value={currentPlan.period} onSave={(v:any)=>updatePlanInfo('period',v)} canEdit={canEditOrg} />
                         </div>
                       </div>
                       <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 min-w-[150px]">
                         <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Last Modification</div>
                         <div className="font-bold text-slate-700 text-sm flex items-center h-6">{new Date(currentPlan.updatedAt).toLocaleDateString()}</div>
                       </div>
                       <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 min-w-[150px]">
                         <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Sign Off</div>
                         {currentPlan.reviewDate ? (
                           <div className="font-bold text-emerald-600 text-[13px] flex flex-col justify-center h-6 max-w-[140px] overflow-hidden truncate">
                             <span title={currentPlan.reviewerName}>✓ {currentPlan.reviewerName}</span>
                             <span className="text-[9px] text-emerald-500/80 font-medium ml-3">{new Date(currentPlan.reviewDate).toLocaleDateString()}</span>
                           </div>
                         ) : (
                           <select 
                             className="text-sm font-bold text-indigo-500 hover:text-indigo-600 transition-colors h-6 bg-transparent border-none p-0 cursor-pointer outline-none block w-full appearance-none"
                             value=""
                             onChange={(e) => markReviewed(e.target.value)}
                           >
                             <option value="" disabled>Pending Sign-Off...</option>
                             <option value={performer.uid}>Sign off as myself</option>
                             {employees.length > 0 && <optgroup label="HR Team">
                               {employees.map((e:any, idx: number) => {
                                 const eKey = e.uid || e.id || `e-${idx}`;
                                 return <option key={eKey} value={eKey}>{e.displayName || e.email || e.name || 'Unknown'}</option>;
                               })}
                             </optgroup>}
                           </select>
                         )}
                       </div>
                     </div>
                   )}
                 </div>

                 <div className="shrink-0 ml-4">
                   {currentPlan ? (
                      <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm truncate h-8 px-3 py-1.5" onClick={startNewPlan}><Plus size={14}/> New Version</button>
                   ) : (
                      <button className="inline-flex items-center gap-1.5 justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)] shadow-lg shadow-indigo-500/20 h-9 px-4 py-2" onClick={startNewPlan}><Plus size={14}/> Generate First Plan</button>
                   )}
                 </div>
               </div>

               {currentPlan ? (
                 <div className="flex flex-col gap-8 flex-1 w-full max-w-full overflow-hidden">

                    <div className="w-full max-w-full">
                       <h4 className="text-[11px] font-black tracking-widest uppercase text-slate-400 mb-3 border-b border-slate-100 pb-2 flex justify-between w-full">Executive Summary</h4>
                       <div className="w-full"><InlineEdit textClass="block w-full max-w-full" type="richtext" value={currentPlan.executiveSummary} onSave={(v:any)=>updatePlanInfo('executiveSummary',v)} canEdit={canEditOrg} /></div>
                    </div>

                    <div className="w-full max-w-full">
                       <h4 className="text-[11px] font-black tracking-widest uppercase text-slate-400 mb-3 border-b border-slate-100 pb-2">Strategic Goals</h4>
                       <div className="w-full"><InlineEdit textClass="block w-full max-w-full" type="richtext" value={currentPlan.goals} onSave={(v:any)=>updatePlanInfo('goals',v)} canEdit={canEditOrg} /></div>
                    </div>
                 </div>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-slate-400 italic">No account plans have been generated yet.</div>
               )}
            </div>
            
            <div className="w-[30%] bg-slate-50/50 p-6 flex flex-col max-h-[800px] overflow-y-auto">
               <h3 className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-4 sticky top-0 bg-slate-50/50 pt-2 pb-2">Archived Registry ({archivedPlans.length})</h3>
               <div className="flex flex-col gap-3 w-full">
                  {archivedPlans.length === 0 && <div className="text-xs text-slate-400 italic text-center py-10 w-full">No historical records.</div>}
                  {archivedPlans.map(p => (
                     <div key={p.id} className="bg-white border text-left border-slate-200 rounded-xl p-3 flex flex-col w-full shadow-sm">
                        <div className="flex justify-between items-center mb-1 w-full relative">
                           <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider truncate mb-1" title={p.title||`v${p.version}`}>
                             {p.title || `VERSION ${p.version}`} • {p.period}
                           </span>
                           <span className="text-[10px] text-slate-400 font-bold shrink-0">{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs text-slate-500 line-clamp-2" title={p.executiveSummary}>{p.executiveSummary}</div>
                        
                        {canEditOrg && (
                          <div className="mt-3 flex justify-end w-full border-t border-slate-100 pt-2">
                             <button onClick={() => handleRecall(p)} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 uppercase tracking-widest bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded w-full text-center transition-colors">
                               Recall for New Edition
                             </button>
                          </div>
                        )}
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
