'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { 
  PricingTier, 
  PricingPlan,
  TenantPricingSettings,
  getTenantPricingPlans,
  saveTenantPricingPlans,
  DEFAULT_PRICING_PLAN
} from '@/lib/pricingService';
import { Plus, Save, Trash2, ArrowRight, RotateCcw, Settings2, CheckCircle2, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function PricingConfigurationPage() {
  const { tenant } = useAuth();
  const [settings, setSettings] = useState<TenantPricingSettings>({ plans: [] });
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    getTenantPricingPlans(tenant.id)
      .then(s => {
        setSettings(s);
        if (s.plans.length > 0) setActivePlanId(s.plans[0].id);
      })
      .catch(err => {
        toast.error('Failed to load pricing models.');
      })
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  const activePlan = settings.plans.find(p => p.id === activePlanId) || null;

  const updateSettings = (newSettings: TenantPricingSettings) => {
    setSettings(newSettings);
  };

  const updateActivePlan = (updates: Partial<PricingPlan>) => {
    if (!activePlanId) return;
    updateSettings({
      plans: settings.plans.map(p => 
        p.id === activePlanId ? { ...p, ...updates } : p
      )
    });
  };

  const handleSaveAll = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      // Small validation: sort aum tiers on all plans
      const payload: TenantPricingSettings = {
        plans: settings.plans.map(p => ({
          ...p,
          aumTiers: [...p.aumTiers].sort((a, b) => a.minAum - b.minAum)
        }))
      };

      await saveTenantPricingPlans(tenant.id, payload);
      setSettings(payload);
      toast.success('Pricing plans saved successfully.');
    } catch (err: any) {
      toast.error('Failed to save configuration: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePlan = () => {
    const newPlan: PricingPlan = {
      ...DEFAULT_PRICING_PLAN,
      id: `plan_${crypto.randomUUID()}`,
      name: `Custom Pricing Model ${settings.plans.length + 1}`,
      isDefault: settings.plans.length === 0
    };
    updateSettings({ plans: [...settings.plans, newPlan] });
    setActivePlanId(newPlan.id);
  };

  const handleDeletePlan = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (settings.plans.length === 1) {
       toast.error("You must have at least one pricing plan.");
       return;
    }
    const newPlans = settings.plans.filter(p => p.id !== id);
    // If we deleted the active plan, select another one
    if (activePlanId === id) {
       setActivePlanId(newPlans[0].id);
    }
    // If the deleted one was default, make the first one default
    if (settings.plans.find(p => p.id === id)?.isDefault) {
       newPlans[0].isDefault = true;
    }
    updateSettings({ plans: newPlans });
  };

  const handleSetDefault = (id: string) => {
    updateSettings({
      plans: settings.plans.map(p => ({ ...p, isDefault: p.id === id }))
    });
  };

  const handleAddGridRow = () => {
    if (!activePlan) return;
    const newTier: PricingTier = {
      id: `tier_${crypto.randomUUID()}`,
      minAum: 0,
      maxAum: null,
      bpsRate: 50,
      label: 'New Tier'
    };
    updateActivePlan({ aumTiers: [...activePlan.aumTiers, newTier] });
  };

  const handleRemoveTier = (id: string) => {
    if (!activePlan) return;
    updateActivePlan({ aumTiers: activePlan.aumTiers.filter(t => t.id !== id) });
  };

  const handleChangeTier = (id: string, field: keyof PricingTier, value: any) => {
    if (!activePlan) return;
    updateActivePlan({
      aumTiers: activePlan.aumTiers.map(t => {
        if (t.id === id) {
          if (field === 'bpsRate') {
            const asBps = Number(value) * 100;
            return { ...t, bpsRate: asBps };
          }
          return { ...t, [field]: value };
        }
        return t;
      })
    });
  };

  if (loading) {
    return (
      <div className="p-8 pt-20 flex justify-center w-full h-full">
        <div className="text-sm text-[var(--text-secondary)]">Loading pricing configuration...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-[var(--bg-canvas)]">
      {/* HEADER */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0">
         <div>
             <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Pricing Configuration</h1>
             <p className="text-[var(--text-secondary)] text-sm mt-1">Manage multiple fee structures globally and assign named models to specific Family Groups.</p>
         </div>
         <Button onClick={handleSaveAll} disabled={saving} className="h-10 px-8 font-bold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] shadow-sm">
             {saving ? 'Saving...' : <><Save size={16} className="mr-2"/> Commit All Plans</>}
         </Button>
      </div>

      {/* BODY SPLIT */}
      <div className="flex flex-1 overflow-hidden">
         {/* SIDEBAR: Plan List */}
         <div className="w-[300px] shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col h-full overflow-y-auto">
            <div className="p-4 border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-surface)] z-10 flex justify-between items-center box-border">
               <span className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">Pricing Models</span>
               <Button variant="ghost" size="sm" onClick={handleCreatePlan} title="Add New Model" className="h-8 w-8 p-0 text-[var(--brand-primary)] hover:bg-[var(--brand-faint)]">
                   <Plus size={16}/>
               </Button>
            </div>
            <div className="flex flex-col p-3 gap-2">
               {settings.plans.map(plan => (
                 <div 
                   key={plan.id}
                   onClick={() => setActivePlanId(plan.id)}
                   className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition-all ${
                     activePlanId === plan.id 
                       ? 'border-[var(--brand-primary)] bg-[var(--brand-faint)] shadow-sm' 
                       : 'border-transparent hover:bg-[var(--bg-canvas)]'
                   }`}
                 >
                    <div className="flex flex-col overflow-hidden mr-2">
                       <span className="text-[13px] font-bold text-[var(--text-primary)] truncate">{plan.name}</span>
                       {plan.isDefault && <span className="text-[10px] text-[var(--color-green)] font-bold uppercase mt-0.5 w-max px-1 bg-emerald-50 rounded">Global Default</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 data-[active=true]:opacity-100" data-active={activePlanId === plan.id}>
                       <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-white text-red-500 rounded" onClick={(e) => handleDeletePlan(plan.id, e)}><Trash2 size={12}/></Button>
                       <ChevronRight size={14} className="text-[var(--text-tertiary)]"/>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* MAIN: Active Plan Detail */}
         <div className="flex-1 flex justify-center bg-[var(--bg-canvas)] overflow-y-auto px-6 py-8 custom-scrollbar">
            {activePlan ? (
               <div className="w-full max-w-4xl flex flex-col gap-8 animate-fade-in pb-16">
                  
                  {/* Plan Top Meta */}
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 shadow-sm flex flex-col gap-4">
                     <div className="flex justify-between items-start">
                        <div className="flex-1 mr-8">
                           <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">Model Name Identifier</label>
                           <input 
                              type="text" 
                              value={activePlan.name} 
                              onChange={e => updateActivePlan({ name: e.target.value })}
                              className="text-xl font-bold bg-transparent border-b border-dashed border-[var(--border-strong)] focus:border-[var(--brand-primary)] outline-none py-1 w-full text-[var(--text-primary)] transition-colors"
                              placeholder="e.g. Standard MFO Family"
                           />
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                           <Button 
                              variant={activePlan.isDefault ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => handleSetDefault(activePlan.id)}
                              className={activePlan.isDefault ? "bg-emerald-50 border-emerald-200 text-emerald-800" : ""}
                           >
                              {activePlan.isDefault ? <><CheckCircle2 size={14} className="mr-2"/> Is Default</> : 'Set as default'}
                           </Button>
                        </div>
                     </div>
                  </div>

                  {/* ─── AUM FEE TIERS ─── */}
                  <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm p-6 relative">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">AUM Fee Tiers (Cascade)</h3>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">Configure pricing brackets based on aggregate family wealth (Assets Under Management).</p>
                      </div>
                    </div>
                    
                    <div className="border border-[var(--border)] rounded-lg overflow-hidden mt-4">
                      <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
                        <div className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Label</div>
                        <div className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Min AUM ($)</div>
                        <div className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Max AUM ($)</div>
                        <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] text-right pr-2">Fee (% a.a.)</div>
                        <div className="col-span-1"></div>
                      </div>

                      <div className="divide-y divide-[var(--border)]">
                        {activePlan.aumTiers.length === 0 ? (
                          <div className="p-8 text-center text-[var(--text-tertiary)] italic text-sm">No pricing tiers configured. Add one below.</div>
                        ) : (
                          activePlan.aumTiers.map((tier) => {
                            const pctAa = tier.bpsRate / 100;
                            return (
                              <div key={tier.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center bg-[var(--bg-canvas)] transition-colors hover:bg-[var(--bg-surface)]">
                                <div className="col-span-3">
                                  <input 
                                    type="text" 
                                    className="h-8 w-full rounded border border-[var(--border)] bg-transparent px-2 text-xs font-semibold focus:outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)] transition text-[var(--text-primary)]" 
                                    value={tier.label}
                                    onChange={(e) => handleChangeTier(tier.id, 'label', e.target.value)}
                                  />
                                </div>
                                <div className="col-span-3 relative">
                                  <span className="absolute left-2 top-2text-xs text-[var(--text-tertiary)] pt-0.5">$</span>
                                  <input 
                                    type="number" 
                                    className="h-8 w-full rounded border border-[var(--border)] bg-transparent pl-6 pr-2 text-xs focus:outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)] transition text-[var(--text-primary)]" 
                                    value={tier.minAum}
                                    onChange={(e) => handleChangeTier(tier.id, 'minAum', Number(e.target.value))}
                                  />
                                </div>
                                <div className="col-span-3 relative">
                                  <span className="absolute left-2 top-2 text-xs text-[var(--text-tertiary)] pt-0.5">$</span>
                                  <input 
                                    type="number" 
                                    className="h-8 w-full rounded border border-[var(--border)] bg-transparent pl-6 pr-2 text-xs focus:outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)] transition text-[var(--text-primary)]" 
                                    value={tier.maxAum === null ? '' : tier.maxAum}
                                    onChange={(e) => handleChangeTier(tier.id, 'maxAum', e.target.value === '' ? null : Number(e.target.value))}
                                    placeholder="∞ Unlimited"
                                  />
                                </div>
                                <div className="col-span-2 relative flex justify-end">
                                  <input 
                                    type="number" 
                                    step="0.001"
                                    className="h-8 w-full max-w-[80px] text-right rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 focus:outline-none font-mono text-xs focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)] transition text-[var(--text-primary)] pr-6 bg-amber-50 dark:bg-amber-950/20" 
                                    value={pctAa}
                                    onChange={(e) => handleChangeTier(tier.id, 'bpsRate', e.target.value)}
                                  />
                                  <span className="absolute right-2 top-2 text-xs text-[var(--text-tertiary)] pt-0.5">%</span>
                                </div>
                                <div className="col-span-1 flex justify-end">
                                  <button onClick={() => handleRemoveTier(tier.id)} className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50"><Trash2 size={12} /></button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="px-4 py-3 bg-[var(--bg-surface)] border-t border-[var(--border)] flex justify-end">
                        <Button variant="secondary" size="sm" onClick={handleAddGridRow}><Plus size={14} className="mr-2"/> Add Tier Range</Button>
                      </div>
                    </div>
                  </div>

                  {/* ─── PERFORMANCE FEE ─── */}
                  <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm p-6">
                    <div className="flex items-center justify-between mb-2">
                       <div>
                         <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                           Success / Performance Fee 
                           {activePlan.performanceFee.enabled && <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide">Active</span>}
                         </h3>
                         <p className="text-sm text-[var(--text-secondary)] mt-1">Configure success fees charged on alpha generated above a specified benchmark trajectory.</p>
                       </div>
                       <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={activePlan.performanceFee.enabled}
                            onChange={(e) => updateActivePlan({ performanceFee: { ...activePlan.performanceFee, enabled: e.target.checked } })}
                          />
                          <div className="w-10 h-5 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--brand-500)]"></div>
                       </label>
                    </div>

                    {activePlan.performanceFee.enabled && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 animate-fade-in border-t border-[var(--border-subtle)] pt-6">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Fee Percentage</label>
                            <div className="relative">
                              <input 
                                type="number" step="0.01"
                                className="h-9 w-full rounded border border-[var(--border)] bg-[var(--bg-canvas)] px-3 text-sm focus:outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)] pr-8 text-[var(--text-primary)]"
                                value={activePlan.performanceFee.ratePct}
                                onChange={(e) => updateActivePlan({ performanceFee: { ...activePlan.performanceFee, ratePct: Number(e.target.value) } })}
                              />
                              <span className="absolute right-3 top-2 text-[var(--text-tertiary)] font-mono text-sm">%</span>
                            </div>
                            <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5 leading-tight">E.g., 20% applied to extraordinary profits (alpha) over the benchmark.</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Alpha Benchmark</label>
                            <input 
                              type="text" 
                              className="h-9 w-full rounded border border-[var(--border)] bg-[var(--bg-canvas)] px-3 text-sm focus:outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)] text-[var(--text-primary)]"
                              value={activePlan.performanceFee.benchmark}
                              onChange={(e) => updateActivePlan({ performanceFee: { ...activePlan.performanceFee, benchmark: e.target.value } })}
                              placeholder="e.g., S&P 500, IPCA+6%"
                            />
                            <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5 leading-tight">Free-text reference index target</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Hurdle Rate Minimum</label>
                            <div className="relative">
                              <input 
                                type="number" step="0.1"
                                className="h-9 w-full rounded border border-[var(--border)] bg-[var(--bg-canvas)] px-3 text-sm focus:outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)] pr-8 text-[var(--text-primary)]"
                                value={activePlan.performanceFee.hurdleRatePct}
                                onChange={(e) => updateActivePlan({ performanceFee: { ...activePlan.performanceFee, hurdleRatePct: Number(e.target.value) } })}
                              />
                              <span className="absolute right-3 top-2 text-[var(--text-tertiary)] font-mono text-sm">%</span>
                            </div>
                            <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5 leading-tight">Minimum absolute return trigger before fee calculation begins.</p>
                          </div>
                          <div className="flex flex-col justify-end pb-2">
                            <label className="flex items-center gap-3 cursor-pointer p-2.5 border border-[var(--border)] bg-[var(--bg-surface)] rounded-md hover:border-[var(--brand-primary)] transition-colors">
                               <input 
                                 type="checkbox" 
                                 className="w-4 h-4 text-[var(--brand-500)] border-[var(--border)] rounded focus:ring-[var(--brand-500)]"
                                 checked={activePlan.performanceFee.highWaterMark}
                                 onChange={(e) => updateActivePlan({ performanceFee: { ...activePlan.performanceFee, highWaterMark: e.target.checked } })}
                               />
                               <div className="flex-1 overflow-hidden">
                                 <div className="text-sm font-semibold text-[var(--text-primary)] truncate">High Water Mark (HWM)</div>
                                 <div className="text-[10px] text-[var(--text-secondary)]">Charge only on peak net value (no double dipping).</div>
                               </div>
                            </label>
                          </div>
                       </div>
                    )}
                  </div>

                  {/* ─── FIXED FEE ─── */}
                  <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm p-6">
                    <div className="flex items-center justify-between mb-2">
                       <div>
                         <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">Fixed Fee / Base Retainer</h3>
                       </div>
                       <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={activePlan.fixedFee.enabled}
                            onChange={(e) => updateActivePlan({ fixedFee: { ...activePlan.fixedFee, enabled: e.target.checked } })}
                          />
                          <div className="w-10 h-5 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border)] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--brand-500)]"></div>
                       </label>
                    </div>

                    {activePlan.fixedFee.enabled && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 animate-fade-in border-t border-[var(--border-subtle)] pt-6">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">Annual Dollar Amount</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-[var(--text-tertiary)] font-mono text-sm pt-0.5">$</span>
                              <input 
                                type="number" 
                                className="h-9 w-full rounded border border-[var(--border)] bg-[var(--bg-canvas)] pl-8 pr-3 text-sm focus:outline-none focus:border-[var(--brand-500)] focus:ring-1 focus:ring-[var(--brand-500)] text-[var(--text-primary)] bg-emerald-50 dark:bg-emerald-950/20"
                                value={activePlan.fixedFee.annualAmount}
                                onChange={(e) => updateActivePlan({ fixedFee: { ...activePlan.fixedFee, annualAmount: Number(e.target.value) } })}
                              />
                            </div>
                            <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5 leading-tight">This value acts as the absolute minimum retainer if AUM falls below the zero-floor.</p>
                          </div>
                       </div>
                    )}
                  </div>
               </div>
            ) : (
               <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                     <FileText size={48} className="mx-auto text-[var(--border-strong)] mb-4"/>
                     <h3 className="text-lg font-bold text-[var(--text-primary)]">No Plan Selected</h3>
                     <p className="text-sm text-[var(--text-secondary)] mt-2">Create or select a pricing model from the sidebar to configure it.</p>
                  </div>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
