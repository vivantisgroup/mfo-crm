"use client";
import { Search } from 'lucide-react';

import React, { useState, useMemo, useEffect } from "react";
import { usePageTitle } from "@/lib/PageTitleContext";
import { useAuth } from "@/lib/AuthContext";
import { getAllOrgs, getContactsForOrg, type PlatformOrg, type PlatformContact } from "@/lib/crmService";
import { getTenantMembers, type TenantMember } from "@/lib/tenantMemberService";
import { getLedgerEntries, getChartOfAccounts, addChartAccount, type LedgerEntry, type ChartAccount } from "@/lib/accountingService";
import { getEmployees, addEmployee, updateEmployee, type Employee } from "@/lib/peopleService";
import { getDictionary } from "@/lib/i18n/accountingDictionaries";

// API services
import { getPlans, type PlanDefinition } from "@/lib/planService";
import {
  getAllSubscriptions,
  getAllInvoices,
  planMonthlyTotal,
  type TenantSubscription,
  type Invoice as LiveInvoice,
} from "@/lib/subscriptionService";
import {
  getAllExpenses,
  createExpense,
  monthlyEquivalent,
  EXPENSE_CATEGORIES,
  type PlatformExpense,
} from "@/lib/expenseService";
import {
  listRenewals,
  renewalDaysLeft,
  type RenewalRecord,
} from "@/lib/renewalService";

// UI
import {
  SecondaryDock,
  type SecondaryDockTab,
} from "@/components/SecondaryDock";
import { RenewalsModule } from "@/components/RenewalsModule";
import { 
  BarChart2, Building, Receipt, RefreshCcw, Book, FileBarChart, Scale, 
  Users, DollarSign, ReceiptText, LineChart, FileText, CheckCircle2, Layers
} from "lucide-react";

// ─── Interfaces & Helpers ───────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  seats: number;
  color: string;
}

interface Subscriber {
  id: string;
  name: string;
  plan: string;
  seats: number;
  mrr: number;
  arr: number;
  status: "active" | "trial" | "suspended" | "churned";
  startDate: string;
  nextBilling: string;
}

interface Invoice {
  id: string;
  tenantName: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "void" | "cancelled";
  date: string;
  dueDate: string;
  plan: string;
}

interface Expense {
  category: string;
  monthly: number;
  ytd: number;
}

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    active: "emerald",
    trial: "amber",
    suspended: "rose",
    churned: "slate",
    paid: "emerald",
    pending: "indigo",
    overdue: "rose",
  };
  return map[status] || "slate";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:ring-offset-2 border-transparent bg-[var(--brand-500)] text-white shadow hover:bg-[var(--brand-600)] capitalize">
      {status}
    </span>
  );
}

// ─── Expenses Mock Chart ────────────────────────────────────────────────────
const generateMockChartData = (expenses: PlatformExpense[]) => {
  const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const base = expenses.reduce((s, e) => s + monthlyEquivalent(e), 0) || 5000;
  return months.map((m, i) => ({
    Month: m,
    "SaaS & Infra": Math.round(base * 0.4 + i * 120),
    "Travel & Ent": Math.round(base * 0.2 + Math.random() * 500),
    "Office & Supplies": Math.round(base * 0.15 + 100),
    "Legal & Prof": Math.round(base * 0.25 - i * 50),
  }));
};

// ─── Sub-components: Revenue ────────────────────────────────────────────────

