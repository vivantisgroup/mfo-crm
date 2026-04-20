'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Search, X, Users, Landmark, FileText, BadgeDollarSign, Scale, Lock, ShieldCheck, Map, Search as SearchIcon, Umbrella, Ruler, Handshake, Heart, Sprout, Pin, Building, UserCog } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

// ─── Types ────────────────────────────────────────────────────────────────────

 export interface Organization {
 id: string;
 name: string;
 type: string;
 jurisdiction?: string;
 jurisdictionClass?: 'onshore' | 'offshore';
 identifier?: string; // e.g. CNPJ, EIN
 addressStreet?: string;
 addressCity?: string;
 addressState?: string;
 addressZip?: string;
 addressCountry?: string;
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
  'governance_consultant', 'philanthropic_consultant', 'foundation', 
  'corporate_service_provider', 'corporate_administrator', 'offshore_provider', 
  'insurance_manager', 'registered_agent', 'nominee_director', 'registered_office',
  'other'
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
  corporate_service_provider: 'Corporate Service Provider',
  corporate_administrator: 'Corporate Administrator',
  offshore_provider: 'Offshore Provider',
  insurance_manager: 'Insurance Manager',
  registered_agent: 'Registered Agent',
  nominee_director: 'Nominee Director',
  registered_office: 'Registered Office',
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
  corporate_service_provider: 'indigo',
  corporate_administrator: 'slate',
  offshore_provider: 'cyan',
  insurance_manager: 'rose',
  registered_agent: 'violet',
  nominee_director: 'amber',
  registered_office: 'zinc',
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
  corporate_service_provider: Building2,
  corporate_administrator: Users,
  offshore_provider: Map,
  insurance_manager: Umbrella,
  registered_agent: ShieldCheck,
  nominee_director: UserCog,
  registered_office: Pin,
  other: Pin
};

// ─── Create org drawer ────────────────────────────────────────────────────────

