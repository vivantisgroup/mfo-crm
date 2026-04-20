'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, Plus, List, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { SecondaryDock, type SecondaryDockTab } from '@/components/SecondaryDock';
import { usePageTitle } from '@/lib/PageTitleContext';
import { PromptModal } from '@/components/ui/PromptModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { toast } from 'sonner';
import { executeExpenseRules } from '@/lib/expenseRulesService';

import { ExpenseListView } from './components/ExpenseListView';
import { ExpenseKanbanView } from './components/ExpenseKanbanView';

const MAIN_TABS: SecondaryDockTab[] = [
  { id: 'list', label: 'All Expenses', icon: List },
  { id: 'kanban', label: 'Approvals', icon: LayoutDashboard },
];

export default function ExpensesPage() {
  const { tenant, user } = useAuth();
  const { setTitle } = usePageTitle();
  
  const [expenses, setExpenses] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  // UI State
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Modals Data
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expensePromptOpen, setExpensePromptOpen] = useState(false);

  useEffect(() => {
    if (!selectedExpense) {
      setTitle('Expense Reporting', 'Corporate & Family Office Expenses');
    }
  }, [setTitle, selectedExpense]);

  useEffect(() => {
    if (!user || !tenant?.id) return;
    const q1 = query(collection(db, 'tenants', tenant.id, 'expenses'));
    const unsub1 = onSnapshot(q1, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    setSelectedIds(new Set());
    return () => unsub1();
  }, [tenant?.id, user]);

  useEffect(() => { setSelectedIds(new Set()); }, [view]);

  const toggleSelection = (id: string) => {
     const next = new Set(selectedIds);
     if (next.has(id)) next.delete(id);
     else next.add(id);
     setSelectedIds(next);
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.size === 0 || !tenant?.id) return;
    setDeleteConfirmOpen(true);
  };

  const executeBulkDelete = async () => {
    if (!tenant?.id) return;
    setIsDeleting(true);
    const batch = writeBatch(db);
    selectedIds.forEach(id => batch.delete(doc(db, 'tenants', tenant!.id, 'expenses', id)));
    
    try {
      await batch.commit();
      toast.success(`${selectedIds.size} records deleted successfully.`);
      setSelectedIds(new Set());
    } catch (e) {
      console.error("Bulk delete failed", e);
      toast.error('Error deleting records');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExpenseSubmit = async (values: Record<string, string>) => {
    const title = values.title;
    if (title && tenant?.id) {
        const { addDoc } = await import('firebase/firestore');
        try {
          const expenseData = {
              title,
              amount: Math.floor(Math.random() * 5000) + 100, // mock payload generator
              category: 'Travel & Meals',
              status: 'submitted',
              date: new Date().toISOString()
          };
          const docRef = await addDoc(collection(db, 'tenants', tenant.id, 'expenses'), expenseData);
          await executeExpenseRules(tenant.id, docRef.id, expenseData);
          toast.success('Expense submitted and routed!');
        } catch (e) {
          toast.error('Failed to create expense draft.');
        }
    }
  };

  const filteredExpenses = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return expenses;
    return expenses.filter(e => 
      (e.title?.toLowerCase().includes(q) || '') ||
      (e.category?.toLowerCase().includes(q) || '')
    );
  }, [expenses, search]);

  if (selectedExpense) {
    return (
      <div className="relative w-full h-full flex flex-col bg-background text-foreground overflow-y-auto animate-fade-in overflow-y-auto pb-16 p-8">
         <button onClick={() => setSelectedExpense(null)} className="mb-4 text-sm font-bold text-slate-400 hover:text-slate-800 transition-colors">← Back to Expenses</button>
         <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">{selectedExpense.title || 'Expense View'}</h2>
         {/* Detailed View Stub */}
         <div className="bg-[var(--bg-elevated)] p-6 rounded-2xl shadow-sm border border-[var(--border)]">
             <pre className="text-xs text-[var(--text-secondary)]">{JSON.stringify(selectedExpense, null, 2)}</pre>
         </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-background text-foreground overflow-y-auto flex flex-col z-0">
      {/* Secondary Dock Header */}
      <SecondaryDock 
         tabs={MAIN_TABS}
         activeTab={view}
         onTabChange={(id) => setView(id as any)}
         rightAccessory={
            <>
              {selectedIds.size > 0 && (
                 <Button
                   variant="destructive"
                   onClick={handleBulkDeleteClick}
                   disabled={isDeleting}
                   className="gap-2"
                 >
                   Delete {selectedIds.size} selected
                 </Button>
              )}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input 
                  type="text" 
                  placeholder="Search expenses..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 bg-[var(--bg-overlay)] border-none rounded-lg text-xs font-bold w-48 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <Button 
                variant="default"
                onClick={() => setExpensePromptOpen(true)}
                className="gap-1.5 shadow-sm"
              >
                <Plus size={14} /> New Expense
              </Button>
            </>
         }
      />

      <main className="flex-1 min-h-0 relative flex flex-col p-6">
         <div className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] relative">
          {view === 'list' && (
             <ExpenseListView 
                expenses={filteredExpenses}
                selectedIds={selectedIds}
                toggleSelection={toggleSelection}
                onSelect={setSelectedExpense}
             />
          )}

          {view === 'kanban' && (
             <ExpenseKanbanView 
                expenses={filteredExpenses}
                onSelect={setSelectedExpense}
             />
          )}
        </div>
      </main>

      <PromptModal 
        open={expensePromptOpen}
        onOpenChange={setExpensePromptOpen}
        title="Create Expense"
        description="Provide a quick title for your new expense draft."
        fields={[{ name: 'title', label: 'Expense Title', placeholder: 'e.g. Uber to Airport' }]}
        onSubmit={handleExpenseSubmit}
      />

      <ConfirmModal 
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Expenses"
        description={`Are you sure you want to permanently delete ${selectedIds.size} expense record(s)? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={executeBulkDelete}
      />
    </div>
  );
}
