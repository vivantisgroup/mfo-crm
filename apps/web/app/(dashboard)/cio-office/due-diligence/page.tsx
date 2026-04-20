import React from 'react';
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react';

export default function DueDiligencePage() {
  return (
    <div className="flex-1 bg-[var(--bg-background)] p-6 md:p-10 space-y-8 animate-fade-in">
      <header className="mb-8 flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">Due Diligence & Pipeline</h1>
           <p className="text-sm text-[var(--text-secondary)] mt-1">
             Esteira de aprovação de ativos, fundos e gestores externos. Faça upload de Lâminas e Prospectos para extração de dados via IA.
           </p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 shadow-sm transition">
           <UploadCloud size={16} /> Importar Prospecto
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Pipeline Board */}
         <div className="col-span-1 border border-slate-200 bg-slate-50/50 rounded-xl p-4 min-h-[500px]">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-slate-700">Triagem Inicial (2)</h3>
             </div>
             <div className="space-y-3">
                 <div className="bg-white p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
                     <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded mb-2 inline-block">Credit</span>
                     <h4 className="font-bold text-sm text-slate-800">FIDC Infra Master</h4>
                     <p className="text-xs text-slate-500 mt-1 flex gap-1"><FileText size={12}/> Documento extraído aguardando revisão</p>
                 </div>
                 <div className="bg-white p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
                     <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded mb-2 inline-block">Equity Long Bias</span>
                     <h4 className="font-bold text-sm text-slate-800">Verde AM Ações</h4>
                     <p className="text-xs text-slate-500 mt-1 flex gap-1"><CheckCircle2 size={12} className="text-green-500"/> IA Completada</p>
                 </div>
             </div>
         </div>

         <div className="col-span-1 border border-slate-200 bg-slate-50/50 rounded-xl p-4 min-h-[500px]">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-slate-700">Comitê & Aprovação (1)</h3>
             </div>
             <div className="space-y-3">
                 <div className="bg-white p-4 rounded-lg bg-white border border-slate-200 shadow-sm border-l-4 border-l-orange-400">
                     <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-100 px-2 py-0.5 rounded mb-2 inline-block">Global Macro</span>
                     <h4 className="font-bold text-sm text-slate-800">SPX Nimitz FIC FIM</h4>
                     <p className="text-xs text-slate-500 mt-1">Aguardando parecer final do Risk.</p>
                 </div>
             </div>
         </div>

         <div className="col-span-1 border border-slate-200 bg-slate-50/50 rounded-xl p-4 min-h-[500px]">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-slate-700">Aprovados / Monitoramento (10+)</h3>
             </div>
             <div className="bg-white border text-center border-slate-200 text-slate-400 p-8 rounded-lg">
                 [ Tabela de Ativos Aprovados na Plataforma ]
             </div>
         </div>
      </div>
    </div>
  );
}
