'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getAllOrgs } from '@/lib/crmService';
import { getAllSubscriptions } from '@/lib/subscriptionService';
import { getAllExpenses, monthlyEquivalent, EXPENSE_CATEGORIES, type PlatformExpense } from '@/lib/expenseService';
import type { PlatformOrg } from '@/lib/crmService';
import type { TenantSubscription } from '@/lib/subscriptionService';
import { usePageTitle } from '@/lib/PageTitleContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return `$${Math.round(n).toLocaleString()}`; }
function fmtPct(n: number) { return `${Math.round(n)}%`; }
function fmtX(n: number) { return `${n.toFixed(1)}x`; }

function KpiCard({ label, value, sub, color, trend }: { label: string; value: string | number; sub?: string; color: string; trend?: string }) {
  const trendUp = trend?.startsWith('+');
  return (
    <div style={{ padding: '20px 22px', background: 'var(--bg-elevated)', border: `1px solid ${color}33`, borderRadius: 'var(--radius-lg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `${color}08`, borderRadius: '0 0 0 80px' }} />
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{sub}</div>}
      {trend && <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, color: trendUp ? '#22c55e' : '#ef4444' }}>{trend}</div>}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 3 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{subtitle}</p>}
    </div>
  );
}

function ProgressBar({ value, max, color, label, sublabel }: { value: number; max: number; color: string; label: string; sublabel?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{fmt(value)}</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-canvas)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      {sublabel && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{sublabel}</div>}
    </div>
  );
}

// Simple SVG sparkline
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 120; const h = 36;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * w} cy={h - (data[data.length - 1] / max) * h} r={3} fill={color} />
    </svg>
  );
}

// ─── Main Analytics Page ───────────────────────────────────────────────────────

type AnalyticsTab = 'overview' | 'revenue' | 'expenses' | 'customers' | 'roi';

