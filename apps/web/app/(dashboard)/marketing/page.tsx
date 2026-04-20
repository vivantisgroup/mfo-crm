'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getEvents, getCampaigns, getBudgetPlan, saveBudgetPlan, EventRecord, CampaignRecord, MarketingBudgetPlan } from '@/lib/marketingService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatUsd } from '@/lib/subscriptionService';
import { Calendar, Mail, Megaphone, Plus, LayoutDashboard, Calculator, ArrowRight } from 'lucide-react';
import { usePageTitle } from '@/lib/PageTitleContext';

import { BudgetMatrix } from './components/BudgetMatrix';
import { PerformanceDashboard } from './components/PerformanceDashboard';

export default function MarketingModulePage() {
  const { tenant } = useAuth();
  const { setTitle } = usePageTitle();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'budget' | 'campaigns' | 'events'>('dashboard');
  
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [budgetPlan, setBudgetPlan] = useState<MarketingBudgetPlan | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [savingBudget, setSavingBudget] = useState(false);

  useEffect(() => {
    setTitle('Marketing & ROI', 'Planejamento de campanhas, alocação de verbas e métricas de funil (CAC/LTV).');
  }, [setTitle]);

  useEffect(() => {
    if (!tenant?.id) return;
    async function load() {
      try {
        const [loadedEvents, loadedCampaigns, loadedBudget] = await Promise.all([
          getEvents(tenant!.id),
          getCampaigns(tenant!.id),
          getBudgetPlan(tenant!.id, new Date().getFullYear())
        ]);
        setEvents(loadedEvents);
        setCampaigns(loadedCampaigns);
        setBudgetPlan(loadedBudget);
      } catch (err) {
        console.error('Failed to load marketing data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenant]);

  const handleSaveBudget = async (plan: Partial<MarketingBudgetPlan>) => {
    if (!tenant?.id) return;
    setSavingBudget(true);
    try {
       await saveBudgetPlan(tenant.id, { ...plan, year: plan.year || new Date().getFullYear() });
       setBudgetPlan(plan as MarketingBudgetPlan);
    } catch(err) {
       console.error("Error saving budget", err);
    } finally {
       setSavingBudget(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8">
         <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-64 bg-slate-100 rounded-xl mt-8"></div>
         </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 h-full flex flex-col p-4 lg:p-8 bg-slate-50/50">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Marketing Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">ROI Analysis, Lead Gen Funnels, and Budget Matrix.</p>
        </div>
        <div className="flex gap-2">
           <Button className="bg-slate-800 hover:bg-slate-700 text-white rounded-md shadow-sm"><Plus className="h-4 w-4 mr-2" /> Launch Plan</Button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex space-x-1 bg-slate-200/50 p-1 pl-1 pr-1 w-max rounded-lg">
         <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={14} />}>Performance ROI</TabButton>
         <TabButton active={activeTab === 'budget'} onClick={() => setActiveTab('budget')} icon={<Calculator size={14} />}>Budget Matrix</TabButton>
         <TabButton active={activeTab === 'campaigns'} onClick={() => setActiveTab('campaigns')} icon={<Megaphone size={14} />}>Digital Campaigns</TabButton>
         <TabButton active={activeTab === 'events'} onClick={() => setActiveTab('events')} icon={<Calendar size={14} />}>Calendar & Events</TabButton>
      </div>

      {/* ── CONTENT ROUTING ── */}
      
      {activeTab === 'dashboard' && (
         <PerformanceDashboard campaigns={campaigns} />
      )}
      
      {activeTab === 'budget' && (
         <BudgetMatrix plan={budgetPlan} onSave={handleSaveBudget} saving={savingBudget} />
      )}

      {activeTab === 'campaigns' && (
         <Card className="rounded-xl overflow-hidden border-slate-200 shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Campaign Strategy</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Vector</th>
                    <th className="px-6 py-4 text-right">Spend</th>
                    <th className="px-6 py-4 text-right">Leads</th>
                    <th className="px-6 py-4 text-right">Oppts</th>
                    <th className="px-6 py-4 text-right">CPA/CAC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.length === 0 ? (
                    <tr>
                       <td colSpan={7} className="text-center py-10 text-slate-500 text-xs tracking-wide">No campaigns registered. Initialize your macro distribution strategy.</td>
                    </tr>
                  ) : (
                    campaigns.map(camp => {
                       const cac = camp.clientsConverted && camp.clientsConverted > 0 ? camp.budgetSent / camp.clientsConverted : 0;
                       const typeColors: Record<string, string> = {
                         'newsletter': 'bg-blue-50 text-blue-700',
                         'webinar': 'bg-purple-50 text-purple-700',
                         'social': 'bg-pink-50 text-pink-700',
                         'print': 'bg-slate-100 text-slate-700'
                       };
                       
                       return (
                        <tr key={camp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 font-semibold text-slate-800 flex items-center gap-3">
                             <Mail className="h-4 w-4 text-slate-400" />
                             {camp.name}
                          </td>
                          <td className="px-6 py-3">
                             <Badge variant="outline" className="uppercase text-[9px] tracking-wider font-bold">
                               {camp.status}
                             </Badge>
                          </td>
                          <td className="px-6 py-3">
                             <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${typeColors[camp.type] || 'bg-slate-100'}`}>
                               {camp.type}
                             </span>
                          </td>
                          <td className="px-6 py-3 text-right font-medium text-slate-700 cursor-help" title={`Allocated: ${formatUsd(camp.budgetAllocated)}`}>
                            {formatUsd(camp.budgetSent)}
                          </td>
                          <td className="px-6 py-3 text-right font-semibold text-slate-800">{camp.actualLeadsGenerated}</td>
                          <td className="px-6 py-3 text-right font-semibold text-emerald-700">{camp.opportunitiesGenerated || 0}</td>
                          <td className="px-6 py-3 text-right">
                             <span className="font-bold text-slate-800">{formatUsd(cac)}</span>
                          </td>
                        </tr>
                       )
                    })
                  )}
                </tbody>
              </table>
            </div>
         </Card>
      )}

      {activeTab === 'events' && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.length === 0 ? (
               <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                  <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-700">No Events Scheduled</h3>
                  <p className="text-sm text-slate-500 mt-1">Plan your next private dining or capital raising presentation here.</p>
               </div>
            ) : (
               events.map(event => (
                 <Card key={event.id} className="rounded-xl border-slate-200 shadow-sm hover:shadow transition-shadow bg-white">
                   <CardHeader className="p-5 pb-3">
                     <div className="flex justify-between items-start">
                       <CardTitle className="text-sm font-bold text-slate-800 leading-tight">{event.title}</CardTitle>
                       <Badge variant="secondary" className="uppercase tracking-wide text-[9px] bg-slate-100 text-slate-600">
                         {event.status.replace('_', ' ')}
                       </Badge>
                     </div>
                     <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 font-medium">
                        <Calendar className="h-3 w-3" />
                        {new Date(event.eventDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                     </p>
                   </CardHeader>
                   <CardContent className="p-5 pt-0">
                     <div className="grid grid-cols-2 gap-4 mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Registered</span>
                           <span className="font-black text-slate-800">{event.registeredCount} / {event.maxCapacity}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cost</span>
                           <span className="font-bold text-slate-800">{formatUsd(event.actualCost)}</span>
                        </div>
                     </div>
                     <div className="mt-5 flex justify-end">
                       <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 text-xs font-semibold h-8 rounded">
                         Manage <ArrowRight className="h-3 w-3 ml-2" />
                       </Button>
                     </div>
                   </CardContent>
                 </Card>
               ))
            )}
         </div>
      )}

    </div>
  );
}

function TabButton({ active, children, onClick, icon }: any) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 flex items-center gap-2 font-semibold text-xs transition-all rounded-md tracking-wide
        ${active 
          ? 'bg-white text-slate-800 shadow-sm border border-slate-200/60' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 border border-transparent'}
      `}
    >
      {icon}
      {children}
    </button>
  );
}
