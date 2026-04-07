'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Search, X, Users, Landmark, FileText, BadgeDollarSign, Scale, Lock, ShieldCheck, Map, Search as SearchIcon, Umbrella, Ruler, Handshake, Heart, Sprout, Pin, Building } from 'lucide-react';
import { Select, SelectItem } from '@tremor/react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Organization {
 id: string;
 name: string;
 type: string;
 jurisdiction?: string;
 linkedFamilyIds: string[];
 linkedFamilyNames: string[];
 linkedContactIds: string[];
 linkedContactNames: string[];
 linkedOrgIds?: string[];
 linkedOrgNames?: string[];
 status?: string;
 aum?: number;
 currency?: string;
 notes?: string;
 createdAt?: string;
}

const ORG_TYPES = [
  'family_group', 'financial_institution', 'accountant', 'tax_consultant', 'lawyer',
  'trustee', 'fiduciary_admin', 'offshore_admin', 'corporate_provider', 'auditor',
  'insurance_company', 'insurance_consultant', 'real_estate_admin', 'appraiser',
  'governance_consultant', 'philanthropic_consultant', 'foundation', 'other'
];

const TYPE_LABELS: Record<string, string> = {
  family_group: 'Grupo Familiar',
  financial_institution: 'Instituição Financeira',
  accountant: 'Contador',
  tax_consultant: 'Consultor Tributário',
  lawyer: 'Advogado',
  trustee: 'Trustee',
  fiduciary_admin: 'Administrador Fiduciário',
  offshore_admin: 'Administrador Offshore',
  corporate_provider: 'Provedor Corporativo',
  auditor: 'Auditor',
  insurance_company: 'Seguradora',
  insurance_consultant: 'Consultor de Seguros',
  real_estate_admin: 'Administrador Imobiliário',
  appraiser: 'Avaliador',
  governance_consultant: 'Consultor de Governança',
  philanthropic_consultant: 'Consultor Filantrópico',
  foundation: 'Fundação',
  other: 'Outros'
};

const TYPE_COLORS: Record<string, string> = {
  family_group: 'indigo',
  financial_institution: 'blue',
  accountant: 'emerald',
  tax_consultant: 'teal',
  lawyer: 'amber',
  trustee: 'violet',
  fiduciary_admin: 'fuchsia',
  offshore_admin: 'cyan',
  corporate_provider: 'slate',
  auditor: 'zinc',
  insurance_company: 'rose',
  insurance_consultant: 'pink',
  real_estate_admin: 'orange',
  appraiser: 'yellow',
  governance_consultant: 'sky',
  philanthropic_consultant: 'lime',
  foundation: 'emerald',
  other: 'slate'
};

const TYPE_ICONS: Record<string, any> = {
  family_group: Users, 
  financial_institution: Landmark, 
  accountant: FileText, 
  tax_consultant: BadgeDollarSign, 
  lawyer: Scale,
  trustee: Lock, 
  fiduciary_admin: ShieldCheck, 
  offshore_admin: Map, 
  corporate_provider: Building2, 
  auditor: SearchIcon,
  insurance_company: Umbrella, 
  insurance_consultant: Umbrella, 
  real_estate_admin: Building, 
  appraiser: Ruler,
  governance_consultant: Handshake, 
  philanthropic_consultant: Heart, 
  foundation: Sprout, 
  other: Pin
};

// ─── Create org drawer ────────────────────────────────────────────────────────

