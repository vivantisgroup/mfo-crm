'use client';

import React, { useState } from 'react';
import { Briefcase, ActivitySquare, BrainCircuit } from 'lucide-react';
import { AllocationEngine } from './components/AllocationEngine';
import { LongevitySimulator } from './components/LongevitySimulator';
export { AdvisorSimulator } from './components/AdvisorSimulator';

export default function FinancialEngineerPage() {
  const [currentModule, setCurrentModule] = useState<'allocation' | 'longevity' | 'advisor'>('allocation');

  // Let's lazy load or just render dynamically
  const renderModule = () => {
     if (currentModule === 'allocation') return <AllocationEngine />;
     if (currentModule === 'longevity') return <LongevitySimulator />;
     // Dynamic import to avoid circular dependencies or simply load it here
     const { AdvisorSimulator } = require('./components/AdvisorSimulator');
     return <AdvisorSimulator />;
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-200 overflow-y-auto">
      {/* HEADER TABS */}
      <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-slate-950/80 backdrop-blur-md z-10 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">MFO Advisory Hub</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Wealth Planning, Longevity & AI Strategy</p>
        </div>
        
        <div className="flex bg-slate-900 border border-white/10 rounded-xl p-1 shadow-inner gap-1">
          <button
            onClick={() => setCurrentModule('allocation')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-all ${currentModule === 'allocation' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Briefcase size={14} />
            Alocação Estrutural
          </button>
          <button
            onClick={() => setCurrentModule('longevity')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-all ${currentModule === 'longevity' ? 'bg-indigo-600 outline-none ring-1 ring-indigo-500/50 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ActivitySquare size={14} />
            Glide Path (Drawdown)
          </button>
          <button
            onClick={() => setCurrentModule('advisor')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-all ${currentModule === 'advisor' ? 'bg-emerald-600 outline-none ring-1 ring-emerald-500/50 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <BrainCircuit size={14} />
            AI Wealth Advisor
          </button>
        </div>
      </div>

      {/* RENDER MODULE */}
      <div className="flex-1 p-8">
        {renderModule()}
      </div>
    </div>
  );
}
