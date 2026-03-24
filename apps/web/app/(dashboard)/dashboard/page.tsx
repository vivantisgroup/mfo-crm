'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/StatCard';
import { AssetAllocationChart } from '@/components/AssetAllocationChart';
import { ActivityItem } from '@/components/ActivityItem';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { DASHBOARD_STATS, BALANCE_SHEETS, TASKS, ACTIVITIES, PLATFORM_USERS } from '@/lib/mockData';
import { useAuth } from '@/lib/AuthContext';
import { useLiveMode } from '@/lib/useLiveMode';
import { getPlatformConfig, getAllTenants, getAllUsers } from '@/lib/platformService';
import type { PlatformConfig, TenantRecord, UserProfile } from '@/lib/platformService';

// ─── Getting-Started steps for fresh SaaS Master Admin ────────────────────────

const SETUP_STEPS = [
  {
    icon: '✅',
    title: 'Platform initialized',
    desc: 'Master tenant created, SaaS Master Admin account active.',
    done: true,
    link: null,
  },
  {
    icon: '🏢',
    title: 'Create your first tenant',
    desc: 'Onboard a family office firm as a new tenant with their own workspace.',
    done: false,
    link: '/admin',
  },
  {
    icon: '👤',
    title: 'Invite team members',
    desc: 'Add users and assign them roles within tenants.',
    done: false,
    link: '/admin',
  },
  {
    icon: '🌱',
    title: 'Seed a demo tenant',
    desc: 'Provision a trial tenant with realistic sample data for demonstrations.',
    done: false,
    link: '/platform/demo',
  },
  {
    icon: '⚙️',
    title: 'Configure task queues & SLAs',
    desc: 'Set up workflow queues, task types, and SLA targets.',
    done: false,
    link: '/admin',
  },
];

// ─── Live platform stats component ────────────────────────────────────────────

