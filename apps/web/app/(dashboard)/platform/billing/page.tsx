'use client';

import React, { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  id: string; tenantName: string; amount: number; status: 'paid' | 'pending' | 'overdue';
  date: string; dueDate: string; plan: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    id: 'starter', name: 'Starter', priceMonthly: 490, priceAnnual: 4900, seats: 2, families: 5,
    aiTokens: '50k/mo', storage: '5 GB', color: '#64748b',
    features: ['Core CRM', 'Document Vault', 'Basic Reports', 'Email Support', 'TOTP MFA']
  },
  {
    id: 'growth', name: 'Growth', priceMonthly: 1290, priceAnnual: 12900, seats: 10, families: 25,
    aiTokens: '500k/mo', storage: '50 GB', color: '#6366f1', popular: true,
    features: ['Everything in Starter', 'Suitability Assessments', 'Calendar Sync', 'AI Summaries', 'Priority Support', 'Custom Branding']
  },
  {
    id: 'enterprise', name: 'Enterprise', priceMonthly: 3490, priceAnnual: 34900, seats: 999, families: 999,
    aiTokens: 'Unlimited', storage: '500 GB', color: '#f59e0b',
    features: ['Everything in Growth', 'Unlimited Families', 'Multi-tenant Admin', 'BYOK AI Keys', 'SLA 99.9%', 'Dedicated CSM', 'Custom Integrations']
  },
];

const SUBSCRIBERS: Subscriber[] = [
  { id: 't-001', name: 'Vivants Multi-Family Office', plan: 'Enterprise', seats: 8, mrr: 3490, arr: 34900, status: 'active', startDate: '2024-01-01', nextBilling: '2026-04-01', country: 'Brazil' },
  { id: 't-002', name: 'Apex Wealth Partners', plan: 'Growth', seats: 6, mrr: 1290, arr: 12900, status: 'active', startDate: '2024-03-15', nextBilling: '2026-04-15', country: 'Brazil' },
  { id: 't-003', name: 'Summit Capital', plan: 'Growth', seats: 4, mrr: 1290, arr: 12900, status: 'active', startDate: '2024-06-01', nextBilling: '2026-04-01', country: 'USA' },
  { id: 't-004', name: 'Legacy Trust Group', plan: 'Enterprise', seats: 12, mrr: 3490, arr: 34900, status: 'active', startDate: '2023-11-01', nextBilling: '2026-04-01', country: 'UK' },
  { id: 't-005', name: 'AlphaPath Advisory', plan: 'Starter', seats: 2, mrr: 490, arr: 4900, status: 'trial', startDate: '2026-03-01', nextBilling: '2026-04-01', country: 'Hong Kong' },
  { id: 't-006', name: 'Meridian Wealth', plan: 'Growth', seats: 5, mrr: 1290, arr: 12900, status: 'active', startDate: '2025-01-10', nextBilling: '2026-04-10', country: 'Brazil' },
  { id: 't-007', name: 'Pacific Family Office', plan: 'Starter', seats: 2, mrr: 0, arr: 0, status: 'churned', startDate: '2024-05-01', nextBilling: '—', country: 'Australia' },
];

const INVOICES: Invoice[] = [
  { id: 'INV-2026-031', tenantName: 'Vivants Multi-Family Office', amount: 3490, status: 'pending', date: '2026-03-20', dueDate: '2026-04-01', plan: 'Enterprise' },
  { id: 'INV-2026-030', tenantName: 'Apex Wealth Partners', amount: 1290, status: 'pending', date: '2026-03-15', dueDate: '2026-04-15', plan: 'Growth' },
  { id: 'INV-2026-029', tenantName: 'Legacy Trust Group', amount: 3490, status: 'paid', date: '2026-03-01', dueDate: '2026-03-01', plan: 'Enterprise' },
  { id: 'INV-2026-028', tenantName: 'Summit Capital', amount: 1290, status: 'paid', date: '2026-03-01', dueDate: '2026-03-01', plan: 'Growth' },
  { id: 'INV-2026-027', tenantName: 'Meridian Wealth', amount: 1290, status: 'paid', date: '2026-03-10', dueDate: '2026-03-10', plan: 'Growth' },
  { id: 'INV-2026-026', tenantName: 'Pacific Family Office', amount: 490, status: 'overdue', date: '2026-02-01', dueDate: '2026-02-28', plan: 'Starter' },
];

