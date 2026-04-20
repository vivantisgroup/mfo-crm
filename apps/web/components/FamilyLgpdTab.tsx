import React, { useState } from 'react';
import { Shield, CheckCircle2, AlertTriangle, FileText, Lock } from 'lucide-react';
import { LgpdConsent, LgpdSubjectRequest } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';

interface Props {
  tenantId: string;
  familyId: string;
}

export function FamilyLgpdTab({ tenantId, familyId }: Props) {
  // Mock data representing LGPD constraints and Data Subject Requests
  const mockConsents: LgpdConsent[] = [
    { id: '1', familyId, purpose: 'Processamento de Dados Financeiros Básicos', status: 'granted', grantedAt: new Date(Date.now() - 5000000000).toISOString(), ipAddress: '192.168.1.1' },
    { id: '2', familyId, purpose: 'Compartilhamento com Parceiros Bancários', status: 'pending' },
    { id: '3', familyId, purpose: 'Comunicações de Marketing (Wealth)', status: 'revoked', revokedAt: new Date(Date.now() - 100000000).toISOString() },
  ];

  const mockRequests: LgpdSubjectRequest[] = [
    { id: 'req-1', familyId, type: 'access', status: 'fulfilled', requestedAt: new Date(Date.now() - 100000000).toISOString(), resolvedAt: new Date(Date.now() - 50000000).toISOString() },
    { id: 'req-2', familyId, type: 'deletion', status: 'in_progress', requestedAt: new Date(Date.now() - 86400000).toISOString(), details: 'Apagar registros não essenciais após encerramento do fundo A.' },
  ];

  return (
    <div className="space-y-6">
       
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-lg overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl pointer-events-none text-white"><Shield size={120}/></div>
          <div>
             <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><Lock size={20} className="text-emerald-400"/> Central de Privacidade e LGPD</h2>
             <p className="text-slate-400 text-sm">Gerencie o consentimento e as requisições ativas dos titulares de dados desta familía.</p>
          </div>
          <div className="flex gap-3 z-10">
             <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-semibold transition">
               Registrar Consentimento Manual
             </button>
             <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 rounded-lg text-sm font-semibold transition shadow-sm">
               Nova Requisição (DSR)
             </button>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Termos de Consentimento Ativos */}
         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800">
               <h3 className="font-bold text-slate-800 dark:text-slate-200">Termos de Consentimento (Bases Legais)</h3>
            </div>
            <div className="p-0">
               {mockConsents.map(consent => (
                 <div key={consent.id} className="p-4 border-b border-slate-100 dark:border-slate-800/60 last:border-0 flex items-start justify-between">
                    <div>
                       <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-1">{consent.purpose}</div>
                       <div className="text-xs text-slate-500">
                         {consent.status === 'granted' ? `Aceito em: ${formatDate(consent.grantedAt!)} - IP: ${consent.ipAddress}` : 
                          consent.status === 'revoked' ? `Revogado em: ${formatDate(consent.revokedAt!)}` : 'Aguardando ação do titular'}
                       </div>
                    </div>
                    <div>
                       <StatusBadge 
                         status={consent.status} 
                         label={consent.status === 'granted' ? 'Concedido' : consent.status === 'revoked' ? 'Revogado' : 'Pendente'}
                       />
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* Requisições de Direitos (DSR - Data Subject Requests) */}
         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
               <h3 className="font-bold text-slate-800 dark:text-slate-200">Requisições de Direitos (DSR)</h3>
               <span className="text-xs font-semibold bg-rose-100 text-rose-700 px-2 py-1 rounded dark:bg-rose-900/40 dark:text-rose-400">
                 SLA de 15 dias
               </span>
            </div>
            <div className="p-0">
               {mockRequests.map(req => (
                 <div key={req.id} className="p-4 border-b border-slate-100 dark:border-slate-800/60 last:border-0 flex items-start justify-between">
                    <div>
                       <div className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-1 flex items-center gap-2">
                         {req.type === 'deletion' ? <AlertTriangle size={14} className="text-rose-500"/> : <FileText size={14} className="text-blue-500" />}
                         {req.type}
                       </div>
                       <div className="text-xs text-slate-500 mb-2">Aberto em: {formatDate(req.requestedAt)}</div>
                       {req.details && <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded">{req.details}</div>}
                    </div>
                    <div>
                       <StatusBadge status={req.status} label={req.status.replace('_', ' ').toUpperCase()} />
                    </div>
                 </div>
               ))}
               {mockRequests.length === 0 && (
                 <div className="p-6 text-center text-slate-500 text-sm">
                    Nenhuma requisição ativa.
                 </div>
               )}
            </div>
         </div>
       </div>

    </div>
  );
}
