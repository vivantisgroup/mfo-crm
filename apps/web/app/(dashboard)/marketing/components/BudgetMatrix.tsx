import React, { useState } from 'react';
import { MarketingBudgetPlan } from '@/lib/marketingService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatUsd } from '@/lib/subscriptionService';
import { Save, RefreshCw, Calculator } from 'lucide-react';

interface BudgetMatrixProps {
  plan: MarketingBudgetPlan | null;
  onSave: (plan: Partial<MarketingBudgetPlan>) => void;
  saving: boolean;
}

export function BudgetMatrix({ plan, onSave, saving }: BudgetMatrixProps) {
  const [localPlan, setLocalPlan] = useState<Partial<MarketingBudgetPlan>>(
    plan || {
      year: new Date().getFullYear(),
      totalBudget: 0,
      allocations: { q1: 0, q2: 0, q3: 0, q4: 0 },
      channels: { digital: 0, events: 0, sponsorship: 0, print: 0 }
    }
  );

  const handleAllocationChange = (q: keyof MarketingBudgetPlan['allocations'], val: string) => {
    const num = parseFloat(val) || 0;
    setLocalPlan(prev => ({
      ...prev,
      allocations: { ...prev.allocations!, [q]: num }
    }));
  };

  const handleChannelChange = (ch: keyof MarketingBudgetPlan['channels'], val: string) => {
    const num = parseFloat(val) || 0;
    setLocalPlan(prev => ({
      ...prev,
      channels: { ...prev.channels!, [ch]: num }
    }));
  };

  const currentTotalQ = Object.values(localPlan.allocations || {}).reduce((a, b) => a + b, 0);
  const currentTotalCh = Object.values(localPlan.channels || {}).reduce((a, b) => a + b, 0);
  
  const isBalanced = currentTotalQ === currentTotalCh;

  return (
    <Card className="rounded-xl overflow-hidden border-slate-200 shadow-sm bg-white">
      <CardHeader className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold tracking-wide text-slate-800 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-slate-500" />
          Budget Allocation Matrix - {localPlan.year}
        </CardTitle>
        <button 
          onClick={() => onSave({ ...localPlan, totalBudget: currentTotalQ })}
          disabled={saving || !isBalanced}
          className="text-xs font-semibold px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
        >
          {saving ? <RefreshCw className="h-3 w-3 animate-spin"/> : <Save className="h-3 w-3" />}
          {saving ? 'Salvando...' : 'Salvar Matriz'}
        </button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          
          {/* Quarterly Allocations */}
          <div className="p-6 bg-white">
             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Quarterly Limits</h4>
             <div className="space-y-3">
               {(['q1', 'q2', 'q3', 'q4'] as const).map(q => (
                 <div key={q} className="flex items-center justify-between">
                   <label className="text-sm font-medium text-slate-700 uppercase">{q}</label>
                   <div className="relative w-32">
                     <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
                     <input 
                       type="number"
                       value={localPlan.allocations?.[q] || ''}
                       onChange={e => handleAllocationChange(q, e.target.value)}
                       className="w-full text-right py-1 pl-6 pr-2 text-sm border-b border-slate-200 focus:outline-none focus:border-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors"
                     />
                   </div>
                 </div>
               ))}
               <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-sm font-bold text-slate-800">Total</span>
                  <span className="text-sm font-bold text-slate-800">{formatUsd(currentTotalQ)}</span>
               </div>
             </div>
          </div>

          {/* Channel Allocations */}
          <div className="p-6 bg-slate-50/50">
             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Channel Routing</h4>
             <div className="space-y-3">
               {(['digital', 'events', 'sponsorship', 'print'] as const).map(ch => (
                 <div key={ch} className="flex items-center justify-between">
                   <label className="text-sm font-medium text-slate-700 capitalize">{ch}</label>
                   <div className="relative w-32">
                     <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
                     <input 
                       type="number"
                       value={localPlan.channels?.[ch] || ''}
                       onChange={e => handleChannelChange(ch, e.target.value)}
                       className="w-full text-right py-1 pl-6 pr-2 text-sm border-b border-slate-200 focus:outline-none focus:border-slate-500 bg-white hover:bg-slate-50 transition-colors"
                     />
                   </div>
                 </div>
               ))}
               <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-sm font-bold text-slate-800">Target</span>
                  <span className={`text-sm font-bold ${isBalanced ? 'text-slate-800' : 'text-rose-600'}`}>
                    {formatUsd(currentTotalCh)}
                  </span>
               </div>
               {!isBalanced && (
                 <p className="text-[10px] text-rose-500 text-right font-medium">Channel target must match Quarterly total ({formatUsd(currentTotalQ)}) to save.</p>
               )}
             </div>
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
}