function CreateOrgView({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
 const [form, setForm] = useState<Partial<Organization>>({ 
   name: '', type: 'family_group', jurisdiction: '', jurisdictionClass: 'offshore', identifier: '',
   addressStreet: '', addressCity: '', addressState: '', addressZip: '', addressCountry: '',
   notes: '', status: 'active' 
  });
 const [saving, setSaving] = useState(false);

 const valid = (form.name || '').trim().length > 0;

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
 <div className="p-8 animate-fade-in max-w-4xl mx-auto pt-6 pb-20">
   <div className="mb-8 pl-1">
     <h1 className="text-3xl font-extrabold text-slate-800 mb-2 flex items-center gap-3">
       <Building2 className="text-indigo-500" strokeWidth={2.5} /> 
       New Organization
     </h1>
     <p className="text-slate-500 text-sm ml-11">Register a new trust, fund, or legal entity</p>
   </div>
   
   <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col gap-7">
     <div className="grid grid-cols-2 gap-x-8 gap-y-6">
       <div className="col-span-2 flex flex-col gap-2">
         <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Organization Name *</span>
         <input className="input w-full" autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Holdings LLC" />
       </div>

       <div className="flex flex-col gap-2">
         <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entity Type</span>
         <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm ring-offset-background" value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))}>
           {ORG_TYPES.map(t => {
             return (
               <option key={t} value={t}>
                 {TYPE_LABELS[t]}
               </option>
             );
           })}
         </select>
       </div>

       <div className="flex flex-col gap-2">
         <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jurisdiction</span>
         <input className="input w-full" list="jurisdictions-list" value={form.jurisdiction} onChange={e => setForm(p => ({ ...p, jurisdiction: e.target.value }))} placeholder="e.g. Delaware, Cayman Islands, Brazil" />
         <datalist id="jurisdictions-list">
           <option value="Brazil" />
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

       {/* Conditional fields for Financial Institutions (and related entities) */}
       {form.type === 'financial_institution' && (
         <div className="col-span-2 grid grid-cols-2 gap-x-8 gap-y-6 mt-2 pt-6 border-t border-slate-100">
           <div className="col-span-2">
             <h3 className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
               <Map className="w-4 h-4 text-slate-400" />
               Institutional Metadata
             </h3>
             <p className="text-xs text-slate-500">Address and tax identification for automated document pairing.</p>
           </div>
           
           <div className="col-span-2 sm:col-span-1 flex flex-col gap-2">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Classification</span>
             <select className="flex h-9 w-full rounded-md border border-input bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm" value={form.jurisdictionClass} onChange={e => setForm(p => ({ ...p, jurisdictionClass: e.target.value as any}))}>
               <option value="onshore">Onshore (Domestic)</option>
               <option value="offshore">Offshore (International)</option>
             </select>
           </div>
           
           <div className="col-span-2 sm:col-span-1 flex flex-col gap-2">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">CNPJ / Tax Identifier</span>
             <input className="input w-full" value={form.identifier} onChange={e => setForm(p => ({ ...p, identifier: e.target.value }))} placeholder="e.g. 00.000.000/0001-00" />
           </div>

           <div className="col-span-2 flex flex-col gap-2">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Street Address</span>
             <input className="input w-full" value={form.addressStreet} onChange={e => setForm(p => ({ ...p, addressStreet: e.target.value }))} placeholder="e.g. Av. Faria Lima, 3000" />
           </div>
           
           <div className="flex flex-col gap-2">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">City</span>
             <input className="input w-full" value={form.addressCity} onChange={e => setForm(p => ({ ...p, addressCity: e.target.value }))} placeholder="e.g. São Paulo" />
           </div>
           
           <div className="flex flex-col gap-2">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">State / Region</span>
             <input className="input w-full" value={form.addressState} onChange={e => setForm(p => ({ ...p, addressState: e.target.value }))} placeholder="e.g. SP" />
           </div>

           <div className="flex flex-col gap-2">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Postal / ZIP Code</span>
             <input className="input w-full" value={form.addressZip} onChange={e => setForm(p => ({ ...p, addressZip: e.target.value }))} placeholder="e.g. 01452-000" />
           </div>
           
           <div className="flex flex-col gap-2">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Country</span>
             <input className="input w-full" value={form.addressCountry} onChange={e => setForm(p => ({ ...p, addressCountry: e.target.value }))} placeholder="e.g. Brazil" />
           </div>
         </div>
       )}

       <div className="col-span-2 flex flex-col gap-2">
         <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Internal Notes</span>
         <div className="min-h-[200px] border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
           <RichTextEditor 
             value={form.notes || ''} 
             onChange={val => setForm(p => ({ ...p, notes: val }))} 
             placeholder="Additional context or formation details..."
           />
         </div>
       </div>
     </div>

     <div className="flex gap-4 mt-4 pt-6 border-t border-slate-100">
       <button type="button" className="btn btn-secondary flex-1 font-medium" onClick={onClose}>Cancel</button>
       <button type="submit" className="btn btn-primary flex-[2] font-semibold" disabled={!valid || saving}>
         {saving ? 'Creating...' : 'Create Organization'}
       </button>
     </div>
   </form>
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
 
  {showCreate && tenantId ? (
    <CreateOrgView tenantId={tenantId} onClose={() => setShowCreate(false)} />
  ) : (
    <>
      <header className="mb-8 pt-6">
      <div className="flex justify-between items-start mb-6">
      <div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-slate-900 border-none pb-0">
      Organizations
      </h1>
      <p className="text-sm text-slate-500">Manage legal entities, trusts, and holding companies.</p>
      </div>
      <button className="btn btn-primary shadow-sm" onClick={() => setShowCreate(true)}>
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
      {o.jurisdictionClass && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">· {o.jurisdictionClass}</span>}
      {o.identifier && <span className="text-xs font-medium text-slate-400">· {o.identifier}</span>}
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
    </>
  )}

 </div>
 );
}
