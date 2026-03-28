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
import {
  Card, Metric, Text, Title, Subtitle, Flex, Grid, Col,
  AreaChart, BarList, DonutChart, BadgeDelta, ProgressBar, Badge,
  Tracker, Divider, Button, Icon
} from '@tremor/react';

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
    <div className="mb-6 p-6 rounded-tremor-default bg-gradient-to-br from-blue-600 to-indigo-900 flex justify-between items-center shadow-lg">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{getGreeting()}, {name} 👋</h1>
        <p className="text-sm text-blue-100 mt-1 font-medium bg-white/10 inline-block px-3 py-1 rounded-full">{role}</p>
      </div>
      {action && (
        <Link href={action.href} className="px-5 py-2.5 bg-white/20 hover:bg-white/30 transition-colors text-white rounded-tremor-default font-semibold text-sm border border-white/30 backdrop-blur-sm shadow-sm">
          {action.label}
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

  return (
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'Admin'}
        role="Platform Administration"
        action={{ href: '/platform/tenants', label: '+ New Tenant' }}
      />
      
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mb-6">
        <Card decoration="top" decorationColor="emerald">
          <Text>Active Tenants</Text>
          <Metric>{active}</Metric>
          <Text className="mt-2 text-tremor-content">Platform clients</Text>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Trial Tenants</Text>
          <Metric>{trials}</Metric>
          <Text className="mt-2 text-tremor-content">Evaluating</Text>
        </Card>
        <Card decoration="top" decorationColor="blue">
          <Text>Total Users</Text>
          <Metric>{users.length}</Metric>
          <Text className="mt-2 text-tremor-content">Across all tenants</Text>
        </Card>
        <Card decoration="top" decorationColor="teal">
          <Text>Platform Status</Text>
          <Metric>Healthy</Metric>
          <Text className="mt-2 text-tremor-content">All systems operational</Text>
        </Card>
      </Grid>

      <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
        <Card>
          <Flex alignItems="start">
            <div>
              <Title>Tenant Breakdown</Title>
              <Subtitle>Distribution by subscription status</Subtitle>
            </div>
            <Link href="/platform/tenants" className="text-sm font-medium text-blue-500 hover:underline">Manage &rarr;</Link>
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
        </Card>

        <Card>
           <Flex alignItems="start">
            <div>
              <Title>Platform Growth</Title>
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
        </Card>
      </Grid>

      <Card className="mt-6">
        <Title>Quick Engine Access</Title>
        <Subtitle>Jump to a centralized module</Subtitle>
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            { href: '/platform/crm',       label: '📊 Global CRM' },
            { href: '/platform/users',     label: '👤 User Directory' },
            { href: '/platform/roles',     label: '🔐 Role Policies' },
            { href: '/platform/analytics', label: '📈 Analytics' },
            { href: '/platform/support',   label: '🎧 Support Center' },
            { href: '/admin',              label: '⚙️ Settings (BYOK)' },
          ].map(l => (
            <Link key={l.href} href={l.href} className="px-4 py-2 bg-tremor-background-muted hover:bg-tremor-background-subtle border border-tremor-border rounded-tremor-small text-sm font-medium text-tremor-content-strong transition-colors">
              {l.label}
            </Link>
          ))}
        </div>
      </Card>
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
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'Manager'}
        role="Sales Leadership"
        action={{ href: '/platform/crm', label: '→ View Pipeline' }}
      />
      
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mb-6">
        <Card decoration="top" decorationColor="indigo">
          <Text>Total Pipeline</Text>
          <Metric>{fmtUsd(pipeline)}</Metric>
          <Flex className="mt-2 text-sm text-tremor-content">
            <Text>{openOpps.length} active deals</Text>
          </Flex>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>Won Revenue</Text>
          <Metric>{fmtUsd(won)}</Metric>
          <Text className="mt-2 text-tremor-content">Closed won this cycle</Text>
        </Card>
        <Card decoration="top" decorationColor={winRate >= 30 ? "emerald" : "amber"}>
          <Text>Win Rate</Text>
          <Metric>{winRate}%</Metric>
          <Text className="mt-2 text-tremor-content">Across {closedTotal} closed opportunities</Text>
        </Card>
        <Card decoration="top" decorationColor={closingSoon.length > 3 ? "rose" : "amber"}>
          <Text>Closing ≤30d</Text>
          <Metric>{closingSoon.length}</Metric>
          <Text className="mt-2 text-tremor-content">Deals fast approaching close date</Text>
        </Card>
      </Grid>

      <Grid numItemsSm={1} numItemsLg={2} className="gap-6 mb-6">
         <Card>
          <Title>Sales Teams Attainment</Title>
          <Subtitle>Quota completion percentage</Subtitle>
          <BarList 
            data={teamAttainment} 
            className="mt-6"
            color="indigo" 
            valueFormatter={(val: number) => `${val}%`}
          />
        </Card>

        <Card>
          <Flex alignItems="start">
            <div>
              <Title>Hot Deals Closing Soon</Title>
              <Subtitle>Top 6 deals scheduled to close in next 30 days</Subtitle>
            </div>
            <Badge color="rose">{closingSoon.length} Deals</Badge>
          </Flex>
          <div className="mt-6 flex flex-col gap-4">
            {closingSoon.length === 0 ? (
              <Text>No deals closing in the next 30 days.</Text>
            ) : closingSoon.slice(0, 6).map(o => (
              <div key={o.id} className="flex justify-between items-center border-b border-tremor-border pb-3 last:border-0 last:pb-0">
                <div>
                  <Text className="font-semibold text-tremor-content-strong">{o.orgName}</Text>
                  <Text className="text-xs text-tremor-content">{o.ownerName} &bull; {o.stage.replace('_', ' ')}</Text>
                </div>
                <div className="text-right">
                  <Text className="font-bold text-tremor-content-strong">{fmtUsd(o.valueUsd ?? 0)}</Text>
                  <Text className="text-xs text-tremor-brand">{o.closeDate?.slice(0,10)}</Text>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Grid>

      <Card>
        <Title>Recent Activities Feed</Title>
        <div className="mt-4 flex flex-col gap-3">
          {activities.slice(0, 5).map(a => (
            <div key={a.id} className="flex items-center gap-4 py-3 border-b border-tremor-border last:border-0 last:pb-0">
              <div className="w-10 h-10 rounded-tremor-default bg-tremor-background-muted flex items-center justify-center text-lg shadow-sm border border-tremor-border">
                {a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : a.type === 'meeting' ? '🤝' : '📝'}
              </div>
              <div className="flex-1">
                <Text className="font-semibold text-tremor-content-strong leading-tight">{a.subject}</Text>
                <Text className="text-xs text-tremor-content mt-1">{a.performedByName} &bull; {new Date(a.scheduledAt).toLocaleDateString()}</Text>
              </div>
            </div>
          ))}
        </div>
      </Card>
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
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'Account Executive'}
        role="Sales Representative"
        action={{ href: '/platform/crm', label: 'Launch Copilot ⚡' }}
      />
      
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mb-6">
        <Card decoration="top" decorationColor="blue">
          <Text>My Pipeline</Text>
          <Metric>{fmtUsd(pipeline)}</Metric>
          <Text className="mt-2 text-tremor-content">{openOpps.length} open deals</Text>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>Won This Cycle</Text>
          <Metric>{fmtUsd(won)}</Metric>
          <Text className="mt-2 text-tremor-content">Closed won revenue</Text>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>My Activities</Text>
          <Metric>{myActivities.length}</Metric>
          <Text className="mt-2 text-tremor-content">Logged interactions</Text>
        </Card>
        <Card decoration="top" decorationColor="indigo">
          <Text>In Progress</Text>
          <Metric>{openOpps.length}</Metric>
          <Text className="mt-2 text-tremor-content">Actively working deals</Text>
        </Card>
      </Grid>

      <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
        <Card>
          <Title>Pipeline Spread</Title>
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
          <Divider />
          <div className="mt-4 flex flex-col gap-3">
             {byStage.map(s => (
               <div key={s.name} className="flex justify-between items-center text-sm">
                 <span className="text-tremor-content-strong text-xs font-semibold uppercase">{s.name} <span className="text-tremor-content ml-1">({s.count})</span></span>
                 <span className="font-bold text-tremor-content-strong">{fmtUsd(s.value)}</span>
               </div>
             ))}
          </div>
        </Card>

        <Card>
          <Flex alignItems="center" className="mb-4">
            <Title>Recent Activities</Title>
            <Link href="/platform/crm" className="text-sm font-medium text-blue-500 hover:underline">Log New &rarr;</Link>
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
                <Text className="font-semibold text-tremor-content-strong">{a.subject}</Text>
                <Text className="text-xs text-tremor-content mt-1">{a.orgName} &bull; {new Date(a.scheduledAt).toLocaleDateString()}</Text>
              </div>
            </div>
          ))}
        </Card>
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
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      <GreetingBar
        name={user?.name?.split(' ')[0] ?? 'CSM'}
        role="Customer Success / AM"
        action={{ href: '/platform/crm', label: '→ View Accounts' }}
      />
      
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mb-6">
        <Card decoration="top" decorationColor="indigo">
          <Text>Client Renewals</Text>
          <Metric>{renewals.length}</Metric>
          <Text className="mt-2 text-tremor-content">Tracked active cycles</Text>
        </Card>
        <Card decoration="top" decorationColor={atRisk.length > 0 ? "rose" : "emerald"}>
          <Text>At Risk ≤30d</Text>
          <Metric>{atRisk.length}</Metric>
          <Text className="mt-2 text-tremor-content">Impending expirations</Text>
        </Card>
        <Card decoration="top" decorationColor="teal">
          <Text>Total Engagements</Text>
          <Metric>{activities.length}</Metric>
          <Text className="mt-2 text-tremor-content">All client interactions</Text>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Accounts Map</Text>
          <Metric>{opps.length}</Metric>
          <Text className="mt-2 text-tremor-content">Managed in CRM</Text>
        </Card>
      </Grid>

      <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
        <Card>
           <Flex alignItems="center" className="mb-4">
            <Title>Renewals at Risk</Title>
            <Badge color={atRisk.length === 0 ? "emerald" : "rose"}>{atRisk.length} Urgent</Badge>
          </Flex>
          {atRisk.length === 0 ? (
            <Text>No renewals at risk in the next 30 days. 🎉</Text>
          ) : (
            <div className="flex flex-col gap-3">
              {atRisk.map(o => (
                <div key={o.id} className="flex justify-between items-center py-2 border-b border-tremor-border last:border-0 last:pb-0">
                  <div>
                    <Text className="font-semibold text-tremor-content-strong text-sm">{o.orgName}</Text>
                    <Text className="text-xs text-tremor-content">Closes {o.closeDate?.slice(0,10)}</Text>
                  </div>
                  <Text className="font-bold text-rose-500">{fmtUsd(o.valueUsd ?? 0)}</Text>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <Title>Recent Engagements</Title>
          <Subtitle>Last noted client interactions</Subtitle>
          <div className="mt-4 flex flex-col gap-3">
            {activities.slice(0, 6).map(a => (
              <div key={a.id} className="flex items-center gap-4 py-2 border-b border-tremor-border last:border-0 last:pb-0">
                <div className="text-xl w-8 text-center">{a.type === 'call' ? '📞' : a.type === 'email' ? '📧' : '🤝'}</div>
                <div>
                  <Text className="font-semibold text-tremor-content-strong text-sm">{a.subject}</Text>
                  <Text className="text-xs text-tremor-content mt-0.5">{a.performedByName} &bull; {new Date(a.scheduledAt).toLocaleDateString()}</Text>
                </div>
              </div>
            ))}
          </div>
        </Card>
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
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      <GreetingBar name={user?.name?.split(' ')[0] ?? 'there'} role={roleLabel} action={{ href: '/clients', label: 'Launch Workspace 🚀' }} />
      
      <Grid numItemsSm={1} numItemsLg={3} className="gap-6 mb-8">
        <Card decoration="top" decorationColor="blue">
          <Text>Client Families</Text>
          <Metric>—</Metric>
          <Text className="mt-2 text-tremor-content">Active wealth groups</Text>
        </Card>
        <Card decoration="top" decorationColor="emerald">
          <Text>Active Tasks</Text>
          <Metric>—</Metric>
          <Text className="mt-2 text-tremor-content">Pending action items</Text>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Upcoming Events</Text>
          <Metric>—</Metric>
          <Text className="mt-2 text-tremor-content">Next 14 days</Text>
        </Card>
      </Grid>
      
      <Card>
        <Title>Workspace Navigation</Title>
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
      </Card>
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
      <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
        <GreetingBar name="Demo" role="Platform Demo Mode" />
        <Card className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-6">🏛️</div>
          <Title className="text-2xl font-bold">MFO Nexus Platform</Title>
          <Text className="mt-2 max-w-sm mx-auto">Switch to Live Mode using the toggle in the header to view your actual database records and interactive Tremor charts.</Text>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <Text>Loading advanced analytics…</Text>
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
