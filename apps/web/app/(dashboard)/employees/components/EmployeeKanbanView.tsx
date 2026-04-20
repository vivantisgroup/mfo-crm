import React, { useMemo } from 'react';
import { Mail, Briefcase } from 'lucide-react';
import { getInitials } from '@/lib/utils';

export function EmployeeKanbanView({ employees, onSelect, selectedIds, toggleSelection }: { 
   employees: any[], 
   onSelect: (emp: any) => void,
   selectedIds: Set<string>,
   toggleSelection: (id: string) => void 
}) {
  
  // Group employees by department
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    employees.forEach(emp => {
      const dept = emp.department || emp.odooData?.department_id || 'Unassigned / Operations';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(emp);
    });
    return groups;
  }, [employees]);

  if (employees.length === 0) {
     return (
        <div className="card text-center py-20 border-dashed bg-slate-50">
          <div className="text-6xl mb-4 opacity-50">👔</div>
          <h3 className="text-lg font-extrabold text-slate-800 mb-2">No internal staff found.</h3>
          <p className="text-slate-500 max-w-sm mx-auto text-sm">Use the Odoo ERP Sync to migrate hr.employee records or manually invite team members.</p>
        </div>
     );
  }

  const columns = Object.keys(grouped).sort();

  return (
    <div className="flex gap-5 overflow-x-auto pb-6 h-full items-start">
      {columns.map(dept => {
         const items = grouped[dept];
         
         return (
            <div key={dept} className="flex-shrink-0 w-80 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col max-h-full">
               <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-slate-50 rounded-t-2xl z-10">
                  <h3 className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] truncate">{dept}</h3>
                  <span className="w-6 h-6 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-500 flex items-center justify-center shadow-sm">
                     {items.length}
                  </span>
               </div>
               
               <div className="p-3 flex flex-col gap-3 overflow-y-auto">
                  {items.map(emp => {
                     const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Unknown Staff';
                     const title = emp.jobTitle || emp.odooData?.job_id || 'Staff Member';
                     const email = emp.email || emp.work_email || '';
                     const isSelected = selectedIds.has(emp.id);
                     
                     return (
                        <div 
                           key={emp.id}
                           onClick={() => onSelect(emp)}
                           className={`bg-white p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all relative group ${isSelected ? 'border-red-400 ring-1 ring-red-400 shadow-sm' : 'border-slate-200 hover:border-indigo-400'}`}
                        >
                           <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => toggleSelection(emp.id)}
                                className="w-4 h-4 cursor-pointer accent-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100" 
                                style={{ opacity: isSelected ? 1 : undefined }}
                              />
                           </div>

                           <div className="flex flex-col gap-3">
                              <div className="flex items-center gap-3 pr-6">
                                 <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold border border-slate-200 bg-slate-50 text-indigo-700 shrink-0">
                                   {emp.avatarUrl ? (
                                      <img src={emp.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                                   ) : (
                                      getInitials(fullName)
                                   )}
                                 </div>
                                 <div className="min-w-0">
                                    <h4 className="font-bold text-slate-800 text-sm truncate group-hover:text-indigo-600 transition-colors">{fullName}</h4>
                                    <div className="text-[10px] font-semibold text-slate-500 truncate uppercase mt-0.5 tracking-wider">{title}</div>
                                 </div>
                              </div>
                              
                              {email && (
                                 <div className="pt-3 mt-1 border-t border-slate-100">
                                    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 truncate">
                                       <Mail size={12} className="shrink-0 text-slate-400" /> 
                                       <span className="truncate">{email}</span>
                                    </div>
                                 </div>
                              )}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
         );
      })}
    </div>
  );
}
