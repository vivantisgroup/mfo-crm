import React from 'react';

export function FinanceDashboardView({ accounts, payrolls }: { accounts: any[], payrolls: any[] }) {
  
  const totalPayrollsThisYear = payrolls.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);

  return (
    <div className="w-full h-full p-8 overflow-y-auto animate-fade-in">
       <h3 className="text-lg font-semibold tracking-tight mb-6 text-2xl">Treasury Overview</h3>
       
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm rounded-xl border border-[var(--border)] p-5">
            <div className="text-sm text-[var(--text-secondary)]">Available Cash (All Bank Accounts)</div>
            <div className="text-3xl font-bold tracking-tight">R$ 1.25M</div>
            <div className="flex items-center mt-4">
              <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-[var(--brand-100)] text-[var(--brand-700)] shadow-sm">+12.5% M/Mo</span>
            </div>
          </div>
          
          <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm rounded-xl border border-[var(--border)] p-5">
            <div className="text-sm text-[var(--text-secondary)]">Total OPEX (YTD)</div>
            <div className="text-3xl font-bold tracking-tight">R$ 1.40M</div>
            <div className="flex items-center mt-4">
              <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-[var(--brand-100)] text-[var(--brand-700)] shadow-sm">+4% vs Budget</span>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm rounded-xl border border-[var(--border)] p-5">
            <div className="text-sm text-[var(--text-secondary)]">Payroll Spends (YTD)</div>
            <div className="text-3xl font-bold tracking-tight">R$ {totalPayrollsThisYear.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div className="flex items-center mt-4">
              <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-secondary)] shadow-sm">On Par with HR</span>
            </div>
          </div>
       </div>

       <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-2">Operating Cash Flow</h3>
          <div className="text-sm text-[var(--text-secondary)]">Inflows (MFO Revenue/Capital) vs Outflows (Expenses, Payroll, Taxes)</div>
          <div className="h-80 mt-4 rounded-lg bg-[var(--bg-muted)] flex items-center justify-center text-[var(--text-tertiary)] border border-[var(--border)]">
             Chart rendering handled by AdvancedEChartsCore...
          </div>
       </div>
    </div>
  );
}
