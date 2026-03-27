'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { useLiveMode } from '@/lib/useLiveMode';
import { usePageTitle } from '@/lib/PageTitleContext';
import { getPlatformConfig, getAllTenants, getAllUsers } from '@/lib/platformService';
import type { PlatformConfig, TenantRecord, UserProfile } from '@/lib/platformService';
import { getAllOpportunities, getAllActivities, getSalesTeams } from '@/lib/crmService';
import type { Opportunity, CrmActivity, SalesTeam } from '@/lib/crmService';

// ─── Utility ──────────────────────────────────────────────────────────────────

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// ─── UI Components ────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color = 'var(--brand-500)', icon }: {
  label: string; value: string; sub?: string; color?: string; icon?: string;
}) {
  return (
    <div style={{
      padding: '20px 24px', background: 'var(--bg-elevated)',
      borderRadius: 14, border: '1px solid var(--border)',
    }}>
      {icon && <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, link, children }: { title: string; link?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginTop: 20 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
        {link && <Link href={link.href} style={{ fontSize: 12, color: 'var(--brand-500)', fontWeight: 600 }}>{link.label} →</Link>}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function GreetingBar({ name, role, action }: { name: string; role: string; action?: { href: string; label: string } }) {
  return (
    <div style={{
      marginBottom: 24, padding: '18px 24px',
      background: 'linear-gradient(135deg, var(--brand-500) 0%, #a78bfa 100%)',
      borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'white' }}>{getGreeting()}, {name} 👋</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{role}</div>
      </div>
      {action && (
        <Link href={action.href} style={{
          padding: '10px 20px', background: 'rgba(255,255,255,0.2)',
          color: 'white', borderRadius: 10, fontWeight: 700, fontSize: 13,
          textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)',
        }}>{action.label}</Link>
      )}
    </div>
  );
}

// ─── Role Dashboards ──────────────────────────────────────────────────────────

function PlatformAdminDashboard({ user, platformCfg, tenants, users }: {
  user: ReturnType<typeof useAuth>['user'];
  platformCfg: PlatformConfig | null;
  tenants: TenantRecord[];
  users: UserProfile[];
}) {
  usePageTitle('Platform Dashboard');
  const active    = tenants.filter(t => t.status === 'active').length;
  const trials    = tenants.filter(t => t.status === 'trial').length;
  const suspended = tenants.filter(t => t.status === 'suspended').length;

  return (
    <div className="page animate-fade-in">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'Admin'}
        role="Platform Administration"
        action={{ href: '/platform/tenants', label: '+ New Tenant' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KPI label="Active Tenants"  value={active.toString()}        sub="Platform clients"         icon="🏢" />
        <KPI label="Trial Tenants"   value={trials.toString()}        sub="Evaluating"               icon="⏳" color="#f59e0b" />
        <KPI label="Total Users"     value={users.length.toString()}  sub="Across all tenants"       icon="👥" />
        <KPI label="Platform Status" value="Healthy"                   sub="All systems operational"  icon="💚" color="#22c55e" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Section title="Tenant Breakdown" link={{ href: '/platform/tenants', label: 'Manage' }}>
          {[
            { label: 'Active',    count: active,    color: '#22c55e' },
            { label: 'Trial',     count: trials,    color: '#f59e0b' },
            { label: 'Suspended', count: suspended, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span>{s.label}</span>
              <span style={{ fontWeight: 700, color: s.color }}>{s.count}</span>
            </div>
          ))}
        </Section>

        <Section title="Recent Tenants" link={{ href: '/platform/tenants', label: 'View All' }}>
          {tenants.slice(-5).reverse().map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{t.name}</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                background: t.status === 'active' ? '#22c55e15' : '#f59e0b15',
                color: t.status === 'active' ? '#22c55e' : '#f59e0b',
              }}>{t.status}</span>
            </div>
          ))}
        </Section>
      </div>

      <Section title="Quick Links">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { href: '/platform/crm',       label: '📊 CRM Suite' },
            { href: '/platform/users',     label: '👤 Users' },
            { href: '/platform/roles',     label: '🔐 Roles' },
            { href: '/platform/analytics', label: '📈 Analytics' },
            { href: '/platform/support',   label: '🎧 Support' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{
              padding: '8px 16px', background: 'var(--bg-canvas)',
              border: '1px solid var(--border)', borderRadius: 10,
              fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none',
            }}>{l.label}</Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

function SalesLeaderDashboard({ user, opps, activities, teams }: {
  user: ReturnType<typeof useAuth>['user'];
  opps: Opportunity[];
  activities: CrmActivity[];
  teams: SalesTeam[];
}) {
  usePageTitle('Sales Dashboard');
  const openOpps = opps.filter(o => !['closed_won','closed_lost'].includes(o.stage));
  const wonOpps  = opps.filter(o => o.stage === 'closed_won');
  const pipeline = openOpps.reduce((s, o) => s + (o.valueUsd ?? 0), 0);
  const won      = wonOpps.reduce((s, o) => s + (o.valueUsd ?? 0), 0);

  const closingSoon = openOpps.filter(o => {
    if (!o.closeDate) return false;
    const days = (new Date(o.closeDate).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 30;
  });

  const closedTotal = opps.filter(o => ['closed_won','closed_lost'].includes(o.stage)).length;
  const winRate = closedTotal > 0 ? Math.round((wonOpps.length / closedTotal) * 100) : 0;

  return (
    <div className="page animate-fade-in">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'Manager'}
        role="Sales Leadership"
        action={{ href: '/platform/crm', label: '→ Open CRM' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KPI label="Pipeline Value" value={fmtUsd(pipeline)} sub={`${openOpps.length} active deals`}      icon="🎯" />
        <KPI label="Won Revenue"    value={fmtUsd(won)}      sub="Closed won"                               icon="🏆" color="#22c55e" />
        <KPI label="Win Rate"       value={`${winRate}%`}    sub="Of closed deals"                          icon="📊" color={winRate >= 30 ? '#22c55e' : '#f59e0b'} />
        <KPI label="Closing ≤30d"  value={closingSoon.length.toString()} sub="Deals at risk if missed"    icon="⏰" color={closingSoon.length > 3 ? '#ef4444' : '#f59e0b'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Section title="Closing Soon" link={{ href: '/platform/crm', label: 'View Pipeline' }}>
          {closingSoon.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No deals closing in the next 30 days.</div>
          ) : closingSoon.slice(0, 6).map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{o.orgName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{o.ownerName} · {o.stage}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{fmtUsd(o.valueUsd ?? 0)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{o.closeDate?.slice(0,10)}</div>
              </div>
            </div>
          ))}
        </Section>

        <Section title="Sales Teams" link={{ href: '/platform/crm', label: 'View Teams' }}>
          {teams.slice(0, 6).map(t => {
            const won = opps.filter(o => o.stage === 'closed_won' && t.memberIds.includes(o.assignedToUid ?? o.ownerId ?? '')).reduce((s, o) => s + (o.valueUsd ?? 0), 0);
            const pct = t.quota > 0 ? Math.min(100, Math.round((won / t.quota) * 100)) : 0;
            return (
              <div key={t.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{t.name}</span>
                  <span style={{ fontWeight: 700, color: pct >= 80 ? '#22c55e' : '#f59e0b' }}>{pct}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-canvas)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#22c55e' : '#f59e0b', borderRadius: 3, transition: 'width 0.6s' }} />
                </div>
              </div>
            );
          })}
        </Section>
      </div>

      <Section title="Recent Activities" link={{ href: '/platform/crm', label: 'Activity Log' }}>
        {activities.slice(0, 5).map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
              {a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : a.type === 'meeting' ? '🤝' : '📝'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{a.subject}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.performedByName} · {new Date(a.scheduledAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function SalesRepDashboard({ user, opps, activities }: {
  user: ReturnType<typeof useAuth>['user'];
  opps: Opportunity[];
  activities: CrmActivity[];
}) {
  usePageTitle('My Pipeline');
  const uid   = user?.uid;
  const name  = user?.name;
  const myOpps = opps.filter(o => o.ownerId === uid || o.ownerName === name);
  const openOpps = myOpps.filter(o => !['closed_won','closed_lost'].includes(o.stage));
  const pipeline = openOpps.reduce((s, o) => s + (o.valueUsd ?? 0), 0);
  const won = myOpps.filter(o => o.stage === 'closed_won').reduce((s, o) => s + (o.valueUsd ?? 0), 0);

  const stageOrder = ['lead', 'qualification', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  const byStage = stageOrder.map(s => ({
    stage: s,
    count: myOpps.filter(o => o.stage === s).length,
    value: myOpps.filter(o => o.stage === s).reduce((sum, o) => sum + (o.valueUsd ?? 0), 0),
  })).filter(s => s.count > 0);

  const myActivities = activities.filter(a => a.performedByUid === uid || a.performedByName === name);

  return (
    <div className="page animate-fade-in">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'Rep'}
        role="Account Executive"
        action={{ href: '/platform/crm', label: '+ New Opportunity' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KPI label="My Pipeline"    value={fmtUsd(pipeline)}                  sub={`${openOpps.length} open deals`} icon="🎯" />
        <KPI label="Won This Cycle" value={fmtUsd(won)}                        sub="Closed won"                     icon="🏆" color="#22c55e" />
        <KPI label="Activities"     value={myActivities.length.toString()}     sub="Logged by me"                   icon="📅" />
        <KPI label="Open Deals"     value={openOpps.length.toString()}          sub="In progress"                    icon="🔄" color="#6366f1" />
      </div>

      <Section title="My Deals by Stage" link={{ href: '/platform/crm', label: 'Open Pipeline' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          {byStage.map(s => (
            <div key={s.stage} style={{ padding: '14px 16px', background: 'var(--bg-canvas)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{s.stage.replace('_',' ')}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--brand-500)' }}>{s.count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{fmtUsd(s.value)}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="My Recent Activities" link={{ href: '/platform/crm', label: 'Log Activity' }}>
        {myActivities.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No activities logged yet. <Link href="/platform/crm" style={{ color: 'var(--brand-500)' }}>Log your first activity →</Link>
          </div>
        ) : myActivities.slice(0, 5).map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>{a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : a.type === 'meeting' ? '🤝' : '📝'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{a.subject}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.orgName} · {new Date(a.scheduledAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function CustomerSuccessDashboard({ user, opps, activities }: {
  user: ReturnType<typeof useAuth>['user'];
  opps: Opportunity[];
  activities: CrmActivity[];
}) {
  usePageTitle('Customer Success');
  const renewals = opps.filter(o =>
    o.orgName?.toLowerCase().includes('renew') ||
    o.stage === 'negotiation' ||
    (o.closeDate && (new Date(o.closeDate).getTime() - Date.now()) / 86_400_000 < 90)
  );
  const atRisk = renewals.filter(o => {
    if (!o.closeDate) return false;
    const days = (new Date(o.closeDate).getTime() - Date.now()) / 86_400_000;
    return days < 30 && days >= 0;
  });

  return (
    <div className="page animate-fade-in">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'CSM'}
        role="Customer Success"
        action={{ href: '/platform/crm', label: '→ Activity Log' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KPI label="Renewals Tracked" value={renewals.length.toString()}  sub="Active accounts"       icon="🔁" />
        <KPI label="At Risk ≤30d"     value={atRisk.length.toString()}      sub="Need attention"        icon="⚠️" color={atRisk.length > 0 ? '#ef4444' : '#22c55e'} />
        <KPI label="Total Activities" value={activities.length.toString()} sub="All interactions"      icon="📅" />
        <KPI label="Accounts"         value={opps.length.toString()}        sub="In CRM"                icon="🏢" color="#6366f1" />
      </div>

      <Section title="Renewals at Risk" link={{ href: '/platform/crm', label: 'View All' }}>
        {atRisk.length === 0 ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No renewals at risk in the next 30 days. 🎉</div>
        ) : atRisk.map(o => (
          <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{o.orgName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Closes {o.closeDate?.slice(0,10)}</div>
            </div>
            <div style={{ fontWeight: 700, color: '#ef4444' }}>{fmtUsd(o.valueUsd ?? 0)}</div>
          </div>
        ))}
      </Section>

      <Section title="Recent Client Interactions" link={{ href: '/platform/crm', label: 'Log Activity' }}>
        {activities.slice(0, 6).map(a => (
          <div key={a.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>{a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : '🤝'}</span>
            <div>
              <div style={{ fontWeight: 600 }}>{a.subject}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.performedByName} · {new Date(a.scheduledAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function TenantUserDashboard({ user, roleLabel }: {
  user: ReturnType<typeof useAuth>['user'];
  roleLabel: string;
}) {
  usePageTitle('Dashboard');
  return (
    <div className="page animate-fade-in">
      <GreetingBar name={user?.name?.split(' ')[0] ?? 'there'} role={roleLabel} action={{ href: '/families', label: '→ Client Families' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <KPI label="Client Families"  value="—" sub="Navigate to Families" icon="👨‍👩‍👧‍👦" />
        <KPI label="Active Tasks"     value="—" sub="Navigate to Tasks"    icon="✅" />
        <KPI label="Upcoming Events"  value="—" sub="Navigate to Calendar" icon="📅" />
      </div>
      <Section title="Quick Actions">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { href: '/families',   label: '👨‍👩‍👧‍👦 Families' },
            { href: '/tasks',      label: '✅ Tasks' },
            { href: '/activities', label: '📋 Activities' },
            { href: '/calendar',   label: '📅 Calendar' },
            { href: '/documents',  label: '📁 Documents' },
            { href: '/reports',    label: '📊 Reports' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{
              padding: '10px 18px', background: 'var(--bg-canvas)',
              border: '1px solid var(--border)', borderRadius: 10,
              fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none',
            }}>{l.label}</Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Role label map ───────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  saas_master_admin:        'SaaS Master Admin',
  tenant_admin:             'Tenant Administrator',
  relationship_manager:     'Relationship Manager',
  cio:                      'Chief Investment Officer',
  controller:               'Controller',
  compliance_officer:       'Compliance Officer',
  report_viewer:            'Report Viewer',
  external_advisor:         'External Advisor',
  sales_operations:         'Sales Operations',
  business_manager:         'Business Manager',
  sales_manager:            'Sales Manager',
  revenue_manager:          'Revenue Manager',
  account_executive:        'Account Executive',
  sdr:                      'Sales Development Representative',
  customer_success_manager: 'Customer Success Manager',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, userProfile, isSaasMasterAdmin } = useAuth();
  const isLive = useLiveMode();
  const role = userProfile?.role ?? 'report_viewer';

  const [platformCfg,     setPlatformCfg]     = useState<PlatformConfig | null>(null);
  const [tenants,         setTenants]         = useState<TenantRecord[]>([]);
  const [platformUsers,   setPlatformUsers]   = useState<UserProfile[]>([]);
  const [opps,            setOpps]            = useState<Opportunity[]>([]);
  const [activities,      setActivities]      = useState<CrmActivity[]>([]);
  const [teams,           setTeams]           = useState<SalesTeam[]>([]);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    if (!isLive || !user) { setLoading(false); return; }

    const isPlatformAdmin = isSaasMasterAdmin || ['business_manager','sales_operations'].includes(role);
    const isSalesRole     = ['sales_manager','revenue_manager','account_executive','sdr','customer_success_manager','sales_operations','business_manager'].includes(role);

    const fetches: Promise<unknown>[] = [];

    if (isPlatformAdmin) {
      fetches.push(
        getPlatformConfig().catch(() => null).then(d => setPlatformCfg(d)),
        getAllTenants().catch(() => []).then(d => setTenants(d as TenantRecord[])),
        getAllUsers().catch(() => []).then(d => setPlatformUsers(d as UserProfile[])),
      );
    }

    if (isSalesRole || isPlatformAdmin) {
      fetches.push(
        getAllOpportunities().catch(() => []).then(d => setOpps(d as Opportunity[])),
        getAllActivities().catch(() => []).then(d => setActivities(d as CrmActivity[])),
        getSalesTeams().catch(() => []).then(d => setTeams(d as SalesTeam[])),
      );
    }

    Promise.all(fetches).finally(() => setLoading(false));
  }, [isLive, isSaasMasterAdmin, role, user]);

  if (!isLive) {
    return (
      <div className="page animate-fade-in">
        <GreetingBar name="Demo" role="Platform Demo Mode" />
        <div style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: 56 }}>🏛️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '16px 0 8px' }}>MFO Nexus Platform</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Switch to Live Mode to see your real data.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #6366f133', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading your dashboard…</div>
        </div>
      </div>
    );
  }

  // ── Route by role ──────────────────────────────────────────────────────────
  if (['saas_master_admin', 'business_manager', 'sales_operations'].includes(role)) {
    return <PlatformAdminDashboard user={user} platformCfg={platformCfg} tenants={tenants} users={platformUsers} />;
  }
  if (['sales_manager', 'revenue_manager'].includes(role)) {
    return <SalesLeaderDashboard user={user} opps={opps} activities={activities} teams={teams} />;
  }
  if (['account_executive', 'sdr'].includes(role)) {
    return <SalesRepDashboard user={user} opps={opps} activities={activities} />;
  }
  if (role === 'customer_success_manager') {
    return <CustomerSuccessDashboard user={user} opps={opps} activities={activities} />;
  }

  // All tenant/advisor roles
  return <TenantUserDashboard user={user} roleLabel={ROLE_LABELS[role] ?? 'User'} />;
}
