import React from 'react';
import Link from 'next/link';
import { Grid, Flex, Subtitle, DonutChart, ProgressBar, fmtUsd } from './UI';
import { Clock, ShieldAlert, FileText, CheckCircle, Search, FileSignature } from 'lucide-react';
// import { useTranslation } from 'react-i18next';
const useTranslation = () => ({ t: (k: string, fall?: string) => fall || k });

export function FirmAdminDashboard() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-secondary">{t('Total AUM', 'Total AUM')}</div>
          <div className="text-3xl font-bold mt-1">$2.4B</div>
          <div className="text-sm text-emerald-500 mt-2 font-medium">+12.4% vs last quarter</div>
        </div>
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-secondary">{t('Active Users', 'Active Users')}</div>
          <div className="text-3xl font-bold mt-1">124</div>
          <div className="text-sm text-secondary mt-2">Across 14 groups</div>
        </div>
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5">
          <div className="text-sm text-secondary">{t('Open LGPD Requests', 'Open LGPD Requests')}</div>
          <div className="text-3xl font-bold mt-1 text-rose-500">2</div>
          <div className="text-sm text-rose-500 mt-2 font-medium">Require action within 48h</div>
        </div>
      </Grid>
      
      <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5 w-full">
        <h3 className="font-semibold text-lg">{t('SLA Health across Queues', 'SLA Health across Queues')}</h3>
        <Subtitle>{t('Current response times against targets', 'Current response times against targets')}</Subtitle>
        <div className="mt-6 space-y-4">
           <div>
             <Flex className="mb-2"><span>{t('Support Tickets', 'Support Tickets')}</span><span className="text-secondary text-sm">98% {t('within SLA', 'within SLA')}</span></Flex>
             <ProgressBar value={98} color="emerald" />
           </div>
           <div>
             <Flex className="mb-2"><span>{t('Account Opening', 'Account Opening')}</span><span className="text-secondary text-sm">74% {t('within SLA', 'within SLA')}</span></Flex>
             <ProgressBar value={74} color="amber" />
           </div>
           <div>
             <Flex className="mb-2"><span>{t('Compliance Review', 'Compliance Review')}</span><span className="text-secondary text-sm">92% {t('within SLA', 'within SLA')}</span></Flex>
             <ProgressBar value={92} color="emerald" />
           </div>
        </div>
      </div>
    </div>
  );
}

