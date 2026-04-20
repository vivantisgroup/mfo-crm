import React, { useMemo } from 'react';
import { Folder, FileText, Plus } from 'lucide-react';

export function ChartOfAccountsView({ accounts }: { accounts: any[] }) {

  // Build tree from raw accounts
  const tree = useMemo(() => {
     const map = new Map();
     accounts.forEach(a => map.set(a.code, { ...a, children: [] }));
     
     const roots: any[] = [];
     
     // Due to unordered loading, iterate again to link children
     accounts.forEach((a) => {
        if (a.parent && map.has(a.parent)) {
           map.get(a.parent).children.push(map.get(a.code));
        } else if (!a.parent) {
           roots.push(map.get(a.code));
        }
     });

     // Sort roots and children by code
     const sortNode = (nodes: any[]) => {
        nodes.sort((x, y) => x.code.localeCompare(y.code));
        nodes.forEach(n => sortNode(n.children));
     };
     sortNode(roots);
     
     return roots;
  }, [accounts]);

  const renderTree = (nodes: any[], level = 0) => {
     return (
       <div className={`ml-${level > 0 ? 6 : 0} flex flex-col gap-1`}>
          {nodes.map(n => (
             <React.Fragment key={n.code}>
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${level === 0 ? 'bg-slate-800 text-white font-bold border-slate-700 mt-2' : level === 1 ? 'bg-slate-100 font-bold border-slate-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                   {n.children.length > 0 ? <Folder size={16} className={level === 0 ? 'text-indigo-400' : 'text-slate-400'} /> : <FileText size={16} className="text-slate-300" />}
                   <span className={`w-16 ${level === 0 ? 'opacity-80' : 'text-indigo-600'}`}>{n.code}</span>
                   <span className="flex-1">{n.name}</span>
                   <span className="text-xs font-bold opacity-50">{n.children.length} sub-accounts</span>
                </div>
                {n.children.length > 0 && renderTree(n.children, level + 1)}
             </React.Fragment>
          ))}
       </div>
     );
  };

  return (
    <div className="w-full h-full p-8 overflow-y-auto animate-fade-in bg-slate-50/50">
       <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-semibold tracking-tight mb-2 text-2xl font-bold">Plano de Contas</h3>
            <div className="text-sm text-[var(--text-secondary)]">Chart of Accounts structure for financial tagging and reporting.</div>
          </div>
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 shadow bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-white"><Plus className="mr-2 h-4 w-4" /> Add Account</button>
       </div>

       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-4xl mx-auto">
          {tree.length > 0 ? renderTree(tree) : (
             <div className="p-10 text-center text-slate-500 font-bold">Loading Standard Structure...</div>
          )}
       </div>
    </div>
  );
}