function OverviewTab({
  plans,
  subscribers,
  expenses,
}: {
  plans: Plan[];
  subscribers: Subscriber[];
  expenses: Expense[];
}) {
  const totalMRR = subscribers
    .filter((s) => s.status === "active")
    .reduce((s, t) => s + t.mrr, 0);
  const totalARR = totalMRR * 12;
  const totalExpenses = expenses.reduce((s, e) => s + e.monthly, 0);
  const grossProfit = totalMRR - totalExpenses;
  const margin = totalMRR ? Math.round((grossProfit / totalMRR) * 100) : 0;
  const activeCount = subscribers.filter((s) => s.status === "active").length;
  const trialCount = subscribers.filter((s) => s.status === "trial").length;
  const avgMRR = activeCount ? Math.round(totalMRR / activeCount) : 0;

  const revenueByPlan = plans
    .map((plan) => {
      const subs = subscribers.filter(
        (s) => s.plan === plan.name && s.status !== "churned",
      );
      return {
        name: plan.name,
        value: subs.reduce((a, s) => a + s.mrr, 0),
        count: subs.length,
        color: plan.color,
      };
    })
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="animate-fade-in py-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 border-t-2 border-t-indigo-500">
          <div className="text-sm text-[var(--text-secondary)]">Monthly Recurring Revenue (MRR)</div>
          <div className="text-3xl font-bold tracking-tight">{fmt(totalMRR)}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-slate-500">
            Annualized: {fmt(totalARR)}
          </div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 border-t-2 border-t-emerald-500">
          <div className="text-sm text-[var(--text-secondary)]">Gross Profit Margin</div>
          <div className="text-3xl font-bold tracking-tight">{margin}%</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-slate-500">
            {fmt(grossProfit)} monthly profit
          </div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 border-t-2 border-t-amber-500">
          <div className="text-sm text-[var(--text-secondary)]">Platform OPEX</div>
          <div className="text-3xl font-bold tracking-tight">{fmt(totalExpenses)}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-slate-500">
            Infrastructure & Operations
          </div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 border-t-2 border-t-blue-500">
          <div className="text-sm text-[var(--text-secondary)]">Active Tenants</div>
          <div className="text-3xl font-bold tracking-tight">{activeCount}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-slate-500">
            {trialCount} accounts evaluating
          </div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 border-t-2 border-t-fuchsia-500">
          <div className="text-sm text-[var(--text-secondary)]">Average MRR (ARPU)</div>
          <div className="text-3xl font-bold tracking-tight">{fmt(avgMRR)}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-slate-500">
            Per active configured tenant
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-2">Revenue by Plan</h3>
          <p className="text-sm text-slate-500">Contribution to MRR</p>
          <div className="mt-6 flex flex-col gap-3">
            {revenueByPlan.map(p => (
              <div key={p.name} className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-700">{p.name}</span>
                  <span className="font-bold text-slate-900">{fmt(p.value)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.max(5, (p.value / totalMRR) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-2">Monthly OPEX Breakdown</h3>
          <p className="text-sm text-slate-500">Cost centers and infrastructure overhead</p>
          <div className="mt-6 flex flex-col gap-3">
            {expenses.map((exp) => (
              <div
                key={exp.category}
                className="flex justify-between items-center py-2 border-b border-tremor-border last:border-0 last:pb-0"
              >
                <div className="text-sm text-[var(--text-secondary)] font-medium text-tremor-content-strong">
                  {exp.category}
                </div>
                <div className="text-right">
                  <div className="text-sm text-[var(--text-secondary)] font-bold text-tremor-content-strong">
                    {fmt(exp.monthly)}
                    <span className="text-xs font-normal">/mo</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SubscribersTab({
  plans,
  subscribers,
}: {
  plans: Plan[];
  subscribers: Subscriber[];
}) {
  const [search, setSearch] = useState("");
  const filtered = subscribers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="animate-fade-in py-6">
      <div className="flex justify-between items-center mb-6">
        <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 max-w-xs"
          placeholder="🔍 Search subscribers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2">
          Onboard Tenant
        </button>
      </div>
      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="w-full overflow-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Seats</th>
                <th className="px-4 py-3 font-medium">MRR</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Next Billing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((sub) => (
                <tr
                  key={sub.id}
                  className="hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {sub.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:ring-offset-2 border-transparent bg-[var(--brand-500)] text-white shadow hover:bg-[var(--brand-600)] uppercase">
                      {sub.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">{sub.seats}</td>
                  <td className="px-4 py-3 font-bold text-emerald-500">
                    {fmt(sub.mrr)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sub.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{sub.nextBilling}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InvoicesTab({ invoices }: { invoices: Invoice[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const filtered = invoices.filter((i) => {
    const matchesSearch =
      i.tenantName.toLowerCase().includes(search.toLowerCase()) ||
      i.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "All" ||
      i.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="animate-fade-in py-6">
      <div className="flex justify-between flex-wrap gap-4 mb-6">
        <div className="flex gap-4 w-auto">
          <input className="flex h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="🔍 Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="flex h-9 w-40 items-center justify-between rounded-md border border-input bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm ring-offset-background"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>
      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="w-full overflow-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-500">
                    {inv.id}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {inv.tenantName}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {fmt(inv.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td
                    className={`px-4 py-3 ${
                      inv.status === "overdue" ? "text-rose-500 font-bold" : "text-slate-500"
                    }`}
                  >
                    {inv.dueDate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Finance Sub-components ---

function ChartOfAccountsTab({ accounts, onAddAccount }: { accounts: ChartAccount[], onAddAccount: () => void }) {
  // Sort accounts strictly by Code
  const sorted = [...accounts].sort((a,b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));

  return (
    <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 mt-4 shadow-sm border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold tracking-tight mb-2">Chart of Accounts</h3>
        <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={onAddAccount}>
          <span className="mr-2">➕</span> New Account
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-medium w-32">Code</th>
              <th className="px-4 py-3 font-medium">Account Name</th>
              <th className="px-4 py-3 font-medium">Classification</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map(acc => {
              const depth = acc.code.split('.').length - 1;
              const indentClass = depth === 0 ? 'pl-4' : depth === 1 ? 'pl-8' : depth === 2 ? 'pl-12' : 'pl-16';
              return (
                <tr key={acc.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-500">
                     {acc.code}
                  </td>
                  <td className={`px-4 py-3 ${indentClass} ${acc.isGroup ? 'font-black text-slate-800' : 'font-medium text-slate-600'}`}>
                     <div className="flex items-center gap-2">
                       {acc.isGroup && <span className="text-indigo-500 text-xs mt-0.5">▾</span>}
                       {!acc.isGroup && <span className="text-slate-300 text-xs mt-0.5">·</span>}
                       {acc.name}
                       </div>
                  </td>
                  <td className="px-4 py-3">
                     <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:ring-offset-2 border-transparent bg-[var(--brand-500)] text-white shadow hover:bg-[var(--brand-600)] uppercase">
                       {acc.type}
                     </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                     {acc.isSystem ? <span className="text-xs text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">SYSTEM</span> : <button className="text-xs text-indigo-600 font-bold hover:text-indigo-800">Edit</button>}
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

function LedgerTab({ ledger }: { ledger: any[] }) {
  if (!ledger.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-slate-200 shadow-sm mt-4">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-2xl">📓</div>
        <h3 className="text-lg font-bold text-slate-800">No Ledger Entries</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-2">The general ledger is currently empty. Transactions will appear here as they are synced.</p>
      </div>
    );
  }
  return (
    <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 mt-4 shadow-sm border-slate-200">
      <h3 className="text-lg font-semibold tracking-tight mb-2">General Ledger</h3>
      <div className="overflow-x-auto mt-4 w-full">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium text-right">Debit</th>
              <th className="px-4 py-3 font-medium text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ledger.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{entry.date}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{entry.description}</td>
                <td className="px-4 py-3">{entry.account}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{entry.type === 'debit' ? `$${(entry.amount).toLocaleString()}` : '-'}</td>
                <td className="px-4 py-3 text-right text-rose-500 font-medium">{entry.type === 'credit' ? `$${(entry.amount).toLocaleString()}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


import { List, LayoutGrid, Check, Save } from "lucide-react";

function EmployeeDetailView({ 
  employee, 
  onBack, 
  onSave,
  contacts,
  members
}: { 
  employee: any, 
  onBack: () => void, 
  onSave: (data: any) => Promise<void>,
  contacts: any[],
  members: any[]
}) {
  usePageTitle(
    employee.id === "new" ? "Register Employee" : `Edit ${employee.name}`,
    undefined,
    [
      { label: 'Directory', onClick: onBack },
      { label: employee.id === "new" ? "New Registration" : "Edit Profile" }
    ]
  );
  const [form, setForm] = useState(employee);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    await onSave(form);
    setIsSaving(false);
  };

  return (
    <div className="mx-auto py-2 animate-fade-in relative z-10 w-full mb-20 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-100 text-slate-700 shadow hover:bg-slate-200 h-9 px-4 py-2" onClick={onBack}>
            <span className="mr-2">←</span> Back to Directory
          </button>
          <h3 className="text-lg font-semibold tracking-tight">{employee.id === "new" ? "Register New Employee" : "Edit Profile"}</h3>
        </div>
        <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={save} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Profile"}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-slate-200">
          <h3 className="text-lg font-semibold tracking-tight mb-2 mb-4">Personal Details</h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-[var(--text-secondary)] mb-1 font-medium text-slate-700">Full Name</div>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={form.name} onChange={e => setForm({...form, name: e.target.value})} disabled={isSaving} />
            </div>
            <div>
              <div className="text-sm text-[var(--text-secondary)] mb-1 font-medium text-slate-700">Location</div>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})} disabled={isSaving} />
            </div>
            <div>
              <div className="text-sm text-[var(--text-secondary)] mb-1 font-medium text-slate-700">Linked Member Identity</div>
              <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm ring-offset-background" value={form.linkedMemberUid || ""} onChange={e => setForm({...form, linkedMemberUid: e.target.value})} disabled={isSaving}>
                <option value="">-- Not applicable --</option>
                {members.map(m => (
                  <option key={m.id} value={m.userId}>{m.name || m.email || m.userId}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-sm text-[var(--text-secondary)] mb-1 font-medium text-slate-700">Linked Contact Record</div>
              <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm ring-offset-background" value={form.linkedContactId || ""} onChange={e => setForm({...form, linkedContactId: e.target.value})} disabled={isSaving}>
                <option value="">-- Not applicable --</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name || "Unnamed Contact"}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-slate-200">
          <h3 className="text-lg font-semibold tracking-tight mb-2 mb-4">Employment Data</h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-[var(--text-secondary)] mb-1 font-medium text-slate-700">Title / Role</div>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={form.title} onChange={e => setForm({...form, title: e.target.value})} disabled={isSaving} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-[var(--text-secondary)] mb-1 font-medium text-slate-700">Department</div>
                <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm ring-offset-background" value={form.department} onChange={e => setForm({...form, department: e.target.value})} disabled={isSaving}>
                  <option value="Executive">Executive</option>
                  <option value="Sales">Sales</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Operations">Operations</option>
                  <option value="Marketing">Marketing</option>
                </select>
              </div>
              <div>
                <div className="text-sm text-[var(--text-secondary)] mb-1 font-medium text-slate-700">Type</div>
                <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm ring-offset-background" value={form.employmentType} onChange={e => setForm({...form, employmentType: e.target.value})} disabled={isSaving}>
                  <option value="Full-Time">Full-Time</option>
                  <option value="Contractor">Contractor</option>
                </select>
              </div>
            </div>
            <div>
              <div className="text-sm text-[var(--text-secondary)] mb-1 font-medium text-slate-700">Base Salary (USD)</div>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" type="number" value={form.baseSalary || ""} onChange={e => setForm({...form, baseSalary: Number(e.target.value)})} disabled={isSaving} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeesTab({ employees, onAddClick, updateEmp, contacts, members }: { employees: any[], onAddClick: (data?: any) => Promise<void> | void, updateEmp: any, contacts: any[], members: any[] }) {
  const [viewMode, setViewMode] = useState<"grid"|"list">("grid");
  const [detailId, setDetailId] = useState<string|null>(null);

  // Instead of opening modal, we toggle to detail view if they want to add
  // But wait, the parent manages 'isAddEmployeeOpen'. Let's override that and just use internal state.
  const isAdding = detailId === "new";
  const selectedEmp = isAdding ? {
    id: "new", name: "", title: "", department: "Engineering", employmentType: "Full-Time", baseSalary: 0, location: ""
  } : employees.find(e => e.id === detailId);

  if (selectedEmp) {
    return <EmployeeDetailView 
      employee={selectedEmp} 
      onBack={() => setDetailId(null)} 
      onSave={async (data) => {
                if (data.id === "new") {
          const { id, ...rest } = data;
          await onAddClick(rest);
          setDetailId(null);
        } else {
          await updateEmp(data.id, data);
          setDetailId(null);
        }
      }}
      contacts={contacts}
      members={members}
    />;
  }

  return (
    <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 mt-4 shadow-sm border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold tracking-tight">Employee Directory</h3>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md mr-2 text-slate-500">
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-sm ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'hover:bg-slate-200'}`}><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-sm ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'hover:bg-slate-200'}`}><LayoutGrid className="w-4 h-4" /></button>
          </div>
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={() => setDetailId("new")}>
            <span className="mr-2">➕</span> New Employee
          </button>
        </div>
      </div>
      
      {!employees.length ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-slate-200 shadow-sm mt-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-2xl">👥</div>
          <h3 className="text-lg font-bold text-slate-800">No Employees Found</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-2 mb-4">There are no employees registered on the platform directory.</p>
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={() => setDetailId("new")}>
            <span className="mr-2">➕</span> Add First Employee
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {employees.map(emp => (
            <div key={emp.id} onClick={() => setDetailId(emp.id)} className="p-4 rounded-xl border border-slate-200 flex flex-col items-start bg-slate-50/50 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg mb-3">
                {emp.name.charAt(0)}
              </div>
              <h4 className="font-bold text-slate-800 text-base">{emp.name}</h4>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{emp.title} • {emp.department}</p>
              <div className="text-xs text-slate-500 mb-1">Type: <span className="font-bold text-emerald-600 capitalize">{emp.employmentType}</span></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto w-full mt-4">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Title / Role</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Record Map</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map(emp => (
                <tr key={emp.id} onClick={() => setDetailId(emp.id)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-800">{emp.name}</td>
                  <td className="px-4 py-3">{emp.title}</td>
                  <td className="px-4 py-3">{emp.department}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {emp.linkedMemberUid && <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:ring-offset-2 border-transparent bg-indigo-50 text-indigo-700 shadow-sm border-indigo-200">Member</span>}
                      {emp.linkedContactId && <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:ring-offset-2 border-transparent bg-emerald-50 text-emerald-700 shadow-sm border-emerald-200">Contact</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CommissionsTab({ employees }: { employees?: any[] }) {
  return (
    <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 mt-4 shadow-sm border-slate-200">
      <h3 className="text-lg font-semibold tracking-tight mb-2">Commission Accounting</h3>
      <div className="text-sm text-[var(--text-secondary)] mt-2 text-slate-500">Commissions engine is syncing with the Revenue pipeline...</div>
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function FinanceDashboard() {
  usePageTitle("Finance Headquarters");
  const { user, tenant } = useAuth();
  const [dict, setDict] = useState<any>(getDictionary((tenant as any)?.country === 'BR' ? 'pt' : 'en'));

  const [loading, setLoading] = useState(true);

  // Revenue state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState<any>({ name: "", code: "", type: "EXPENSE", isGroup: false });
  const [contacts, setContacts] = useState<PlatformContact[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [newEmployeeForm, setNewEmployeeForm] = useState({
    name: "",
    title: "",
    department: "Engineering",
    employmentType: "Full-Time",
    baseSalary: 0,
    location: "",
    startDate: new Date().toISOString().split("T")[0],
    managerName: "",
    quota: 0,
    ytdCommission: 0,
  });
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [newExpenseForm, setNewExpenseForm] = useState({
    name: "",
    vendor: "",
    category: "software",
    amountUsd: 0,
    frequency: "monthly",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
  });

  // Expenses state
  const [expensesList, setExpensesList] = useState<PlatformExpense[]>([]);
  const [expensesSummary, setExpensesSummary] = useState<Expense[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [
          livePlans,
          liveSubs,
          liveInvoices,
          liveExpenses,
          liveRenewals,
          liveOrgs,
          liveLedger,
          liveEmps,
          liveMembers,
          liveContacts,
          liveCOA,
        ] = await Promise.all([
          getPlans(),
          getAllSubscriptions(),
          getAllInvoices(),
          getAllExpenses(),
          listRenewals(),
          getAllOrgs(),
          getLedgerEntries(),
          getEmployees(),
          getTenantMembers("platform").catch(() => []),
          getContactsForOrg("MFO-Central-Platform-Org-Id").catch(() => []),
          getChartOfAccounts()
        ]);

        setPlans(
          livePlans.map((p) => ({
            id: p.code,
            name: p.name,
            priceMonthly: p.baseMonthly,
            priceAnnual: p.baseAnnual,
            seats: p.maxSeats,
            color: p.color,
          })),
        );

        setSubscribers(

          liveSubs.map((s) => {
            const mrr = planMonthlyTotal(s);
            return {
              id: s.tenantId,
              name: s.tenantName,
              plan: s.planId.toUpperCase(),
              seats: s.licensedSeats,
              mrr,
              arr: mrr * 12,
              status:
                s.status === "trial"
                  ? "trial"
                  : s.status === "suspended"
                    ? "suspended"
                    : ["cancelled", "past_due"].includes(s.status)
                      ? "churned"
                      : "active",
              startDate: s.subscriptionStart?.split("T")[0] || "",
              nextBilling: s.nextInvoiceDate?.split("T")[0] || "",
            };
          }),
        );

        setInvoices(
          liveInvoices.map((i) => ({
            id: i.invoiceNumber,
            tenantName: i.tenantName,
            amount: i.totalAmount,
            status: ["draft", "sent"].includes(i.status)
              ? "pending"
              : (i.status as any),
            date: i.issuedAt.split("T")[0],
            dueDate: i.dueAt.split("T")[0],
            plan: i.planId.toUpperCase(),
          })),
        );

        setExpensesList(liveExpenses);
        setExpensesSummary(
          liveExpenses.map((e) => ({
            category: e.name,
            monthly: monthlyEquivalent(e),
            ytd: monthlyEquivalent(e) * 3,
          })),
        );

        setRenewals(liveRenewals);
        setOrgs(liveOrgs);
        setLedger(liveLedger);
        setChartAccounts(liveCOA);
        setEmployees(liveEmps);
      } catch (e) {
        console.error("Failed to load finance data:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const { renewalsDueSoon } = useMemo(
    () => ({
      renewalsDueSoon: renewals.filter(
        (r) =>
          !["completed", "declined", "expired"].includes(r.status) &&
          renewalDaysLeft(r) <= 30,
      ).length,
    }),
    [renewals],
  );

  // Nested Docks state
  const [revTab, setRevTab] = useState("overview");
  const [expTab, setExpTab] = useState("dashboard");
  const [pplTab, setPplTab] = useState("directory");

      
  const resetEmployeeForm = () => {
    setNewEmployeeForm({
      name: "",
      title: "",
      department: "Engineering",
      employmentType: "Full-Time",
      baseSalary: 0,
      location: "",
      startDate: new Date().toISOString().split("T")[0],
      managerName: "",
      quota: 0,
      ytdCommission: 0,
    });
  };

  const handleAddEmployee = async () => {
    setIsSavingEmployee(true);
    try {
      const added = await addEmployee(newEmployeeForm as any);
      setEmployees((prev) => [...prev, added].sort((a,b) => a.name.localeCompare(b.name)));
      setIsAddEmployeeOpen(false);
      resetEmployeeForm();
    } catch (e) {
      console.error("Failed to add employee:", e);
    } finally {
      setIsSavingEmployee(false);
    }
  };

  const REV_TABS: SecondaryDockTab[] = [
    { id: "overview", label: "Revenue Overview", icon: BarChart2 },
    { id: "subscribers", label: "Subscribers", icon: Building },
    { id: "invoices", label: "Invoices", icon: Receipt },
    {
      id: "renewals",
      label: "Renewals",
      icon: RefreshCcw,
      badge:
        renewalsDueSoon > 0 ? (
          <span
            style={{
              background: "#f59e0b22",
              color: "#f59e0b",
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 10,
              marginLeft: 6,
            }}
          >
            {renewalsDueSoon}
          </span>
        ) : null,
    },
  ];

  const ACC_TABS: SecondaryDockTab[] = [
    { id: "ledger", label: "General Ledger", icon: Book },
    { id: "pl", label: "P&L Statement", icon: FileBarChart },
    { id: "coa", label: "Chart of Accounts", icon: Layers },
    { id: "balance", label: "Balance Sheet", icon: Scale },
  ];

  const PPL_TABS: SecondaryDockTab[] = [
    { id: "directory", label: "Employee Directory", icon: Users },
    { id: "commissions", label: "Commissions", icon: DollarSign },
    { id: "payroll", label: "Payroll Overview", icon: ReceiptText },
  ];

  const [accTab, setAccTab] = useState("ledger");
  

  const EXP_TABS: SecondaryDockTab[] = [
    { id: "dashboard", label: "Dashboard", icon: LineChart },
    { id: "reporting", label: "Expense Reporting", icon: FileText },
    { id: "approvals", label: "Approvals Queue", icon: CheckCircle2 },
  ];

  if (loading) {
    return (
      <div className="page flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <div className="text-sm text-[var(--text-secondary)] text-tremor-content font-medium">
          Synchronizing live financial data...
        </div>
      </div>
    );
  }

  const activeExpenses = expensesList.filter((e) => e.active);
  const totalMonthlyOpex = activeExpenses.reduce(
    (s, e) => s + monthlyEquivalent(e),
    0,
  );
  const projectedAnnual = totalMonthlyOpex * 12;
  const chartData = generateMockChartData(activeExpenses);

  return (
    <div className="flex flex-col absolute inset-0 overflow-hidden bg-canvas z-0">
      <div className="w-full z-10 relative bg-white border-b border-slate-200 px-6 pt-6 shrink-0">
        <h3 className="text-lg font-semibold tracking-tight mb-2 text-2xl font-black text-slate-800 tracking-tight mb-4">
          Finance & Operations
        </h3>
        <div className="w-full">
          <div className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--bg-muted)] p-1 text-[var(--text-tertiary)] mt-2 text-sm border-0 font-semibold gap-4">
            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] data-[selected]:bg-[var(--bg-surface)] data-[selected]:text-[var(--text-primary)] data-[selected]:shadow-sm data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 outline-none">
              Revenue & Growth
            </button>
            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] data-[selected]:bg-[var(--bg-surface)] data-[selected]:text-[var(--text-primary)] data-[selected]:shadow-sm data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 outline-none">
              Corporate Expenses
            </button>
            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] data-[selected]:bg-[var(--bg-surface)] data-[selected]:text-[var(--text-primary)] data-[selected]:shadow-sm data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 outline-none">
              Accounting & Ledgers
            </button>
            
            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] disabled:pointer-events-none disabled:opacity-50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] data-[selected]:bg-[var(--bg-surface)] data-[selected]:text-[var(--text-primary)] data-[selected]:shadow-sm data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 outline-none">
              People & Payroll
            </button>
          </div>

          <main className="flex-1 flex flex-col min-h-0 relative animate-fade-in flex-grow">
            <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden h-full shadow-inner mt-2">
            {/* ─── REVENUE PANEL ─── */}
            <div className="mt-2 ring-offset-background">
              <div className="flex-1 flex flex-col min-h-0 relative h-full">
              <SecondaryDock
                tabs={REV_TABS}
                activeTab={revTab}
                onTabChange={setRevTab}
              />
              <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 w-full animate-fade-in relative bg-slate-50/50">
                {revTab === "overview" && (
                  <OverviewTab
                    plans={plans}
                    subscribers={subscribers}
                    expenses={expensesSummary}
                  />
                )}
                {revTab === "subscribers" && (
                  <SubscribersTab plans={plans} subscribers={subscribers} />
                )}
                {revTab === "invoices" && <InvoicesTab invoices={invoices} />}
                {revTab === "renewals" && (
                  <div className="py-6">
                    <RenewalsModule />
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* ─── EXPENSES PANEL ─── */}
            <div className="mt-2 ring-offset-background">
              <div className="flex-1 flex flex-col min-h-0 relative h-full">
              <SecondaryDock
                tabs={EXP_TABS}
                activeTab={expTab}
                onTabChange={setExpTab}
              />
              <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 w-full animate-fade-in relative bg-slate-50/50">
                <div className="flex justify-end mb-4 gap-3">
                  <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-100 text-slate-700 shadow hover:bg-slate-200 h-9 px-4 py-2">
                    ↻ Refresh
                  </button>
                  <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-100 text-slate-700 shadow hover:bg-slate-200 h-9 px-4 py-2">
                    <span className="mr-2">📎</span> Scan Receipt PDF
                  </button>
                  <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2"
                    onClick={() => setIsManualEntryOpen(true)}
                  >
                    Manual Entry
                  </button>
                </div>

                {expTab === "dashboard" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-t-4 border-t-blue-500 border-x-slate-200 border-b-slate-200">
                        <div className="text-sm text-[var(--text-secondary)]">MTD Operating Expenses</div>
                        <div className="text-3xl font-black tracking-tight">
                          {fmt(totalMonthlyOpex)}
                        </div>
                      </div>
                      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-t-4 border-t-amber-500 border-x-slate-200 border-b-slate-200">
                        <div className="text-sm text-[var(--text-secondary)]">Projected Annual Burn</div>
                        <div className="text-3xl font-black tracking-tight">
                          {fmt(projectedAnnual)}
                        </div>
                      </div>
                      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-t-4 border-t-rose-500 border-x-slate-200 border-b-slate-200">
                        <div className="text-sm text-[var(--text-secondary)]">Pending Reimbursable</div>
                        <div className="text-3xl font-black tracking-tight">
                          {fmt(1850)}
                        </div>
                        <div className="flex mt-4">
                          <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-rose-50 text-rose-700 shadow-sm border-rose-200">
                            Requires signature
                          </span>
                        </div>
                      </div>
                      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-t-4 border-t-emerald-500 border-x-slate-200 border-b-slate-200">
                        <div className="text-sm text-[var(--text-secondary)]">Cash Efficiency Ratio</div>
                        <div className="text-3xl font-black tracking-tight">1.14x</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 col-span-2 shadow-sm border-slate-200">
                        <h3 className="text-lg font-semibold tracking-tight mb-2">T30 Expense Trend</h3>
                        <div className="mt-6 h-72 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg">
                          <p className="text-sm text-slate-500">Chart visualization temporarily disabled</p>
                        </div>
                      </div>
                      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-slate-200">
                        <h3 className="text-lg font-semibold tracking-tight mb-2">Top SaaS Subscriptions</h3>
                        <div className="mt-6 space-y-4">
                          {activeExpenses
                            .sort(
                              (a, b) =>
                                monthlyEquivalent(b) - monthlyEquivalent(a),
                            )
                            .slice(0, 5)
                            .map((e) => (
                              <div
                                key={e.id}
                                className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0"
                              >
                                <div>
                                  <p className="font-bold text-sm">{e.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {e.vendor}
                                  </p>
                                </div>
                                <p className="font-bold text-sm">
                                  {fmt(monthlyEquivalent(e))}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {expTab === "reporting" && (
                  <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 shadow-sm border-slate-200 overflow-hidden mt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                          <tr>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Merchant</th>
                            <th className="px-4 py-3 font-medium">Category</th>
                            <th className="px-4 py-3 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {expensesList.map((exp) => (
                            <tr key={exp.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">{fmtDate(exp.startDate)}</td>
                              <td className="px-4 py-3 font-medium text-slate-800">{exp.vendor || exp.name}</td>
                              <td className="px-4 py-3">{exp.category}</td>
                              <td className="px-4 py-3 font-bold text-rose-500">
                                {fmt(exp.amountUsd)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {expTab === "approvals" && (
                  <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
                    <h3 className="text-lg font-semibold tracking-tight mb-2">Approvals Queue</h3>
                    <div className="text-sm text-[var(--text-secondary)] mt-4 text-slate-500">
                      All pending reimbursements caught by automated rules.
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
            {/* --- ACCOUNTING PANEL --- */}
            <div className="mt-2 ring-offset-background">
              <div className="flex-1 flex flex-col min-h-0 relative h-full">
              <SecondaryDock
                tabs={ACC_TABS}
                activeTab={accTab}
                onTabChange={setAccTab}
              />
              <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 w-full animate-fade-in relative bg-slate-50/50">
                {accTab === "ledger" && <LedgerTab ledger={ledger} />}
                {accTab === "coa" && <ChartOfAccountsTab accounts={chartAccounts} onAddAccount={() => setIsAddAccountOpen(true)} />}
                {accTab === "pl" && (
                  <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
                    <h3 className="text-lg font-semibold tracking-tight mb-2">P&L Statement</h3>
                    <div className="text-sm text-[var(--text-secondary)] mt-4">Aggregated view coming soon.</div>
                  </div>
                )}
                {accTab === "balance" && (
                  <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
                    <h3 className="text-lg font-semibold tracking-tight mb-2">Balance Sheet</h3>
                    <div className="text-sm text-[var(--text-secondary)] mt-4">Summary coming soon.</div>
                  </div>
                )}
              </div>
              </div>
            </div>

            
            {/* --- PEOPLE & PAYROLL PANEL --- */}
            <div className="mt-2 ring-offset-background">
              <div className="flex-1 flex flex-col min-h-0 relative h-full">
              <SecondaryDock
                tabs={PPL_TABS}
                activeTab={pplTab}
                onTabChange={setPplTab}
              />
              <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 w-full animate-fade-in relative bg-slate-50/50">
                {pplTab === "directory" && <EmployeesTab employees={employees} onAddClick={async (data) => { if (!data) return; const { addEmployee } = await import("@/lib/peopleService"); const newEmp = await addEmployee(data); setEmployees(prev => [...prev, newEmp]); }} updateEmp={async (id: any, data: any) => { const { updateEmployee } = await import("@/lib/peopleService"); await updateEmployee(id, data); setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e)); }} contacts={contacts} members={members} />}
                {pplTab === "commissions" && <CommissionsTab employees={employees} />}
                {pplTab === "payroll" && (
                  <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
                    <h3 className="text-lg font-semibold tracking-tight mb-2">Payroll Overview</h3>
                    <div className="text-sm text-[var(--text-secondary)] mt-4">Integration processing...</div>
                  </div>
                )}
              </div>
              </div>
            </div>

          </div>
        </main>
        </div>
      </div>

      {/* Modal removed for center view */}

      {isAddAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto w-full max-h-screen">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold tracking-tight mb-2 font-black text-slate-800">Add Account Plan</h3>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setIsAddAccountOpen(false)}>×</button>
            </div>
            <div className="space-y-4">
               <div>
                 <div className="text-sm text-[var(--text-secondary)] text-xs uppercase font-bold text-slate-500 mb-1">Account Code</div>
                 <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="e.g. 1.1.3" value={newAccountForm.code} onChange={e => setNewAccountForm({...newAccountForm, code: e.target.value})} />
                 <div className="text-sm text-[var(--text-secondary)] text-[10px] text-slate-400 mt-1">Use dot decimal notation (e.g., 5.1.4) to auto-nest.</div>
               </div>
               <div>
                 <div className="text-sm text-[var(--text-secondary)] text-xs uppercase font-bold text-slate-500 mb-1">Account Name</div>
                 <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" placeholder="e.g. Prepaid Insurance" value={newAccountForm.name} onChange={e => setNewAccountForm({...newAccountForm, name: e.target.value})} />
               </div>
               <div>
                 <div className="text-sm text-[var(--text-secondary)] text-xs uppercase font-bold text-slate-500 mb-1">Classification Type</div>
                 <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-[var(--bg-surface)] px-3 py-2 text-sm shadow-sm ring-offset-background" value={newAccountForm.type} onChange={e => setNewAccountForm({...newAccountForm, type: e.target.value as any})}>
                   <option value="ASSET">{dict.ASSET}</option>
                   <option value="LIABILITY">{dict.LIABILITY}</option>
                   <option value="EQUITY">{dict.EQUITY}</option>
                   <option value="REVENUE">{dict.REVENUE}</option>
                   <option value="EXPENSE">{dict.EXPENSE}</option>
                 </select>
               </div>
               <div className="flex items-center gap-2 mt-4 ml-1">
                 <input type="checkbox" id="isGroup" checked={newAccountForm.isGroup} onChange={e => setNewAccountForm({...newAccountForm, isGroup: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" />
                 <label htmlFor="isGroup" className="text-sm font-semibold text-slate-700 cursor-pointer">This is a Group Account</label>
               </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-100 text-slate-700 shadow hover:bg-slate-200 h-9 px-4 py-2" onClick={() => setIsAddAccountOpen(false)}>Cancel</button>
              <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={async () => {
                  const added = await addChartAccount(newAccountForm);
                  setChartAccounts(prev => [...prev, added]);
                  setIsAddAccountOpen(false);
                  setNewAccountForm({ name: "", code: "", type: "EXPENSE", isGroup: false });
              }}>Add Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