function CreateOrgDrawer({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
 const [form, setForm] = useState({ name: '', type: 'family_group', jurisdiction: '', notes: '', status: 'active' });
 const [saving, setSaving] = useState(false);

 const valid = form.name.trim().length > 0;

 async function handleSave(e?: React.FormEvent) {
 if (e) e.preventDefault();
 if (!valid || saving) return;
 setSaving(true);
 try {
 await addDoc(collection(db, 'tenants', tenantId, 'organizations'), {
 ...form,
 linkedFamilyIds: [], linkedFamilyNames: [],
 linkedContactIds: [], linkedContactNames: [],
 linkedOrgIds: [], linkedOrgNames: [],
 createdAt: new Date().toISOString(),
 });
 onClose();
 } catch (e) { console.error(e); }
 finally { setSaving(false); }
 }

 return (
 <div className="fixed inset-0 z-50 flex justify-end">
 <div onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
 <div className="w-[480px] bg-white border-l border-slate-200 flex flex-col h-full shadow-2xl relative z-10 animate-fade-in-right">
 <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50 shrink-0">
 <div>
 <h3 className="text-macro" style={{ fontSize: 20 }}>New Organization</h3>
 <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Register a new trust, fund, or legal entity</p>
 </div>
 <button type="button" onClick={onClose} className="btn btn-ghost btn-sm p-2 -mr-2" aria-label="Close">
 <X size={20} />
 </button>
 </div>
 
 <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
 <div className="flex flex-col gap-2">
 <span className="text-micro font-bold text-slate-800">Organization Name</span>
 <input className="input" autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Holdings LLC" onKeyDown={e => e.key === 'Enter' && handleSave()} />
 </div>

 <div className="flex flex-col gap-2">
 <span className="text-micro font-bold text-slate-800">Entity Type</span>
 <Select value={form.type} onValueChange={(val) => setForm(p => ({ ...p, type: val }))}>
 {ORG_TYPES.map(t => {
   const IconComp = TYPE_ICONS[t];
   return (
     <SelectItem key={t} value={t} icon={IconComp}>
       {TYPE_LABELS[t]}
     </SelectItem>
   );
 })}
 </Select>
 </div>

 <div className="flex flex-col gap-2">
 <span className="text-micro font-bold text-slate-800">Jurisdiction</span>
 <input className="input" list="jurisdictions-list" value={form.jurisdiction} onChange={e => setForm(p => ({ ...p, jurisdiction: e.target.value }))} placeholder="e.g. Delaware, Cayman Islands" onKeyDown={e => e.key === 'Enter' && handleSave()} />
 <datalist id="jurisdictions-list">
 <option value="British Virgin Islands" />
 <option value="Cayman Islands" />
 <option value="Bermuda" />
 <option value="Jersey" />
 <option value="Isle of Man" />
 <option value="Panama" />
 <option value="Bahamas" />
 <option value="Delaware" />
 <option value="Luxembourg" />
 <option value="Switzerland" />
 </datalist>
 </div>

 <div className="flex flex-col gap-2">
 <span className="text-micro font-bold text-slate-800">Internal Notes</span>
 <textarea 
 value={form.notes} 
 onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} 
 rows={4}
 className="input resize-y"
 placeholder="Additional context or formation details..."
 />
 </div>
 </div>

 <div className="p-5 border-t border-slate-200 flex gap-3 bg-slate-50 shrink-0">
 <button type="button" className="btn btn-secondary flex-1 font-medium" onClick={onClose}>Cancel</button>
 <button type="button" className="btn btn-primary flex-1 font-semibold" onClick={() => handleSave()} disabled={!valid || saving}>
 {saving ? 'Creating...' : 'Create Organization'}
 </button>
 </div>
 </div>
 </div>
 );
}

// ─── Main page ────────────────────────────────────────────────────────────────

import { usePageTitle } from '@/lib/PageTitleContext';

