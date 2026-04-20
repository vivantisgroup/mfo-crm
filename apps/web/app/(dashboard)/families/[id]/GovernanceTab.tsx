import React from 'react';
import { Landmark, Users, ScrollText, Calendar, Plus } from 'lucide-react';

interface GovernanceTabProps {
  family: any;
}

export function GovernanceTab({ family }: GovernanceTabProps) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in relative max-w-6xl mx-auto pb-24">
      
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-xl font-black text-[var(--text-primary)]">Family Governance Structuring</h2>
           <p className="text-sm text-[var(--text-secondary)] mt-1">
             Manage the corporate structures, active committees, and policy documents for the {family.name} family.
           </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90">
           <Plus size={16} /> New Committee
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        
        {/* Family Council & Assemblies */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                 <Users size={20} />
              </div>
              <div>
                 <h3 className="text-sm font-bold text-[var(--text-primary)]">Family Council & Assembly</h3>
                 <p className="text-[11px] text-[var(--text-secondary)]">The governing bodies of the family group</p>
              </div>
           </div>

           <div className="space-y-4">
              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-2 text-xs font-bold text-[var(--brand-primary)]">Active</div>
                 <h4 className="font-bold text-[var(--text-primary)] mb-1">Board of Directors</h4>
                 <div className="text-sm text-[var(--text-secondary)] mb-3">3 Members · Meets Quarterly</div>
                 <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">JP</div>
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800">AM</div>
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-green-200 flex items-center justify-center text-xs font-bold text-green-800">LM</div>
                 </div>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-white relative hover:border-[var(--brand-primary)] cursor-pointer transition-colors">
                 <h4 className="font-bold text-[var(--text-primary)] mb-1">Investment Committee</h4>
                 <div className="text-sm text-[var(--text-secondary)]">2 Members · Internal & External Advisors</div>
              </div>
           </div>
        </div>

        {/* Governance Core Documents */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
           <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                 <ScrollText size={20} />
              </div>
              <div>
                 <h3 className="text-sm font-bold text-[var(--text-primary)]">Key Policies & Protocols</h3>
                 <p className="text-[11px] text-[var(--text-secondary)]">Constitutions, Shareholders Agreements</p>
              </div>
           </div>

           <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--bg-muted)] transition-colors cursor-pointer group">
                 <div className="flex items-center gap-3">
                    <Landmark size={18} className="text-blue-500" />
                    <div>
                       <div className="font-semibold text-[var(--text-primary)] text-sm group-hover:text-[var(--brand-primary)] transition-colors">Family Constitution</div>
                       <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">Signed: Oct 2024 · Valid indefinitely</div>
                    </div>
                 </div>
                 <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase">Active</span>
              </div>

              <div className="flex items-center justify-between p-3 border border-red-200 bg-red-50 rounded-xl hover:bg-red-100 transition-colors cursor-pointer group">
                 <div className="flex items-center gap-3">
                    <ScrollText size={18} className="text-red-500" />
                    <div>
                       <div className="font-semibold text-red-900 text-sm group-hover:text-red-700 transition-colors">Investment Policy Statement (IPS)</div>
                       <div className="text-[10px] text-red-600 mt-0.5">Expired: Jan 15, 2025 · Requires Renewal</div>
                    </div>
                 </div>
                 <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded font-bold uppercase">Overdue</span>
              </div>
              
              <button className="w-full py-3 border border-dashed border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)] transition-colors flex items-center justify-center gap-2">
                 <Plus size={14} /> Add Governance Document
              </button>
           </div>
        </div>

      </div>

    </div>
  );
}
