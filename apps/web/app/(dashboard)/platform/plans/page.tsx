'use client';

/**
 * /platform/plans — Plan Management
 * Full CRUD for subscription plan definitions.
 * Product-manager facing — separate from Tenant Management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  getPlans, upsertPlan, archivePlan, getPlanVersions, seedDefaultPlansIfEmpty,
  formatPrice, annualSavingsPct,
  type PlanDefinition, type PlanVersion, type PlanStatus,
} from '@/lib/planService';
import { ConfirmDialog, type ConfirmOptions } from '@/components/ConfirmDialog';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<PlanStatus, { fg: string; bg: string }> = {
  active:   { fg: '#22c55e', bg: '#22c55e15' },
  legacy:   { fg: '#f59e0b', bg: '#f59e0b15' },
  archived: { fg: '#64748b', bg: '#64748b15' },
};

function Chip({ label, status }: { label: string; status: PlanStatus }) {
  const c = STATUS_COLOR[status];
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: c.bg, color: c.fg, textTransform: 'capitalize' }}>{label}</span>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{children}</div>;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button onClick={() => onChange(!on)} style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: on ? 'var(--brand-500)' : 'var(--bg-overlay)',
        boxShadow: 'inset 0 0 0 1px var(--border)', position: 'relative', transition: 'background 0.2s',
      }}>
        <div style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
      </button>
      {label && <span style={{ fontSize: 13 }}>{label}</span>}
    </div>
  );
}

// ─── Plan Editor Modal ────────────────────────────────────────────────────────

const EMPTY_PLAN: PlanDefinition = {
  code: '', name: '', description: '', icon: '📦', color: '#6366f1', sortOrder: 99,
  baseMonthly: 0, baseAnnual: 0, pricePerSeat: 0, pricePerSeatAnnual: 0, aumFeeBps: 0,
  maxSeats: 10, maxAumUsd: 100_000_000, trialDays: 0,
  features: [''], addOns: [''],
  publishedToWeb: false, status: 'active',
  version: 0, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', changeNote: '',
};

function PlanEditorModal({ plan, isNew, onClose, onSave }: {
  plan: PlanDefinition;
  isNew: boolean;
  onClose: () => void;
  onSave: (p: PlanDefinition, note: string) => Promise<void>;
}) {
  const [form, setForm]           = useState<PlanDefinition>({ ...plan });
  const [changeNote, setChangeNote] = useState('');
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState<string | null>(null);
  const [tab, setTab]             = useState<'basic' | 'pricing' | 'limits' | 'features'>('basic');

  function f(key: keyof PlanDefinition) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
      setForm(p => ({ ...p, [key]: val }));
    };
  }

  function updateList(key: 'features' | 'addOns', idx: number, val: string) {
    setForm(p => ({ ...p, [key]: p[key].map((v, i) => i === idx ? val : v) }));
  }
  function addItem(key: 'features' | 'addOns') {
    setForm(p => ({ ...p, [key]: [...p[key], ''] }));
  }
  function removeItem(key: 'features' | 'addOns', idx: number) {
    setForm(p => ({ ...p, [key]: p[key].filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) { setErr('Code and name are required.'); return; }
    if (!changeNote.trim()) { setErr('Please add a change note describing what changed.'); return; }
    setLoading(true); setErr(null);
    try {
      await onSave({ ...form, features: form.features.filter(Boolean), addOns: form.addOns.filter(Boolean) }, changeNote);
    } catch (e: any) { setErr(e.message); setLoading(false); }
  }

  const TABS = [
    { id: 'basic',    label: '📋 Basic' },
    { id: 'pricing',  label: '💰 Pricing' },
    { id: 'limits',   label: '📏 Limits' },
    { id: 'features', label: '✨ Features' },
  ] as const;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 680, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{isNew ? '➕ New Plan' : `✏️ Edit Plan — ${plan.name}`}</div>
              {!isNew && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>Code: <code>{plan.code}</code> · v{plan.version}</div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-tertiary)' }}>✕</button>
          </div>
          <div style={{ display: 'flex' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)} style={{
                padding: '9px 16px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
                fontWeight: tab === t.id ? 700 : 500,
                borderBottom: `2px solid ${tab === t.id ? 'var(--brand-500)' : 'transparent'}`,
                color: tab === t.id ? 'var(--brand-500)' : 'var(--text-secondary)',
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px 28px' }}>
          {/* BASIC */}
          {tab === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <Label>Plan Code *</Label>
                  <input className="input" style={{ width: '100%' }} value={form.code}
                    onChange={f('code')} placeholder="STARTER-2027" disabled={!isNew}
                    title={isNew ? '' : 'Plan code is immutable once created'} />
                  {isNew && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Immutable once saved. Use a versioned slug, e.g. STARTER-2026.</div>}
                </div>
                <div>
                  <Label>Display Name *</Label>
                  <input className="input" style={{ width: '100%' }} value={form.name} onChange={f('name')} placeholder="Starter" />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <input className="input" style={{ width: '100%' }} value={form.description} onChange={f('description')} placeholder="For boutique family offices…" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <Label>Icon (emoji)</Label>
                  <input className="input" style={{ width: '100%', fontSize: 22 }} value={form.icon} onChange={f('icon')} placeholder="⭐" />
                </div>
                <div>
                  <Label>Brand Color (hex)</Label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                      style={{ width: 40, height: 36, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
                    <input className="input" style={{ flex: 1 }} value={form.color} onChange={f('color')} />
                  </div>
                </div>
                <div>
                  <Label>Sort Order</Label>
                  <input type="number" className="input" style={{ width: '100%' }} value={form.sortOrder} onChange={f('sortOrder')} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <Label>Status</Label>
                  <select className="input" style={{ width: '100%' }} value={form.status} onChange={f('status')}>
                    <option value="active">Active</option>
                    <option value="legacy">Legacy (grandfathered)</option>
                    <option value="archived">Archived (hidden)</option>
                  </select>
                </div>
                <div style={{ paddingTop: 22 }}>
                  <Toggle on={form.publishedToWeb} onChange={v => setForm(p => ({ ...p, publishedToWeb: v }))} label="Published to website pricing page" />
                </div>
              </div>
            </div>
          )}

          {/* PRICING */}
          {tab === 'pricing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '12px 16px', background: 'var(--bg-canvas)', borderRadius: 8, fontSize: 13 }}>
                💡 Leave base prices at <strong>0</strong> for Trial or Custom/Enterprise plans.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <Label>Base Monthly (USD)</Label>
                  <input type="number" min={0} className="input" style={{ width: '100%' }} value={form.baseMonthly} onChange={f('baseMonthly')} />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>Platform base fee per month</div>
                </div>
                <div>
                  <Label>Base Annual (USD) — full year</Label>
                  <input type="number" min={0} className="input" style={{ width: '100%' }} value={form.baseAnnual} onChange={f('baseAnnual')} />
                  {form.baseMonthly > 0 && form.baseAnnual > 0 && (
                    <div style={{ fontSize: 11, color: '#22c55e', marginTop: 3 }}>
                      ~{annualSavingsPct({ ...form })}% saving vs monthly
                    </div>
                  )}
                </div>
                <div>
                  <Label>Per Seat / Month (USD)</Label>
                  <input type="number" min={0} className="input" style={{ width: '100%' }} value={form.pricePerSeat} onChange={f('pricePerSeat')} />
                </div>
                <div>
                  <Label>Per Seat / Year (USD)</Label>
                  <input type="number" min={0} className="input" style={{ width: '100%' }} value={form.pricePerSeatAnnual} onChange={f('pricePerSeatAnnual')} />
                </div>
                <div>
                  <Label>AUM Fee (basis points / year)</Label>
                  <input type="number" min={0} className="input" style={{ width: '100%' }} value={form.aumFeeBps} onChange={f('aumFeeBps')} />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>Applied on AUM monthly (annual bps ÷ 12)</div>
                </div>
                <div>
                  <Label>Trial Days</Label>
                  <input type="number" min={0} className="input" style={{ width: '100%' }} value={form.trialDays} onChange={f('trialDays')} />
                </div>
              </div>
              {/* Live preview */}
              <div style={{ padding: '14px 18px', background: `${form.color}12`, border: `1px solid ${form.color}44`, borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>Price preview</div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
                  <span><strong>Monthly:</strong> {formatPrice(form, 'monthly')}/mo base + ${form.pricePerSeat}/seat</span>
                  <span><strong>Annual:</strong> {formatPrice(form, 'annual')}/mo base + ${Math.round(form.pricePerSeatAnnual / 12)}/seat</span>
                  <span><strong>AUM fee:</strong> {form.aumFeeBps} bps/yr</span>
                </div>
              </div>
            </div>
          )}

          {/* LIMITS */}
          {tab === 'limits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <Label>Max Seats (-1 = unlimited)</Label>
                  <input type="number" min={-1} className="input" style={{ width: '100%' }} value={form.maxSeats} onChange={f('maxSeats')} />
                </div>
                <div>
                  <Label>Max AUM USD (-1 = unlimited)</Label>
                  <input type="number" min={-1} className="input" style={{ width: '100%' }} value={form.maxAumUsd} onChange={f('maxAumUsd')} />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                    {form.maxAumUsd === -1 ? 'Unlimited' : `$${(form.maxAumUsd / 1e6).toFixed(0)}M AUM`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FEATURES */}
          {tab === 'features' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Label>Feature bullets (shown on pricing page)</Label>
                  <button className="btn btn-sm btn-secondary" onClick={() => addItem('features')}>+ Add</button>
                </div>
                {form.features.map((feat, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input className="input" style={{ flex: 1 }} value={feat} placeholder="Feature description…"
                      onChange={e => updateList('features', i, e.target.value)} />
                    <button className="btn btn-ghost btn-sm" onClick={() => removeItem('features', i)} style={{ color: '#ef4444' }}>✕</button>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Label>Add-ons (optional extras)</Label>
                  <button className="btn btn-sm btn-secondary" onClick={() => addItem('addOns')}>+ Add</button>
                </div>
                {form.addOns.map((addon, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input className="input" style={{ flex: 1 }} value={addon} placeholder="Add-on name…"
                      onChange={e => updateList('addOns', i, e.target.value)} />
                    <button className="btn btn-ghost btn-sm" onClick={() => removeItem('addOns', i)} style={{ color: '#ef4444' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Change note + save */}
          <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <Label>Change Note * — describe what changed and why</Label>
            <textarea className="input" rows={2} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
              value={changeNote} onChange={e => setChangeNote(e.target.value)}
              placeholder="e.g. Increased per-seat price for new signups per Q2 pricing review" />
            {err && <div style={{ marginTop: 8, fontSize: 13, color: '#ef4444' }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={loading} style={{ flex: 2 }}>
                {loading ? '…' : isNew ? '✅ Create Plan' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Version History Panel ─────────────────────────────────────────────────────

function VersionHistoryPanel({ planCode, onClose }: { planCode: string; onClose: () => void }) {
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    getPlanVersions(planCode).then(v => { setVersions(v); setLoading(false); });
  }, [planCode]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 640, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>📜 Version History — {planCode}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>Immutable snapshots of every plan change</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-tertiary)' }}>✕</button>
        </div>
        <div style={{ padding: '16px 28px 28px' }}>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading…</div>
            : versions.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>No version history found.</div>
            : versions.map(v => (
              <div key={v.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      <span style={{ color: 'var(--brand-500)', marginRight: 8 }}>v{v.version}</span>
                      {v.changeNote}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      {new Date(v.changedAt).toLocaleString()} · by {v.changedBy}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
                    <div>${v.snapshot.baseMonthly}/mo base</div>
                    <div>${v.snapshot.pricePerSeat}/seat/mo</div>
                    <div>{v.snapshot.aumFeeBps}bps AUM</div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Plan Management Page ────────────────────────────────────────────────

export default function PlanManagementPage() {
  const { user } = useAuth();
  const performer = { uid: user?.uid ?? 'unknown', name: user?.name ?? 'Admin' };

  const [plans,   setPlans]   = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanDefinition | null>(null);
  const [isNew,   setIsNew]   = useState(false);
  const [historyCode, setHistoryCode] = useState<string | null>(null);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPlans(await getPlans()); } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSeed() {
    setMsg(null);
    try {
      const seeded = await seedDefaultPlansIfEmpty(performer);
      setMsg(seeded ? '✅ Default plans seeded to Firestore.' : 'ℹ️ Plans already exist — seed skipped.');
      await load();
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
  }

  async function handleSave(plan: PlanDefinition, note: string) {
    await upsertPlan(plan, performer, note);
    setMsg(`✅ Plan "${plan.name}" saved (v${plan.version + 1}).`);
    setEditing(null);
    setIsNew(false);
    await load();
  }

  function handleArchive(plan: PlanDefinition) {
    setConfirmOpts({
      title:        'Archive Plan',
      message:      `Archive plan "${plan.name}"? It will be hidden from new subscriptions but existing subscribers keep their terms.`,
      confirmLabel: 'Archive',
      variant:      'warning',
      onConfirm: async () => {
        await archivePlan(plan.code, performer);
        setMsg(`✅ Plan "${plan.name}" archived.`);
        await load();
      },
      onCancel: () => setConfirmOpts(null),
    });
  }

  function openNew() {
    setEditing({ ...EMPTY_PLAN });
    setIsNew(true);
  }

  const EMPTY_PLAN = {
    code: '', name: '', description: '', icon: '📦', color: '#6366f1', sortOrder: plans.length,
    baseMonthly: 0, baseAnnual: 0, pricePerSeat: 0, pricePerSeatAnnual: 0, aumFeeBps: 0,
    maxSeats: 10, maxAumUsd: 100_000_000, trialDays: 0,
    features: [''], addOns: [''],
    publishedToWeb: false, status: 'active' as const,
    version: 0, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', changeNote: '',
  };

  return (
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">
      {confirmOpts && <ConfirmDialog {...confirmOpts} />}
      {editing && (
        <PlanEditorModal plan={editing} isNew={isNew} onClose={() => { setEditing(null); setIsNew(false); }} onSave={handleSave} />
      )}
      {historyCode && (
        <VersionHistoryPanel planCode={historyCode} onClose={() => setHistoryCode(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-5 border-b border-tremor-border gap-4">
        <div>
          <h1 className="text-3xl font-bold text-tremor-content-strong tracking-tight">Subscription Plans</h1>
            <p className="mt-2 text-tremor-content">Define, version, and publish pricing plans. All changes are versioned for audit and grandfathering.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={handleSeed}>↑ Seed Defaults</button>
          <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
          <button className="btn btn-primary" onClick={openNew}>+ New Plan</button>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: msg.startsWith('✅') ? '#22c55e15' : msg.startsWith('❌') ? '#ef444415' : 'var(--bg-elevated)', borderRadius: 8, fontSize: 13, color: msg.startsWith('✅') ? '#22c55e' : msg.startsWith('❌') ? '#ef4444' : 'var(--text-secondary)' }}>
          {msg}
        </div>
      )}

      {/* Web publish notice */}
      <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span>🌐</span>
        <span>Plans with <strong>Published to Web</strong> enabled will appear on the public <a href="/pricing" target="_blank" style={{ color: 'var(--brand-400)' }}>/pricing</a> page.</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-tertiary)' }}>Loading plans…</div>
      ) : plans.length === 0 ? (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <h2 style={{ fontWeight: 800, marginBottom: 8 }}>No plans yet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Seed the defaults or create your first plan.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={handleSeed}>↑ Seed Default Plans</button>
            <button className="btn btn-primary" onClick={openNew}>+ New Plan</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {plans.map(plan => (
            <div key={plan.code} style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${plan.status === 'archived' ? 'var(--border)' : `${plan.color}44`}`,
              borderRadius: 14, overflow: 'hidden',
              opacity: plan.status === 'archived' ? 0.6 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 16 }}>
                {/* Icon + color dot */}
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${plan.color}20`, border: `1px solid ${plan.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {plan.icon}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{plan.name}</span>
                    <Chip label={plan.status} status={plan.status} />
                    {plan.publishedToWeb && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#22c55e15', color: '#22c55e', border: '1px solid #22c55e40' }}>🌐 WEB</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>v{plan.version}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                    <code style={{ fontSize: 10, background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4 }}>{plan.code}</code>
                    {' · '}{plan.description}
                  </div>
                </div>
                {/* Pricing */}
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 160 }}>
                  {plan.baseMonthly > 0 ? (
                    <>
                      <div style={{ fontWeight: 900, fontSize: 18, color: plan.color }}>${plan.baseMonthly}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>/mo</span></div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+${plan.pricePerSeat}/seat · {plan.aumFeeBps}bps AUM</div>
                    </>
                  ) : plan.code === 'TRIAL' ? (
                    <div style={{ fontWeight: 900, fontSize: 18, color: plan.color }}>Free Trial</div>
                  ) : (
                    <div style={{ fontWeight: 900, fontSize: 18, color: plan.color }}>Custom</div>
                  )}
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => setHistoryCode(plan.code)}>📜 History</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setEditing(plan); setIsNew(false); }}>Edit</button>
                  {plan.status !== 'archived' && (
                    <button className="btn btn-sm btn-ghost" onClick={() => handleArchive(plan)} style={{ color: '#64748b' }}>Archive</button>
                  )}
                </div>
              </div>
              {/* Feature preview */}
              <div style={{ padding: '0 20px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {plan.features.slice(0, 4).map((f, i) => (
                  <span key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>✓ {f}</span>
                ))}
                {plan.features.length > 4 && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{plan.features.length - 4} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