export default function OrganizationsPage() {
 const router = useRouter();
 const [orgs, setOrgs] = useState<Organization[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [typeFilter, setTypeFilter] = useState('All');
 const [showCreate, setShowCreate] = useState(false);
 const [tenantId, setTenantId] = useState('');

 usePageTitle('Organizations');


 useEffect(() => {
 try {
 const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
 if (t?.id) setTenantId(t.id);
 } catch { /* ignore */ }
 }, []);

 useEffect(() => {
 if (!tenantId) return;
 setLoading(true);
 const q = query(collection(db, 'tenants', tenantId, 'organizations'), orderBy('name', 'asc'));
 const unsub = onSnapshot(q, snap => {
 setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization)));
 setLoading(false);
 }, () => setLoading(false));
 return () => unsub();
 }, [tenantId]);

 const filtered = useMemo(() => {
 const q = search.toLowerCase();
 return orgs.filter(o => {
 const matchSearch = !q || o.name.toLowerCase().includes(q)
 || o.type?.toLowerCase().includes(q)
 || o.jurisdiction?.toLowerCase().includes(q)
 || o.linkedFamilyNames?.some(f => f.toLowerCase().includes(q))
 || o.linkedContactNames?.some(c => c.toLowerCase().includes(q));
 const matchType = typeFilter === 'All' || o.type === typeFilter;
 return matchSearch && matchType;
 });
 }, [orgs, search, typeFilter]);

 return (
 <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8 bg-slate-50/50 min-h-screen">
 
 {/* Page Header */}
 <header className="mb-8 pt-6">
 <div className="flex justify-between items-start mb-6">
 <div>
 <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-slate-900 border-none pb-0">
 Organizations
 </h1>
 <p className="text-sm text-slate-500">Manage legal entities, trusts, and holding companies.</p>
 </div>
 <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
 <Plus size={16} className="mr-1.5" />
 New Organization
 </button>
 </div>

 <div className="flex gap-4 items-center">
 <div className="header-search flex-1 max-w-md">
 <Search size={16} className="text-tertiary" />
 <input 
 type="text" 
 value={search} 
 onChange={e => setSearch(e.target.value)} 
 placeholder="Search organizations..." 
 className="flex-1 bg-transparent border-none outline-none text-sm" 
 />
 </div>
 <select 
 value={typeFilter} 
 onChange={e => setTypeFilter(e.target.value)}
 className="input text-sm font-medium py-2"
 >
 <option value="All">All Entity Types</option>
 {ORG_TYPES.map(t => (
 <option key={t} value={t}>{TYPE_LABELS[t]}</option>
 ))}
 </select>
 </div>
 </header>

 {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="card h-40 animate-pulse bg-slate-50 border-transparent" />
 ))}
 </div>
 ) : filtered.length === 0 ? (
 <div className="card text-center py-20 bg-slate-50 border-dashed">
 <Building2 size={48} className="mx-auto mb-4 opacity-20 text-slate-800" />
 <h3 className="text-macro mb-2" style={{ fontSize: 20 }}>
 {orgs.length === 0 ? 'No organizations registered yet.' : 'No entities match your filters.'}
 </h3>
 <p className="mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>Organizations act as structural nodes mapping companies, trusts, and banks seamlessly into your CRM.</p>
 {orgs.length === 0 && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Register First Entity</button>}
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-12">
 {filtered.map(o => {
 const colorName = TYPE_COLORS[o.type] ?? 'slate';
 const IconComp = TYPE_ICONS[o.type] ?? Building2;
 return (
 <div 
 key={o.id} 
 onClick={() => router.push(`/relationships/organizations/${o.id}`)}
 className={`card cursor-pointer hover:shadow-md transition-all flex flex-col gap-4 !p-5 group border-t-4 border-t-${colorName}-500 hover:border-t-${colorName}-600`}
 >
 <div className="flex items-start gap-4">
 <div className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-2xl border border-${colorName}-200 bg-${colorName}-50 group-hover:scale-105 transition-transform`}>
 <IconComp size={24} className={`text-${colorName}-600`} strokeWidth={2} />
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="truncate text-macro text-lg">{o.name}</h3>
 <div className="flex items-center gap-2 mt-1.5 flex-wrap">
 <span className={`badge px-2 py-0.5 capitalize bg-${colorName}-100 text-${colorName}-800`} style={{ fontSize: 11 }}>
 {TYPE_LABELS[o.type] || o.type}
 </span>
 {o.jurisdiction && <span className="text-xs font-medium truncate max-w-[120px]" style={{ color: 'var(--text-secondary)' }}>· {o.jurisdiction}</span>}
 </div>
 </div>
 </div>
 
 <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-200 mt-auto">
 {o.linkedContactNames?.slice(0, 3).map(c => (
 <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-800 font-medium border border-slate-200 truncate max-w-[140px]">
 👤 {c.split(' ')[0]}
 </span>
 ))}
 {(o.linkedContactNames?.length ?? 0) > 3 && (
 <span className="text-[10px] font-bold px-1" style={{ color: 'var(--text-secondary)' }}>+{o.linkedContactNames!.length - 3}</span>
 )}
 {o.linkedFamilyNames?.map(f => (
 <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 truncate max-w-[120px]">
 👥 {f}
 </span>
 ))}
 </div>
 </div>
 );
 })}
 </div>
 )}

 {showCreate && tenantId && <CreateOrgDrawer tenantId={tenantId} onClose={() => setShowCreate(false)} />}
 </div>
 );
}
