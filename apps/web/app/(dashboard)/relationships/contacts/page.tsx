'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { User, Plus, Search, X, Trash2, CheckCircle2, DownloadCloud } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { OdooMigrationUtility } from '../../admin/components/OdooMigrationUtility';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Contact {
 id: string;
 firstName: string;
 lastName: string;
 email?: string;
 phone?: string;
 dateOfBirth?: string;
 role: string;
 relationshipType?: string;
 identifications?: Array<{ type: string; number: string; isPrimary: boolean }>;
 linkedFamilyIds: string[];
 linkedFamilyNames: string[];
 linkedOrgIds: string[];
 linkedOrgNames: string[];
 pepFlag?: boolean;
 nationality?: string;
 notes?: string;
 kycStatus?: string;
 createdAt?: string;
}

const ROLES = ['beneficiary', 'advisor', 'attorney', 'accountant', 'banker', 'trustee', 'benefactor', 'other'];
const RELATIONSHIP_TYPES = ['Family Member', 'Employee', 'Founder', 'Shareholder', 'Director', 'Advisor', 'Dependent', 'Other'];
const ID_TYPES = ['SSN', 'Passport', 'Drivers License', 'CNPJ', 'CPF', 'RG', 'NIF', 'NIS', 'Other'];

const ROLE_COLORS: Record<string, string> = {
 beneficiary: 'blue',
 advisor: 'cyan',
 attorney: 'amber',
 accountant: 'violet',
 banker: 'emerald',
 trustee: 'indigo',
 benefactor: 'pink',
 other: 'slate',
};

function getInitials(fn: string, ln: string) {
 return `${fn?.[0] ?? ''}${ln?.[0] ?? ''}`.toUpperCase();
}
function CreateContactView({ tenantId, onClose, onCreate }: { tenantId: string, onClose: () => void, onCreate: () => void }) {
  const [saving, setSaving] = React.useState(false);
  const valid = true;
  return <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 mt-6 mb-6">
    <h2 className="text-xl font-bold mb-4">Create New Contact</h2>
    <form onSubmit={(e) => { e.preventDefault(); setSaving(true); setTimeout(() => { setSaving(false); onClose(); onCreate(); }, 500); }}>
      <div className="flex gap-4 mt-2 border-t border-slate-100 pt-6">
        <button type="button" className="btn btn-secondary flex-1 font-medium" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary flex-[2] font-semibold" disabled={!valid || saving}>{saving ? "Creating..." : "Create Contact"}</button>
      </div>
    </form>
  </div>;
}

// ─── Main page ────────────────────────────────────────────────────────────────

import { usePageTitle } from '@/lib/PageTitleContext';

