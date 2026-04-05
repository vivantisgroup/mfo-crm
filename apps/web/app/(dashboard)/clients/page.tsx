'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, getInitials, getTierBadgeColor, getRiskColor } from '@/lib/utils';
import { FAMILIES } from '@/lib/mockData';
import { LiveModeGate, FamiliesEmptyState } from '@/components/LiveModeGate';

import { Search, Plus, Download, Users, Briefcase } from 'lucide-react';

export default function FamiliesPage() {
 const router = useRouter();
 const [search, setSearch] = useState('');
 const [tierFilter, setTierFilter] = useState('All Tiers');
 const [statusFilter, setStatusFilter] = useState('All Statuses');

 const filtered = useMemo(() => {
 const q = search.toLowerCase();
 return FAMILIES.filter(f => {
 const matchSearch = !q || f.name.toLowerCase().includes(q)
 || f.code.toLowerCase().includes(q)
 || f.assignedRmName.toLowerCase().includes(q);
 const matchTier = tierFilter === 'All Tiers' || f.serviceTier.toLowerCase() === tierFilter.toLowerCase();
 const matchStatus = statusFilter === 'All Statuses' || f.kycStatus.toLowerCase() === statusFilter.toLowerCase();
 return matchSearch && matchTier && matchStatus;
 });
 }, [search, tierFilter, statusFilter]);

 return (
 <LiveModeGate emptyState={<FamiliesEmptyState />}>
 <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8">
 
 {/* Header */}
 <div className="flex justify-end mb-6">
 <div className="flex gap-3">
 <button className="btn btn-secondary font-semibold shadow-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Download size={16} /> Export</button>
 <button className="btn btn-primary font-semibold shadow-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Plus size={16} /> Onboard Client</button>
 </div>
 </div>

 {/* Filters */}
 <div className="flex flex-wrap items-center gap-4 mb-8">
 <div className="w-full md:flex-1 md:min-w-[300px] relative">
 <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
 <input 
 className="input w-full pl-10"
 placeholder="Search by client name, code, or Relationship Manager..." 
 value={search} 
 onChange={(e) => setSearch(e.target.value)} 
 />
 </div>
 <div className="w-full md:w-48">
 <select className="input w-full" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
 <option value="All Tiers">All Service Tiers</option>
 <option value="Platinum">Platinum</option>
 <option value="Gold">Gold</option>
 <option value="Standard">Standard</option>
 </select>
 </div>
 <div className="w-full md:w-56">
 <select className="input w-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
 <option value="All Statuses">All KYC/AML</option>
 <option value="Approved">Approved</option>
 <option value="In Review">In Review</option>
 <option value="Pending">Pending</option>
 </select>
 </div>
 </div>

 {/* Content Grid */}
 {filtered.length === 0 ? (
 <div className="card text-center py-20 border-dashed bg-slate-50">
 <div className="text-6xl mb-4 opacity-50">👥</div>
 <h3 className="text-macro mb-2" style={{ fontSize: 20 }}>No clients match your search criteria.</h3>
 <p className="mb-6 max-w-sm" style={{ color: 'var(--text-secondary)' }}>Adjust your filters or initiate a new client onboarding sequence.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
 {filtered.map(f => (
 <div 
 key={f.id} 
 onClick={() => router.push(`/clients/${f.id}`)}
 className="card cursor-pointer hover:shadow-md transition-all flex flex-col gap-4 !p-5 group border-t-4 border-t-transparent hover:border-t-indigo-600"
 >
 <div className="flex items-start gap-4">
 <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-sm font-bold border border-slate-200 bg-slate-50 text-slate-700 shadow-sm group-hover:scale-105 transition-transform" style={{ background: 'linear-gradient(135deg, var(--bg-highlight), var(--bg-surface))' }}>
 {getInitials(f.name.replace(' Family', ''))}
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="truncate text-macro text-lg group-hover:text-indigo-600 transition-colors">{f.name}</h3>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 <span className="text-micro px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md tracking-wider">{f.code}</span>
 <span className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>· {f.domicileCountry}</span>
 </div>
 </div>
 </div>
 
 <div className="grid grid-cols-2 gap-y-4 gap-x-2 py-4 border-y border-slate-200">
 <div>
 <div className="text-micro text-slate-500 mb-1">Total AUM</div>
 <div className="text-macro lg:text-lg">{formatCurrency(f.totalAum, f.currency)}</div>
 </div>
 <div className="text-right">
 <div className="text-micro text-slate-500 mb-1">Service Tier</div>
 <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: getTierBadgeColor(f.serviceTier).replace('text', 'bg'), color: getTierBadgeColor(f.serviceTier) }}>
 {f.serviceTier}
 </span>
 </div>
 
 <div>
 <div className="text-micro text-slate-500 mb-1">Manager</div>
 <div className="flex items-center gap-1.5 overflow-hidden">
 <Briefcase size={12} className="shrink-0 text-slate-400" />
 <span className="text-xs font-semibold truncate text-slate-800">{f.assignedRmName}</span>
 </div>
 </div>
 <div className="text-right flex flex-col items-end">
 <div className="text-micro text-slate-500 mb-1">Compliance</div>
 <div className="flex gap-1">
 <StatusBadge status={f.kycStatus} />
 </div>
 </div>
 </div>

 <div className="mt-auto pt-1 flex justify-between items-center">
 <div className="text-xs font-semibold" style={{ color: getRiskColor(f.riskProfile) }}>
 Risk: <span className="capitalize">{f.riskProfile}</span>
 </div>
 <div className="text-xs font-semibold hover:text-indigo-600 group-hover:underline text-slate-500">View Profile &rarr;</div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </LiveModeGate>
 );
}
