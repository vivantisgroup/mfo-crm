import React from 'react';

export default function AssetAllocationPage() {
  return (
    <div className="flex-1 bg-[var(--bg-background)] p-6 md:p-10 space-y-8 animate-fade-in">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">Asset Allocation Engine</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Modelagem de portfólios, Rebalanceamento e Track Record Teórico (Paper Portfolios).
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {['Conservador', 'Moderado', 'Dinâmico', 'Agressivo'].map((perfil, i) => (
          <div key={Math.random()} className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors">
            <h3 className="font-bold text-[var(--text-primary)]">{perfil}</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Alocação Modelo</p>
            <div className="mt-4 flex items-baseline gap-2">
               <span className="text-2xl font-black text-indigo-600">{10 + i * 4}%</span>
               <span className="text-xs text-slate-500">YTD Teórico</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
           <h2 className="font-bold text-[var(--text-primary)]">Detalhes da Alocação Modelo (Moderado)</h2>
           <div className="flex gap-2">
             <button className="px-3 py-1.5 border border-slate-200 text-sm font-medium rounded hover:bg-slate-50">Backtest</button>
             <button className="px-3 py-1.5 bg-[var(--brand-primary)] text-white text-sm font-medium rounded hover:bg-opacity-90">Editar Pesos</button>
           </div>
        </div>
        <div className="p-10 text-center text-slate-400 bg-slate-50">
           [ Engine de Rebalanceamento & Gráficos de Fronteira Eficiente ]
        </div>
      </div>
    </div>
  );
}