function LivePlatformDashboard({ user, platformCfg, tenants, users }: {
  user: ReturnType<typeof useAuth>['user'];
  platformCfg: PlatformConfig | null;
  tenants: TenantRecord[];
  users: UserProfile[];
}) {
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting}, {user?.name?.split(' ')[0] ?? 'Admin'} 👋
          </h1>
          <p className="page-subtitle">
            Platform initialized {platformCfg?.initializedAt
              ? new Date(platformCfg.initializedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
              : ''} · Version {platformCfg?.version ?? '—'}
          </p>
        </div>
        <div className="page-actions">
          <Link href="/platform/audit" className="btn btn-secondary">Audit Log</Link>
          <Link href="/platform/demo" className="btn btn-primary">+ New Demo Tenant</Link>
        </div>
      </div>

      {/* Live stats */}
      <div className="stat-grid">
        <StatCard label="Active Tenants"  value={tenants.filter(t => t.status === 'active').length.toString()} icon="🏢" trendValue="Platform HQ included" />
        <StatCard label="Registered Users" value={users.length.toString()} icon="👥" trendValue="Across all tenants" />
        <StatCard label="Platform Status"  value="Healthy" icon="💚" trendValue="All systems operational" trendDirection="up" />
        <StatCard label="Your Role"        value="SaaS Master Admin" icon="🔑" />
      </div>

      {/* Support Health metrics */}
      <div className="card mt-6">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">🎧 Support Center Health</h2>
          <Link href="/platform/support" className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>Manage Support →</Link>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '16px 20px' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em' }}>Active Backlog</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)' }}>14</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>tickets in queue</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em' }}>Unassigned</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#f59e0b' }}>3</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>need assignment</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em' }}>SLA Breach Rate</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444' }}>7%</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>of active tickets</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em' }}>Avg Resolution</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)' }}>4.2</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>hours (last 7d)</div>
          </div>
        </div>
      </div>

      {/* Getting-started checklist */}
      <div className="card mt-6">
        <div className="card-header">
          <h2 className="card-title">🚀 Platform Setup Checklist</h2>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {SETUP_STEPS.filter(s => s.done).length} / {SETUP_STEPS.length} complete
          </span>
        </div>
        <div className="card-body" style={{ padding: '8px 0' }}>
          {SETUP_STEPS.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
              borderBottom: i < SETUP_STEPS.length - 1 ? '1px solid var(--border)' : 'none',
              opacity: step.done ? 0.6 : 1,
            }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>{step.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {step.title}
                  {step.done && <span style={{ fontSize: 10, background: '#22c55e22', color: '#22c55e', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>DONE</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{step.desc}</div>
              </div>
              {step.link && !step.done && (
                <Link href={step.link} className="btn btn-secondary btn-sm" style={{ flexShrink: 0, fontSize: 12 }}>
                  Go →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick links grid */}
      <div className="grid-2 mt-6">
        <div className="card">
          <div className="card-header"><h2 className="card-title">📋 Quick Actions</h2></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 20px' }}>
            {[
              { label: 'Admin & Configuration', href: '/admin', desc: 'Tenants, users, task queues, SLAs' },
              { label: 'Task Queue Manager', href: '/admin', desc: 'Create and manage work queues' },
              { label: 'Audit Trail', href: '/platform/audit', desc: 'Immutable compliance log' },
              { label: 'Demo Provisioner', href: '/platform/demo', desc: 'Seed trial environments' },
              { label: 'Platform Support', href: '/platform/support', desc: 'Help & documentation' },
            ].map(q => (
              <Link key={q.href + q.label} href={q.href} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', textDecoration: 'none', transition: 'background 0.15s' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{q.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{q.desc}</div>
                </div>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>→</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="card-title">🔐 Platform Config</h2></div>
          <div className="card-body" style={{ padding: '12px 20px' }}>
            {[
              ['Platform Name',    platformCfg?.platformName ?? '—'],
              ['Version',          platformCfg?.version ?? '—'],
              ['Initialized',      platformCfg?.initializedAt ? new Date(platformCfg.initializedAt).toLocaleString() : '—'],
              ['Master Admin UID', platformCfg?.initializedBy ?? '—'],
              ['Tenants',          tenants.length.toString()],
              ['Total Users',      users.length.toString()],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{k}</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: k.includes('UID') ? 'monospace' : 'inherit', fontSize: k.includes('UID') ? 11 : 13 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Demo dashboard component (shown when not authenticated / demo mode) ───────

function DemoDashboard() {
  const { tenant } = useAuth();
  const isInternal = tenant?.isInternal;
  const stats = DASHBOARD_STATS;

  const allAllocs = BALANCE_SHEETS.flatMap(b => b.allocation);
  const aggAllocs = Array.from(
    allAllocs.reduce((acc, curr) => {
      acc.set(curr.assetClass, (acc.get(curr.assetClass) || 0) + curr.value);
      return acc;
    }, new Map<string, number>())
  ).map(([assetClass, value], i) => {
    const colors = ['#6366f1', '#22d3ee', '#34d399', '#f59e0b', '#a78bfa', '#94a3b8'];
    const val = value as number;
    return { assetClass: assetClass as string, value: val, pct: val / stats.totalAum, color: colors[i % colors.length] };
  }).sort((a, b) => b.value - a.value);

  return (
    <div className="page animate-fade-in">
      {/* Demo banner */}
      <div style={{ padding: '10px 16px', background: '#f59e0b11', border: '1px solid #f59e0b44', borderRadius: 10, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
        <span>⚠️</span>
        <span style={{ color: 'var(--text-secondary)' }}>
          <strong style={{ color: '#f59e0b' }}>Demo Mode</strong> — Showing sample data. Sign in with your account to see real data.
        </span>
        <Link href="/login" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>Sign In</Link>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">{isInternal ? 'Firm Management Dashboard' : 'Advisor Dashboard'}</h1>
          <p className="page-subtitle">{isInternal ? 'Aggregate platform analytics' : `Consolidation across ${stats.totalFamilies} families`}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary">{isInternal ? 'Platform Audit' : 'Download Master Report'}</button>
          {!isInternal && <button className="btn btn-primary">New Activity</button>}
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Platform AUM" value={formatCurrency(stats.totalAum, 'USD', true)} trendValue="+8.3% YTD" trendDirection="up" icon="🏛️" />
        <StatCard label="Total Clients" value={stats.totalFamilies.toString()} trendValue="+1 this month" trendDirection="up" icon="👥" />
        {isInternal ? (
          <>
            <StatCard label="Active Users" value={PLATFORM_USERS.length.toString()} icon="👤" />
            <StatCard label="Avg. Fee bps" value="85" icon="🧾" />
          </>
        ) : (
          <>
            <StatCard label="Capital Calls Due" value={stats.capitalCallsDue.toString()} trendValue={formatCurrency(stats.capitalCallsAmount, 'USD', true)} trendDirection="down" icon="💰" />
            <StatCard label="Active Tasks" value={stats.activeTasksCount.toString()} trendValue="2 urgent" trendDirection="down" icon="✓" />
          </>
        )}
      </div>

      <div className={isInternal ? 'grid-1 mt-6' : 'grid-2 mt-6'}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Aggregated Platform Allocation</h2>
          </div>
          <div className="card-body">
            <AssetAllocationChart data={aggAllocs} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
              {aggAllocs.slice(0,8).map(a => (
                <div key={a.assetClass} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: a.color }} />
                  <div style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)' }}>{a.assetClass}</div>
                  <div style={{ fontSize: 11, fontWeight: 500 }}>{formatPercent(a.pct)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {!isInternal && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Priority Tasks</h2>
              <Link href="/tasks" className="text-brand text-xs fw-600">View All →</Link>
            </div>
            <div className="card-body" style={{ padding: 12 }}>
              {TASKS.filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high')).slice(0,5).map(task => (
                <div key={task.id} className="task-card">
                  <div className="task-card-title">{task.title}</div>
                  <div className="task-card-meta">
                    <span className="text-xs text-brand fw-600">{task.familyName}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <StatusBadge status={task.priority} />
                      <span className="text-xs text-secondary">Due {task.dueDate?.slice(5)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isInternal && (
        <div className="card mt-6">
          <div className="card-header">
            <h2 className="card-title">Recent Activities</h2>
            <Link href="/activities" className="btn btn-secondary btn-sm">View Timeline</Link>
          </div>
          <div className="card-body" style={{ padding: '0 20px' }}>
            <div className="activity-list">
              {ACTIVITIES.slice(0, 5).map(act => <ActivityItem key={act.id} activity={act} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page — switches between live and demo ────────────────────────────────

export default function DashboardPage() {
  const { user, userProfile, isSaasMasterAdmin } = useAuth();
  const isLive = useLiveMode();

  const [platformCfg, setPlatformCfg] = useState<PlatformConfig | null>(null);
  const [tenants,     setTenants]     = useState<TenantRecord[]>([]);
  const [users,       setUsers]       = useState<UserProfile[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!isLive || !isSaasMasterAdmin) { setLoading(false); return; }
    Promise.all([
      getPlatformConfig().catch(() => null),
      getAllTenants().catch(() => []),
      getAllUsers().catch(() => []),
    ]).then(([cfg, ts, us]) => {
      setPlatformCfg(cfg);
      setTenants(ts);
      setUsers(us);
    }).finally(() => setLoading(false));
  }, [isLive, isSaasMasterAdmin]);

  // In live mode as SaaS Master Admin → show real platform dashboard
  if (isLive && isSaasMasterAdmin) {
    if (loading) {
      return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #6366f133', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading platform data…</div>
          </div>
        </div>
      );
    }
    return <LivePlatformDashboard user={user} platformCfg={platformCfg} tenants={tenants} users={users} />;
  }

  // In live mode as regular user → show empty tenant dashboard
  if (isLive && !isSaasMasterAdmin) {
    return (
      <div className="page animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Welcome, {user?.name?.split(' ')[0] ?? 'there'} 👋</h1>
            <p className="page-subtitle">Your workspace is ready. Start by adding families, tasks, or activities.</p>
          </div>
          <div className="page-actions">
            <Link href="/activities" className="btn btn-primary">+ New Activity</Link>
          </div>
        </div>
        <div className="card mt-6" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🏛️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Your workspace is empty</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.6 }}>
            No families, tasks, or activities have been added yet. Get started by adding your first client family, or ask your platform administrator to provision data.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/families" className="btn btn-primary">+ Add Family</Link>
            <Link href="/tasks" className="btn btn-secondary">+ Create Task</Link>
            <Link href="/activities" className="btn btn-secondary">+ Log Activity</Link>
          </div>
        </div>
      </div>
    );
  }

  // Demo / unauthenticated mode → show demo dashboard
  return <DemoDashboard />;
}
