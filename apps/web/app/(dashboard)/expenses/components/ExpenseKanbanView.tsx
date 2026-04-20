import React, { useMemo } from 'react';
import { Plus, GripVertical, CheckCircle2 } from 'lucide-react';
import { getInitials } from '@/lib/utils';

export function ExpenseKanbanView({ expenses, onSelect }: { 
   expenses: any[], 
   onSelect: (exp: any) => void
}) {

  const columns = useMemo(() => {
     const cols = {
        'draft': { title: 'Draft', color: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', items: [] as any[] },
        'submitted': { title: 'Pending Approval', color: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400', items: [] as any[] },
        'approved': { title: 'Approved', color: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', items: [] as any[] },
        'reimbursed': { title: 'Reimbursed', color: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-400', items: [] as any[] },
     };
     
     expenses.forEach(e => {
        const s = e.status || 'draft';
        if (cols[s as keyof typeof cols]) cols[s as keyof typeof cols].items.push(e);
        else cols['draft'].items.push(e);
     });
     return cols;
  }, [expenses]);

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden pb-4">
       <div className="flex gap-6 h-full min-w-max p-1">
          {Object.entries(columns).map(([id, col]) => (
             <div key={id} className={`w-80 flex flex-col rounded-2xl ${col.color} border border-slate-200/50`}>
                {/* Column Header */}
                <div className="p-4 flex items-center justify-between border-b border-slate-200/50">
                   <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${col.dot} shadow-sm`} />
                      <h3 className={`font-bold text-sm tracking-wide ${col.text}`}>{col.title}</h3>
                   </div>
                   <div className={`px-2 py-0.5 rounded-full text-xs font-bold bg-white/60 ${col.text} shadow-sm`}>
                      {col.items.length}
                   </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                   {col.items.map(exp => (
                      <div 
                         key={exp.id} 
                         onClick={() => onSelect(exp)}
                         className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all group"
                      >
                         <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-slate-800 text-sm line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                               {exp.title || 'Untitled Expense'}
                            </h4>
                            <GripVertical size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab shrink-0 ml-2" />
                         </div>
                         
                         <div className="text-xs text-slate-500 mb-3 drop-shadow-sm font-medium">
                            {exp.category || 'General'}
                         </div>
                         
                         <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                             <div className="font-extrabold text-slate-700 text-sm">
                                R$ {Number(exp.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                             </div>
                             <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                {exp.date ? new Date(exp.date).toLocaleDateString() : 'N/A'}
                             </div>
                         </div>
                      </div>
                   ))}

                   {col.items.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 opacity-50 px-4 text-center">
                         <div className={`w-10 h-10 rounded-full border-2 border-dashed ${col.text} border-current flex items-center justify-center mb-2`}>
                            <Plus size={16} />
                         </div>
                         <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Drop here</span>
                      </div>
                   )}
                </div>
             </div>
          ))}
       </div>
    </div>
  );
}
