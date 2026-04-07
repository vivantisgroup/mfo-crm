'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, getInitials, getTierBadgeColor, getRiskColor } from '@/lib/utils';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { usePageTitle } from '@/lib/PageTitleContext';

export default function FamiliesPage() {
 const router = useRouter();
 const [families, setFamilies] = useState<any[]>([]);
 const [tenantId, setTenantId] = useState('');
 
 usePageTitle('Family Groups');

 useEffect(() => {
   try {
     const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
     if (t?.id) setTenantId(t.id);
   } catch { /* ignore */ }
 }, []);

 useEffect(() => {
   if (!tenantId) return;
   const q = query(collection(db, 'tenants', tenantId, 'organizations'), where('type', '==', 'family_group'));
   const unsub = onSnapshot(q, snap => {
     setFamilies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
   });
   return unsub;
 }, [tenantId]);

 const columns = [
 {
   header: 'Family Group',
   className: 'w-full',
   accessor: (f: any) => (
     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
       <div className="family-avatar" style={{ background: `linear-gradient(135deg, var(--bg-highlight), var(--bg-surface))`, border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
         {getInitials(f.name?.replace(' Family', '') || '?')}
       </div>
       <div>
         <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</div>
         <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f.jurisdiction || 'N/A'}</div>
       </div>
     </div>
   ),
 },
 { header: 'AUM', className: 'td-right', accessor: (f: any) => <div style={{ fontWeight: 600 }}>{formatCurrency(f.aum || 0, f.currency || 'USD')}</div> },
 { header: 'Tier', accessor: (f: any) => <span className="badge" style={{ background: getTierBadgeColor(f.serviceTier || 'standard').replace('text', 'bg'), color: getTierBadgeColor(f.serviceTier || 'standard') }}>{(f.serviceTier || 'standard').toUpperCase()}</span> },
 { header: 'Risk', accessor: (f: any) => <span style={{ color: getRiskColor(f.riskProfile || 'moderate'), fontWeight: 500, fontSize: 12, textTransform: 'capitalize' }}>• {f.riskProfile || 'moderate'}</span> },
 { header: 'Status', accessor: (f: any) => <div style={{ display: 'flex', gap: 6 }}><StatusBadge status={f.status || 'active'} /></div> },
 { header: 'Members', accessor: (f: any) => <div style={{ color: 'var(--text-secondary)' }}>{f.linkedContactIds?.length || 0} contacts</div> },
 ];

 return (
   <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8 bg-slate-50/50 min-h-screen">
     
     <header className="mb-8 pt-6">
       <div className="flex justify-between items-start mb-6">
         <div>
           <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-slate-900 border-none pb-0">
             Family Groups
           </h1>
           <p className="text-sm text-slate-500">Manage overarching family structures and their connected wealth.</p>
         </div>
         <button className="btn btn-primary" onClick={() => router.push('/relationships/organizations')}>
           + New Family Group
         </button>
       </div>
       
       <div className="flex gap-4 items-center">
         <div className="header-search flex-1 max-w-md">
           <Search size={16} className="text-tertiary" />
           <input 
             type="text" 
             placeholder="Search families..." 
             className="flex-1 bg-transparent border-none outline-none text-sm" 
           />
         </div>
       </div>
     </header>

     {families.length === 0 ? (
       <div className="card text-center py-20 bg-slate-50 border-dashed">
         <Users size={48} className="mx-auto mb-4 opacity-20 text-slate-800" />
         <h3 className="text-macro mb-2" style={{ fontSize: 20 }}>No Family Groups Yet</h3>
         <p className="mb-6 max-w-sm mx-auto text-slate-500">Register family groups through the Organizations framework to see them map here.</p>
         <button className="btn btn-primary mt-6" onClick={() => router.push('/relationships/organizations')}>Go to Organizations</button>
       </div>
     ) : (
       <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-0 overflow-hidden">
         <DataTable data={families} columns={columns} onRowClick={(row) => router.push(`/families/${row.id}`)} />
       </div>
     )}
   </div>
 );
}