const EXPENSES = [
  { category: 'Firebase / GCP', monthly: 380, ytd: 1140 },
  { category: 'OpenAI API (shared)', monthly: 210, ytd: 630 },
  { category: 'Sendgrid Email', monthly: 45, ytd: 135 },
  { category: 'Domain & DNS', monthly: 12, ytd: 36 },
  { category: 'Monitoring (Datadog)', monthly: 120, ytd: 360 },
  { category: 'Legal & Compliance', monthly: 500, ytd: 1500 },
  { category: 'Team Salaries (ops share)', monthly: 4200, ytd: 12600 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return `$${n.toLocaleString()}` }

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: '#22c55e', trial: '#f59e0b', suspended: '#ef4444', churned: '#64748b',
    paid: '#22c55e', pending: '#6366f1', overdue: '#ef4444'
  };
  const color = colors[status] || '#64748b';
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: `${color}22`, color, border: `1px solid ${color}44`, textTransform: 'capitalize' }}>{status}</span>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OverviewTab() {
  const totalMRR = SUBSCRIBERS.filter(s => s.status === 'active').reduce((s, t) => s + t.mrr, 0);
  const totalARR = totalMRR * 12;
  const totalExpenses = EXPENSES.reduce((s, e) => s + e.monthly, 0);
  const grossProfit = totalMRR - totalExpenses;
  const margin = Math.round((grossProfit / totalMRR) * 100);
  const activeCount = SUBSCRIBERS.filter(s => s.status === 'active').length;
  const trialCount = SUBSCRIBERS.filter(s => s.status === 'trial').length;
  const avgMRR = Math.round(totalMRR / activeCount);

  return (
    <div className="animate-fade-in">
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'MRR', value: fmt(totalMRR), sub: '+11.2% MoM', color: '#6366f1' },
          { label: 'ARR', value: fmt(totalARR), sub: 'Annualized', color: '#22d3ee' },
          { label: 'Gross Profit', value: fmt(grossProfit), sub: `${margin}% margin`, color: '#22c55e' },
          { label: 'Monthly OPEX', value: fmt(totalExpenses), sub: 'All infra + ops', color: '#f59e0b' },
          { label: 'Active Tenants', value: activeCount, sub: `${trialCount} trial`, color: '#6366f1' },
          { label: 'Avg MRR/Tenant', value: fmt(avgMRR), sub: 'Per customer', color: '#22d3ee' },
        ].map(kpi => (
          <div key={kpi.label} style={{ padding: '20px', background: 'var(--bg-elevated)', border: `1px solid ${kpi.color}33`, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em', marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue by Plan */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <div style={{ padding: 24, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 800, marginBottom: 20, fontSize: 16 }}>Revenue by Plan</h3>
          {PLANS.map(plan => {
            const subs = SUBSCRIBERS.filter(s => s.plan === plan.name && s.status !== 'churned');
            const rev = subs.reduce((a, s) => a + s.mrr, 0);
            const pct = Math.round((rev / totalMRR) * 100) || 0;
            return (
              <div key={plan.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{plan.name}</span>
                  <span style={{ fontSize: 13, color: plan.color, fontWeight: 700 }}>{fmt(rev)} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-canvas)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: plan.color, borderRadius: 3, transition: 'width 0.6s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{subs.length} subscribers</div>
              </div>
            );
          })}
        </div>

        {/* Expense Breakdown */}
        <div style={{ padding: 24, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 800, marginBottom: 20, fontSize: 16 }}>Monthly OPEX Breakdown</h3>
          {EXPENSES.map(exp => (
            <div key={exp.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13 }}>{exp.category}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(exp.monthly)}/mo</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>YTD: {fmt(exp.ytd)}</div>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontWeight: 800 }}>
            <span>Total OPEX</span>
            <span style={{ color: '#ef4444' }}>{fmt(totalExpenses)}/mo</span>
          </div>
        </div>
      </div>

      {/* ROI Summary */}
      <div style={{ padding: 24, background: 'linear-gradient(135deg, #6366f108, #22d3ee08)', border: '1px solid var(--brand-500)33', borderRadius: 'var(--radius-xl)', marginBottom: 32 }}>
        <h3 style={{ fontWeight: 800, marginBottom: 16, fontSize: 16 }}>📊 Platform ROI Dashboard</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {[
            { label: 'Customer LTV (avg)', value: '$' + (avgMRR * 24).toLocaleString(), sub: '24-mo average' },
            { label: 'CAC (est.)', value: '$820', sub: 'Sales + marketing' },
            { label: 'LTV / CAC Ratio', value: `${Math.round((avgMRR * 24) / 820)}x`, sub: 'Target: >3x ✅' },
            { label: 'Payback Period', value: `${Math.round(820 / avgMRR)} months`, sub: 'Target: <12 months ✅' },
          ].map(m => (
            <div key={m.label} style={{ padding: '16px 20px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand-400)' }}>{m.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SubscribersTab() {
  const [search, setSearch] = useState('');
  const filtered = SUBSCRIBERS.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <input type="text" placeholder="🔍 Search tenants…" value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ padding: '8px 14px', width: 280 }} />
        <button className="btn btn-primary btn-sm">+ Onboard Tenant</button>
      </div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
              {['Tenant', 'Plan', 'Seats', 'MRR', 'ARR', 'Status', 'Country', 'Next Billing', ''].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(sub => (
              <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-lift">
                <td style={{ padding: '14px 14px', fontWeight: 600, fontSize: 14 }}>{sub.name}</td>
                <td style={{ padding: '14px 14px' }}>
                  <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 8, background: PLANS.find(p => p.name === sub.plan)?.color + '22', color: PLANS.find(p => p.name === sub.plan)?.color, fontWeight: 700 }}>
                    {sub.plan}
                  </span>
                </td>
                <td style={{ padding: '14px 14px', fontSize: 13 }}>{sub.seats}</td>
                <td style={{ padding: '14px 14px', fontWeight: 700, color: '#22c55e' }}>{fmt(sub.mrr)}</td>
                <td style={{ padding: '14px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{fmt(sub.arr)}</td>
                <td style={{ padding: '14px 14px' }}><StatusPill status={sub.status} /></td>
                <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{sub.country}</td>
                <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{sub.nextBilling}</td>
                <td style={{ padding: '14px 14px' }}>
                  <button className="btn btn-ghost btn-sm">Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvoicesTab() {
  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="🔍 Search invoices…" className="input" style={{ padding: '8px 14px', width: 240 }} />
          <select className="input" style={{ padding: '8px 12px' }}><option>All Statuses</option><option>Paid</option><option>Pending</option><option>Overdue</option></select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm">📥 Export</button>
          <button className="btn btn-primary btn-sm">+ Generate Invoice</button>
        </div>
      </div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
              {['Invoice', 'Tenant', 'Plan', 'Amount', 'Status', 'Issued', 'Due Date', ''].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INVOICES.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-lift">
                <td style={{ padding: '14px 14px', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{inv.id}</td>
                <td style={{ padding: '14px 14px', fontSize: 13, fontWeight: 600 }}>{inv.tenantName}</td>
                <td style={{ padding: '14px 14px' }}>
                  <span style={{ fontSize: 11, background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>{inv.plan}</span>
                </td>
                <td style={{ padding: '14px 14px', fontWeight: 800, fontSize: 15 }}>{fmt(inv.amount)}</td>
                <td style={{ padding: '14px 14px' }}><StatusPill status={inv.status} /></td>
                <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{inv.date}</td>
                <td style={{ padding: '14px 14px', fontSize: 12, color: inv.status === 'overdue' ? '#ef4444' : 'var(--text-secondary)', fontWeight: inv.status === 'overdue' ? 700 : 400 }}>{inv.dueDate}</td>
                <td style={{ padding: '14px 14px', display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm">📄 View</button>
                  {inv.status !== 'paid' && <button className="btn btn-ghost btn-sm">📧 Send</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'subscribers' | 'invoices';

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>('overview');

  const totalMRR = SUBSCRIBERS.filter(s => s.status === 'active').reduce((s, t) => s + t.mrr, 0);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
              Billing <span style={{ color: 'var(--brand-500)', fontWeight: 400 }}>& Subscriptions</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Subscription revenue, invoicing, plan management, and financial analytics.</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#22c55e' }}>{fmt(totalMRR)}<span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 400 }}>/mo MRR</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmt(totalMRR * 12)} ARR</div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 32, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {([
          { id: 'overview', label: '📊 Revenue Overview' },
          { id: 'subscribers', label: '🏢 Subscribers' },
          { id: 'invoices', label: '🧾 Invoices' },
        ] as const).map(t => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className="btn btn-ghost btn-sm"
            style={{ borderRadius: '8px 8px 0 0', borderBottom: tab === t.id ? '2px solid var(--brand-500)' : '2px solid transparent', fontWeight: tab === t.id ? 700 : 500, paddingBottom: 12 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'subscribers' && <SubscribersTab />}
      {tab === 'invoices' && <InvoicesTab />}
    </div>
  );
}
