import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CampaignRecord } from '@/lib/marketingService';
import { formatUsd } from '@/lib/subscriptionService';
import { Filter, MousePointerClick, Users, UserCheck, TrendingUp, DollarSign } from 'lucide-react';

interface PerformanceDashboardProps {
  campaigns: CampaignRecord[];
}

export function PerformanceDashboard({ campaigns }: PerformanceDashboardProps) {
  // Aggregate Metrics across all campaigns
  const totalAllocated = campaigns.reduce((acc, c) => acc + (c.budgetAllocated || 0), 0);
  const totalSpent = campaigns.reduce((acc, c) => acc + (c.budgetSent || 0), 0);
  
  const totalImpressions = campaigns.reduce((acc, c) => acc + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((acc, c) => acc + (c.clicks || 0), 0);
  
  const totalExpectedLeads = campaigns.reduce((acc, c) => acc + (c.expectedLeads || 0), 0);
  const totalActualLeads = campaigns.reduce((acc, c) => acc + (c.actualLeadsGenerated || 0), 0);
  
  const totalOppts = campaigns.reduce((acc, c) => acc + (c.opportunitiesGenerated || 0), 0);
  const totalClients = campaigns.reduce((acc, c) => acc + (c.clientsConverted || 0), 0);
  
  const totalExpectedRev = campaigns.reduce((acc, c) => acc + (c.expectedRevenue || 0), 0);
  const totalActualRev = campaigns.reduce((acc, c) => acc + (c.actualRevenueAttributed || 0), 0);

  // Derived Performance Metrics
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : '0%';
  const leadConv = totalClicks > 0 ? ((totalActualLeads / totalClicks) * 100).toFixed(2) + '%' : '0%';
  const opptConv = totalActualLeads > 0 ? ((totalOppts / totalActualLeads) * 100).toFixed(2) + '%' : '0%';
  
  const cac = totalClients > 0 ? (totalSpent / totalClients) : 0;
  const costPerLead = totalActualLeads > 0 ? (totalSpent / totalActualLeads) : 0;
  
  const overallRoi = totalSpent > 0 ? (((totalActualRev - totalSpent) / totalSpent) * 100).toFixed(2) + '%' : '0%';

  return (
    <div className="space-y-6">
      
      {/* Top Level Exec Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Total Ad Spend" value={formatUsd(totalSpent)} subtitle={`of ${formatUsd(totalAllocated)} allocated`} icon={<DollarSign size={16} />} />
        <MetricCard title="Cost Per Lead (CPL)" value={formatUsd(costPerLead)} subtitle={`${totalActualLeads} total leads`} icon={<Filter size={16} />} />
        <MetricCard title="Client Acq. Cost (CAC)" value={formatUsd(cac)} subtitle={`${totalClients} new clients`} icon={<UserCheck size={16} />} />
        <MetricCard title="Attributed Revenue" value={formatUsd(totalActualRev)} subtitle={`${overallRoi} ROI`} icon={<TrendingUp size={16} />} />
      </div>

      {/* Funnel Matrix */}
      <Card className="rounded-xl overflow-hidden border-slate-200 shadow-sm bg-white">
         <CardHeader className="bg-slate-50 border-b border-slate-200 px-6 py-4">
            <CardTitle className="text-sm font-semibold tracking-wide text-slate-800">Conversion Funnel Analytics</CardTitle>
         </CardHeader>
         <CardContent className="p-0">
             <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-100">
               
               {/* Impression */}
               <FunnelStage 
                 label="Impressions" 
                 value={totalImpressions.toLocaleString()} 
                 icon={<Filter size={18} className="text-slate-400" />} 
                 metricLabel="CTR" 
                 metricValue={ctr} 
               />
               
               {/* Click */}
               <FunnelStage 
                 label="Clicks" 
                 value={totalClicks.toLocaleString()} 
                 icon={<MousePointerClick size={18} className="text-slate-400" />} 
                 metricLabel="LCR" 
                 metricValue={leadConv} 
               />
               
               {/* Leads */}
               <FunnelStage 
                 label="Leads Captured" 
                 value={totalActualLeads.toLocaleString()} 
                 icon={<Users size={18} className="text-slate-400" />} 
                 metricLabel="OpCR" 
                 metricValue={opptConv} 
                 vsTarget={`${totalExpectedLeads} Target`}
               />
               
               {/* Opportunities */}
               <FunnelStage 
                 label="Origination Pipeline" 
                 value={totalOppts.toLocaleString()} 
                 icon={<TrendingUp size={18} className="text-slate-400" />} 
                 metricLabel="WinR" 
                 metricValue={totalOppts > 0 ? ((totalClients/totalOppts)*100).toFixed(1)+'%' : '0%'} 
               />
               
               {/* Won Clients */}
               <div className="p-6 flex flex-col justify-between bg-emerald-50/30">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">New Clients</span>
                     <UserCheck size={18} className="text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 leading-none my-2">{totalClients}</h3>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-emerald-100/50">
                     <span className="text-[10px] font-bold text-slate-400 uppercase">Rev/Client</span>
                     <span className="text-xs font-bold text-emerald-700">{formatUsd(totalClients > 0 ? totalActualRev / totalClients : 0)}</span>
                  </div>
               </div>

             </div>
         </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon }: any) {
  return (
    <Card className="rounded-xl border-slate-200 shadow-sm bg-white">
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between mb-4 text-slate-500">
          <p className="text-xs font-bold uppercase tracking-wider">{title}</p>
          {icon}
        </div>
        <div className="mt-auto">
          <h3 className="text-2xl font-black text-slate-800 leading-none">{value}</h3>
          <p className="text-[10px] uppercase font-bold text-slate-400 mt-2">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelStage({ label, value, icon, metricLabel, metricValue, vsTarget }: any) {
  return (
    <div className="p-6 flex flex-col justify-between bg-white relative">
      <div className="flex items-center justify-between mb-2">
         <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</span>
         {icon}
      </div>
      <div className="my-2">
         <h3 className="text-2xl font-black text-slate-800 leading-none">{value}</h3>
         {vsTarget && <span className="text-[10px] font-semibold text-slate-400 block mt-1">{vsTarget}</span>}
      </div>
      
      {/* Down arrow connector mapping metric */}
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
         <span className="text-[10px] font-bold text-slate-400 uppercase">{metricLabel}</span>
         <span className="text-xs font-bold text-slate-700">{metricValue}</span>
      </div>

      <div className="hidden md:block absolute right-0 top-1/2 -mt-3 -mr-3 z-10 w-6 h-6 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center shadow-sm">
         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    </div>
  );
}
