'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, writeBatch, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Landmark, PieChart, Users, Settings2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { SecondaryDock, type SecondaryDockTab } from '@/components/SecondaryDock';
import { usePageTitle } from '@/lib/PageTitleContext';

import { ChartOfAccountsView } from './components/ChartOfAccountsView';
import { PayrollRunsView } from './components/PayrollRunsView';
import { FinanceDashboardView } from './components/FinanceDashboardView';

const MAIN_TABS: SecondaryDockTab[] = [
  { id: 'dashboard', label: 'Treasury Dash', icon: PieChart },
  { id: 'accounts', label: 'Plano de Contas', icon: Landmark },
  { id: 'payroll', label: 'Folha & Comissões', icon: Users },
  { id: 'settings', label: 'Fechamento', icon: Settings2 },
];

const DEFAULT_COA = [
   { code: '1.0', name: 'Receitas', parent: null },
   { code: '1.1', name: 'Honorários de Gestão (Management Fee)', parent: '1.0' },
   { code: '1.2', name: 'Taxa de Sucesso (Performance Fee)', parent: '1.0' },
   { code: '2.0', name: 'Despesas Operacionais (OPEX)', parent: null },
   { code: '2.1', name: 'Folha de Pagamento', parent: '2.0' },
   { code: '2.1.1', name: 'Salários e Ordenados', parent: '2.1' },
   { code: '2.1.2', name: 'Encargos (INSS/FGTS)', parent: '2.1' },
   { code: '2.1.3', name: 'Benefícios', parent: '2.1' },
   { code: '2.2', name: 'Despesas Administrativas', parent: '2.0' },
   { code: '2.2.1', name: 'Aluguel & Condomínio', parent: '2.2' },
   { code: '2.2.2', name: 'TI & Software', parent: '2.2' },
   { code: '3.0', name: 'Tributos', parent: null },
   { code: '3.1', name: 'Impostos sobre Faturamento', parent: '3.0' },
];

export default function FinancePage() {
  const { tenant, user } = useAuth();
  const { setTitle } = usePageTitle();
  
  const [view, setView] = useState<'dashboard' | 'accounts' | 'payroll' | 'settings'>('dashboard');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    setTitle('Corporate Finance', 'Backoffice & Treasury Control');
  }, [setTitle]);

  useEffect(() => {
    if (!user || !tenant?.id) return;
    
    // Load CoA
    const unsubAccts = onSnapshot(query(collection(db, 'tenants', tenant.id, 'chart_of_accounts')), snap => {
       const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       setAccounts(data);
       
       // Bootstrap basic Brazilian CoA if completely empty
       if (data.length === 0) {
          const batch = writeBatch(db);
          DEFAULT_COA.forEach(a => {
             const ref = doc(collection(db, 'tenants', tenant.id, 'chart_of_accounts'));
             batch.set(ref, a);
          });
          batch.commit();
       }
    });

    // Load Payruns
    const unsubPay = onSnapshot(query(collection(db, 'tenants', tenant.id, 'payrolls')), snap => {
       setPayrolls(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Load HR Employees directly for Payroll computations
    const unsubEmp = onSnapshot(query(collection(db, 'tenants', tenant.id, 'employees')), snap => {
       setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubAccts(); unsubPay(); unsubEmp(); };
  }, [tenant?.id, user]);

  return (
    <div className="flex flex-col absolute inset-0 overflow-hidden bg-[var(--bg-canvas)] z-0">
      <SecondaryDock 
         tabs={MAIN_TABS}
         activeTab={view}
         onTabChange={(id) => setView(id as any)}
      />

      <main className="flex-1 min-h-0 relative flex flex-col p-6">
         <div className="flex-1 overflow-y-auto bg-[var(--bg-canvas)] relative rounded-xl border border-slate-200 shadow-sm bg-white">
            {view === 'dashboard' && <FinanceDashboardView accounts={accounts} payrolls={payrolls} />}
            {view === 'accounts' && <ChartOfAccountsView accounts={accounts} />}
            {view === 'payroll' && <PayrollRunsView payrolls={payrolls} employees={employees} tenantId={tenant?.id || ''} />}
            
            {view === 'settings' && (
               <div className="p-10 flex flex-col items-center justify-center h-full text-center">
                  <Settings2 size={40} className="text-slate-300 mb-4" />
                  <h3 className="text-xl font-bold text-slate-800">Fechamento do Mês</h3>
                  <p className="text-slate-500 max-w-sm mt-2">Routine for freezing financial periods, exporting DREs (Income Statements), and locking accounts.</p>
               </div>
            )}
        </div>
      </main>
    </div>
  );
}
