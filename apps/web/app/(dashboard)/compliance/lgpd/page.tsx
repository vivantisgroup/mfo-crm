'use client';

import React, { useState } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { ShieldAlert, Users, FileText, Search, Filter } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

export default function GlobalLgpdDashboard() {
  usePageTitle('LGPD & Privacy Data Center');

  // Hardcoded mock for the global view. In real app, fetch from all families.
  const [activeRequests] = useState([
    { id: 'REQ-1092', family: '001-RKI (Andrade)', subject: 'Felipe Andrade', type: 'Exclusão de Dados (Termo F)', status: 'in_progress', slaInDays: 4 },
    { id: 'REQ-1093', family: '002-MRB (Silva)', subject: 'Marina Silva', type: 'Acesso / Exportação de Portfólio', status: 'open', slaInDays: 12 },
    { id: 'REQ-1094', family: '004-TRL (Lima)', subject: 'Tiago Lima', type: 'Retificação de Base Legal', status: 'fulfilled', slaInDays: 0 },
  ]);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
       {/* Header Strip */}
       <div className="bg-white px-8 py-4 border-b border-slate-200 flex justify-between items-center z-10">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ShieldAlert className="text-rose-500"/> Privacy Operations Center</h1>
            <p className="text-sm text-slate-500">Monitoramento global de conformidade LGPD e Data Subject Requests (DSR).</p>
          </div>
          <div className="flex gap-3">
             <button className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition">
               <FileText size={16} /> Relatório de Impacto (RIPD)
             </button>
          </div>
       </div>

       {/* KPIs */}
       <div className="px-8 py-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Users size={24}/></div>
             <div><div className="text-3xl font-black text-slate-800">142</div><div className="text-xs text-slate-500 font-bold uppercase tracking-wide">Titulares Rastreados</div></div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><ShieldAlert size={24}/></div>
             <div><div className="text-3xl font-black text-slate-800">98%</div><div className="text-xs text-slate-500 font-bold uppercase tracking-wide">Taxa de Consentimento</div></div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600"><FileText size={24}/></div>
             <div><div className="text-3xl font-black text-rose-700">2</div><div className="text-xs text-rose-600/70 font-bold uppercase tracking-wide">DSRs Abertos</div></div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><ShieldAlert size={24}/></div>
             <div><div className="text-3xl font-black text-slate-800">1</div><div className="text-xs text-slate-500 font-bold uppercase tracking-wide">Risco de SLA Alto</div></div>
          </div>
       </div>

       {/* DSR Table */}
       <div className="px-8 pb-8 flex-1 overflow-auto">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm h-full flex flex-col">
             <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
                 <h2 className="font-bold text-slate-800">Fila de Requisição de Titulares (DSR Queue)</h2>
                 <div className="flex gap-2">
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                       <input type="text" placeholder="Buscar titular..." className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <button className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"><Filter size={16}/></button>
                 </div>
             </div>
             
             <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm text-slate-600">
                   <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-6 py-4 font-semibold">ID</th>
                        <th className="px-6 py-4 font-semibold">Família</th>
                        <th className="px-6 py-4 font-semibold">Titular (Subject)</th>
                        <th className="px-6 py-4 font-semibold">Tipo de Requisição</th>
                        <th className="px-6 py-4 font-semibold">SLA Restante</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 font-semibold text-right">Ação</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 text-slate-700">
                      {activeRequests.map(req => (
                        <tr key={req.id} className="hover:bg-slate-50 transition cursor-pointer">
                           <td className="px-6 py-4 font-mono font-medium text-indigo-600">{req.id}</td>
                           <td className="px-6 py-4 font-medium">{req.family}</td>
                           <td className="px-6 py-4">{req.subject}</td>
                           <td className="px-6 py-4">{req.type}</td>
                           <td className="px-6 py-4">
                             {req.slaInDays > 0 ? (
                               <span className={`font-semibold ${req.slaInDays <= 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                 {req.slaInDays} dias
                               </span>
                             ) : (
                               <span className="text-slate-400 font-medium">Resolvido</span>
                             )}
                           </td>
                           <td className="px-6 py-4">
                              <StatusBadge status={req.status} label={req.status === 'in_progress' ? 'Em Progresso' : req.status === 'open' ? 'Aberto' : 'Resolvido'} />
                           </td>
                           <td className="px-6 py-4 text-right">
                              <button className="text-indigo-600 font-semibold hover:text-indigo-800 text-sm">Analisar</button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
       </div>

    </div>
  );
}