export default function ContactsPage() {
 const router = useRouter();
 const [contacts, setContacts] = useState<Contact[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [roleFilter, setRoleFilter] = useState('All');
 const [showCreate, setShowCreate] = useState(false);
 const [showImport, setShowImport] = useState(false);
 const [tenantId, setTenantId] = useState('');

 usePageTitle('Contacts');

 useEffect(() => {
 try {
 const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
 if (t?.id) setTenantId(t.id);
 } catch { /* ignore */ }
 }, []);

 useEffect(() => {
 if (!tenantId) return;
 setLoading(true);
 const q = query(collection(db, 'tenants', tenantId, 'contacts'), orderBy('lastName', 'asc'));
 const unsub = onSnapshot(q, snap => {
 setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Contact)));
 setLoading(false);
 }, () => setLoading(false));
 return () => unsub();
 }, [tenantId]);

 const filtered = useMemo(() => {
 const q = search.toLowerCase();
 return contacts.filter(c => {
 const matchSearch = !q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
 || c.email?.toLowerCase().includes(q)
 || c.role?.toLowerCase().includes(q)
 || c.linkedOrgNames?.some(o => o.toLowerCase().includes(q))
 || c.linkedFamilyNames?.some(f => f.toLowerCase().includes(q));
 const matchRole = roleFilter === 'All' || c.role === roleFilter;
 return matchSearch && matchRole;
 });
 }, [contacts, search, roleFilter]);

 return (
 <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8 bg-slate-50/50 min-h-screen md:pb-12">
   {showCreate && tenantId ? (
     <CreateContactView tenantId={tenantId} onClose={() => setShowCreate(false)} onCreate={() => {}} />
   ) : showImport && tenantId ? (
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--border)] h-[800px] max-h-[85vh] flex flex-col overflow-hidden relative mt-6 mb-6">
        <OdooMigrationUtility 
           tenantId={tenantId} 
           initialTargetType="contacts" 
           hideTargetSelection={true} 
           onClose={() => setShowImport(false)} 
        />
      </div>
    ) : (
      <>
        <header className="mb-8 pt-6">
         <div className="flex justify-between items-start mb-6">
           <div>
             <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-slate-900 border-none pb-0">
               Contacts
             </h1>
             <p className="text-sm text-slate-500">Manage individuals, advisors, and team members connected to entities.</p>
           </div>
           <div className="flex gap-3">
              <button className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold shadow-sm" onClick={() => setShowImport(true)}>
                <DownloadCloud size={16} className="mr-1.5 text-indigo-500" />
                Import
              </button>
              <div className="flex gap-3">
              <button className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold shadow-sm" onClick={() => setShowImport(true)}>
                <DownloadCloud size={16} className="mr-1.5 text-indigo-500" />
                Import
              </button>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                <Plus size={16} className="mr-1.5" />
                New Contact
              </button>
            </div>
            </div>
         </div>

         <div className="flex gap-4 items-center">
           <div className="header-search flex-1 max-w-md">
             <Search size={16} className="text-tertiary" />
             <input 
               type="text" 
               value={search} 
               onChange={e => setSearch(e.target.value)} 
               placeholder="Search contacts..." 
               className="flex-1 bg-transparent border-none outline-none text-sm" 
             />
           </div>
           <select 
             value={roleFilter} 
             onChange={e => setRoleFilter(e.target.value)}
             className="input text-sm font-medium py-2 w-auto"
           >
             <option value="All">All Roles</option>
             {ROLES.map(r => (
               <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
             ))}
           </select>
         </div>
       </header>

       {loading ? (
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
       {Array.from({ length: 8 }).map((_, i) => (
       <div key={i} className="card h-32 animate-pulse bg-slate-50 border-transparent" />
       ))}
       </div>
       ) : filtered.length === 0 ? (
       <div className="card text-center py-20 bg-slate-50 border-dashed">
       <User size={48} className="mx-auto mb-4 opacity-20 text-slate-800" />
       <h3 className="text-macro mb-2" style={{ fontSize: 20 }}>
       {contacts.length === 0 ? 'No contacts registered yet.' : 'No people match your filters.'}
       </h3>
       <p className="mb-6 max-w-sm" style={{ color: 'var(--text-secondary)' }}>Contacts act as the atomic relationship layer, bridging organizations and families seamlessly.</p>
       {contacts.length === 0 && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create First Profile</button>}
       </div>
       ) : (
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
       {filtered.map(c => {
       const colorName = ROLE_COLORS[c.role] ?? 'slate';
       return (
       <div 
       key={c.id} 
       onClick={() => router.push(`/relationships/contacts/${c.id}`)}
       className={`card cursor-pointer hover:shadow-md transition-all flex flex-col gap-4 !p-5 group border-t-4 border-t-${colorName}-500 hover:border-t-${colorName}-600`}
       >
       <div className="flex items-start gap-4">
       <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-sm font-bold border border-${colorName}-200 bg-${colorName}-50 text-${colorName}-700 group-hover:scale-105 transition-transform`}>
       {getInitials(c.firstName, c.lastName)}
       </div>
       <div className="flex-1 min-w-0">
       <h3 className="truncate text-macro text-lg">{c.firstName} {c.lastName}</h3>
       <div className="flex items-center gap-2 mt-1 flex-wrap">
       <span className={`badge px-2 py-0.5 capitalize bg-${colorName}-100 text-${colorName}-800`} style={{ fontSize: 11 }}>
       {c.role.replace(/_/g, ' ')}
       </span>
       {c.email && <span className="text-xs font-medium truncate max-w-[120px]" style={{ color: 'var(--text-secondary)' }}>· {c.email}</span>}
       </div>
       </div>
       </div>
       
       <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-200 mt-auto">
       {c.linkedOrgNames?.slice(0, 2).map(o => (
       <span key={o} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-800 font-medium border border-slate-200 truncate max-w-[140px]">
       🏢 {o}
       </span>
       ))}
       {(c.linkedOrgNames?.length ?? 0) > 2 && (
       <span className="text-[10px] font-bold px-1" style={{ color: 'var(--text-secondary)' }}>+{c.linkedOrgNames!.length - 2}</span>
       )}
       {c.linkedFamilyNames?.map(f => (
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
