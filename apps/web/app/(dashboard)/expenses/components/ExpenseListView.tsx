import React from 'react';
import { Receipt, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export function ExpenseListView({ expenses, onSelect, selectedIds, toggleSelection }: { 
   expenses: any[], 
   onSelect: (exp: any) => void,
   selectedIds: Set<string>,
   toggleSelection: (id: string) => void 
}) {
  if (expenses.length === 0) {
     return (
        <div className="card text-center py-20 border-dashed bg-slate-50">
          <div className="text-6xl mb-4 opacity-50">🧾</div>
          <h3 className="text-lg font-extrabold text-slate-800 mb-2">No expenses found</h3>
          <p className="text-slate-500 max-w-sm mx-auto text-sm">Submit your first expense report to get started.</p>
        </div>
     );
  }

  const StatusBadge = ({ status }: { status: string }) => {
     if (status === 'draft') return <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-slate-100 text-slate-800 shadow"><Clock className="mr-1 h-3 w-3" /> Draft</span>;
     if (status === 'submitted') return <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-amber-100 text-amber-800 shadow"><AlertCircle className="mr-1 h-3 w-3" /> Pending Approval</span>;
     if (status === 'approved') return <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-emerald-100 text-emerald-800 shadow"><CheckCircle2 className="mr-1 h-3 w-3" /> Approved</span>;
     if (status === 'reimbursed') return <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-indigo-100 text-indigo-800 shadow"><CheckCircle2 className="mr-1 h-3 w-3" /> Reimbursed</span>;
     return <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-slate-100 text-slate-800 shadow">{status}</span>;
  };

  return (
    <div className="card overflow-hidden shadow-sm border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
             <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4 w-12 text-center"></th>
                <th className="p-4">Description</th>
                <th className="p-4 hidden md:table-cell">Category</th>
                <th className="p-4 hidden lg:table-cell">Date</th>
                <th className="p-4 hidden sm:table-cell">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 w-12"></th>
             </tr>
          </thead>
          <tbody>
             {expenses.map(exp => {
                const dateRaw = exp.date || exp.createdAt;
                const formattedDate = dateRaw ? new Date(dateRaw).toLocaleDateString() : 'N/A';
                const formattedAmount = exp.amount ? `R$ ${Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00';
                
                return (
                   <tr 
                     key={exp.id} 
                     onClick={() => onSelect(exp)}
                     className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors group ${selectedIds.has(exp.id) ? 'bg-red-50/30' : ''}`}
                   >
                      <td className="p-4 text-center" onClick={(e) => { e.stopPropagation(); toggleSelection(exp.id); }}>
                         <input 
                           type="checkbox" 
                           checked={selectedIds.has(exp.id)} 
                           onChange={() => {}} 
                           className="w-4 h-4 cursor-pointer accent-indigo-600" 
                         />
                      </td>
                      <td className="p-4 font-bold text-slate-800 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center text-xs font-bold border border-slate-200 bg-white text-indigo-700 shrink-0">
                           <Receipt size={16} />
                         </div>
                         <span className="truncate group-hover:text-indigo-600 transition-colors">{exp.title || 'Untitled Expense'}</span>
                      </td>
                      <td className="p-4 hidden md:table-cell text-slate-600">
                         <span className="inline-flex flex-wrap items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold">
                            {exp.category || 'General'}
                         </span>
                      </td>
                      <td className="p-4 hidden lg:table-cell text-slate-500 font-medium">
                         {formattedDate}
                      </td>
                      <td className="p-4 hidden sm:table-cell font-bold text-slate-700">
                         {formattedAmount}
                      </td>
                      <td className="p-4">
                         <StatusBadge status={exp.status || 'draft'} />
                      </td>
                      <td className="p-4 text-right">
                         <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      </td>
                   </tr>
                );
             })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
