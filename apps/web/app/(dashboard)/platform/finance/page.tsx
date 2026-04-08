"use client";
import { Search } from 'lucide-react';

import React, { useState, useMemo, useEffect } from "react";
import { usePageTitle } from "@/lib/PageTitleContext";
import { useAuth } from "@/lib/AuthContext";
import { getAllOrgs, getContactsForOrg, type PlatformOrg, type PlatformContact } from "@/lib/crmService";
import { getTenantMembers, type TenantMember } from "@/lib/tenantMemberService";
import { getLedgerEntries, getChartOfAccounts, addChartAccount, type LedgerEntry, type ChartAccount } from "@/lib/accountingService";
import { getEmployees, addEmployee, updateEmployee, type Employee } from "@/lib/peopleService";

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
  Card,
  Metric,
  Text,
  Title,
  Subtitle,
  Flex,
  Grid,
  BarList,
  Badge,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  Button,
  TextInput,
  Select,
  SelectItem,
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  AreaChart,
  BadgeDelta,
  Dialog,
  DialogPanel,
} from "@tremor/react";
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
    <Badge color={getStatusColor(status) as any} className="capitalize">
      {status}
    </Badge>
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
      <Grid numItemsSm={2} numItemsLg={3} className="gap-6 mb-6">
        <Card decoration="top" decorationColor="indigo">
          <Text>Monthly Recurring Revenue (MRR)</Text>
          <Metric>{fmt(totalMRR)}</Metric>
          <Text className="mt-2 text-tremor-content">
            Annualized: {fmt(totalARR)}
          </Text>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>Gross Profit Margin</Text>
          <Metric>{margin}%</Metric>
          <Text className="mt-2 text-tremor-content">
            {fmt(grossProfit)} monthly profit
          </Text>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Platform OPEX</Text>
          <Metric>{fmt(totalExpenses)}</Metric>
          <Text className="mt-2 text-tremor-content">
            Infrastructure & Operations
          </Text>
        </Card>
        <Card decoration="top" decorationColor="blue">
          <Text>Active Tenants</Text>
          <Metric>{activeCount}</Metric>
          <Text className="mt-2 text-tremor-content">
            {trialCount} accounts evaluating
          </Text>
        </Card>
        <Card decoration="top" decorationColor="fuchsia">
          <Text>Average MRR (ARPU)</Text>
          <Metric>{fmt(avgMRR)}</Metric>
          <Text className="mt-2 text-tremor-content">
            Per active configured tenant
          </Text>
        </Card>
      </Grid>
      <Grid numItemsSm={1} numItemsLg={2} className="gap-6 mb-6">
        <Card>
          <Title>Revenue by Plan</Title>
          <Subtitle>Contribution to MRR</Subtitle>
          <div className="mt-6">
            <BarList
              data={revenueByPlan}
              color="indigo"
              className="mt-2"
              valueFormatter={(val: number) => fmt(val)}
            />
          </div>
        </Card>
        <Card>
          <Title>Monthly OPEX Breakdown</Title>
          <Subtitle>Cost centers and infrastructure overhead</Subtitle>
          <div className="mt-6 flex flex-col gap-3">
            {expenses.map((exp) => (
              <div
                key={exp.category}
                className="flex justify-between items-center py-2 border-b border-tremor-border last:border-0 last:pb-0"
              >
                <Text className="font-medium text-tremor-content-strong">
                  {exp.category}
                </Text>
                <div className="text-right">
                  <Text className="font-bold text-tremor-content-strong">
                    {fmt(exp.monthly)}
                    <span className="text-xs font-normal">/mo</span>
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Grid>
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
      <Flex justifyContent="between" alignItems="center" className="mb-6">
        <TextInput
          placeholder="🔍 Search subscribers..."
          className="max-w-xs"
          value={search}
          onValueChange={setSearch}
        />
        <Button size="sm" variant="primary">
          Onboard Tenant
        </Button>
      </Flex>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Tenant</TableHeaderCell>
              <TableHeaderCell>Plan</TableHeaderCell>
              <TableHeaderCell>Seats</TableHeaderCell>
              <TableHeaderCell>MRR</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Next Billing</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((sub) => (
              <TableRow
                key={sub.id}
                className="hover:bg-tremor-background-subtle"
              >
                <TableCell className="font-semibold text-tremor-content-strong">
                  {sub.name}
                </TableCell>
                <TableCell>
                  <Badge size="xs" color="indigo" className="uppercase">
                    {sub.plan}
                  </Badge>
                </TableCell>
                <TableCell>{sub.seats}</TableCell>
                <TableCell className="font-bold text-emerald-500">
                  {fmt(sub.mrr)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={sub.status} />
                </TableCell>
                <TableCell>{sub.nextBilling}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
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
      <Flex justifyContent="between" className="mb-6 gap-4 flex-wrap">
        <Flex className="gap-4 w-auto">
          <TextInput
            placeholder="🔍 Search invoices..."
            className="w-64"
            value={search}
            onValueChange={setSearch}
          />
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="w-40"
          >
            <SelectItem value="All">All Statuses</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
          </Select>
        </Flex>
      </Flex>
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Invoice</TableHeaderCell>
              <TableHeaderCell>Tenant</TableHeaderCell>
              <TableHeaderCell>Amount</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Due Date</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow
                key={inv.id}
                className="hover:bg-tremor-background-subtle"
              >
                <TableCell className="font-mono text-xs font-semibold">
                  {inv.id}
                </TableCell>
                <TableCell className="font-semibold text-tremor-content-strong">
                  {inv.tenantName}
                </TableCell>
                <TableCell className="font-bold text-tremor-content-strong">
                  {fmt(inv.amount)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={inv.status} />
                </TableCell>
                <TableCell
                  className={
                    inv.status === "overdue" ? "text-rose-500 font-bold" : ""
                  }
                >
                  {inv.dueDate}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// --- Finance Sub-components ---

function ChartOfAccountsTab({ accounts, onAddAccount }: { accounts: ChartAccount[], onAddAccount: () => void }) {
  // Sort accounts strictly by Code
  const sorted = [...accounts].sort((a,b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));

  return (
    <Card className="mt-4 shadow-sm border-slate-200">
      <Flex justifyContent="between" className="mb-6">
        <Title>Chart of Accounts</Title>
        <Button size="sm" onClick={onAddAccount}>
          <span className="mr-2">➕</span> New Account
        </Button>
      </Flex>
      <div className="overflow-x-auto">
        <Table>
          <TableHead className="bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHeaderCell className="w-32">Code</TableHeaderCell>
              <TableHeaderCell>Account Name</TableHeaderCell>
              <TableHeaderCell>Classification</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map(acc => {
              const depth = acc.code.split('.').length - 1;
              const indentClass = depth === 0 ? 'pl-4' : depth === 1 ? 'pl-8' : depth === 2 ? 'pl-12' : 'pl-16';
              return (
                <TableRow key={acc.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                  <TableCell className="font-mono text-xs font-semibold text-slate-500">
                     {acc.code}
                  </TableCell>
                  <TableCell className={`${indentClass} ${acc.isGroup ? 'font-black text-slate-800' : 'font-medium text-slate-600'}`}>
                     <div className="flex items-center gap-2">
                       {acc.isGroup && <span className="text-indigo-500 text-xs mt-0.5">▾</span>}
                       {!acc.isGroup && <span className="text-slate-300 text-xs mt-0.5">·</span>}
                       {acc.name}
                     </div>
                  </TableCell>
                  <TableCell>
                     <Badge size="xs" color={acc.type === 'ASSET' ? 'emerald' : acc.type === 'LIABILITY' ? 'rose' : acc.type === 'EQUITY' ? 'indigo' : acc.type === 'REVENUE' ? 'teal' : 'amber'}>
                       {acc.type}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                     {acc.isSystem ? <span className="text-xs text-slate-400 font-semibold bg-slate-100 px-2 rounded-md">SYSTEM</span> : <button className="text-xs text-indigo-600 font-bold hover:text-indigo-800">Edit</button>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
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
    <Card className="mt-4 shadow-sm border-slate-200">
      <Title>General Ledger</Title>
      <Table className="mt-4">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Date</TableHeaderCell>
            <TableHeaderCell>Description</TableHeaderCell>
            <TableHeaderCell>Account</TableHeaderCell>
            <TableHeaderCell className="text-right">Debit</TableHeaderCell>
            <TableHeaderCell className="text-right">Credit</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ledger.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{entry.date}</TableCell>
              <TableCell className="font-medium text-slate-800">{entry.description}</TableCell>
              <TableCell>{entry.account}</TableCell>
              <TableCell className="text-right text-emerald-600 font-medium">{entry.type === 'debit' ? `$${(entry.amount).toLocaleString()}` : '-'}</TableCell>
              <TableCell className="text-right text-rose-500 font-medium">{entry.type === 'credit' ? `$${(entry.amount).toLocaleString()}` : '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
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
      <Flex justifyContent="between">
        <div className="flex items-center gap-4">
          <Button variant="light" color="slate" onClick={onBack}>
            <span className="mr-2">←</span> Back to Directory
          </Button>
          <Title>{employee.id === "new" ? "Register New Employee" : "Edit Profile"}</Title>
        </div>
        <Button onClick={save} disabled={isSaving} icon={Save}>
          {isSaving ? "Saving..." : "Save Profile"}
        </Button>
      </Flex>
      
      <Grid numItems={1} numItemsMd={2} className="gap-6">
        <Card className="shadow-sm border-slate-200">
          <Title className="mb-4">Personal Details</Title>
          <div className="space-y-4">
            <div>
              <Text className="mb-1 font-medium text-slate-700">Full Name</Text>
              <TextInput value={form.name} onChange={e => setForm({...form, name: e.target.value})} disabled={isSaving} />
            </div>
            <div>
              <Text className="mb-1 font-medium text-slate-700">Location</Text>
              <TextInput value={form.location || ""} onChange={e => setForm({...form, location: e.target.value})} disabled={isSaving} />
            </div>
            <div>
              <Text className="mb-1 font-medium text-slate-700">Linked Member Identity</Text>
              <Select value={form.linkedMemberUid || ""} onValueChange={v => setForm({...form, linkedMemberUid: v})} disabled={isSaving}>
                <SelectItem value="">-- Not applicable --</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.userId}>{m.name || m.email || m.userId}</SelectItem>
                ))}
              </Select>
            </div>
            <div>
              <Text className="mb-1 font-medium text-slate-700">Linked Contact Record</Text>
              <Select value={form.linkedContactId || ""} onValueChange={v => setForm({...form, linkedContactId: v})} disabled={isSaving}>
                <SelectItem value="">-- Not applicable --</SelectItem>
                {contacts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name || "Unnamed Contact"}</SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </Card>
        
        <Card className="shadow-sm border-slate-200">
          <Title className="mb-4">Employment Data</Title>
          <div className="space-y-4">
            <div>
              <Text className="mb-1 font-medium text-slate-700">Title / Role</Text>
              <TextInput value={form.title} onChange={e => setForm({...form, title: e.target.value})} disabled={isSaving} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text className="mb-1 font-medium text-slate-700">Department</Text>
                <Select value={form.department} onValueChange={v => setForm({...form, department: v})} disabled={isSaving}>
                  <SelectItem value="Executive">Executive</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                </Select>
              </div>
              <div>
                <Text className="mb-1 font-medium text-slate-700">Type</Text>
                <Select value={form.employmentType} onValueChange={v => setForm({...form, employmentType: v})} disabled={isSaving}>
                  <SelectItem value="Full-Time">Full-Time</SelectItem>
                  <SelectItem value="Contractor">Contractor</SelectItem>
                </Select>
              </div>
            </div>
            <div>
              <Text className="mb-1 font-medium text-slate-700">Base Salary (USD)</Text>
              <TextInput type="number" value={form.baseSalary || ""} onChange={e => setForm({...form, baseSalary: Number(e.target.value)})} disabled={isSaving} />
            </div>
          </div>
        </Card>
      </Grid>
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
    <Card className="mt-4 shadow-sm border-slate-200">
      <Flex justifyContent="between" className="mb-6">
        <Title>Employee Directory</Title>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md mr-2 text-slate-500">
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-sm ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'hover:bg-slate-200'}`}><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-sm ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'hover:bg-slate-200'}`}><LayoutGrid className="w-4 h-4" /></button>
          </div>
          <Button size="sm" onClick={() => setDetailId("new")}>
            <span className="mr-2">➕</span> New Employee
          </Button>
        </div>
      </Flex>
      
      {!employees.length ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-slate-200 shadow-sm mt-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-2xl">👥</div>
          <h3 className="text-lg font-bold text-slate-800">No Employees Found</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-2 mb-4">There are no employees registered on the platform directory.</p>
          <Button onClick={() => setDetailId("new")}>
            <span className="mr-2">➕</span> Add First Employee
          </Button>
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
        <Table className="mt-4">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Title / Role</TableHeaderCell>
              <TableHeaderCell>Department</TableHeaderCell>
              <TableHeaderCell>Record Map</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map(emp => (
              <TableRow key={emp.id} onClick={() => setDetailId(emp.id)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                <TableCell className="font-bold text-slate-800">{emp.name}</TableCell>
                <TableCell>{emp.title}</TableCell>
                <TableCell>{emp.department}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {emp.linkedMemberUid && <Badge color="indigo" size="xs">Member</Badge>}
                    {emp.linkedContactId && <Badge color="emerald" size="xs">Contact</Badge>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function CommissionsTab({ employees }: { employees?: any[] }) {
  return (
    <Card className="mt-4 shadow-sm border-slate-200">
      <Title>Commission Accounting</Title>
      <Text className="mt-2 text-slate-500">Commissions engine is syncing with the Revenue pipeline...</Text>
    </Card>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function FinanceHubPage() {
  usePageTitle("Finance Control Center");
  const { user } = useAuth();

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
        <Text className="text-tremor-content font-medium">
          Synchronizing live financial data...
        </Text>
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
        <Title className="text-2xl font-black text-slate-800 tracking-tight mb-4">
          Finance & Operations
        </Title>
        <TabGroup>
          <TabList className="mt-2 text-sm border-0 font-semibold gap-4">
            <Tab className="data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 px-1 outline-none">
              Revenue & Growth
            </Tab>
            <Tab className="data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 px-1 outline-none">
              Corporate Expenses
            </Tab>
            <Tab className="data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 px-1 outline-none">
              Accounting & Ledgers
            </Tab>
            
            <Tab className="data-[selected]:border-b-2 data-[selected]:border-indigo-600 data-[selected]:text-indigo-600 text-slate-500 pb-2 px-1 outline-none">
              People & Payroll
            </Tab>
          </TabList>

          <main className="flex-1 flex flex-col min-h-0 relative animate-fade-in flex-grow">
            <TabPanels className="mt-0 flex-1 flex flex-col min-h-0 relative overflow-hidden h-full shadow-inner">
            {/* ─── REVENUE PANEL ─── */}
            <TabPanel>
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
            </TabPanel>

            {/* ─── EXPENSES PANEL ─── */}
            <TabPanel>
              <div className="flex-1 flex flex-col min-h-0 relative h-full">
              <SecondaryDock
                tabs={EXP_TABS}
                activeTab={expTab}
                onTabChange={setExpTab}
              />
              <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 w-full animate-fade-in relative bg-slate-50/50">
                <div className="flex justify-end mb-4 gap-3">
                  <Button size="sm" variant="secondary">
                    ↻ Refresh
                  </Button>
                  <Button size="sm">
                    <span className="mr-2">📎</span> Scan Receipt PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setIsManualEntryOpen(true)}
                  >
                    Manual Entry
                  </Button>
                </div>

                {expTab === "dashboard" && (
                  <div className="space-y-6">
                    <Grid numItemsSm={1} numItemsLg={4} className="gap-6">
                      <Card
                        className="shadow-sm border-slate-200"
                        decoration="top"
                        decorationColor="blue"
                      >
                        <Text>MTD Operating Expenses</Text>
                        <Metric className="text-3xl font-black">
                          {fmt(totalMonthlyOpex)}
                        </Metric>
                      </Card>
                      <Card
                        className="shadow-sm border-slate-200"
                        decoration="top"
                        decorationColor="amber"
                      >
                        <Text>Projected Annual Burn</Text>
                        <Metric className="text-3xl font-black">
                          {fmt(projectedAnnual)}
                        </Metric>
                      </Card>
                      <Card
                        className="shadow-sm border-slate-200"
                        decoration="top"
                        decorationColor="rose"
                      >
                        <Text>Pending Reimbursable</Text>
                        <Metric className="text-3xl font-black">
                          {fmt(1850)}
                        </Metric>
                        <Flex className="mt-4">
                          <Badge color="rose" size="xs">
                            Requires signature
                          </Badge>
                        </Flex>
                      </Card>
                      <Card
                        className="shadow-sm border-slate-200"
                        decoration="top"
                        decorationColor="emerald"
                      >
                        <Text>Cash Efficiency Ratio</Text>
                        <Metric className="text-3xl font-black">1.14x</Metric>
                      </Card>
                    </Grid>
                    <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
                      <Card className="col-span-2 shadow-sm border-slate-200">
                        <Title>T30 Expense Trend</Title>
                        <AreaChart
                          className="mt-6 h-72"
                          data={chartData}
                          index="Month"
                          categories={[
                            "SaaS & Infra",
                            "Travel & Ent",
                            "Office & Supplies",
                            "Legal & Prof",
                          ]}
                          colors={["blue", "rose", "amber", "emerald"]}
                          valueFormatter={(num) =>
                            `${Intl.NumberFormat("us").format(num).toString()}`
                          }
                          stack={true}
                        />
                      </Card>
                      <Card className="shadow-sm border-slate-200">
                        <Title>Top SaaS Subscriptions</Title>
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
                      </Card>
                    </Grid>
                  </div>
                )}
                {expTab === "reporting" && (
                  <Card className="p-0 shadow-sm border-slate-200 overflow-hidden">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Date</TableHeaderCell>
                          <TableHeaderCell>Merchant</TableHeaderCell>
                          <TableHeaderCell>Category</TableHeaderCell>
                          <TableHeaderCell>Amount</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {expensesList.map((exp) => (
                          <TableRow key={exp.id}>
                            <TableCell>{fmtDate(exp.startDate)}</TableCell>
                            <TableCell>{exp.vendor || exp.name}</TableCell>
                            <TableCell>{exp.category}</TableCell>
                            <TableCell className="font-bold text-rose-500">
                              {fmt(exp.amountUsd)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
                {expTab === "approvals" && (
                  <Card>
                    <Title>Approvals Queue</Title>
                    <Text className="mt-4 text-slate-500">
                      All pending reimbursements caught by automated rules.
                    </Text>
                  </Card>
                )}
              </div>
              </div>
            </TabPanel>
            {/* --- ACCOUNTING PANEL --- */}
            <TabPanel>
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
                  <Card>
                    <Title>P&L Statement</Title>
                    <Text className="mt-4">Aggregated view coming soon.</Text>
                  </Card>
                )}
                {accTab === "balance" && (
                  <Card>
                    <Title>Balance Sheet</Title>
                    <Text className="mt-4">Summary coming soon.</Text>
                  </Card>
                )}
              </div>
              </div>
            </TabPanel>

            
            {/* --- PEOPLE & PAYROLL PANEL --- */}
            <TabPanel>
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
                  <Card>
                    <Title>Payroll Overview</Title>
                    <Text className="mt-4">Integration processing...</Text>
                  </Card>
                )}
              </div>
              </div>
            </TabPanel>

          </TabPanels>
        </main>
        </TabGroup>
      </div>

      {/* Modal removed for center view */}

      <Dialog open={isAddAccountOpen} onClose={(v) => { if(!isSavingEmployee) setIsAddAccountOpen(v); }} static={true}>
        <DialogPanel className="max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <Title className="font-black text-slate-800">Add Account Plan</Title>
            <button className="text-slate-400 hover:text-slate-600" onClick={() => setIsAddAccountOpen(false)}>×</button>
          </div>
          <div className="space-y-4">
             <div>
               <Text className="text-xs uppercase font-bold text-slate-500 mb-1">Account Code</Text>
               <TextInput placeholder="e.g. 1.1.3" value={newAccountForm.code} onChange={e => setNewAccountForm({...newAccountForm, code: e.target.value})} />
               <Text className="text-[10px] text-slate-400 mt-1">Use dot decimal notation (e.g., 5.1.4) to auto-nest.</Text>
             </div>
             <div>
               <Text className="text-xs uppercase font-bold text-slate-500 mb-1">Account Name</Text>
               <TextInput placeholder="e.g. Prepaid Insurance" value={newAccountForm.name} onChange={e => setNewAccountForm({...newAccountForm, name: e.target.value})} />
             </div>
             <div>
               <Text className="text-xs uppercase font-bold text-slate-500 mb-1">Classification Type</Text>
               <Select value={newAccountForm.type} onValueChange={v => setNewAccountForm({...newAccountForm, type: v as any})}>
                 <SelectItem value="ASSET">Asset (Ativo)</SelectItem>
                 <SelectItem value="LIABILITY">Liability (Passivo)</SelectItem>
                 <SelectItem value="EQUITY">Equity (Patrimônio)</SelectItem>
                 <SelectItem value="REVENUE">Revenue (Receita)</SelectItem>
                 <SelectItem value="EXPENSE">Expense (Despesa)</SelectItem>
               </Select>
             </div>
             <div className="flex items-center gap-2 mt-4 ml-1">
               <input type="checkbox" id="isGroup" checked={newAccountForm.isGroup} onChange={e => setNewAccountForm({...newAccountForm, isGroup: e.target.checked})} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" />
               <label htmlFor="isGroup" className="text-sm font-semibold text-slate-700 cursor-pointer">This is a Group Account</label>
             </div>
          </div>
          <div className="mt-8 flex justify-end gap-3">
            <Button size="sm" variant="secondary" onClick={() => setIsAddAccountOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={async () => {
                const added = await addChartAccount(newAccountForm);
                setChartAccounts(prev => [...prev, added]);
                setIsAddAccountOpen(false);
                setNewAccountForm({ name: "", code: "", type: "EXPENSE", isGroup: false });
            }}>Add Account</Button>
          </div>
        </DialogPanel>
      </Dialog>
    </div>
  );
}
