import React from 'react';
import { Mail, Briefcase, ChevronRight } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { Avatar } from '@/components/Avatar';

export function EmployeeListView({ employees, teams, families, onSelect, selectedIds, toggleSelection }: { 
   employees: any[], 
   teams: any[],
   families: any[],
   onSelect: (emp: any) => void,
   selectedIds: Set<string>,
   toggleSelection: (id: string) => void 
}) {
  const familiesByTeam = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    families.forEach(f => {
      if (f.serviceTeamId) {
        if (!map[f.serviceTeamId]) map[f.serviceTeamId] = [];
        map[f.serviceTeamId].push(f);
      }
    });
    return map;
  }, [families]);
  if (employees.length === 0) {
     return (
        <div className="card text-center py-20 border-dashed bg-slate-50">
          <div className="text-6xl mb-4 opacity-50">👔</div>
          <h3 className="text-lg font-extrabold text-slate-800 mb-2">No internal staff found.</h3>
          <p className="text-slate-500 max-w-sm mx-auto text-sm">Use the Odoo ERP Sync to migrate hr.employee records or manually invite team members.</p>
        </div>
     );
  }

  return (
    <div className="card overflow-hidden shadow-sm border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
             <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4 w-12 text-center">
                   {/* Header checkbox could go here for select all */}
                </th>
                <th className="p-4">Name</th>
                <th className="p-4 hidden sm:table-cell">Job Title</th>
                <th className="p-4 hidden md:table-cell">Department</th>
                <th className="p-4 hidden lg:table-cell">Coverage</th>
                <th className="p-4 hidden lg:table-cell">Contact Info</th>
                <th className="p-4 w-12"></th>
             </tr>
          </thead>
          <tbody>
             {employees.map(emp => {
                const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Unknown Staff';
                const title = emp.jobTitle || emp.odooData?.job_id || 'Staff Member';
                const dept = emp.department || emp.odooData?.department_id || 'Operations';
                const email = emp.email || emp.work_email || '';
                
                return (
                   <tr 
                     key={emp.id} 
                     onClick={() => onSelect(emp)}
                     className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors group ${selectedIds.has(emp.id) ? 'bg-red-50/30' : ''}`}
                   >
                      <td className="p-4 text-center" onClick={(e) => { e.stopPropagation(); toggleSelection(emp.id); }}>
                         <input 
                           type="checkbox" 
                           checked={selectedIds.has(emp.id)} 
                           onChange={() => {}} 
                           className="w-4 h-4 cursor-pointer accent-indigo-600" 
                         />
                      </td>
                      <td className="p-4 font-bold text-slate-800 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold border border-slate-200 bg-white text-indigo-700 shrink-0">
                           {emp.avatarUrl ? (
                              <img src={emp.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                           ) : (
                              getInitials(fullName)
                           )}
                         </div>
                         <span className="truncate group-hover:text-indigo-600 transition-colors">{fullName}</span>
                      </td>
                      <td className="p-4 hidden sm:table-cell text-slate-600 font-medium">{title}</td>
                      <td className="p-4 hidden md:table-cell text-slate-600">
                         <span className="inline-flex flex-wrap items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold">
                            {dept}
                         </span>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                         <div className="flex flex-wrap gap-1">
                           {(() => {
                             const employeeTeams = teams.filter(t => t.members?.some((m: any) => m.uid === emp.id));
                             const employeeFamilies = employeeTeams.flatMap(t => familiesByTeam[t.id] || []);
                             const uniqueFamilies = Array.from(new Map(employeeFamilies.map(f => [f.id, f])).values());
                             
                             if (uniqueFamilies.length === 0) return <span className="text-[10px] text-slate-400 font-medium">Unassigned</span>;
                             
                             // Show up to 2 families, then +X more
                             const visible = uniqueFamilies.slice(0, 2);
                             const hidden = uniqueFamilies.length - 2;
                             return (
                               <>
                                 {visible.map((f: any) => (
                                   <span key={f.id} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                     {f.name}
                                   </span>
                                 ))}
                                 {hidden > 0 && <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">+{hidden} more</span>}
                               </>
                             );
                           })()}
                         </div>
                      </td>
                      <td className="p-4 hidden lg:table-cell text-slate-500 font-medium">
                         {email ? <a href={`mailto:${email}`} onClick={e=>e.stopPropagation()} className="hover:text-indigo-600 transition-colors">{email}</a> : <span className="opacity-50">-</span>}
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
