'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getOpportunities, getPipelineStages, updateOpportunityStage, OpportunityRecord, PipelineStage } from '@/lib/salesService';
import { getTenantPricingPlans, type TenantPricingSettings, type PricingPlan } from '@/lib/pricingService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatUsd } from '@/lib/subscriptionService';
import { DollarSign, LineChart, Target, Users, Plus, ArrowRight, X, Settings } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';
import { useTheme } from 'next-themes';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';
import { OpportunitySlideOver } from '@/components/OpportunitySlideOver';
import { toast } from 'sonner';

interface NewOpportunityForm {
  title: string;
  type: string;
  expectedAum: number;
  expectedRevenue: number;
  probability: number;
  autoCalculate: boolean;
}

export default function SalesModulePage() {
  const { tenant } = useAuth();
  const { theme } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'board' | 'forecast' | 'list'>('board');
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantPricing, setTenantPricing] = useState<TenantPricingSettings | null>(null);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<OpportunityRecord | null>(null);
  
  const [formData, setFormData] = useState<NewOpportunityForm>({
    title: '',
    type: 'referral',
    expectedAum: 0,
    expectedRevenue: 0,
    probability: 25,
    autoCalculate: true,
  });

  const { t } = useTranslation();

  async function load() {
    try {
      const loadedStages = await getPipelineStages(tenant!.id);
      const loadedOpps = await getOpportunities(tenant!.id);
      const config = await getTenantPricingSettings(tenant!.id);
      
      setStages(loadedStages);
      setOpportunities(loadedOpps);
      setTenantPricing(config);
      
      // Update selectedOpp if open
      if (selectedOpp) {
        const updated = loadedOpps.find(o => o.id === selectedOpp.id);
        if (updated) setSelectedOpp(updated);
      }
    } catch (err) {
      console.error('Failed to load sales data', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!tenant?.id) return;
    load();
  }, [tenant]);

  // Helper function
  const calculateExpectedRevenue = (aum: number, pricingModels: TenantPricingSettings | null) => {
     if (!pricingModels || pricingModels.plans.length === 0) return aum * 0.0050; // default 50 bps
     const plan = pricingModels.plans.find(p => p.isDefault) || pricingModels.plans[0];
     let rev = 0;
     for (const t of plan.aumTiers) {
        if (aum > t.minAum) {
           const bracketMax = t.maxAum ? Math.min(aum, t.maxAum) : aum;
           const bracketAmt = bracketMax - t.minAum;
           rev += bracketAmt * (t.bpsRate / 10000);
        }
     }
     return rev > 0 ? rev : aum * 0.0050;
  };

  // Dynamic Revenue Calc
  useEffect(() => {
    if (formData.autoCalculate && formData.expectedAum > 0) {
      setFormData(prev => ({ ...prev, expectedRevenue: calculateExpectedRevenue(prev.expectedAum, tenantPricing) }));
    }
  }, [formData.expectedAum, formData.autoCalculate, tenantPricing]);

  const handleCreate = async () => {
    if (!tenant?.id || !formData.title) return;
    try {
      setLoading(true);
      await import('@/lib/salesService').then(m => m.createOpportunity(tenant.id, {
        tenantId: tenant.id,
        title: formData.title,
        stageId: stages[0]?.id || 'stg_1',
        stageName: stages[0]?.name || 'New Lead',
        probability: formData.probability,
        expectedAum: formData.expectedAum,
        expectedRevenue: formData.expectedRevenue,
        currency: 'USD',
        metadata: { opportunityType: formData.type }
      }));
      setIsModalOpen(false);
      setFormData({ title: '', type: 'referral', expectedAum: 0, expectedRevenue: 0, probability: 25, autoCalculate: true });
      await load();
      toast.success('Opportunity created successfully.');
    } catch (e) {
      console.error(e);
      setLoading(false);
      toast.error('Failed to create opportunity.');
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStage: PipelineStage) => {
    e.preventDefault();
    if (!tenant?.id) return;
    
    const oppId = e.dataTransfer.getData('oppId');
    if (!oppId) return;

    // Optimistic UI Update
    setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, stageId: targetStage.id, stageName: targetStage.name, probability: targetStage.probability } : o));

    try {
      await updateOpportunityStage(tenant.id, oppId, targetStage);
      toast.success(`Moved to ${targetStage.name}`);
      await load();
    } catch (err) {
      console.error(err);
      toast.error('Failed to move opportunity.');
      await load(); // Revert
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // allow drop
  };

  if (loading && opportunities.length === 0) {
    return <div className="p-8 animate-pulse text-zinc-400">Loading Pipeline Data...</div>;
  }

  // Calculate top line metrics
  const totalPipelineAum = opportunities.reduce((acc, curr) => curr.stageName !== 'Closed Lost' ? acc + curr.expectedAum : acc, 0);
  const weightedRevenue = opportunities.reduce((acc, curr) => acc + (curr.expectedRevenue * (curr.probability / 100)), 0);
  const totalActiveDeals = opportunities.filter(o => o.stageName !== 'Closed Won' && o.stageName !== 'Closed Lost').length;
  
  const wonCount = opportunities.filter(o => o.stageName === 'Closed Won').length;
  const closedCount = opportunities.filter(o => o.stageName === 'Closed Won' || o.stageName === 'Closed Lost').length;
  const winRate = closedCount > 0 ? ((wonCount / closedCount) * 100).toFixed(0) : 0;

  const forecastData = [
    { month: 'Current', aum: opportunities.reduce((acc, o) => acc + (o.probability > 80 ? o.expectedAum : 0), 0) },
    { month: '+1 Month', aum: opportunities.reduce((acc, o) => acc + (o.probability > 60 ? o.expectedAum : 0), 0) * 1.1 },
    { month: '+2 Months', aum: opportunities.reduce((acc, o) => acc + (o.probability > 40 ? o.expectedAum : 0), 0) * 1.25 },
    { month: '+3 Months', aum: opportunities.reduce((acc, o) => acc + (o.probability > 20 ? o.expectedAum : 0), 0) * 1.5 },
    { month: '+6 Months', aum: opportunities.reduce((acc, o) => acc + o.expectedAum, 0) * 1.8 }
  ];

  return (
    <div className="flex-1 space-y-6 h-full flex flex-col font-sans">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t('Deal Origination' as any) || 'Origination'}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Track prospect capital raising, liquidity events, and onboarding opportunities.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => toast.info('Pipeline Pricing Configuration Engine is configured globally via backend for now. Admin config interface coming soon.')}
          >
            <Settings size={16} /> Pipeline Settings
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Opportunity
          </Button>
        </div>
      </div>

      {/* ── TOP METRICS ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Total Pipeline (AUM)" value={formatAum(totalPipelineAum)} icon={<DollarSign className="h-4 w-4 text-zinc-500" />} />
        <MetricCard title="Weighted Forecast (Rev)" value={formatUsd(weightedRevenue)} icon={<LineChart className="h-4 w-4 text-zinc-500" />} />
        <MetricCard title="Active Deals" value={totalActiveDeals.toString()} icon={<Target className="h-4 w-4 text-zinc-500" />} />
        <MetricCard title="Win Rate" value={`${winRate}%`} icon={<Users className="h-4 w-4 text-zinc-500" />} />
      </div>

      {/* ── TABS ── */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-8">
          <TabButton active={activeTab === 'board'} onClick={() => setActiveTab('board')}>Kanban Board</TabButton>
          <TabButton active={activeTab === 'forecast'} onClick={() => setActiveTab('forecast')}>Forecasting</TabButton>
          <TabButton active={activeTab === 'list'} onClick={() => setActiveTab('list')}>List View</TabButton>
        </nav>
      </div>

      {/* ── KANBAN BOARD VIEW ── */}
      {activeTab === 'board' && (
        <div className="flex overflow-x-auto pb-4 gap-4 h-[calc(100vh-260px)] min-h-[500px] items-start snap-x">
          {stages.map((stage) => {
            const oppsInStage = opportunities.filter(o => o.stageId === stage.id);
            const stageValue = oppsInStage.reduce((acc, curr) => acc + curr.expectedAum, 0);

            return (
              <div 
                key={stage.id} 
                className="min-w-[300px] w-[300px] flex-shrink-0 flex flex-col bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] snap-center max-h-full overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
              >
                {/* Premium Header */}
                <div 
                  className="p-3 flex items-center justify-between border-b border-[var(--border-subtle)] relative overflow-hidden bg-[var(--bg-card)]"
                >
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: stage.color || '#6366f1' }} />
                  <div className="flex items-center gap-2 relative z-10 mt-1">
                    <h3 className="font-bold text-[13px] uppercase tracking-wider text-[var(--text-primary)]">{stage.name}</h3>
                    <Badge variant="secondary" className="bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-bold border-0">{oppsInStage.length}</Badge>
                  </div>
                  <span className="text-xs font-bold text-[var(--text-secondary)] relative z-10 mt-1">{formatAum(stageValue)}</span>
                </div>
                
                <div className="p-2 flex-1 overflow-y-auto space-y-2 scrollbar-thin">
                  {oppsInStage.map(opp => (
                    <Card 
                      key={opp.id} 
                      draggable 
                      onDragStart={(e) => e.dataTransfer.setData('oppId', opp.id)}
                      onClick={() => setSelectedOpp(opp)}
                      className="cursor-pointer hover:border-indigo-400 hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-200 border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]"
                    >
                      <CardContent className="p-3 flex flex-col gap-1.5">
                        <div className="flex justify-between items-start">
                           <span className="font-bold text-[13px] text-[var(--text-primary)] leading-tight">{opp.title}</span>
                        </div>
                        <div className="text-lg tracking-tight font-black bg-gradient-to-br from-indigo-600 to-indigo-400 dark:from-indigo-400 dark:to-indigo-300 bg-clip-text text-transparent">
                           {formatAum(opp.expectedAum)}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] mt-2 pt-2 border-t border-[var(--border-subtle)]">
                           <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {opp.primaryContactName || 'No Contact'}</span>
                           <span className="font-semibold px-2 py-0.5 bg-[var(--bg-elevated)] rounded-full text-[var(--text-secondary)]">{opp.probability}% win</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {oppsInStage.length === 0 && (
                    <div className="h-20 border-2 border-dashed border-[var(--border-subtle)] rounded-xl flex items-center justify-center text-xs text-[var(--text-tertiary)] font-medium">
                       Drop items here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── FORECAST VIEW ── */}
      {activeTab === 'forecast' && (
        <Card className="flex flex-col items-center justify-center h-[600px] w-full p-6">
           <div className="w-full h-full flex flex-col">
              <div className="mb-6">
                 <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">Pipeline Alpha Forecast</h3>
                 <p className="text-sm text-zinc-500">Projected Expected AUM over the next 6 months based on probability-weighted pipeline opportunities.</p>
              </div>
              <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={forecastData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                       <defs>
                          <linearGradient id="colorAum" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                             <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} />
                       <XAxis dataKey="month" stroke={theme === 'dark' ? '#71717a' : '#a1a1aa'} fontSize={12} tickLine={false} axisLine={false} />
                       <YAxis stroke={theme === 'dark' ? '#71717a' : '#a1a1aa'} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value / 1000000).toFixed(0)}M`} />
                       <RechartsTooltip 
                          contentStyle={{ backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff', borderColor: theme === 'dark' ? '#27272a' : '#e4e4e7', borderRadius: '8px' }}
                          formatter={(value: any) => [formatAum(value), 'Expected AUM']}
                       />
                       <Area type="monotone" dataKey="aum" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAum)" />
                     </AreaChart>
                  </ResponsiveContainer>
              </div>
           </div>
        </Card>
      )}

      {/* ── LIST VIEW ── */}
      {activeTab === 'list' && (
        <Card className="h-[600px] overflow-auto">
           <table className="w-full text-sm text-left">
             <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase font-semibold text-zinc-500">
               <tr>
                 <th className="px-6 py-4">Opportunity</th>
                 <th className="px-6 py-4">Stage</th>
                 <th className="px-6 py-4">AUM ($)</th>
                 <th className="px-6 py-4">Revenue Rate</th>
                 <th className="px-6 py-4">Contact</th>
               </tr>
             </thead>
             <tbody>
               {opportunities.map(opp => (
                 <tr key={opp.id} onClick={() => setSelectedOpp(opp)} className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition">
                   <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{opp.title}</td>
                   <td className="px-6 py-4"><Badge variant="outline">{opp.stageName}</Badge></td>
                   <td className="px-6 py-4 font-black">{formatAum(opp.expectedAum)}</td>
                   <td className="px-6 py-4 text-indigo-600 dark:text-indigo-400 font-bold">{formatUsd(opp.expectedRevenue)}</td>
                   <td className="px-6 py-4">{opp.primaryContactName || '-'}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </Card>
      )}



      {/* ── NEW OPPORTUNITY MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/50">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Create Opportunity</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Add a new liquidity event, referral, or prospect to the pipeline.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-2 rounded-full border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition">
                 <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-1">
                 <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Opportunity Name / Family</label>
                 <Input className="h-11 bg-white dark:bg-zinc-950" placeholder="e.g. Acme Tech Liquidity Event" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              
              <div className="space-y-1">
                 <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">MFO Opportunity Type</label>
                 <select 
                    className="w-full flex h-11 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                 >
                    <option value="referral">Client Referral / Warm Intro</option>
                    <option value="liquidity_event">Liquidity Event (M&A / IPO)</option>
                    <option value="capital_consolidation">AUM Consolidation (Away from PB)</option>
                    <option value="family_expansion">Family Expansion / Succession Event</option>
                    <option value="corporate_mandate">Corporate Cash Management</option>
                    <option value="direct_prospecting">Direct Prospecting</option>
                 </select>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <div className="space-y-2">
                   <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Expected AUM ($)</label>
                   <Input type="number" className="font-mono bg-white dark:bg-zinc-950" placeholder="50000000" value={formData.expectedAum || ''} onChange={e => setFormData({...formData, expectedAum: parseInt(e.target.value) || 0})} />
                </div>
                <div className="space-y-2 relative">
                   <div className="flex items-center justify-between">
                     <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Expected Rev / YR</label>
                     <label className="text-[10px] text-zinc-400 flex items-center gap-1 cursor-pointer hover:text-indigo-500">
                       <input type="checkbox" checked={formData.autoCalculate} onChange={e => setFormData({...formData, autoCalculate: e.target.checked})} />
                       Auto-Calculate
                     </label>
                   </div>
                   <Input type="number" className="font-mono bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-100" placeholder="250000" disabled={formData.autoCalculate} value={formData.expectedRevenue || ''} onChange={e => setFormData({...formData, expectedRevenue: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              
              <div className="space-y-1">
                 <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Win Probability (%)</label>
                 <Input type="number" min={0} max={100} className="w-full bg-white dark:bg-zinc-950" value={formData.probability || ''} onChange={e => setFormData({...formData, probability: parseInt(e.target.value) || 0})} />
              </div>

            </div>
            <div className="p-5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 rounded-b-xl">
               <Button variant="outline" className="px-6" onClick={() => setIsModalOpen(false)}>Cancel</Button>
               <Button className="px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20" disabled={!formData.title} onClick={handleCreate}>Create Deal</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── OPPORTUNITY SLIDEOVER (ACTIVITY INTEGRATION) ── */}
      {selectedOpp && tenant && (
        <OpportunitySlideOver 
          tenantId={tenant.id} 
          opportunity={selectedOpp} 
          onClose={() => setSelectedOpp(null)} 
          onUpdate={load} 
        />
      )}

    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden relative group">
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"/>
      <CardContent className="p-6 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between whitespace-nowrap">
          <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400 tracking-tight">{title}</p>
          <div className="p-2 bg-slate-50 dark:bg-zinc-900 rounded-full border border-slate-100 dark:border-zinc-800">{icon}</div>
        </div>
        <div className="mt-4">
          <h3 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-zinc-50">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        whitespace-nowrap pb-4 px-1 border-b-[3px] font-bold text-sm transition-all
        ${active 
          ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
          : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300'}
      `}
    >
      {children}
    </button>
  );
}

function formatAum(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
  return `$${usd.toLocaleString()}`;
}
