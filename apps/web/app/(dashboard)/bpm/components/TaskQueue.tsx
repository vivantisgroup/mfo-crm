'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { 
  getBPMTasks,
  completeTask,
  BPMTask,
} from '@/lib/bpmService';
import { can, canAny } from '@/lib/rbacService';
import { toast } from 'sonner';

export default function TaskQueue() {
  const { user, tenant, authzContext: authz } = useAuth();
  const tenantId = tenant?.id;
  const [tasks, setTasks] = useState<BPMTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  useEffect(() => {
    if (tenantId && user) {
      loadData();
    }
  }, [tenantId, user, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (tenantId) {
        const fetched = await getBPMTasks(tenantId, activeTab);
        
        const filtered = fetched.filter(t => {
          if (authz?.role === 'tenant_admin' || authz?.role === 'saas_master_admin') return true; 
          if (t.assignedTo === user?.uid) return true;
          if (t.assignedRole === authz?.role) return true;
          return false;
        });

        setTasks(filtered);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        toast.error('Insufficient permissions to view workflow tasks.');
      } else {
        toast.error('Failed to load tasks.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (taskId: string) => {
    if (!tenantId || !user) return;
    try {
      await completeTask(tenantId, taskId, user.uid);
      setTasks(tasks.filter(t => t.id !== taskId));
      toast.success('Task marked as complete.');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to complete task.');
    }
  };

  if (!canAny(authz, ['tasks:read', 'tasks:write', 'processes:read'])) {
    return <div className="p-8 text-red-500">You do not have permission to view workflow tasks.</div>;
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Workflow Tasks Queue</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Action items assigned to your role queue.</p>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
        
        {/* Sub-Tabs */}
        <div className="flex border-b border-[var(--border)] bg-[var(--bg-surface)]">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-4 font-medium text-sm transition-colors ${
              activeTab === 'pending'
                ? 'border-b-2 border-[var(--brand-500)] text-[var(--brand-500)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Pending Actions
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-6 py-4 font-medium text-sm transition-colors ${
              activeTab === 'completed'
                ? 'border-b-2 border-[var(--brand-500)] text-[var(--brand-500)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Completed History
          </button>
        </div>

        <div className="p-0">
          {loading ? (
             <div className="flex items-center justify-center py-20">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-500)]"></div>
             </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[var(--text-secondary)] font-medium">No tasks found in this queue.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {tasks.map(task => (
                <div key={task.id} className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 hover:bg-[var(--bg-surface)] transition">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase
                          ${task.status === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
                          {task.status}
                       </span>
                       {task.dueDate && new Date(task.dueDate) < new Date() && task.status === 'pending' && (
                         <span className="bg-red-50 text-red-700 dark:bg-red-500/20 border border-red-500/30 dark:text-red-500 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase animate-pulse">SLA BREACHED</span>
                       )}
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">{task.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">{task.description}</p>
                    
                    <div className="flex items-center gap-4 mt-4 text-xs font-medium text-[var(--text-secondary)]">
                      <span className="bg-[var(--bg-canvas)] border border-[var(--border)] px-2 py-1 rounded">Queue: {task.assignedRole || 'Unassigned Role'}</span>
                      {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleString()}</span>}
                    </div>
                  </div>

                  <div>
                    {task.status === 'pending' ? (
                      <button
                        onClick={() => handleComplete(task.id!)}
                        className="px-5 py-2.5 rounded-lg text-[var(--brand-500)] bg-[var(--brand-500)]/10 hover:bg-[var(--brand-500)]/20 border border-[var(--brand-500)]/30 font-semibold transition text-sm shadow-sm"
                      >
                        Action & Complete
                      </button>
                    ) : (
                       <div className="text-xs text-[var(--text-secondary)] text-right">
                         Completed on <br/>
                         {new Date(task.completedAt!).toLocaleDateString()}
                       </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