export function CIODashboard() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Grid numItemsSm={1} numItemsLg={2} className="gap-6">
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5">
          <h3 className="font-semibold text-lg">{t('Global Asset Allocation', 'Global Asset Allocation')}</h3>
          <Subtitle>{t('Across all wealth groups', 'Across all wealth groups')}</Subtitle>
          <div className="h-48 mt-4"><DonutChart /></div>
        </div>
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-lg">{t('Quick Actions', 'Quick Actions')}</h3>
            <Subtitle>{t('Market intelligence', 'Market intelligence')}</Subtitle>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Link href="/market" className="p-4 rounded-lg bg-secondary/20 hover:bg-brand-50 hover:text-brand-600 transition border border-transparent hover:border-brand-100 flex flex-col items-center justify-center text-center">
              <Search className="h-6 w-6 mb-2" />
              <span className="text-sm font-medium">{t('Market Screener', 'Market Screener')}</span>
            </Link>
            <div className="p-4 rounded-lg bg-secondary/20 hover:bg-brand-50 hover:text-brand-600 transition border border-transparent hover:border-brand-100 flex flex-col items-center justify-center text-center cursor-pointer">
              <FileText className="h-6 w-6 mb-2" />
              <span className="text-sm font-medium">{t('Recent Minutes', 'Recent Minutes')}</span>
            </div>
          </div>
        </div>
      </Grid>
      <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5">
        <h3 className="font-semibold text-lg mb-4">{t('Top Performing Assets', 'Top Performing Assets')}</h3>
        <div className="divide-y divide-border">
          {[
            { a: 'AAPL', b: 'Equity', c: '+14.2%' },
            { a: 'BTC', b: 'Crypto', c: '+9.4%' },
            { a: 'US Treasuries', b: 'Fixed Income', c: '+1.1%' }
          ].map(row => (
            <Flex key={row.a} className="py-3">
              <div>
                 <div className="font-medium">{row.a}</div>
                 <div className="text-xs text-secondary">{row.b}</div>
              </div>
              <div className="text-emerald-500 font-medium">{row.c}</div>
            </Flex>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RelationshipManagerDashboard() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6">
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-4">
          <div className="text-sm text-secondary">{t('My Clients', 'My Clients')}</div>
          <div className="text-2xl font-bold mt-1">42</div>
        </div>
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-4">
          <div className="text-sm text-secondary">{t('Upcoming Birthdays', 'Upcoming Birthdays')}</div>
          <div className="text-2xl font-bold mt-1">3</div>
        </div>
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-4">
          <div className="text-sm text-secondary">{t('Unread Emails', 'Unread Emails')}</div>
          <div className="text-2xl font-bold mt-1 text-brand-600">12</div>
        </div>
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-4">
          <div className="text-sm text-secondary">{t('KYC Renewals', 'KYC Renewals')}</div>
          <div className="text-2xl font-bold mt-1 text-amber-500">2</div>
        </div>
      </Grid>
      <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5">
        <h3 className="font-semibold text-lg mb-4">{t('Assigned Tasks', 'Assigned Tasks')}</h3>
        <div className="space-y-3">
          {[
            { title: 'Follow up on Trust Deed', client: 'Smith Family', date: 'Today' },
            { title: 'Quarterly Review Meeting', client: 'Johnson Estate', date: 'Tomorrow' },
          ].map(task => (
            <Flex key={task.title} className="p-3 bg-secondary/10 rounded-lg">
              <div className="flex items-center gap-3">
                 <CheckCircle className="h-5 w-5 text-secondary" />
                 <div>
                   <div className="font-medium text-sm">{task.title}</div>
                   <div className="text-xs text-secondary">{task.client}</div>
                 </div>
              </div>
              <div className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">{task.date}</div>
            </Flex>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ControllerDashboard() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5 border-l-4 border-l-amber-500">
          <h3 className="text-sm text-secondary">{t('Pending Capital Calls', 'Pending Capital Calls')}</h3>
          <div className="text-3xl font-bold mt-2">$1.2M</div>
          <div className="text-sm mt-1">4 {t('transactions require funding', 'transactions require funding')}</div>
        </div>
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5 border-l-4 border-l-rose-500">
          <h3 className="text-sm text-secondary">{t('Un-reconciled', 'Un-reconciled Transactions')}</h3>
          <div className="text-3xl font-bold mt-2">18</div>
          <div className="text-sm mt-1">{t('Across 3 bank accounts', 'Across 3 bank accounts')}</div>
        </div>
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5 border-l-4 border-l-emerald-500">
          <h3 className="text-sm text-secondary">{t('Cash Position Alert', 'Cash Position Alert')}</h3>
          <div className="text-3xl font-bold mt-2">$4.5M</div>
          <div className="text-sm mt-1">{t('Liquid reserves optimal', 'Liquid reserves optimal')}</div>
        </div>
      </Grid>
      <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5">
        <Flex alignItems="center" className="mb-4">
          <h3 className="font-semibold text-lg">{t('Unsigned Tax Documents', 'Unsigned Tax Documents')}</h3>
          <FileSignature className="h-5 w-5 text-secondary" />
        </Flex>
        <div className="py-8 text-center text-secondary border border-dashed rounded-lg">
          {t('No pending signatures', 'No pending signatures')}
        </div>
      </div>
    </div>
  );
}

export function ComplianceOfficerDashboard() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Grid numItemsSm={1} numItemsLg={3} className="gap-6">
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5 flex items-center gap-4">
          <div className="p-3 rounded-full bg-amber-100 text-amber-600"><ShieldAlert className="h-6 w-6" /></div>
          <div>
            <div className="text-sm text-secondary">{t('Flagged Accounts', 'Flagged Accounts')}</div>
            <div className="text-2xl font-bold mt-1">2</div>
          </div>
        </div>
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5 flex items-center gap-4">
          <div className="p-3 rounded-full bg-blue-100 text-blue-600"><FileText className="h-6 w-6" /></div>
          <div>
            <div className="text-sm text-secondary">{t('Suitability Pending', 'Suitability Reviews Pending')}</div>
            <div className="text-2xl font-bold mt-1">5</div>
          </div>
        </div>
        <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5 flex items-center gap-4">
          <div className="p-3 rounded-full bg-rose-100 text-rose-600"><Clock className="h-6 w-6" /></div>
          <div>
            <div className="text-sm text-secondary">{t('Data Deletion Requests', 'Data Deletion Requests')}</div>
            <div className="text-2xl font-bold mt-1">1</div>
          </div>
        </div>
      </Grid>
      <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-5 max-h-64 overflow-y-auto">
        <h3 className="font-semibold text-lg mb-4">{t('Audit Log Ticker', 'Audit Log Ticker')}</h3>
        <div className="space-y-3">
          {[
            { msg: 'User J. Doe downloaded TrustDeed.pdf', time: '10m ago' },
            { msg: 'System flagged transaction TX-1092', time: '1h ago', alert: true },
            { msg: 'Admin modified Role Policies', time: '2h ago' },
          ].map((log, i) => (
            <div key={i} className={`p-2 rounded text-sm ${log.alert ? 'bg-rose-50 text-rose-700 font-medium' : 'text-secondary font-mono'}`}>
              <span className="opacity-70 mr-3">{log.time}</span> {log.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReportViewerDashboard() {
  const { t } = useTranslation();
  return (
    <div className="bg-card shadow-sm rounded-xl border border-[var(--border)] p-6 min-h-[40vh] flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-500 mb-4">
         <FileText className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-bold tracking-tight mb-2">{t('Report Gallery', 'Report Gallery')}</h3>
      <p className="text-secondary max-w-md">{t('Access recent portfolio, estate, and performance reports generated for your authorized entities.', 'Access recent portfolio, estate, and performance reports generated for your authorized entities.')}</p>
      
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
         <div className="p-4 border rounded-lg hover:border-brand-500 cursor-pointer transition text-left flex items-start gap-4">
            <div className="bg-brand-500 text-white rounded p-2"><FileText className="w-5 h-5" /></div>
            <div>
              <div className="font-medium text-sm">Q3 Performance Summary</div>
              <div className="text-xs text-secondary mt-1">Generated: Oct 2</div>
            </div>
         </div>
         <div className="p-4 border rounded-lg hover:border-brand-500 cursor-pointer transition text-left flex items-start gap-4">
            <div className="bg-brand-500 text-white rounded p-2"><FileText className="w-5 h-5" /></div>
            <div>
              <div className="font-medium text-sm">Estate Liquidity Profile</div>
              <div className="text-xs text-secondary mt-1">Generated: Sep 15</div>
            </div>
         </div>
      </div>
    </div>
  );
}
