'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import DashboardHub from '@/components/dashboards/DashboardHub';
import { useLiveMode } from '@/lib/useLiveMode';
import { usePageTitle } from '@/lib/PageTitleContext';
import { getPlatformConfig, getAllTenants, getAllUsers } from '@/lib/platformService';
import type { PlatformConfig, TenantRecord, UserProfile } from '@/lib/platformService';
import { getAllOpportunities, getAllActivities, getSalesTeams } from '@/lib/crmService';
import type { Opportunity, CrmActivity, SalesTeam } from '@/lib/crmService';
import ReactECharts from 'echarts-for-react';

// ─── Tremor Migration Stubs ───────────────────────────────────────────────────
// These lightweight components replace the uninstalled Tremor library dependencies

export const Grid = ({ numItemsSm, numItemsLg, className, children }: any) => {
  const smCols = numItemsSm === 1 ? 'sm:grid-cols-1' : numItemsSm === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';
  const lgCols = numItemsLg === 2 ? 'lg:grid-cols-2' : numItemsLg === 3 ? 'lg:grid-cols-3' : numItemsLg === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-1';
  return <div className={`grid grid-cols-1 ${smCols} ${lgCols} ${className || ''}`}>{children}</div>;
};

export const Flex = ({ alignItems, className, children, justifyContent }: any) => {
  const align = alignItems === 'start' ? 'items-start' : 'items-center';
  const justify = justifyContent === 'center' ? 'justify-center' : 'justify-between';
  return <div className={`flex ${justify} ${align} w-full ${className || ''}`}>{children}</div>;
};

export const Subtitle = ({ className, children }: any) => (
  <div className={`text-sm text-[var(--text-secondary)] ${className || ''}`}>{children}</div>
);

export const ProgressBar = ({ value, color, className }: any) => {
  let bg = 'bg-primary';
  if (color === 'emerald') bg = 'bg-emerald-500';
  if (color === 'blue') bg = 'bg-blue-500';
  if (color === 'amber') bg = 'bg-amber-500';
  if (color === 'rose') bg = 'bg-rose-500';
  
  return (
    <div className={`w-full bg-secondary/30 rounded-full h-2 ${className || ''}`}>
       <div className={`${bg} h-2 rounded-full transition-all`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }}></div>
    </div>
  );
};

export const DonutChart = (props: any) => <div className="flex h-full w-full items-center justify-center border border-dashed rounded-xl bg-card/50 text-sm text-muted-foreground p-4">Analytic Chart Unavailable</div>;
export const AreaChart = (props: any) => <div className="flex h-full w-full items-center justify-center border border-dashed rounded-xl bg-card/50 text-sm text-muted-foreground p-4">Analytic Chart Unavailable</div>;
export const BarList = (props: any) => <div className="flex h-full w-full items-center justify-center border border-dashed rounded-xl bg-card/50 text-sm text-muted-foreground p-4">Data List Unavailable</div>;

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

