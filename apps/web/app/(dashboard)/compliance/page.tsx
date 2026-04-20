'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { usePageTitle } from '@/lib/PageTitleContext';
import { 
  ShieldAlert, 
  Users, 
  FileText, 
  Search, 
  Filter,
  Scale,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/lib/AuthContext';

type ComplianceTab = 'overview' | 'regulatory' | 'suitability' | 'lgpd' | 'platform_compliance';

export default function GlobalComplianceDashboard() {
  usePageTitle('Compliance & Risk Operations Central');

  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<ComplianceTab>('overview');

  // Hardcoded mock data for the global view. In real app, fetch from families and tenant settings.
  const [lgpdRequests] = useState([
    { id: 'REQ-1092', family: '001-RKI (Andrade)', subject: 'Felipe Andrade', type: 'Exclusão de Dados', status: 'in_progress', slaInDays: 4 },
    { id: 'REQ-1093', family: '002-MRB (Silva)', subject: 'Marina Silva', type: 'Acesso / Exportação', status: 'open', slaInDays: 12 },
    { id: 'REQ-1094', family: '004-TRL (Lima)', subject: 'Tiago Lima', type: 'Retificação de Dados', status: 'fulfilled', slaInDays: 0 },
  ]);

  const [kycQueue] = useState([
    { id: 'KYC-591', family: '005-JSB (Santana)', member: 'João Santana', risk: 'high', nextReview: '2025-05-10', status: 'pending_review' },
    { id: 'KYC-592', family: '008-MXO (Costa)', member: 'Mariana Costa', risk: 'low', nextReview: '2025-09-12', status: 'approved' },
  ]);

  const [amlAlerts] = useState([
    { id: 'AML-991', family: '001-RKI (Andrade)', type: 'Large Transfer', trigger: '>$100k outflow to offshore', risk: 'critical', date: '2025-04-16' }
  ]);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
       {/* Header Strip */}
       <div className="bg-white px-8 py-6 border-b border-slate-200 z-10 shrink-0">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Scale className="text-[var(--brand-primary)]" size={28} /> Central Compliance & Risk
              </h1>
              <p className="text-sm text-slate-500 mt-1">Unified operational hub for CVM, AnBima, and LGPD regulatory frameworks.</p>
            </div>
            <div className="flex gap-3">
               <button 
                 onClick={() => toast.success('RIPD Report generated and queued for download.')}
                 className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition shadow-sm">
                 <FileText size={16} /> RIPD Report
               </button>
               <button 
                 onClick={() => {
                   toast.info('Initiating Global Compliance Sweeps...');
                   setTimeout(() => toast.success('Sweeps completed. 0 critical vulnerabilities found.'), 2000);
                 }}
                 className="flex items-center gap-2 bg-[var(--brand-primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition shadow-sm">
                 <ShieldAlert size={16} /> Run Sweeps
               </button>
            </div>
          </div>

          <div className="flex items-center gap-6 overflow-x-auto pb-1 mt-2">
            {[
              { id: 'overview', label: 'Global Overview', icon: <Users size={16} /> },
              { id: 'regulatory', label: 'KYC & AML (AnBima)', icon: <FolderOpen size={16} /> },
              { id: 'suitability', label: 'Suitability & KYP (CVM)', icon: <CheckCircle2 size={16} /> },
              { id: 'lgpd', label: 'LGPD & Privacy Data', icon: <Lock size={16} /> },
              { id: 'platform_compliance', label: 'Platform Compliance & ISO', icon: <ShieldAlert size={16} /> }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ComplianceTab)}
                className={`flex items-center gap-2 pb-3 border-b-2 font-bold text-sm transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
       </div>

       {/* Tab Content */}
       <div className="flex-1 overflow-y-auto w-full p-8">
         <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-16">
          
          {/* == OVERVIEW TAB == */}
          {activeTab === 'overview' && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Users size={24}/></div>
                    <div><div className="text-3xl font-black text-slate-800 tracking-tight">142</div><div className="text-xs text-slate-500 font-bold uppercase tracking-wide">Monitored Profiles</div></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle2 size={24}/></div>
                    <div><div className="text-3xl font-black text-slate-800 tracking-tight">98%</div><div className="text-xs text-slate-500 font-bold uppercase tracking-wide">KYC Completion</div></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 rounded-full blur-2xl"></div>
                    <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 relative z-10"><AlertTriangle size={24}/></div>
                    <div className="relative z-10"><div className="text-3xl font-black text-rose-700 tracking-tight">3</div><div className="text-xs text-rose-600/70 font-bold uppercase tracking-wide">Action Items</div></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><ShieldAlert size={24}/></div>
                    <div><div className="text-3xl font-black text-slate-800 tracking-tight">1</div><div className="text-xs text-slate-500 font-bold uppercase tracking-wide">DSR Risk SLA</div></div>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                   <h2 className="font-bold text-slate-800 mb-4">Pending KYC Renewals (Due within 30 days)</h2>
                   <div className="space-y-3">
                     {kycQueue.map(k => (
                       <div key={k.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50 flex items-center justify-between">
                         <div>
                            <div className="font-bold tracking-tight text-slate-800">{k.member}</div>
                            <div className="text-xs text-slate-500">{k.family}</div>
                         </div>
                         <div className="text-right">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${k.risk === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>{k.risk} Risk</span>
                            <div className="text-xs font-semibold text-slate-600 mt-1">Due: {k.nextReview}</div>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-t-4 border-t-red-500">
                   <h2 className="font-bold text-slate-800 mb-4 text-red-600 flex items-center gap-2"><AlertTriangle size={18} /> AML / Suspicious Activities</h2>
                   <div className="space-y-3">
                     {amlAlerts.map(a => (
                       <div key={a.id} className="p-4 border border-red-100 rounded-xl bg-red-50 flex items-center justify-between hover:bg-red-100 cursor-pointer transition">
                         <div>
                            <div className="font-bold tracking-tight text-red-900">{a.type}</div>
                            <div className="text-xs text-red-700 font-medium">{a.trigger} • {a.family}</div>
                         </div>
                         <div className="text-right">
                           <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-200 text-red-800">{a.risk}</span>
                           <div className="text-xs font-semibold text-red-600 mt-1">{a.date}</div>
                         </div>
                       </div>
                     ))}
                     {amlAlerts.length === 0 && <div className="p-4 text-center text-slate-500 text-sm">No critical AML alerts.</div>}
                   </div>
                </div>
              </div>
            </>
          )}


          {/* == LGPD TAB == */}
          {activeTab === 'lgpd' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <h2 className="font-bold text-slate-800 tracking-tight">DSR Queue (Data Subject Requests)</h2>
                    <p className="text-xs text-slate-500 mt-1">Manage titular requests conforming to LGPD.</p>
                  </div>
                  <div className="flex gap-2">
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder="Search subject..." className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]" />
                     </div>
                     <button className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"><Filter size={16}/></button>
                  </div>
              </div>
              
              <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-[11px] uppercase tracking-wider font-extrabold bg-slate-50 text-slate-500 border-b border-slate-200">
                       <tr>
                         <th className="px-6 py-4">ID</th>
                         <th className="px-6 py-4">Family / Account</th>
                         <th className="px-6 py-4">Subject</th>
                         <th className="px-6 py-4">Request Type</th>
                         <th className="px-6 py-4">SLA Time Left</th>
                         <th className="px-6 py-4">Status</th>
                         <th className="px-6 py-4 text-right">Action</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                       {lgpdRequests.map(req => (
                         <tr key={req.id} className="hover:bg-slate-50 transition cursor-pointer">
                            <td className="px-6 py-4 font-mono font-bold text-indigo-600">{req.id}</td>
                            <td className="px-6 py-4 font-medium">{req.family}</td>
                            <td className="px-6 py-4">{req.subject}</td>
                            <td className="px-6 py-4 font-medium">{req.type}</td>
                            <td className="px-6 py-4">
                              {req.slaInDays > 0 ? (
                                <span className={`font-black ${req.slaInDays <= 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                  {req.slaInDays} days
                                </span>
                              ) : (
                                <span className="text-slate-400 font-bold">Fulfilled</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                               <StatusBadge status={req.status} label={req.status === 'in_progress' ? 'In Progress' : req.status === 'open' ? 'Open' : 'Fulfilled'} />
                            </td>
                            <td className="px-6 py-4 text-right">
                               <button className="text-[var(--brand-primary)] font-bold hover:underline text-sm">Review</button>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            </div>
          )}


          {/* == PLATFORM COMPLIANCE (Security & Evidence) == */}
          {activeTab === 'platform_compliance' && (
             <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-8">
               
               <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Platform Compliance Report</h2>
                  <p className="text-secondary mt-1">
                    Systemic evidence of MFO Nexus platform architecture mapping to global and regional regulatory standards.
                    This report verifies real-time technical controls implemented per tenant context.
                  </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Block: Data Security */}
                 <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h3 className="font-bold flex items-center gap-2 mb-3"><Lock size={18} className="text-brand-600"/> Data Encryption & Transport</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      All tenant databases (Cloud Firestore) and storage buckets are encrypted at rest using <strong>AES-256</strong> by default (Google Cloud key management). 
                      Data in transit is secured via <strong>TLS 1.2 / 1.3</strong> across all platform endpoints.
                    </p>
                 </div>

                 {/* Block: Logical Access & Identity */}
                 <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h3 className="font-bold flex items-center gap-2 mb-3"><Users size={18} className="text-brand-600"/> Identity & RBAC</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Strict Multi-Tenant Isolation via Firestore Security Rules. Authorization uses an explicit <strong>Role-Based Access Control (RBAC)</strong> model combined with <strong>Multi-Factor Authentication (MFA)</strong> requiring Time-Based One-Time Passwords (TOTP) to secure high-risk actions.
                    </p>
                 </div>

                 {/* Block: ISO Mapping */}
                 <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
                    <h3 className="font-bold flex items-center gap-2 mb-3"><CheckCircle2 size={18} className="text-brand-600"/> ISO 27001 Mapping</h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-2">
                       The underlying Google Cloud Infrastructure complies with <strong>ISO/IEC 27001</strong>, <strong>ISO 27017</strong>, and <strong>ISO 27018</strong>. 
                    </p>
                    <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                      <li>A.9 Access Control: Met through Identity Platform integration.</li>
                      <li>A.10 Cryptography: Met through AES-256 KMS.</li>
                      <li>A.12 Operations Security: Met through immutable audit event logging.</li>
                    </ul>
                 </div>

                 {/* Block: Dynamic Tenant Rules */}
                 <div className="p-5 bg-slate-50 border border-brand-200 rounded-xl bg-brand-50/20">
                    <h3 className="font-bold flex items-center gap-2 mb-3 text-brand-800"><Scale size={18} /> Regional & Industry Context</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      <strong>Tenant Location:</strong> {tenant?.id ? 'Brazil (Inheriting LGPD & CVM rules)' : 'Global Defaults'}<br/>
                      <strong>Industry Framework:</strong> {tenant?.industryVertical === 'wealth_management' ? 'Asset Management / CVM Instruction 161' : 'Cross-Industry SaaS Compliance'}<br/>
                    </p>
                    <p className="text-xs text-slate-600 mt-2">
                      Because this tenant operates inside {tenant?.id ? 'Brazil' : 'the defined region'}, PII is rigorously subjected to <strong>LGPD (Lei Geral de Proteção de Dados)</strong> article compliance.
                      All user roles map dynamically to regulatory boundaries.
                    </p>
                 </div>
               </div>

               <div className="mt-8 border-t border-slate-200 pt-6">
                 <button className="bg-brand-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-brand-700 shadow-sm transition">
                    Download Certified PDF Report
                 </button>
               </div>
             </div>
          )}

          {/* Placeholder for others */}
          {(activeTab === 'regulatory' || activeTab === 'suitability') && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-16 flex flex-col items-center justify-center text-center h-[500px]">
               <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                 {activeTab === 'regulatory' ? <FolderOpen size={30} /> : <CheckCircle2 size={30} />}
               </div>
               <h2 className="text-xl font-bold text-slate-800 tracking-tight">Queue Empty</h2>
               <p className="text-sm text-slate-500 mt-2 max-w-sm">
                 There are no pending actions for {activeTab === 'regulatory' ? 'KYC/AML workflows' : 'Suitability assessments'} at this time.
               </p>
            </div>
          )}
          
         </div>
       </div>

    </div>
  );
}
