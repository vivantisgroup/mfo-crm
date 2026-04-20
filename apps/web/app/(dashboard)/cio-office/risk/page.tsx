import React from 'react';
import { ShieldAlert, TrendingDown } from 'lucide-react';

export default function RiskStressPage() {
  return (
    <div className="flex-1 bg-[var(--bg-background)] p-6 md:p-10 space-y-8 animate-fade-in">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">Risk & Stress Testing</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Limites de liquidez, VaR (Value at Risk) holístico e correlações para mitigar riscos sistêmicos da casa.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="bg-red-50 border border-red-100 rounded-xl p-5 shadow-sm text-red-900 flex flex-col justify-between">
             <div className="flex items-center gap-2 mb-2 opacity-80">
                <ShieldAlert size={18}/>
                <span className="font-semibold text-sm">Alerta de Concentração</span>
             </div>
             <h2 className="text-2xl font-black">Emissor BRL Corp</h2>
             <p className="text-xs opacity-70 mt-1">A exposição consolidada de 3 famílias ultrapassou 10% do AUM em debêntures do mesmo emissor.</p>
         </div>

         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
             <div className="flex items-center gap-2 mb-2 text-slate-500">
                <TrendingDown size={18}/>
                <span className="font-semibold text-sm w-full">Stress Test Scenario: Selic +300bps</span>
             </div>
             <h2 className="text-3xl font-black text-slate-800">-4.2%</h2>
             <p className="text-xs text-slate-400 mt-1">Impacto estimado no portfólio "Dinâmico" da casa.</p>
         </div>
         
         <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
             <div className="flex items-center gap-2 mb-2 text-slate-500">
                <span className="font-semibold text-sm w-full">Liquidez Global (MFO)</span>
             </div>
             <h2 className="text-3xl font-black text-slate-800">42%</h2>
             <p className="text-xs text-slate-400 mt-1">Dos ativos geridos possuem liquidez D+0 até D+5.</p>
             <div className="w-full bg-slate-100 h-2 mt-3 rounded overflow-hidden">
                 <div className="bg-green-500 h-full" style={{width: '42%'}}></div>
             </div>
         </div>
      </div>

      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
           <h2 className="font-bold text-[var(--text-primary)]">Mapa de Calor: Correlações</h2>
        </div>
        <div className="p-10 text-center text-slate-400 bg-slate-50/50 min-h-[300px] flex items-center justify-center">
           [ Tabela de Correlação Entre Classes e Fundos Aprovados ]
        </div>
      </div>
    </div>
  );
}