function GreetingBar({ name, role, action }: { name: string; role: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center shadow-sm shrink-0">
          <span className="text-2xl font-black text-brand-600">{name.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight mb-2 text-3xl font-black text-primary tracking-tight">{getGreeting()}, {name}</h3>
          <div className="text-sm text-[var(--text-secondary)] text-secondary font-medium">{role}</div>
        </div>
      </div>
      {action && (
        <Link href={action.href}>
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2">
            {action.label}
          </button>
        </Link>
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

  const tenantData = [
    { name: 'Active', value: active },
    { name: 'Trial', value: trials },
    { name: 'Suspended', value: suspended }
  ].filter(d => d.value > 0);

  // Mock area chart data for tenant growth
  const chartData = [
    { date: 'Jan 26', "New Tenants": 2, "Churned": 0 },
    { date: 'Feb 26', "New Tenants": 5, "Churned": 1 },
    { date: 'Mar 26', "New Tenants": active + trials, "Churned": suspended },
  ];

  // User activity metrics
  const now = Date.now();
  const mins15 = 15 * 60 * 1000;
  const days1 = 24 * 60 * 60 * 1000;
  const days7 = 7 * days1;
  const days30 = 30 * days1;

  let onlineNow = 0;
  let activeToday = 0;
  let activeWeek = 0;
  let dormant = 0;
  let churnRisk = 0;

  users.forEach(u => {
    // Treat users with no activity as churn risk
    const activeAt = u.lastActivityAt ? new Date(u.lastActivityAt).getTime() : 0;
    const diff = now - activeAt;
    
    if (diff < mins15) onlineNow++;
    else if (diff < days1) activeToday++;
    else if (diff < days7) activeWeek++;
    else if (diff < days30) dormant++;
    else churnRisk++;
  });

  const utilizationChartOptions = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { left: 'center', bottom: '0', itemStyle: { opacity: 1 } },
    series: [
      {
        name: 'User Utilization',
        type: 'pie',
        radius: ['30%', '75%'],
        roseType: 'radius',
        itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 },
        data: [
          { value: onlineNow, name: 'Online Now', itemStyle: { color: '#10b981' } },
          { value: activeToday, name: 'Active < 24h', itemStyle: { color: '#3b82f6' } },
          { value: activeWeek, name: 'Active < 7d', itemStyle: { color: '#8b5cf6' } },
          { value: dormant, name: 'Dormant < 30d', itemStyle: { color: '#f59e0b' } },
          { value: churnRisk, name: 'Churn Risk (>30d)', itemStyle: { color: '#ef4444' } },
        ].filter(d => d.value > 0).sort((a,b) => b.value - a.value)
      }
    ]
  };

  return (
    <div className="page-wrapper animate-fade-in mx-auto w-full px-4 lg:px-8">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'Admin'}
        role="Platform Administration"
      />
      
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mb-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Active Tenants</div>
          <div className="text-3xl font-bold tracking-tight">{active}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Platform clients</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Trial Tenants</div>
          <div className="text-3xl font-bold tracking-tight">{trials}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Evaluating</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Total Users</div>
          <div className="text-3xl font-bold tracking-tight">{users.length}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Across all tenants</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Platform Status</div>
          <div className="text-3xl font-bold tracking-tight">Healthy</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">All systems operational</div>
        </div>
      </Grid>

      <Grid numItemsSm={1} numItemsLg={2} className="gap-6 mb-8">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <Flex alignItems="start">
            <div>
              <h3 className="text-lg font-semibold tracking-tight mb-2">Tenant Breakdown</h3>
              <Subtitle>Distribution by subscription status</Subtitle>
            </div>
            <Link href="/platform/tenants" className="text-sm font-medium text-brand-500 hover:text-brand-600 hover:underline">Manage &rarr;</Link>
          </Flex>
          <div className="mt-6 flex items-center justify-center h-52">
            <DonutChart
              data={tenantData}
              category="value"
              index="name"
              colors={['emerald', 'amber', 'rose']}
              className="w-40 h-40"
              variant="pie"
            />
          </div>
          <div className="mt-6">
            <BarList data={tenantData.map(d => ({ name: d.name, value: d.value }))} className="mt-2" color="blue" />
          </div>
        </div>

        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
           <Flex alignItems="start">
            <div>
              <h3 className="text-lg font-semibold tracking-tight mb-2">Platform Growth</h3>
              <Subtitle>Tenant acquisition over last 90 days</Subtitle>
            </div>
          </Flex>
          <AreaChart
            className="h-72 mt-4"
            data={chartData}
            index="date"
            categories={["New Tenants", "Churned"]}
            colors={["indigo", "rose"]}
            yAxisWidth={30}
            showAnimation={true}
          />
        </div>
      </Grid>

      <Grid numItemsSm={1} numItemsLg={2} className="gap-6 mb-8">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <Flex alignItems="start">
            <div>
              <h3 className="text-lg font-semibold tracking-tight mb-2">User Utilization</h3>
              <Subtitle>Global user engagement & churn risk</Subtitle>
            </div>
            <Link href="/platform/users" className="text-sm font-medium text-brand-500 hover:text-brand-600 hover:underline">View Users &rarr;</Link>
          </Flex>
          <div className="mt-6 flex flex-col h-[300px]">
            {users.length > 0 ? (
              <ReactECharts option={utilizationChartOptions} style={{ height: '100%', width: '100%' }} />
            ) : (
              <Flex className="h-full" justifyContent="center">
                <div className="text-sm text-[var(--text-secondary)]">No user data available</div>
              </Flex>
            )}
          </div>
        </div>

        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-2">Engagement Metrics</h3>
          <Subtitle>Real-time platform activity</Subtitle>
          <div className="mt-6 space-y-6">
            <div>
              <Flex>
                <div className="text-sm text-[var(--text-secondary)]">Online Now</div>
                <div className="text-sm text-[var(--text-secondary)] font-bold text-emerald-600">{onlineNow}</div>
              </Flex>
              <ProgressBar value={users.length ? (onlineNow / users.length)*100 : 0} color="emerald" className="mt-2" />
            </div>
            <div>
              <Flex>
                <div className="text-sm text-[var(--text-secondary)]">Active Today</div>
                <div className="text-sm text-[var(--text-secondary)] font-bold text-blue-600">{activeToday}</div>
              </Flex>
              <ProgressBar value={users.length ? (activeToday / users.length)*100 : 0} color="blue" className="mt-2" />
            </div>
            <div>
              <Flex>
                <div className="text-sm text-[var(--text-secondary)]">Dormant Users ({'<'} 30 days)</div>
                <div className="text-sm text-[var(--text-secondary)] font-bold text-amber-600">{dormant}</div>
              </Flex>
              <ProgressBar value={users.length ? (dormant / users.length)*100 : 0} color="amber" className="mt-2" />
            </div>
            <div>
              <Flex>
                <div className="text-sm text-[var(--text-secondary)]">High Churn Risk ({'>'} 30 days inactive)</div>
                <div className="text-sm text-[var(--text-secondary)] font-bold text-rose-600">{churnRisk}</div>
              </Flex>
              <ProgressBar value={users.length ? (churnRisk / users.length)*100 : 0} color="rose" className="mt-2" />
            </div>
          </div>
        </div>
      </Grid>

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
  }).sort((a,b) => (b.valueUsd??0) - (a.valueUsd??0));

  const closedTotal = opps.filter(o => ['closed_won','closed_lost'].includes(o.stage)).length;
  const winRate = closedTotal > 0 ? Math.round((wonOpps.length / closedTotal) * 100) : 0;

  const teamAttainment = teams.map(t => {
    const teamWon = opps.filter(o => o.stage === 'closed_won' && t.memberIds.includes(o.assignedToUid ?? o.ownerId ?? '')).reduce((s, o) => s + (o.valueUsd ?? 0), 0);
    return {
      name: t.name,
      value: t.quota > 0 ? Math.min(100, Math.round((teamWon / t.quota) * 100)) : 0,
      wonAmount: teamWon,
      quota: t.quota
    };
  }).sort((a, b) => b.value - a.value);

  return (
    <div className="page-wrapper animate-fade-in mx-auto w-full px-4 lg:px-8">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'Manager'}
        role="Sales Leadership"
        action={{ href: '/platform/crm', label: '→ View Pipeline' }}
      />
      
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mb-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Total Pipeline</div>
          <div className="text-3xl font-bold tracking-tight">{fmtUsd(pipeline)}</div>
          <Flex className="mt-2 text-sm text-tremor-content">
            <div className="text-sm text-[var(--text-secondary)]">{openOpps.length} active deals</div>
          </Flex>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Won Revenue</div>
          <div className="text-3xl font-bold tracking-tight">{fmtUsd(won)}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Closed won this cycle</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Win Rate</div>
          <div className="text-3xl font-bold tracking-tight">{winRate}%</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Across {closedTotal} closed opportunities</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Closing ≤30d</div>
          <div className="text-3xl font-bold tracking-tight">{closingSoon.length}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Deals fast approaching close date</div>
        </div>
      </Grid>

      <Grid numItemsSm={1} numItemsLg={2} className="gap-6 mb-6">
         <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-2">Sales Teams Attainment</h3>
          <Subtitle>Quota completion percentage</Subtitle>
          <BarList 
            data={teamAttainment} 
            className="mt-6"
            color="indigo" 
            valueFormatter={(val: number) => `${val}%`}
          />
        </div>

        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <Flex alignItems="start">
            <div>
              <h3 className="text-lg font-semibold tracking-tight mb-2">Hot Deals Closing Soon</h3>
              <Subtitle>Top 6 deals scheduled to close in next 30 days</Subtitle>
            </div>
            <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-[var(--brand-500)] text-white shadow hover:bg-[var(--brand-600)]" color="rose">{closingSoon.length} Deals</span>
          </Flex>
          <div className="mt-6 flex flex-col gap-4">
            {closingSoon.length === 0 ? (
              <div className="text-sm text-[var(--text-secondary)]">No deals closing in the next 30 days.</div>
            ) : closingSoon.slice(0, 6).map(o => (
              <div key={o.id} className="flex justify-between items-center border-b border-tremor-border pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="text-sm text-[var(--text-secondary)] font-semibold text-tremor-content-strong">{o.orgName}</div>
                  <div className="text-sm text-[var(--text-secondary)] text-xs text-tremor-content">{o.ownerName} &bull; {o.stage.replace('_', ' ')}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-[var(--text-secondary)] font-bold text-tremor-content-strong">{fmtUsd(o.valueUsd ?? 0)}</div>
                  <div className="text-sm text-[var(--text-secondary)] text-xs text-tremor-brand">{o.closeDate?.slice(0,10)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Grid>

      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-lg font-semibold tracking-tight mb-2">Recent Activities Feed</h3>
        <div className="mt-4 flex flex-col gap-3">
          {activities.slice(0, 5).map(a => (
            <div key={a.id} className="flex items-center gap-4 py-3 border-b border-tremor-border last:border-0 last:pb-0">
              <div className="w-10 h-10 rounded-tremor-default bg-tremor-background-muted flex items-center justify-center text-lg shadow-sm border border-tremor-border">
                {a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : a.type === 'meeting' ? '🤝' : '📝'}
              </div>
              <div className="flex-1">
                <div className="text-sm text-[var(--text-secondary)] font-semibold text-tremor-content-strong leading-tight">{a.subject}</div>
                <div className="text-sm text-[var(--text-secondary)] text-xs text-tremor-content mt-1">{a.performedByName} &bull; {new Date(a.scheduledAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
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
    name: s.replace('_', ' ').charAt(0).toUpperCase() + s.replace('_', ' ').slice(1),
    value: myOpps.filter(o => o.stage === s).reduce((sum, o) => sum + (o.valueUsd ?? 0), 0),
    count: myOpps.filter(o => o.stage === s).length,
  })).filter(s => s.count > 0);

  const myActivities = activities.filter(a => a.performedByUid === uid || a.performedByName === name);

  return (
    <div className="page-wrapper animate-fade-in mx-auto w-full px-4 lg:px-8">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'Account Executive'}
        role="Sales Representative"
        action={{ href: '/platform/crm', label: 'Launch Copilot ⚡' }}
      />
      
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mb-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">My Pipeline</div>
          <div className="text-3xl font-bold tracking-tight">{fmtUsd(pipeline)}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">{openOpps.length} open deals</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Won This Cycle</div>
          <div className="text-3xl font-bold tracking-tight">{fmtUsd(won)}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Closed won revenue</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">My Activities</div>
          <div className="text-3xl font-bold tracking-tight">{myActivities.length}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Logged interactions</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">In Progress</div>
          <div className="text-3xl font-bold tracking-tight">{openOpps.length}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Actively working deals</div>
        </div>
      </Grid>

      <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-2">Pipeline Spread</h3>
          <Subtitle>Deal value distributed by current stage</Subtitle>
          <div className="mt-6">
            <DonutChart
              data={byStage}
              category="value"
              index="name"
              valueFormatter={fmtUsd}
              className="h-48"
              colors={['slate', 'blue', 'indigo', 'violet', 'fuchsia', 'emerald', 'rose']}
            />
          </div>
          <hr className="my-4 border-t border-[var(--border)]" />
          <div className="mt-4 flex flex-col gap-3">
             {byStage.map(s => (
               <div key={s.name} className="flex justify-between items-center text-sm">
                 <span className="text-tremor-content-strong text-xs font-semibold uppercase">{s.name} <span className="text-tremor-content ml-1">({s.count})</span></span>
                 <span className="font-bold text-tremor-content-strong">{fmtUsd(s.value)}</span>
               </div>
             ))}
          </div>
        </div>

        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <Flex alignItems="center" className="mb-4">
            <h3 className="text-lg font-semibold tracking-tight mb-2">Recent Activities</h3>
            <Link href="/platform/crm" className="text-sm font-medium text-brand-500 hover:underline">Log New &rarr;</Link>
          </Flex>
          {myActivities.length === 0 ? (
            <div className="text-tremor-content text-sm text-center py-10">
              No activities logged yet. Get out there and hustle!
            </div>
          ) : myActivities.slice(0, 6).map(a => (
            <div key={a.id} className="flex items-center gap-4 py-3 border-b border-tremor-border last:border-0 last:pb-0">
               <div className="w-10 h-10 rounded-tremor-default bg-tremor-background-subtle flex items-center justify-center text-lg border border-tremor-border shadow-sm">
                {a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : a.type === 'meeting' ? '🤝' : '📝'}
              </div>
              <div className="flex-1">
                <div className="text-sm text-[var(--text-secondary)] font-semibold text-tremor-content-strong">{a.subject}</div>
                <div className="text-sm text-[var(--text-secondary)] text-xs text-tremor-content mt-1">{a.orgName} &bull; {new Date(a.scheduledAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      </Grid>
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
  }).sort((a,b) => (b.valueUsd??0) - (a.valueUsd??0));

  return (
    <div className="page-wrapper animate-fade-in mx-auto w-full px-4 lg:px-8">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'CSM'}
        role="Customer Success / AM"
        action={{ href: '/platform/crm', label: '→ View Accounts' }}
      />
      
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mb-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Client Renewals</div>
          <div className="text-3xl font-bold tracking-tight">{renewals.length}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Tracked active cycles</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">At Risk ≤30d</div>
          <div className="text-3xl font-bold tracking-tight">{atRisk.length}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Impending expirations</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Total Engagements</div>
          <div className="text-3xl font-bold tracking-tight">{activities.length}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">All client interactions</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Accounts Map</div>
          <div className="text-3xl font-bold tracking-tight">{opps.length}</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Managed in CRM</div>
        </div>
      </Grid>

      <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
           <Flex alignItems="center" className="mb-4">
            <h3 className="text-lg font-semibold tracking-tight mb-2">Renewals at Risk</h3>
            <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-[var(--brand-500)] text-white shadow hover:bg-[var(--brand-600)]" color={atRisk.length === 0 ? "emerald" : "rose"}>{atRisk.length} Urgent</span>
          </Flex>
          {atRisk.length === 0 ? (
            <div className="text-sm text-[var(--text-secondary)]">No renewals at risk in the next 30 days. 🎉</div>
          ) : (
            <div className="flex flex-col gap-3">
              {atRisk.map(o => (
                <div key={o.id} className="flex justify-between items-center py-2 border-b border-tremor-border last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm text-[var(--text-secondary)] font-semibold text-tremor-content-strong text-sm">{o.orgName}</div>
                    <div className="text-sm text-[var(--text-secondary)] text-xs text-tremor-content">Closes {o.closeDate?.slice(0,10)}</div>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] font-bold text-destructive">{fmtUsd(o.valueUsd ?? 0)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-lg font-semibold tracking-tight mb-2">Recent Engagements</h3>
          <Subtitle>Last noted client interactions</Subtitle>
          <div className="mt-4 flex flex-col gap-3">
            {activities.slice(0, 6).map(a => (
              <div key={a.id} className="flex items-center gap-4 py-2 border-b border-tremor-border last:border-0 last:pb-0">
                <div className="text-xl w-8 text-center">{a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : '🤝'}</div>
                <div>
                  <div className="text-sm text-[var(--text-secondary)] font-semibold text-tremor-content-strong text-sm">{a.subject}</div>
                  <div className="text-sm text-[var(--text-secondary)] text-xs text-tremor-content mt-0.5">{a.performedByName} &bull; {new Date(a.scheduledAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Grid>
    </div>
  );
}

function TenantUserDashboard({ user, roleLabel }: {
  user: ReturnType<typeof useAuth>['user'];
  roleLabel: string;
}) {
  usePageTitle('Dashboard');
  return (
    <div className="page-wrapper animate-fade-in mx-auto w-full px-4 lg:px-8">
      <GreetingBar name={user?.name?.split(' ')[0] ?? 'there'} role={roleLabel} action={{ href: '/clients', label: 'Launch Workspace 🚀' }} />
      
      <Grid numItemsSm={1} numItemsLg={3} className="gap-6 mb-8">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Client Families</div>
          <div className="text-3xl font-bold tracking-tight">—</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Active wealth groups</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Active Tasks</div>
          <div className="text-3xl font-bold tracking-tight">—</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Pending action items</div>
        </div>
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-[var(--text-secondary)]">Upcoming Events</div>
          <div className="text-3xl font-bold tracking-tight">—</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2 text-tremor-content">Next 14 days</div>
        </div>
      </Grid>
      
      <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-lg font-semibold tracking-tight mb-2">Workspace Navigation</h3>
        <Subtitle>Jump directly to your operational modules</Subtitle>
        <div className="mt-6 flex gap-3 flex-wrap">
          {[
            { href: '/clients',   label: '👥 Clients' },
            { href: '/tasks',      label: '✅ Tasks' },
            { href: '/activities', label: '📋 Activities' },
            { href: '/calendar',   label: '📅 Calendar' },
            { href: '/documents',  label: '📁 Documents' },
            { href: '/reports',    label: '📊 Reports' },
          ].map(l => (
            <Link key={l.href} href={l.href} className="px-5 py-2.5 bg-tremor-background-muted border border-tremor-border rounded-tremor-default hover:bg-tremor-background-subtle font-semibold text-sm text-tremor-content-emphasis transition-all shadow-sm">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
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
  ai_officer:               'AI Governance Officer',
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
      <div className="page-wrapper animate-fade-in mx-auto w-full px-4 lg:px-8">
        <GreetingBar name="Demo" role="Platform Demo Mode" />
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-5 flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-6">🏛️</div>
          <h3 className="text-lg font-semibold tracking-tight mb-2 text-2xl font-bold">MFO Nexus Platform</h3>
          <div className="text-sm text-[var(--text-secondary)] mt-2 max-w-sm mx-auto">Switch to Live Mode using the toggle in the header to view your actual database records and interactive Tremor charts.</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
          <div className="text-sm text-[var(--text-secondary)]">Loading advanced analytics…</div>
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
  return <DashboardHub user={user} platformRole={role} />;
}
