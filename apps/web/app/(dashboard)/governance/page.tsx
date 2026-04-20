'use client';

import React, { useState, useEffect } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { useAuth } from '@/lib/AuthContext';
import { getFirestore, collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { useRouter } from 'next/navigation';
import { 
  Landmark, 
  Users, 
  FileSignature, 
  Calendar, 
  Scale, 
  ScrollText,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export default function GovernanceDashboard() {
  usePageTitle('Family Governance Hub');
  const { tenant } = useAuth();
  const router = useRouter();

  const [minutes, setMinutes] = useState<any[]>([]);
  const [envelopes, setEnvelopes] = useState<any[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;
    const db = getFirestore(firebaseApp);
    
    // Fetch Committees
    const qCom = query(collection(db, 'committeeMinutes'), where('tenantId', '==', tenant.id));
    const unsubCom = onSnapshot(qCom, snap => {
      setMinutes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Envelopes
    const qEnv = query(collection(db, 'tenants', tenant.id, 'envelopes'), orderBy('createdAt', 'desc'));
    const unsubEnv = onSnapshot(qEnv, snap => {
       setEnvelopes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubCom();
      unsubEnv();
    };
  }, [tenant?.id]);

  const activeReviewDocs = envelopes.filter(e => e.status !== 'completed').slice(0, 5);
  const activeCommittees = minutes.filter(m => m.status !== 'Aprovada');

  return (
    <div className="w-full h-full p-8 bg-[var(--bg-canvas)] overflow-y-auto animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
            Governance Central 🏛
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-2xl">
            Monitor Corporate Structuring, Family Councils, Assemblies, and Governance documentation across all Managed Families.
          </p>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[var(--bg-surface)] p-6 border border-[var(--border)] rounded-2xl shadow-sm">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Users size={20} />
            </div>
            <div className="text-3xl font-black text-[var(--text-primary)] tracking-tight">12</div>
            <div className="text-sm font-semibold text-[var(--text-secondary)] mt-1">Active Family Councils</div>
          </div>
          <div 
            onClick={() => router.push('/cio-office/committee')}
            className="bg-[var(--bg-surface)] p-6 border border-[var(--border)] rounded-2xl shadow-sm cursor-pointer hover:border-[var(--brand-primary)] hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start">
               <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-[var(--brand-primary)] group-hover:text-white transition-colors">
                 <Scale size={20} />
               </div>
               <ArrowRight size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--brand-primary)] transition-colors opacity-0 group-hover:opacity-100" />
            </div>
            <div className="text-3xl font-black text-[var(--text-primary)] tracking-tight">{minutes.length}</div>
            <div className="text-sm font-semibold text-[var(--text-secondary)] mt-1 flex justify-between items-center">
               <span>Investment Committees</span>
            </div>
          </div>
          <div 
            onClick={() => router.push('/signatures')}
            className="bg-[var(--bg-surface)] p-6 border border-[var(--border)] rounded-2xl shadow-sm cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start">
               <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                 <FileSignature size={20} />
               </div>
               <ArrowRight size={16} className="text-[var(--text-tertiary)] group-hover:text-emerald-500 transition-colors opacity-0 group-hover:opacity-100" />
            </div>
            <div className="text-3xl font-black text-[var(--text-primary)] tracking-tight">{envelopes.filter(e => e.status !== 'completed').length}</div>
            <div className="text-sm font-semibold text-[var(--text-secondary)] mt-1">Pending Signatures</div>
          </div>
          <div className="bg-[var(--bg-surface)] p-6 border border-[var(--border)] rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-50 rounded-full blur-2xl"></div>
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4 relative z-10">
              <AlertTriangle size={20} />
            </div>
            <div className="text-3xl font-black text-red-600 tracking-tight relative z-10">2</div>
            <div className="text-sm font-semibold text-[var(--text-secondary)] mt-1 relative z-10">Expired Policies</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Meetings (Committees + Mocks) */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-lg font-bold text-[var(--text-primary)]">Upcoming Governance & Committees</h2>
               <button onClick={() => router.push('/cio-office/committee')} className="text-xs font-semibold text-[var(--brand-primary)] hover:underline">View All</button>
            </div>
            
            <div className="space-y-4 flex-1">
               {activeCommittees.length === 0 && (
                  <div className="text-sm text-slate-500 text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                     No pending committee meetings. 
                  </div>
               )}
               {activeCommittees.slice(0,4).map((m: any, i: number) => (
                 <div onClick={() => router.push('/cio-office/committee')} key={i} className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 border border-[var(--border-subtle)] rounded-xl hover:border-[var(--brand-primary)] transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-700 flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-[10px] uppercase font-bold">{m.date?.split('-')[1] || 'MTH'}</span>
                          <span className="text-sm font-black">{m.date?.split('-')[2] || 'DD'}</span>
                       </div>
                       <div>
                          <div className="font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">{m.title}</div>
                          <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                             <Scale size={12} /> Investment Committee
                          </div>
                       </div>
                    </div>
                    <div className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full ${m.status === 'Draft' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>
                       {m.status}
                    </div>
                 </div>
               ))}
            </div>
          </div>

          {/* Key Documents expiring / review */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-lg font-bold text-[var(--text-primary)]">Pending Signatures & Documents</h2>
               <button onClick={() => router.push('/signatures')} className="text-xs font-semibold text-emerald-600 hover:underline">Vault Options</button>
            </div>
            
            <div className="space-y-3 flex-1">
               {activeReviewDocs.length === 0 && (
                  <div className="text-sm text-slate-500 text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                     All signatures are up to date! 
                  </div>
               )}
               {activeReviewDocs.map((d: any, i: number) => (
                 <div onClick={() => router.push('/signatures')} key={i} className="flex gap-4 p-4 border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--bg-muted)] transition-colors cursor-pointer group">
                    <div className="mt-1 text-emerald-500 group-hover:scale-110 transition-transform">
                       <FileSignature size={20} />
                    </div>
                    <div className="flex-1">
                       <div className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-emerald-700 transition-colors">{d.title}</div>
                       <div className="text-xs text-[var(--text-secondary)] mt-1">
                          {d.completed || 0}/{d.recipients} Signatures Completed
                       </div>
                    </div>
                    <div className="text-right">
                       <div className="text-[11px] font-bold text-amber-500 uppercase">{d.status}</div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
