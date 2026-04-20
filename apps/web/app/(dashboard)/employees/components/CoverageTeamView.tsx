'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getServiceTeams, saveServiceTeam, deleteServiceTeam, ServiceTeam, ServiceTeamMember, TEAM_ROLES, TEAM_ROLE_LABELS } from '@/lib/serviceTeamService';
import { Search, Plus, Trash2, Edit2, Users, Save, X, PlusCircle } from 'lucide-react';
import { Avatar, AvatarGroup } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/utils';
import { onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

export function CoverageTeamView({ employees, teamsProps, familiesProps }: { employees: any[], teamsProps: any[], familiesProps: any[] }) {
  const { tenant } = useAuth();
  
  // Use teams from props instead of fetching locally
  const teams = teamsProps;
  
  // Create a map to easily look up families by serviceTeamId
  const familiesByTeam = useMemo(() => {
    const map: Record<string, any[]> = {};
    familiesProps.forEach(f => {
      if (f.serviceTeamId) {
        if (!map[f.serviceTeamId]) map[f.serviceTeamId] = [];
        map[f.serviceTeamId].push(f);
      }
    });
    return map;
  }, [familiesProps]);

  const [search, setSearch] = useState('');

  // Editor state
  const [editingTeam, setEditingTeam] = useState<Partial<ServiceTeam> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New member selection state
  const [memberSearch, setMemberSearch] = useState('');

  // Fetch real-time service teams - REMOVED (now via props)


  const filteredTeams = useMemo(() => {
    return teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  }, [teams, search]);

  const availableEmployees = useMemo(() => {
    if (!editingTeam) return [];
    // exclude already added members
    const currentMemberIds = new Set(editingTeam.members?.map(m => m.uid) || []);
    return employees.filter(e => {
      const isIncluded = (e.name || `${e.firstName || ''} ${e.lastName || ''}`).toLowerCase().includes(memberSearch.toLowerCase());
      return !currentMemberIds.has(e.id) && isIncluded;
    });
  }, [employees, editingTeam, memberSearch]);

  const handleSaveTeam = async () => {
    if (!tenant?.id || !editingTeam || !editingTeam.name) return;
    setIsSaving(true);
    try {
      await saveServiceTeam(tenant.id, editingTeam);
      setEditingTeam(null);
    } catch (e) {
      console.error(e);
      toast.error('Error saving team');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!tenant?.id || !window.confirm('Delete this Coverage Team?')) return;
    try {
      await deleteServiceTeam(tenant.id, teamId);
    } catch (e) {
      console.error(e);
      toast.error('Error deleting team');
    }
  };

  const handleAddMember = (emp: any) => {
    if (!editingTeam) return;
    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Unknown Staff';
    const newMember: ServiceTeamMember = {
      uid: emp.id,
      name: fullName,
      email: emp.email || emp.work_email || '',
      role: 'analyst', // default
      photoURL: emp.avatarUrl || ''
    };
    setEditingTeam({
      ...editingTeam,
      members: [...(editingTeam.members || []), newMember]
    });
    setMemberSearch(''); // reset search
  };

  const handleRemoveMember = (uid: string) => {
    if (!editingTeam) return;
    setEditingTeam({
      ...editingTeam,
      members: (editingTeam.members || []).filter(m => m.uid !== uid)
    });
  };

  const handleUpdateMemberRole = (uid: string, role: any) => {
    if (!editingTeam) return;
    setEditingTeam({
      ...editingTeam,
      members: (editingTeam.members || []).map(m => m.uid === uid ? { ...m, role } : m)
    });
  };

  // ---------------------------------------------
  // RENDER EDIT VIEW
  // ---------------------------------------------
  if (editingTeam) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col gap-6 animate-fade-in pb-32">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
           <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
             <Users size={24} />
           </div>
           <div className="flex-1">
             <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
               {editingTeam.id ? 'Edit Coverage Team' : 'Create Coverage Team'}
             </h2>
             <p className="text-sm text-slate-500 font-medium mt-0.5">Define your service team structure and assign members to key roles.</p>
           </div>
           <div className="flex items-center gap-2">
             <Button variant="ghost" className="gap-2" onClick={() => setEditingTeam(null)}>
               <X size={16} /> Cancel
             </Button>
             <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={handleSaveTeam} disabled={isSaving || !editingTeam.name}>
               {isSaving ? 'Saving...' : <><Save size={16} /> Save Team</>}
             </Button>
           </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
           <div className="card p-6 shadow-sm border border-slate-200">
             <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider">Team Details</h3>
             <div className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-600 mb-1">Team Name <span className="text-red-500">*</span></label>
                 <input 
                   type="text" 
                   value={editingTeam.name || ''} 
                   onChange={e => setEditingTeam({ ...editingTeam, name: e.target.value })}
                   placeholder="e.g. Alpha Coverage Team"
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                 />
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-600 mb-1">Description (Optional)</label>
                 <textarea 
                   value={editingTeam.description || ''} 
                   onChange={e => setEditingTeam({ ...editingTeam, description: e.target.value })}
                   placeholder="Brief description of the team's responsibilities or targeted segment."
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                 />
               </div>
             </div>
           </div>

           <div className="card p-6 shadow-sm border border-slate-200">
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Team Members ({(editingTeam.members || []).length})</h3>
             </div>

             {/* Assigned Members */}
             <div className="space-y-3 mb-8">
               {(editingTeam.members || []).length === 0 ? (
                 <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm font-medium">
                   No members assigned. Search and add staff below.
                 </div>
               ) : (
                 (editingTeam.members || []).map(m => (
                   <div key={m.uid} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:shadow-md transition-shadow bg-white">
                     <div className="flex items-center gap-3">
                       <Avatar name={m.name} src={m.photoURL} size="md" />
                       <div>
                         <div className="font-bold text-slate-800 text-sm">{m.name}</div>
                         <div className="text-xs text-slate-500 font-medium">{m.email || 'No email provided'}</div>
                       </div>
                     </div>
                     <div className="flex items-center gap-3">
                       <select 
                         value={m.role}
                         onChange={(e) => handleUpdateMemberRole(m.uid, e.target.value)}
                         className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
                       >
                         {TEAM_ROLES.map(role => (
                           <option key={role} value={role}>{TEAM_ROLE_LABELS[role]}</option>
                         ))}
                       </select>
                       <button 
                         onClick={() => handleRemoveMember(m.uid)}
                         className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 transition-colors"
                         title="Remove from team"
                       >
                         <Trash2 size={16} />
                       </button>
                     </div>
                   </div>
                 ))
               )}
             </div>

             {/* Add New Members Search */}
             <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">Assign Additional Staff</h3>
             <div className="relative mb-3">
                <Search size={16} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text" 
                  value={memberSearch} 
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Find staff or advisors to add..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500 transition-all font-medium placeholder-slate-400 shadow-inner outline-none"
                />
             </div>
             
             {memberSearch.length > 0 && availableEmployees.length > 0 && (
               <div className="max-h-60 overflow-y-auto space-y-1 bg-slate-50 rounded-lg border border-slate-200 p-2">
                 {availableEmployees.slice(0, 10).map((emp: any) => {
                   const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Unknown';
                   const title = emp.jobTitle || emp.odooData?.job_id || 'Staff';
                   return (
                     <div key={emp.id} className="flex items-center justify-between p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all cursor-pointer group" onClick={() => handleAddMember(emp)}>
                       <div className="flex items-center gap-3">
                         <Avatar name={fullName} src={emp.avatarUrl} size="sm" />
                         <div>
                           <div className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{fullName}</div>
                           <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{title}</div>
                         </div>
                       </div>
                       <button className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                         <PlusCircle size={14} /> Add
                       </button>
                     </div>
                   );
                 })}
               </div>
             )}
             {memberSearch.length > 0 && availableEmployees.length === 0 && (
                <div className="text-center py-4 text-xs text-slate-500">No available staff found matching '{memberSearch}'</div>
             )}
           </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------
  // RENDER LIST VIEW
  // ---------------------------------------------
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in">
       {/* Header Actions */}
       <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
         <div className="flex items-center gap-4">
           <div className="relative w-64">
              <Search size={16} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text" 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Coverage Teams..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 font-medium placeholder-slate-400 outline-none transition-all shadow-inner"
              />
           </div>
         </div>
         <Button onClick={() => setEditingTeam({ name: '', members: [] })} className="gap-2 bg-slate-900 border-b-2 border-slate-950 font-bold hover:translate-y-px hover:border-b-0">
           <Plus size={16} /> New Team
         </Button>
       </div>

       {/* Grid of Teams */}
       {teams.length === 0 ? (
         <div className="card text-center py-20 border-dashed bg-slate-50">
            <div className="text-6xl mb-4 opacity-50">🤝</div>
            <h3 className="text-lg font-extrabold text-slate-800 mb-2">No Coverage Teams found.</h3>
            <p className="text-slate-500 max-w-sm mx-auto text-sm mb-6">Group your staff into coverage, service, or advisory teams to assign them to families & accounts.</p>
            <Button onClick={() => setEditingTeam({ name: '', members: [] })} variant="outline" className="gap-2 mx-auto">
               <Plus size={16} /> Create your first Team
            </Button>
         </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map(team => (
               <div key={team.id} className="card p-5 group flex flex-col hover:border-indigo-200 cursor-default transition-all shadow-sm hover:shadow-md border border-slate-200">
                 <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 border border-indigo-100/50 filter drop-shadow-sm">
                       <Users size={20} />
                     </div>
                     <div>
                       <h3 className="font-extrabold text-slate-800 text-[15px]">{team.name}</h3>
                       <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">{team.members?.length || 0} Members</div>
                     </div>
                   </div>
                   <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                       onClick={() => setEditingTeam(team)}
                       className="w-8 h-8 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                       title="Edit Team"
                     >
                       <Edit2 size={14} />
                     </button>
                     <button 
                       onClick={() => handleDeleteTeam(team.id)}
                       className="w-8 h-8 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                       title="Delete Team"
                     >
                       <Trash2 size={14} />
                     </button>
                   </div>
                 </div>

                 {team.description && (
                   <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-4 min-h-[32px]">{team.description}</p>
                 )}

                 {/* Display Associated Families as Tags */}
                 <div className="mb-4">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Assigned Families</div>
                   <div className="flex flex-wrap gap-1.5">
                     {familiesByTeam[team.id]?.length ? (
                       familiesByTeam[team.id].map(f => (
                         <span key={f.id} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                           {f.name}
                         </span>
                       ))
                     ) : (
                       <span className="text-xs text-slate-400 italic">No families assigned</span>
                     )}
                   </div>
                 </div>

                 <div className="mt-auto pt-4 border-t border-slate-200/60">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Team Roster</div>
                   {(!team.members || team.members.length === 0) ? (
                     <div className="text-xs text-slate-400 italic">No assigned members</div>
                   ) : (
                     <div className="flex items-center gap-2">
                       <AvatarGroup 
                         items={team.members.map((m: any) => ({ id: m.uid, name: m.name, src: m.photoURL }))} 
                         max={6}
                         size="md"
                       />
                     </div>
                   )}
                 </div>
               </div>
            ))}
         </div>
       )}
    </div>
  );
}
