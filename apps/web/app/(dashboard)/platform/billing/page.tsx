'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { getMockRenewals, renewalDaysLeft, formatRenewalDate } from '@/lib/renewalService';
import { usePageTitle } from '@/lib/PageTitleContext';

import type { PlanDefinition } from '@/lib/planService';
import { getPlans } from '@/lib/planService';
import type { TenantSubscription, Invoice as LiveInvoice } from '@/lib/subscriptionService';
import { getAllSubscriptions, getAllInvoices, planMonthlyTotal } from '@/lib/subscriptionService';
import type { PlatformExpense } from '@/lib/expenseService';
import { getAllExpenses, monthlyEquivalent } from '@/lib/expenseService';
import type { RenewalRecord } from '@/lib/renewalService';
import { listRenewals } from '@/lib/renewalService';

import {
  Card, Metric, Text, Title, Subtitle, Flex, Grid, Col,
  BarList, Badge, Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell,
  TabGroup, TabList, Tab, TabPanels, TabPanel, Button, TextInput, Select, SelectItem
} from '@tremor/react';

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Plan {
  id: string; name: string; priceMonthly: number; priceAnnual: number;
  seats: number; families: number; aiTokens: string; storage: string;
  features: string[]; color: string; popular?: boolean;
}

interface Subscriber {
  id: string; name: string; plan: string; seats: number;
  mrr: number; arr: number; status: 'active' | 'trial' | 'suspended' | 'churned';
  startDate: string; nextBilling: string; country: string;
}

interface Invoice {
  id: string; tenantName: string; amount: number; status: 'paid' | 'pending' | 'overdue' | 'void' | 'cancelled';
  date: string; dueDate: string; plan: string;
}

interface Expense {
  category: string; monthly: number; ytd: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return `$${n.toLocaleString()}` }

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    active: 'emerald', trial: 'amber', suspended: 'rose', churned: 'slate',
    paid: 'emerald', pending: 'indigo', overdue: 'rose'
  };
  return map[status] || 'slate';
}