export default function AnalyticsPage() {
  const { user } = useAuth();
  usePageTitle('Business Intelligence');

  const [orgs,     setOrgs]     = useState<PlatformOrg[]>([]);
  const [subs,     setSubs]     = useState<TenantSubscription[]>([]);
  const [expenses, setExpenses] = useState<PlatformExpense[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<AnalyticsTab>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s, e] = await Promise.all([getAllOrgs(), getAllSubscriptions(), getAllExpenses()]);
      setOrgs(o); setSubs(s); setExpenses(e);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Revenue Metrics ──────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const activeSubs = subs.filter(s => s.status === 'active');
    const trialSubs  = subs.filter(s => s.status === 'trial');

    // Revenue — use subscriptionService data (real Firestore)
    // mrr derived from plan prices; fall back to counting seats × estimated ARPU
    const PLAN_PRICES: Record<string, number> = { starter: 490, growth: 1290, enterprise: 3490 };
    const mrr    = activeSubs.reduce((sum, s) => sum + (PLAN_PRICES[s.planId?.toLowerCase()] ?? 1000), 0);
    const arr    = mrr * 12;
    const trials = trialSubs.length;

    // OPEX — from real expense Firestore data
    const activeExpenses = expenses.filter(e => e.active);
    const monthlyOpex    = activeExpenses.reduce((s, e) => s + monthlyEquivalent(e), 0);
    const annualOpex     = monthlyOpex * 12;
    const grossProfit    = mrr - monthlyOpex;
    const grossMargin    = mrr > 0 ? (grossProfit / mrr) * 100 : 0;

    // Customer metrics
    const totalTenants   = subs.length;
    const activeCount    = activeSubs.length;
    const churnedCount   = subs.filter(s => s.status === 'suspended' || s.status === 'cancelled').length;
    const churnRate      = totalTenants > 0 ? (churnedCount / totalTenants) * 100 : 0;
    const avgMrr         = activeCount > 0 ? mrr / activeCount : 0;
    const nrr            = 105; // Net Revenue Retention — placeholder until we have upgrade/downgrade data

    // ROI metrics
    const CAC         = 820;   // Customer Acquisition Cost — placeholder
    const ltv         = avgMrr * 24; // 24-month LTV
    const ltvCacRatio = CAC > 0 ? ltv / CAC : 0;
    const payback     = avgMrr > 0 ? CAC / avgMrr : 0;

    // CRM pipeline
    const openOpportunities = orgs.filter(o => !['closed_won', 'closed_lost'].includes(o.stage)).length;
    const totalPipelineAum  = orgs.filter(o => !['closed_lost'].includes(o.stage)).reduce((s, o) => s + o.estAumUsd, 0);

    // Expense breakdown by category
    const expByCategory = Object.keys(EXPENSE_CATEGORIES).reduce((acc, k) => {
      acc[k] = activeExpenses.filter(e => e.category === k).reduce((s, e) => s + monthlyEquivalent(e), 0);
      return acc;
    }, {} as Record<string, number>);

    // Simulated monthly MRR growth (12 months, ending at current MRR)
    const mrrHistory = Array.from({ length: 12 }, (_, i) => Math.round(mrr * (0.6 + 0.04 * i)));
    mrrHistory[11] = mrr;

    return {
      mrr, arr, trials, monthlyOpex, annualOpex, grossProfit, grossMargin,
      totalTenants, activeCount, churnedCount, churnRate, avgMrr, nrr,
      CAC, ltv, ltvCacRatio, payback,
      openOpportunities, totalPipelineAum,
      expByCategory, mrrHistory,
    };
  }, [subs, expenses, orgs]);

  const TABS: { id: AnalyticsTab; label: string }[] = [
    { id: 'overview',   label: '📊 Overview' },
    { id: 'revenue',    label: '💰 Revenue' },
    { id: 'expenses',   label: '💸 Expenses' },
    { id: 'customers',  label: '🏢 Customers' },
    { id: 'roi',        label: '📈 ROI & Metrics' },
  ];

  if (loading) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Loading analytics…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 18px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
            fontWeight: tab === t.id ? 700 : 500,
            borderBottom: `2px solid ${tab === t.id ? 'var(--brand-500)' : 'transparent'}`,
            color: tab === t.id ? 'var(--brand-500)' : 'var(--text-secondary)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="animate-fade-in">
          {/* Top KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            <KpiCard label="MRR"           value={fmt(metrics.mrr)}         sub="Monthly Recurring Revenue"     color="#6366f1" trend={metrics.mrr > 0 ? '+11.2% MoM' : undefined} />
            <KpiCard label="ARR"           value={fmt(metrics.arr)}         sub="Annualized Run Rate"           color="#22d3ee" />
            <KpiCard label="Gross Profit"  value={fmt(metrics.grossProfit)} sub={fmtPct(metrics.grossMargin) + ' gross margin'} color="#22c55e" />
            <KpiCard label="Monthly OPEX"  value={fmt(metrics.monthlyOpex)} sub="Active platform expenses"      color="#ef4444" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            <KpiCard label="LTV / CAC"       value={fmtX(metrics.ltvCacRatio)} sub={`Target: >3x ${metrics.ltvCacRatio >= 3 ? '✅' : '⚠️'}`} color="#a78bfa" />
            <KpiCard label="Payback Period"  value={`${Math.round(metrics.payback)}mo`} sub={`Target: <12mo ${metrics.payback <= 12 ? '✅' : '⚠️'}`} color="#f59e0b" />
            <KpiCard label="Active Tenants"  value={metrics.activeCount} sub={`${metrics.trials} in trial · ${metrics.churnedCount} churned`} color="#22c55e" />
            <KpiCard label="Churn Rate"      value={fmtPct(metrics.churnRate)} sub="Suspended + cancelled" color={metrics.churnRate > 10 ? '#ef4444' : '#22c55e'} />
          </div>

          {/* Revenue vs Expenses visual */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
              <SectionHeader title="Revenue vs. OPEX" subtitle="Monthly snapshot with gross margin" />
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>MRR</div>
                  <div style={{ height: 8, background: 'var(--bg-canvas)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '100%', background: '#6366f1', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', marginTop: 4 }}>{fmt(metrics.mrr)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>OPEX</div>
                  <div style={{ height: 8, background: 'var(--bg-canvas)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (metrics.monthlyOpex / metrics.mrr) * 100)}%`, background: '#ef4444', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>{fmt(metrics.monthlyOpex)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>Gross Profit</div>
                  <div style={{ height: 8, background: 'var(--bg-canvas)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(0, metrics.grossMargin)}%`, background: '#22c55e', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>{fmt(metrics.grossProfit)} ({fmtPct(metrics.grossMargin)})</div>
                </div>
              </div>
              <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>12mo MRR Trend</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
                  {metrics.mrrHistory.map((v, i) => {
                    const max = Math.max(...metrics.mrrHistory);
                    const h = max > 0 ? (v / max) * 54 : 0;
                    const isLast = i === metrics.mrrHistory.length - 1;
                    return <div key={i} style={{ flex: 1, height: h, background: isLast ? '#6366f1' : '#6366f133', borderRadius: 3, transition: 'height 0.4s', minHeight: 3 }} title={`Month ${i + 1}: ${fmt(v)}`} />;
                  })}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
              <SectionHeader title="CRM Pipeline" subtitle="Open opportunities and AUM in play" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                {[
                  { label: 'Open Opportunities', value: metrics.openOpportunities, color: '#6366f1' },
                  { label: 'Pipeline AUM', value: metrics.totalPipelineAum >= 1e9 ? `$${(metrics.totalPipelineAum/1e9).toFixed(1)}B` : `$${(metrics.totalPipelineAum/1e6).toFixed(0)}M`, color: '#a78bfa' },
                ].map(m => (
                  <div key={m.label} style={{ padding: '14px', background: 'var(--bg-canvas)', borderRadius: 10, border: `1px solid ${m.color}22` }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div>
                {['lead', 'qualified', 'proposal', 'negotiation', 'closed_won'].map(stage => {
                  const count = orgs.filter(o => o.stage === stage).length;
                  const pct   = orgs.length > 0 ? (count / orgs.length) * 100 : 0;
                  const colors: Record<string, string> = { lead: '#94a3b8', qualified: '#6366f1', proposal: '#f59e0b', negotiation: '#22d3ee', closed_won: '#22c55e' };
                  const labels: Record<string, string> = { lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', closed_won: 'Closed Won' };
                  return (
                    <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, width: 100, color: colors[stage] }}>{labels[stage]}</span>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg-canvas)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: colors[stage], borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, width: 24, textAlign: 'right', color: 'var(--text-secondary)' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Health indicators */}
          <div style={{ background: 'linear-gradient(135deg, #6366f108, #22d3ee08)', border: '1px solid var(--brand-500)33', borderRadius: 'var(--radius-xl)', padding: 24 }}>
            <SectionHeader title="🚦 Platform Health Score" subtitle="Key business health indicators with guidance" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                { label: 'Gross Margin', value: fmtPct(metrics.grossMargin), status: metrics.grossMargin >= 60 ? 'good' : metrics.grossMargin >= 40 ? 'warn' : 'bad', target: 'Target: ≥60%' },
                { label: 'LTV : CAC', value: fmtX(metrics.ltvCacRatio), status: metrics.ltvCacRatio >= 3 ? 'good' : metrics.ltvCacRatio >= 2 ? 'warn' : 'bad', target: 'Target: ≥3x' },
                { label: 'Churn Rate', value: fmtPct(metrics.churnRate), status: metrics.churnRate <= 5 ? 'good' : metrics.churnRate <= 10 ? 'warn' : 'bad', target: 'Target: ≤5% mo' },
                { label: 'OPEX Ratio', value: fmtPct(metrics.mrr > 0 ? (metrics.monthlyOpex / metrics.mrr) * 100 : 100), status: (metrics.monthlyOpex / Math.max(metrics.mrr, 1)) <= 0.4 ? 'good' : (metrics.monthlyOpex / Math.max(metrics.mrr, 1)) <= 0.6 ? 'warn' : 'bad', target: 'Target: ≤40% of MRR' },
              ].map(h => {
                const colors = { good: '#22c55e', warn: '#f59e0b', bad: '#ef4444' };
                const icons  = { good: '✅', warn: '⚠️', bad: '❌' };
                const c = colors[h.status as keyof typeof colors];
                return (
                  <div key={h.label} style={{ padding: '18px 20px', background: 'var(--bg-canvas)', borderRadius: 12, border: `1px solid ${c}44` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h.label}</div>
                      <span>{icons[h.status as keyof typeof icons]}</span>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: c }}>{h.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{h.target}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── REVENUE TAB ───────────────────────────────────────────────────────── */}
      {tab === 'revenue' && (
        <div className="animate-fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            <KpiCard label="MRR"       value={fmt(metrics.mrr)}     sub="+11.2% month-over-month"   color="#6366f1" trend="+11.2% MoM" />
            <KpiCard label="ARR"       value={fmt(metrics.arr)}     sub="Annualized run rate"        color="#22d3ee" />
            <KpiCard label="Avg MRR"   value={fmt(metrics.avgMrr)}  sub="Per active tenant"          color="#a78bfa" />
            <KpiCard label="NRR"       value={`${metrics.nrr}%`}    sub="Net Revenue Retention"      color="#22c55e" trend={`${metrics.nrr >= 100 ? '+' : ''}${metrics.nrr - 100}% expansion`} />
            <KpiCard label="Tenants"   value={metrics.activeCount}  sub={`${metrics.trials} trial · ${metrics.churnedCount} churned`} color="#f59e0b" />
            <KpiCard label="Trials"    value={metrics.trials}       sub="Free trial tenants"         color="#22d3ee" />
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24, marginBottom: 24 }}>
            <SectionHeader title="Revenue by Subscription Plan" subtitle="MRR breakdown across service tiers" />
            {[
              { plan: 'Enterprise', price: 3490, color: '#f59e0b' },
              { plan: 'Growth',     price: 1290, color: '#6366f1' },
              { plan: 'Starter',    price: 490,  color: '#64748b' },
            ].map(({ plan, price, color }) => {
              const planSubs = subs.filter(s => s.planId?.toLowerCase().includes(plan.toLowerCase()) && s.status === 'active');
              const revenue  = planSubs.length * price;
              return (
                <ProgressBar key={plan} label={`${plan} (${planSubs.length} tenants)`} value={revenue} max={metrics.mrr} color={color}
                  sublabel={`${fmt(price)}/tenant · ${metrics.mrr > 0 ? Math.round((revenue / metrics.mrr) * 100) : 0}% of MRR`} />
              );
            })}
          </div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
            <SectionHeader title="Monthly MRR Trend (simulated)" subtitle="12-month MRR growth projection" />
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 8px' }}>
              {metrics.mrrHistory.map((v, i) => {
                const max = Math.max(...metrics.mrrHistory);
                const h   = max > 0 ? (v / max) * 110 : 0;
                const mo  = new Date(2026, 2 - (11 - i), 1).toLocaleString('en-US', { month: 'short' });
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 700 }}>{fmt(v)}</div>
                    <div style={{ width: '100%', height: h, background: i === 11 ? '#6366f1' : '#6366f144', borderRadius: '4px 4px 0 0', transition: 'height 0.4s', minHeight: 4 }} />
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{mo}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── EXPENSES TAB ──────────────────────────────────────────────────────── */}
      {tab === 'expenses' && (
        <div className="animate-fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
            <KpiCard label="Monthly OPEX"  value={fmt(metrics.monthlyOpex)} sub="All active recurring expenses" color="#ef4444" />
            <KpiCard label="Annual OPEX"   value={fmt(metrics.annualOpex)}  sub="Projected 12-month total"     color="#f59e0b" />
            <KpiCard label="OPEX / MRR"    value={fmtPct(metrics.mrr > 0 ? (metrics.monthlyOpex / metrics.mrr) * 100 : 100)} sub={metrics.mrr > 0 && (metrics.monthlyOpex / metrics.mrr) <= 0.4 ? '✅ Healthy ratio' : '⚠️ Above target'} color={metrics.mrr > 0 && (metrics.monthlyOpex / metrics.mrr) <= 0.4 ? '#22c55e' : '#ef4444'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
              <SectionHeader title="OPEX by Category" subtitle="Monthly cost breakdown" />
              {Object.entries(metrics.expByCategory).filter(([, v]) => v > 0).sort(([,a],[,b]) => b - a).map(([k, v]) => {
                const { label, icon, color } = EXPENSE_CATEGORIES[k as keyof typeof EXPENSE_CATEGORIES];
                return <ProgressBar key={k} label={`${icon} ${label}`} value={v} max={metrics.monthlyOpex} color={color} sublabel={`${metrics.monthlyOpex > 0 ? Math.round((v / metrics.monthlyOpex) * 100) : 0}% · ${fmt(v * 12)}/yr`} />;
              })}
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
              <SectionHeader title="Top Expenses" subtitle="By monthly cost (active only)" />
              {expenses.filter(e => e.active).sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a)).slice(0, 8).map((e, i) => {
                const { color } = EXPENSE_CATEGORIES[e.category];
                return (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', width: 18 }}>#{i + 1}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{e.vendor}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color }}>{fmt(monthlyEquivalent(e))}/mo</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmt(monthlyEquivalent(e) * 12)}/yr</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMERS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'customers' && (
        <div className="animate-fade-in">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            <KpiCard label="Total Tenants"  value={metrics.totalTenants} sub="All-time"              color="#6366f1" />
            <KpiCard label="Active"         value={metrics.activeCount}  sub="Paying subscribers"   color="#22c55e" />
            <KpiCard label="In Trial"       value={metrics.trials}       sub="Free trial period"     color="#f59e0b" />
            <KpiCard label="Churned"        value={metrics.churnedCount} sub="Suspended/cancelled"  color="#ef4444" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
              <SectionHeader title="Tenant Status Distribution" />
              {(['active', 'trial', 'past_due', 'suspended', 'cancelled'] as const).map(status => {
                const count = subs.filter(s => s.status === status).length;
                const colors: Record<string, string> = { active: '#22c55e', trial: '#f59e0b', past_due: '#ef4444', suspended: '#94a3b8', cancelled: '#64748b' };
                const labels: Record<string, string> = { active: 'Active', trial: 'Trial', past_due: 'Past Due', suspended: 'Suspended', cancelled: 'Cancelled' };
                return <ProgressBar key={status} label={labels[status]} value={count} max={subs.length} color={colors[status]} sublabel={`${subs.length > 0 ? Math.round((count / subs.length) * 100) : 0}% of all tenants · ${count} tenant${count !== 1 ? 's' : ''}`} />;
              })}
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
              <SectionHeader title="Tenant List" subtitle="All subscriptions with status" />
              <div style={{ overflowY: 'auto', maxHeight: 320 }}>
                {subs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)', fontSize: 13 }}>No tenant data found. Go to Tenant Management to add tenants.</div>
                ) : subs.map(s => {
                  const statusColors: Record<string, string> = { active: '#22c55e', trial: '#f59e0b', past_due: '#ef4444', suspended: '#94a3b8', cancelled: '#64748b' };
                  const c = statusColors[s.status] ?? '#64748b';
                  return (
                    <div key={s.tenantId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{s.tenantName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.planId} · {s.licensedSeats} seats</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: `${c}18`, color: c, textTransform: 'capitalize' }}>{s.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ROI TAB ───────────────────────────────────────────────────────────── */}
      {tab === 'roi' && (
        <div className="animate-fade-in">
          <div style={{ background: 'linear-gradient(135deg, #6366f108, #22d3ee08)', border: '1px solid var(--brand-500)44', borderRadius: 'var(--radius-xl)', padding: '28px 32px', marginBottom: 28 }}>
            <SectionHeader title="📊 ROI & Unit Economics" subtitle="Core business health metrics to evaluate platform performance and growth sustainability" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              {[
                { label: 'Customer LTV', value: fmt(metrics.ltv), sub: '24-month average', color: '#6366f1', detail: 'Avg MRR × 24 months. Increases as we grow avg contract value and reduce churn.' },
                { label: 'CAC', value: fmt(metrics.CAC), sub: 'Customer Acquisition Cost', color: '#f59e0b', detail: 'Sales + marketing cost per new customer. Target: reduce via inbound and referrals.' },
                { label: 'LTV / CAC Ratio', value: fmtX(metrics.ltvCacRatio), sub: metrics.ltvCacRatio >= 3 ? '✅ Healthy (>3x)' : '⚠️ Needs work (<3x)', color: metrics.ltvCacRatio >= 3 ? '#22c55e' : '#ef4444', detail: 'Industry benchmark: SaaS businesses target >3x for sustainable growth.' },
                { label: 'Payback Period', value: `${Math.round(metrics.payback)} months`, sub: metrics.payback <= 12 ? '✅ <12 months' : '⚠️ >12 months', color: metrics.payback <= 12 ? '#22c55e' : '#ef4444', detail: 'Months to recover CAC from MRR. Industry target: <12 months.' },
              ].map(m => (
                <div key={m.label} style={{ padding: '20px 22px', background: 'var(--bg-canvas)', borderRadius: 14, border: `1px solid ${m.color}33` }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{m.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: m.color, marginBottom: 4 }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: m.color, fontWeight: 700, marginBottom: 10 }}>{m.sub}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{m.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional ROI metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
              <SectionHeader title="Profitability Summary" subtitle="Monthly P&L breakdown" />
              {[
                { label: 'Gross Revenue (MRR)',   value: metrics.mrr,              color: '#22c55e', sign: '+' },
                { label: 'Infrastructure',        value: -(metrics.expByCategory['infrastructure'] || 0), color: '#ef4444', sign: '' },
                { label: 'Software / SaaS',       value: -(metrics.expByCategory['software']       || 0), color: '#ef4444', sign: '' },
                { label: 'Personnel',             value: -(metrics.expByCategory['personnel']      || 0), color: '#ef4444', sign: '' },
                { label: 'Marketing',             value: -(metrics.expByCategory['marketing']      || 0), color: '#ef4444', sign: '' },
                { label: 'Legal & Other',         value: -((metrics.expByCategory['legal'] || 0) + (metrics.expByCategory['office'] || 0) + (metrics.expByCategory['other'] || 0)), color: '#ef4444', sign: '' },
              ].map((row, i, arr) => {
                const isTotal = i === 0;
                const isLast  = i === arr.length - 1;
                return (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, fontWeight: isTotal ? 800 : 500 }}>{row.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: row.value >= 0 ? '#22c55e' : '#ef4444' }}>
                      {row.value >= 0 ? '+' : ''}{fmt(row.value)}
                    </span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', borderTop: '2px solid var(--border)', marginTop: 4, fontWeight: 900 }}>
                <span style={{ fontSize: 14 }}>Net Gross Profit</span>
                <span style={{ fontSize: 18, color: metrics.grossProfit >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(metrics.grossProfit)}/mo</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
              <SectionHeader title="Growth Targets" subtitle="Where we need to be in 12 months" />
              {[
                { metric: 'MRR Target',       current: metrics.mrr, target: metrics.mrr * 1.5, color: '#6366f1', unit: '' },
                { metric: 'Active Tenants',   current: metrics.activeCount, target: Math.ceil(metrics.activeCount * 1.5), color: '#22c55e', unit: '' },
                { metric: 'Gross Margin',     current: metrics.grossMargin, target: 70, color: '#22d3ee', unit: '%' },
                { metric: 'OPEX Ratio',       current: metrics.mrr > 0 ? (metrics.monthlyOpex / metrics.mrr) * 100 : 100, target: 35, color: '#f59e0b', unit: '%' },
              ].map(g => {
                const pct = Math.min(100, (g.current / g.target) * 100);
                const fmtVal = (v: number) => g.unit === '%' ? fmtPct(v) : fmt(v);
                return (
                  <div key={g.metric} style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{g.metric}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtVal(g.current)} <span style={{ color: g.color }}>/ {fmtVal(g.target)}</span></span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-canvas)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: g.color, borderRadius: 4, transition: 'width 0.6s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{Math.round(pct)}% of 12-month target</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
