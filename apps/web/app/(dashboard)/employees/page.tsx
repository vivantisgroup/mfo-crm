'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, Plus, Download, List, LayoutDashboard, GitMerge, BarChart2, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { SecondaryDock, type SecondaryDockTab } from '@/components/SecondaryDock';
import { usePageTitle } from '@/lib/PageTitleContext';

// Import our new sub-components
import { EmployeeListView } from './components/EmployeeListView';
import { EmployeeKanbanView } from './components/EmployeeKanbanView';
import { EmployeeDetailView } from './components/EmployeeDetailView';
import { EmployeeDashboardView } from './components/EmployeeDashboardView';
import { AdvisorListView } from '@/components/AdvisorListView';
import { CoverageTeamView } from './components/CoverageTeamView';
import { toast } from 'sonner';

const MAIN_TABS: SecondaryDockTab[] = [
  { id: 'dashboard', label: 'Metrics', icon: BarChart2 },
  { id: 'list', label: 'Directory', icon: List },
  { id: 'kanban', label: 'Board', icon: LayoutDashboard },
  { id: 'org', label: 'Org Chart', icon: GitMerge },
  { id: 'advisors', label: 'Advisors', icon: Shield },
  { id: 'teams', label: 'Coverage Teams', icon: Users },
];

export default function EmployeesPage() {
  const { tenant, user } = useAuth();
  const { setTitle } = usePageTitle();
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  // UI State
  const [view, setView] = useState<'dashboard' | 'list' | 'kanban' | 'org' | 'advisors' | 'teams'>('dashboard');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  
  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Clear page title when in directory mode
  useEffect(() => {
    if (!selectedEmployee) {
      setTitle('Staff & Advisors', 'Internal Operations Directory');
    }
  }, [setTitle, selectedEmployee]);

  useEffect(() => {
    if (!user || !tenant?.id) return;
    const q1 = query(collection(db, 'tenants', tenant.id, 'employees'));
    const unsub1 = onSnapshot(q1, snap => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const q2 = query(collection(db, 'tenants', tenant.id, 'departments'));
    const unsub2 = onSnapshot(q2, snap => setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const q3 = query(collection(db, 'tenants', tenant.id, 'serviceTeams'));
    const unsub3 = onSnapshot(q3, snap => setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const q4 = query(collection(db, 'tenants', tenant.id, 'organizations'));
    const unsub4 = onSnapshot(q4, snap => setFamilies(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((o: any) => o.isFamily === true || o.type === 'family' || o.type === 'family_group')));

    setSelectedIds(new Set()); // Reset selections
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [tenant?.id, user]);

  // Clear selections when switching tabs
  useEffect(() => { setSelectedIds(new Set()); }, [view]);

  const toggleSelection = (id: string) => {
     const next = new Set(selectedIds);
     if (next.has(id)) next.delete(id);
     else next.add(id);
     setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !tenant?.id) return;
    if (!window.confirm(`Você tem certeza que deseja excluir os ${selectedIds.size} registros selecionados?`)) return;
    
    setIsDeleting(true);
    const batch = writeBatch(db);
    // Delete from either employees or departments depending on current view
    const collectionName = view === 'org' ? 'departments' : 'employees';
    
    selectedIds.forEach(id => {
       batch.delete(doc(db, 'tenants', tenant.id, collectionName, id));
    });
    
    try {
      await batch.commit();
      setSelectedIds(new Set());
    } catch (e) {
      console.error("Bulk delete failed", e);
      toast.error('Erro ao excluir registros');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(e => 
      (e.firstName?.toLowerCase().includes(q) || '') ||
      (e.lastName?.toLowerCase().includes(q) || '') ||
      (e.name?.toLowerCase().includes(q) || '') ||
      (e.jobTitle?.toLowerCase().includes(q) || '')
    );
  }, [employees, search]);

  const filteredDepts = useMemo(() => {
    if (!search) return departments;
    return departments.filter(d => d.name?.toLowerCase().includes(search.toLowerCase()));
  }, [departments, search]);

  const handleCloseDetail = React.useCallback(() => setSelectedEmployee(null), []);

  // Handle detailed view taking over the central column
  if (selectedEmployee) {
    return (
      <div className="relative w-full h-full flex flex-col bg-background text-foreground overflow-y-auto animate-fade-in overflow-y-auto pb-16">
         <EmployeeDetailView 
            employee={selectedEmployee} 
            departments={departments}
            onClose={handleCloseDetail} 
         />
      </div>
    );
  }

  // --- Rendering Org Chart Inline ---
  // (We abstract it here slightly but keep it clean)
  const renderOrgChart = () => {
     const byParent = departments.reduce((acc, d) => {
        const pId = d.parent_id || 'root';
        if (!acc[pId]) acc[pId] = [];
        acc[pId].push(d);
        return acc;
     }, {} as Record<string, any[]>);

     const renderNode = (node: any, level: number = 0) => {
        const children = byParent[node.id] || [];
        const isRoot = level === 0;
        const managerName = node.manager_id ? employees.find(e => e.id === node.manager_id || e.odooData?.id === node.manager_id)?.name : 'Sem Gestor';
        
        return (
           <div key={node.id} className="relative">
              <div 
                 onClick={() => toggleSelection(node.id)}
                 className={`p-4 border rounded-xl flex flex-col gap-2 relative cursor-pointer shadow-sm hover:shadow-md transition-shadow ${isRoot ? 'bg-indigo-50/50 border-indigo-200' : 'ml-8 border-slate-200 bg-white'} ${selectedIds.has(node.id) ? 'border-red-400 ring-1 ring-red-400 bg-red-50/30' : ''}`}
                 style={{ zIndex: 10 - level }}
              >
                 <div className="absolute top-4 right-4">
                   <input type="checkbox" checked={selectedIds.has(node.id)} onChange={() => {}} className="w-4 h-4 cursor-pointer accent-indigo-600" />
                 </div>
                 {!isRoot && (
                    <div className="absolute -left-6 top-6 w-6 border-b-2 border-l-2 border-slate-200 h-10 -mt-10 rounded-bl-xl" />
                 )}
                 <div className="flex items-center gap-3">
                    <div className="flex-1">
                       <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">{node.name}</h3>
                       <p className="text-xs text-slate-500 font-medium mt-0.5">Manager: <span className="font-bold text-slate-700">{managerName || 'None'}</span></p>
                    </div>
                 </div>
              </div>
              {children.length > 0 && (
                 <div className="mt-3 relative flex flex-col gap-3">
                    <div className="absolute left-4 top-0 bottom-6 w-0.5 bg-slate-200" style={{ zIndex: 0 }} />
                    {children.map((c: any) => renderNode(c, level + 1))}
                 </div>
              )}
           </div>
        );
     };

     const rootNodes = byParent['root'] || [];
     return (
        <div className="p-4 md:p-8 flex flex-col gap-8 max-w-4xl mx-auto">
           {rootNodes.length === 0 ? (
              <div className="card text-center py-20 border-dashed bg-slate-50">
                 <div className="text-4xl mb-4 opacity-50">🏢</div>
                 <p className="text-slate-500 font-medium">Nenhum departamento raíze encontrado.</p>
              </div>
           ) : (
              rootNodes.map((root: any) => renderNode(root, 0))
           )}
        </div>
     );
  };

  // Main Directory Pattern
  return (
    <div className="relative w-full h-full flex flex-col bg-background text-foreground overflow-y-auto flex flex-col overflow-hidden z-0">
      <SecondaryDock tabs={MAIN_TABS} activeTab={view} onTabChange={setView as any} />
      
      <main className="flex-1 flex flex-col min-h-0 relative animate-fade-in px-4 lg:px-8 pt-6 pb-12 overflow-y-auto w-full">
         
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex gap-3">
               {selectedIds.size > 0 && (
                  <Button 
                    variant="destructive"
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="gap-2"
                  >
                    {isDeleting ? 'Deleting...' : `Deletar (${selectedIds.size})`}
                  </Button>
               )}
            </div>

            <div className="flex gap-3 items-center w-full md:w-auto">
               <div className="relative flex-1 md:w-64">
                  <Search size={16} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)}
                    placeholder={view === 'org' ? "Search Departments..." : "Search Staff..."}
                    className="w-full pl-9 pr-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text-primary)] focus:ring-1 focus:ring-indigo-500 transition-all font-medium placeholder-[var(--text-tertiary)] shadow-sm outline-none"
                  />
               </div>
               <Button variant="ghost" className="gap-2 shrink-0"><Download size={16} className="hidden sm:block" /> <span className="hidden sm:block">Export</span></Button>
               <Button variant="default" className="gap-2 shrink-0"><Plus size={16} /> Invite</Button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] relative">
          {view === 'dashboard' && (
             <EmployeeDashboardView employees={employees} departments={departments} />
          )}

          {view === 'list' && (
             <EmployeeListView 
                employees={filteredEmployees}
                teams={teams}
                families={families}
                selectedIds={selectedIds}
                toggleSelection={toggleSelection}
                onSelect={setSelectedEmployee}
             />
          )}

          {view === 'kanban' && (
             <EmployeeKanbanView 
                employees={filteredEmployees}
                selectedIds={selectedIds}
                toggleSelection={toggleSelection}
                onSelect={setSelectedEmployee}
             />
          )}

          {view === 'org' && (
             <div className="h-full overflow-y-auto pb-20">
                {renderOrgChart()}
             </div>
          )}

          {view === 'advisors' && (
             <div className="h-full overflow-y-auto pb-20">
               <AdvisorListView />
             </div>
          )}

          {view === 'teams' && (
             <div className="h-full overflow-y-auto pb-20">
               <CoverageTeamView employees={employees} teamsProps={teams} familiesProps={families} />
             </div>
          )}
        </div>
      </main>
    </div>
  );
}
