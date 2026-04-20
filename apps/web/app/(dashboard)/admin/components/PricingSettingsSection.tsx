'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { PricingTier, getTenantPricingConfig, saveTenantPricingConfig, DEFAULT_AUM_PRICING_CONFIG } from '@/lib/pricingService';
import { Plus, Save, Trash2, ArrowRight, RotateCcw } from 'lucide-react';

export function PricingSettingsSection() {
  const { tenant } = useAuth();
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    setLoading(true);
    getTenantPricingConfig(tenant.id)
      .then(config => setTiers(config))
      .catch(err => {
        console.error('Failed to load pricing config', err);
        setMsg({ text: 'Error loading pricing tiers.', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    setMsg(null);
    try {
      // Small validation: sort by minAum before saving
      const sorted = [...tiers].sort((a, b) => a.minAum - b.minAum);
      await saveTenantPricingConfig(tenant.id, sorted);
      setTiers(sorted);
      setMsg({ text: 'Pricing configuration saved successfully.', type: 'success' });
    } catch (err: any) {
      setMsg({ text: 'Failed to save configuration: ' + err.message, type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const handleAddGridRow = () => {
    const newTier: PricingTier = {
      id: `tier_${Date.now()}`,
      minAum: 0,
      maxAum: 1000000,
      bpsRate: 50,
      label: 'New Tier'
    };
    setTiers([...tiers, newTier]);
  };

  const handleRemoveTier = (id: string) => {
    setTiers(tiers.filter(t => t.id !== id));
  };

  const handleChange = (id: string, field: keyof PricingTier, value: any) => {
    setTiers(tiers.map(t => {
      if (t.id === id) {
        return { ...t, [field]: value };
      }
      return t;
    }));
  };

  const handleRestoreDefaults = () => {
    if (confirm('Are you sure you want to restore the default platform pricing? All your custom tiers will be lost.')) {
      setTiers([...DEFAULT_AUM_PRICING_CONFIG]);
    }
  };

  if (loading) return <div className="text-sm text-[var(--text-secondary)]">Loading pricing configuration...</div>;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">AUM Fee Tiers</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Configure pricing based on Assets Under Management. Used globally for expected revenue calculation.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleRestoreDefaults}
            className="inline-flex items-center gap-2 justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none bg-[var(--bg-elevated)] text-[var(--text-secondary)] shadow-sm hover:bg-[var(--bg-canvas)] border border-[var(--border)] h-9 px-4 py-2"
          >
            <RotateCcw className="w-4 h-4" />
            Restore Defaults
          </button>
          <button 
            onClick={handleAddGridRow}
            className="inline-flex items-center gap-2 justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none bg-[var(--bg-elevated)] text-[var(--brand-500)] shadow-sm hover:bg-[var(--bg-canvas)] border border-[var(--border)] h-9 px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            Add Tier
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="col-span-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Label</div>
          <div className="col-span-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Min AUM ($)</div>
          <div className="col-span-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Max AUM ($)</div>
          <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">BPS Rate</div>
          <div className="col-span-1 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] text-right">Actions</div>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {tiers.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-tertiary)] italic text-sm">
              No pricing tiers configured. Add one above.
            </div>
          ) : (
            tiers.map((tier, index) => (
              <div key={tier.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center bg-transparent transition-colors hover:bg-[var(--bg-surface)]">
                <div className="col-span-3">
                  <input 
                    type="text" 
                    className="flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] text-[var(--text-primary)]" 
                    value={tier.label}
                    onChange={(e) => handleChange(tier.id, 'label', e.target.value)}
                    placeholder="e.g. Under $10M"
                  />
                </div>
                <div className="col-span-3 relative">
                  <span className="absolute left-3 top-2 text-[var(--text-tertiary)]">$</span>
                  <input 
                    type="number" 
                    className="flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] pl-7 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] text-[var(--text-primary)]" 
                    value={tier.minAum}
                    onChange={(e) => handleChange(tier.id, 'minAum', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-3 relative">
                  <span className="absolute left-3 top-2 text-[var(--text-tertiary)]">$</span>
                  <input 
                    type="number" 
                    className="flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] pl-7 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] text-[var(--text-primary)]" 
                    value={tier.maxAum === null ? '' : tier.maxAum}
                    onChange={(e) => handleChange(tier.id, 'maxAum', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="Infinity"
                  />
                </div>
                <div className="col-span-2 relative">
                  <input 
                    type="number" 
                    className="flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-500)] text-[var(--text-primary)] pr-10" 
                    value={tier.bpsRate}
                    onChange={(e) => handleChange(tier.id, 'bpsRate', Number(e.target.value))}
                  />
                  <span className="absolute right-3 top-2 text-[var(--text-tertiary)] font-mono text-xs">bps</span>
                </div>
                <div className="col-span-1 text-right">
                  <button 
                    onClick={() => handleRemoveTier(tier.id)}
                    className="text-[var(--text-tertiary)] hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="text-xs text-[var(--text-tertiary)] flex items-center gap-2">
          <span>💡 1 basis point (bps) = 0.01%</span>
          <ArrowRight className="w-3 h-3" />
          <span>A $10,000,000 portfolio @ 50bps = $50,000 / yr</span>
        </div>
        
        <div className="flex items-center gap-4">
          {msg && (
            <span className={`text-sm font-medium ${msg.type === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>
              {msg.text}
            </span>
          )}
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="inline-flex items-center gap-2 justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-6 py-2"
          >
            {saving ? (
              'Saving...'
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Tiers Config
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