function StatusBadge({ status }: { status: string }) {
  return <Badge color={getStatusColor(status) as any} className="capitalize">{status}</Badge>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OverviewTab({ plans, subscribers, expenses }: { plans: Plan[], subscribers: Subscriber[], expenses: Expense[] }) {
  const totalMRR = subscribers.filter(s => s.status === 'active').reduce((s, t) => s + t.mrr, 0);
  const totalARR = totalMRR * 12;
  const totalExpenses = expenses.reduce((s, e) => s + e.monthly, 0);
  const grossProfit = totalMRR - totalExpenses;
  const margin = totalMRR ? Math.round((grossProfit / totalMRR) * 100) : 0;
  const activeCount = subscribers.filter(s => s.status === 'active').length;
  const trialCount = subscribers.filter(s => s.status === 'trial').length;
  const avgMRR = activeCount ? Math.round(totalMRR / activeCount) : 0;

  const revenueByPlan = plans.map(plan => {
    const subs = subscribers.filter(s => s.plan === plan.name && s.status !== 'churned');
    return {
      name: plan.name,
      value: subs.reduce((a, s) => a + s.mrr, 0),
      count: subs.length,
      color: plan.color
    };
  }).filter(p => p.value > 0).sort((a,b) => b.value - a.value);

  return (
    <div className="animate-fade-in py-6">
      {/* KPI Row */}
      <Grid numItemsSm={2} numItemsLg={3} className="gap-6 mb-6">
        <Card decoration="top" decorationColor="indigo">
          <Text>Monthly Recurring Revenue (MRR)</Text>
          <Metric>{fmt(totalMRR)}</Metric>
          <Text className="mt-2 text-tremor-content">Annualized: {fmt(totalARR)}</Text>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>Gross Profit Margin</Text>
          <Metric>{margin}%</Metric>
          <Text className="mt-2 text-tremor-content">{fmt(grossProfit)} monthly profit</Text>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Platform OPEX</Text>
          <Metric>{fmt(totalExpenses)}</Metric>
          <Text className="mt-2 text-tremor-content">Infrastructure & Operations</Text>
        </Card>
        <Card decoration="top" decorationColor="blue">
          <Text>Active Tenants</Text>
          <Metric>{activeCount}</Metric>
          <Text className="mt-2 text-tremor-content">{trialCount} accounts evaluating</Text>
        </Card>
        <Card decoration="top" decorationColor="fuchsia">
          <Text>Average MRR (ARPU)</Text>
          <Metric>{fmt(avgMRR)}</Metric>
          <Text className="mt-2 text-tremor-content">Per active configured tenant</Text>
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
            {expenses.map(exp => (
              <div key={exp.category} className="flex justify-between items-center py-2 border-b border-tremor-border last:border-0 last:pb-0">
                <Text className="font-medium text-tremor-content-strong">{exp.category}</Text>
                <div className="text-right">
                  <Text className="font-bold text-tremor-content-strong">{fmt(exp.monthly)}<span className="text-xs font-normal">/mo</span></Text>
                  <Text className="text-xs text-tremor-content">YTD: {fmt(exp.ytd)}</Text>
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 mt-1 border-t border-tremor-border">
              <Text className="font-bold text-sm text-tremor-content-strong uppercase tracking-wider">Total OPEX</Text>
              <Text className="font-bold text-rose-500">{fmt(totalExpenses)}<span className="text-xs font-normal">/mo</span></Text>
            </div>
          </div>
        </Card>
      </Grid>

      {/* ROI Summary */}
      <Card decoration="left" decorationColor="blue" className="bg-gradient-to-br from-indigo-50/50 to-cyan-50/50 dark:from-indigo-900/10 dark:to-cyan-900/10">
        <Title>Platform ROI Model (Estimated)</Title>
        <Grid numItemsSm={2} numItemsLg={4} className="gap-4 mt-4">
          <Card className="shadow-sm">
            <Text>Customer LTV</Text>
            <Metric className="text-2xl">${(avgMRR * 24).toLocaleString()}</Metric>
            <Text className="mt-1 text-xs text-tremor-content">24-month horizon avg</Text>
          </Card>
          <Card className="shadow-sm">
            <Text>CAC</Text>
            <Metric className="text-2xl">$820</Metric>
            <Text className="mt-1 text-xs text-tremor-content">Sales + marketing</Text>
          </Card>
          <Card className="shadow-sm border-emerald-500/30">
            <Text>LTV / CAC Ratio</Text>
            <Metric className="text-2xl text-emerald-600 dark:text-emerald-400">{Math.round((avgMRR * 24) / 820)}x</Metric>
            <Text className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300">Target: &gt; 3.0x</Text>
          </Card>
          <Card className="shadow-sm border-emerald-500/30">
            <Text>Payback Period</Text>
            <Metric className="text-2xl text-emerald-600 dark:text-emerald-400">{Math.round(820 / avgMRR)} mo</Metric>
            <Text className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300">Target: &lt; 12 Months</Text>
          </Card>
        </Grid>
      </Card>
    </div>
  );
}

function SubscribersTab({ plans, subscribers }: { plans: Plan[], subscribers: Subscriber[] }) {
  const [search, setSearch] = useState('');
  const filtered = subscribers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-fade-in py-6">
      <Flex justifyContent="between" alignItems="center" className="mb-6">
        <TextInput 
          placeholder="🔍 Search subscribers..." 
          className="max-w-xs"
          value={search}
          onValueChange={setSearch}
        />
        <Button size="sm" variant="primary">Onboard Tenant</Button>
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
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((sub) => (
              <TableRow key={sub.id} className="hover:bg-tremor-background-subtle">
                <TableCell className="font-semibold text-tremor-content-strong">{sub.name}</TableCell>
                <TableCell>
                  <Badge size="xs" color="indigo" className="uppercase">{sub.plan}</Badge>
                </TableCell>
                <TableCell>{sub.seats}</TableCell>
                <TableCell className="font-bold text-emerald-500">{fmt(sub.mrr)}</TableCell>
                <TableCell><StatusBadge status={sub.status} /></TableCell>
                <TableCell>{sub.nextBilling}</TableCell>
                <TableCell className="text-right">
                  <Button size="xs" variant="light">Manage</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function InvoicesTab({ invoices }: { invoices: Invoice[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const filtered = invoices.filter(i => {
    const matchesSearch = i.tenantName.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || i.status.toLowerCase() === statusFilter.toLowerCase();
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
          <Select value={statusFilter} onValueChange={setStatusFilter} className="w-40">
            <SelectItem value="All">All Statuses</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
          </Select>
        </Flex>
        <Flex className="gap-3 w-auto">
          <Button size="sm" variant="secondary">📥 Export</Button>
          <Button size="sm" variant="primary">Generate Invoice</Button>
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
              <TableHeaderCell>Issued</TableHeaderCell>
              <TableHeaderCell>Due Date</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow key={inv.id} className="hover:bg-tremor-background-subtle">
                <TableCell className="font-mono text-xs font-semibold">{inv.id}</TableCell>
                <TableCell className="font-semibold text-tremor-content-strong">{inv.tenantName}</TableCell>
                <TableCell className="font-bold text-tremor-content-strong">{fmt(inv.amount)}</TableCell>
                <TableCell><StatusBadge status={inv.status} /></TableCell>
                <TableCell>{inv.date}</TableCell>
                <TableCell className={inv.status === 'overdue' ? 'text-rose-500 font-bold' : ''}>{inv.dueDate}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="xs" variant="light">View</Button>
                  {inv.status !== 'paid' && <Button size="xs" variant="light">Send</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function RenewalsTab({ renewals }: { renewals: RenewalRecord[] }) {
  const dueSoon  = renewals.filter(r => !['completed', 'declined', 'expired'].includes(r.status) && renewalDaysLeft(r) <= 30);
  const highRisk = renewals.filter(r => r.risk === 'high' && !['declined', 'expired'].includes(r.status));
  const mrrAtRisk = renewals.filter(r => !['completed', 'declined', 'expired'].includes(r.status)).reduce((s, r) => s + r.currentMrr, 0);

  return (
    <div className="animate-fade-in py-6">
      <Grid numItemsSm={1} numItemsLg={3} className="gap-6 mb-8">
        <Card decoration="top" decorationColor="emerald">
          <Text>MRR at stake</Text>
          <Metric>{fmt(mrrAtRisk)}</Metric>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Due ≤ 30 days</Text>
          <Metric>{dueSoon.length}</Metric>
        </Card>
        <Card decoration="top" decorationColor="rose">
          <Text>High-risk renewals</Text>
          <Metric>{highRisk.length}</Metric>
        </Card>
      </Grid>

      <Flex justifyContent="between" alignItems="center" className="mb-6">
        <Title>Renewals Pipeline (≤ 30 Days)</Title>
        <Link href="/platform/renewals" className="text-sm font-semibold text-indigo-500 hover:text-indigo-600 transition-colors">
          Open CRM Pipeline &rarr;
        </Link>
      </Flex>

      {dueSoon.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed border-2">
          <div className="text-4xl mb-3">🎉</div>
          <Title>All clear!</Title>
          <Text className="mt-2 text-tremor-content">No active renewals are due within the next 30 days.</Text>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Tenant</TableHeaderCell>
                <TableHeaderCell>Plan Identity</TableHeaderCell>
                <TableHeaderCell>MRR</TableHeaderCell>
                <TableHeaderCell>Period End</TableHeaderCell>
                <TableHeaderCell>Days Left</TableHeaderCell>
                <TableHeaderCell>Risk</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dueSoon.sort((a,b) => renewalDaysLeft(a) - renewalDaysLeft(b)).map((r) => {
                const days = renewalDaysLeft(r);
                const dayColor = days <= 14 ? 'rose' : days <= 30 ? 'amber' : 'emerald';
                const riskColor = r.risk === 'high' ? 'rose' : r.risk === 'medium' ? 'amber' : 'emerald';
                
                return (
                  <TableRow key={r.id} className="hover:bg-tremor-background-subtle w-full">
                    <TableCell className="font-semibold text-tremor-content-strong">{r.tenantName}</TableCell>
                    <TableCell>
                      <Text>{r.planName}</Text>
                      <Text className="text-xs text-tremor-content">{r.billingCycle}</Text>
                    </TableCell>
                    <TableCell className="font-bold text-emerald-500">{fmt(r.currentMrr)}</TableCell>
                    <TableCell>{formatRenewalDate(r.periodEnd)}</TableCell>
                    <TableCell>
                      <Badge color={dayColor} size="xs" className="font-bold">
                        {days === 0 ? 'Today!' : `${days}d`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge color={riskColor} size="xs" className="capitalize px-2 py-0.5">
                        {r.risk}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  usePageTitle('Revenue');

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [livePlans, liveSubs, liveInvoices, liveExpenses, liveRenewals] = await Promise.all([
          getPlans(),
          getAllSubscriptions(),
          getAllInvoices(),
          getAllExpenses(),
          listRenewals(),
        ]);

        setPlans(livePlans.map(p => ({
          id: p.code, name: p.name, priceMonthly: p.baseMonthly, priceAnnual: p.baseAnnual,
          seats: p.maxSeats, families: -1, aiTokens: '', storage: '', features: p.features,
          color: p.color
        })));

        setSubscribers(liveSubs.map(s => {
          const mrr = planMonthlyTotal(s);
          let mappedStatus: Subscriber['status'] = 'active';
          if (s.status === 'trial') mappedStatus = 'trial';
          else if (s.status === 'suspended') mappedStatus = 'suspended';
          else if (s.status === 'cancelled' || s.status === 'past_due') mappedStatus = 'churned';

          return {
            id: s.tenantId, name: s.tenantName, plan: s.planId.toUpperCase(),
            seats: s.licensedSeats, mrr, arr: mrr * 12, status: mappedStatus,
            startDate: s.subscriptionStart?.split('T')[0] || '',
            nextBilling: s.nextInvoiceDate?.split('T')[0] || '',
            country: 'Global'
          };
        }));

        setInvoices(liveInvoices.map(i => ({
          id: i.invoiceNumber, tenantName: i.tenantName, amount: i.totalAmount,
          status: i.status === 'draft' ? 'pending' : i.status === 'sent' ? 'pending' : i.status as any,
          date: i.issuedAt.split('T')[0], dueDate: i.dueAt.split('T')[0], plan: i.planId.toUpperCase()
        })));

        setExpenses(liveExpenses.map(e => ({
          category: e.name, monthly: monthlyEquivalent(e), ytd: monthlyEquivalent(e) * 3
        })));

        setRenewals(liveRenewals);
      } catch (e) {
        console.error('Failed to load live billing data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const { renewalsDueSoon } = useMemo(() => {
    return { renewalsDueSoon: renewals.filter(r => !['completed', 'declined', 'expired'].includes(r.status) && renewalDaysLeft(r) <= 30).length };
  }, [renewals]);

  const totalMRR = subscribers.filter(s => s.status === 'active').reduce((s, t) => s + t.mrr, 0);

  if (loading) {
    return (
      <div className="page flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <Text className="text-tremor-content font-medium">Synchronizing live revenue data...</Text>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-fade-in max-w-[1400px] mx-auto py-8">
      {/* MRR summary strip — compact */}
      <Flex justifyContent="end" className="mb-6">
        <div className="text-right bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-500/20 px-6 py-3 rounded-tremor-default shadow-sm inline-block">
          <div className="text-xl font-bold text-emerald-600 leading-tight">
            {fmt(totalMRR)}<span className="text-sm text-emerald-500/80 font-normal ml-1">/mo MRR</span>
          </div>
          <div className="text-xs text-emerald-500/80 mt-1 font-medium tracking-wide text-right">{fmt(totalMRR * 12)} ARR</div>
        </div>
      </Flex>

      <TabGroup>
        <TabList className="mb-2 w-full justify-start whitespace-nowrap border-b border-tremor-border pb-1">
          <Tab icon={() => <span className="mr-2 text-md">📊</span>} className="font-semibold px-4">Revenue Overview</Tab>
          <Tab icon={() => <span className="mr-2 text-md">🏢</span>} className="font-semibold px-4">Subscribers</Tab>
          <Tab icon={() => <span className="mr-2 text-md">🧾</span>} className="font-semibold px-4">Invoices</Tab>
          <Tab icon={() => <span className="mr-2 text-md">🔁</span>} className="font-semibold px-4">
            Renewals {renewalsDueSoon > 0 && <Badge color="amber" size="xs" className="ml-2 rounded-full px-1.5">{renewalsDueSoon}</Badge>}
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel><OverviewTab plans={plans} subscribers={subscribers} expenses={expenses} /></TabPanel>
          <TabPanel><SubscribersTab plans={plans} subscribers={subscribers} /></TabPanel>
          <TabPanel><InvoicesTab invoices={invoices} /></TabPanel>
          <TabPanel><RenewalsTab renewals={renewals} /></TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}
