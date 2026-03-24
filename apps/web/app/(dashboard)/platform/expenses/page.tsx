'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useBreadcrumb, usePageTitle } from '@/lib/PageTitleContext';
import {
  getAllExpenses, createExpense, updateExpense, deleteExpense, seedExpensesIfEmpty,
  EXPENSE_CATEGORIES, FREQ_LABELS, monthlyEquivalent,
  type PlatformExpense, type ExpenseCategory, type ExpenseFrequency,
} from '@/lib/expenseService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return `$${n.toLocaleString()}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{children}</div>;
}

function Chip({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: `${color}20`, color, border: `1px solid ${color}40` }}>{label}</span>;
}

function CatBadge({ cat }: { cat: ExpenseCategory }) {
  const { label, icon, color } = EXPENSE_CATEGORIES[cat];
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: `${color}18`, color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{icon} {label}</span>;
}



// ─── Blank expense form ────────────────────────────────────────────────────────

const BLANK = {
  name: '', category: 'infrastructure' as ExpenseCategory, frequency: 'monthly' as ExpenseFrequency,
  amountUsd: 0, vendor: '', description: '', startDate: new Date().toISOString().slice(0, 10),
  endDate: '', active: true, tags: '',
};

// ─── Expense Form (new + edit) ─────────────────────────────────────────────────

function ExpenseForm({
  initial, onSave, onCancel, title,
}: {
  initial: typeof BLANK;
  onSave: (data: typeof BLANK) => Promise<void>;
  onCancel: () => void;
  title: string;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const f = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.amountUsd) { setErr('Name and amount are required.'); return; }
    setSaving(true); setErr('');
    try { await onSave(form); }
    catch (ex: any) { setErr(ex.message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 720 }}>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)', padding: '24px', marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 20 }}>{title}</div>
        {err && <div style={{ marginBottom: 14, padding: '9px 14px', borderRadius: 8, fontSize: 13, background: '#ef444415', color: '#ef4444' }}>❌ {err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <FieldLabel>Expense Name *</FieldLabel>
            <input required className="input" style={{ width: '100%' }} value={form.name} onChange={f('name')} placeholder="Firebase / GCP" />
          </div>
          <div>
            <FieldLabel>Category *</FieldLabel>
            <select required className="input" style={{ width: '100%' }} value={form.category} onChange={f('category')}>
              {(Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map(k => (
                <option key={k} value={k}>{EXPENSE_CATEGORIES[k].icon} {EXPENSE_CATEGORIES[k].label}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Vendor / Supplier</FieldLabel>
            <input className="input" style={{ width: '100%' }} value={form.vendor} onChange={f('vendor')} placeholder="Google Cloud" />
          </div>
          <div>
            <FieldLabel>Frequency *</FieldLabel>
            <select required className="input" style={{ width: '100%' }} value={form.frequency} onChange={f('frequency')}>
              {(Object.keys(FREQ_LABELS) as ExpenseFrequency[]).map(k => <option key={k} value={k}>{FREQ_LABELS[k]}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Amount (USD) *</FieldLabel>
            <input required type="number" min={0} step={0.01} className="input" style={{ width: '100%' }} value={form.amountUsd} onChange={f('amountUsd')} />
          </div>
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <input type="date" className="input" style={{ width: '100%' }} value={form.startDate} onChange={f('startDate')} />
          </div>
          <div>
            <FieldLabel>End Date {form.frequency === 'one_time' ? '*' : '(optional)'}</FieldLabel>
            <input type="date" className="input" style={{ width: '100%' }} value={form.endDate} onChange={f('endDate')} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FieldLabel>Description</FieldLabel>
            <textarea className="input" rows={2} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} value={form.description} onChange={f('description')} placeholder="What this expense covers…" />
          </div>
          <div>
            <FieldLabel>Tags (comma-separated)</FieldLabel>
            <input className="input" style={{ width: '100%' }} value={form.tags} onChange={f('tags')} placeholder="infrastructure, prod, gdpr" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
            <input type="checkbox" id="expActive" checked={form.active}
              onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
              style={{ accentColor: 'var(--brand-500)', width: 15, height: 15, cursor: 'pointer' }} />
            <label htmlFor="expActive" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Active expense</label>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} style={{ flex: 1 }}>← Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving || !form.name} style={{ flex: 2 }}>
          {saving ? '…' : '✅ Save Expense'}
        </button>
      </div>
    </form>
  );
}

// ─── Expense Detail View ───────────────────────────────────────────────────────

function ExpenseDetail({
  expense, onBack, onUpdated, onDeleted, performer,
}: {
  expense: PlatformExpense;
  onBack: () => void;
  onUpdated: (updated: PlatformExpense) => void;
  onDeleted: (id: string) => void;
  performer: { uid: string };
}) {
  const [editMode, setEditMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState('');
  const { icon, color, label } = EXPENSE_CATEGORIES[expense.category];

  const localToForm = (e: PlatformExpense): typeof BLANK => ({
    name: e.name, category: e.category, frequency: e.frequency,
    amountUsd: e.amountUsd, vendor: e.vendor, description: e.description,
    startDate: e.startDate, endDate: e.endDate ?? '', active: e.active,
    tags: e.tags.join(', '),
  });

  async function handleSave(form: typeof BLANK) {
    await updateExpense(expense.id, {
      name: form.name, category: form.category, frequency: form.frequency,
      amountUsd: form.amountUsd, vendor: form.vendor, description: form.description,
      startDate: form.startDate, endDate: form.endDate || undefined, active: form.active,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    }, performer);
    onUpdated({ ...expense, name: form.name, category: form.category, frequency: form.frequency,
      amountUsd: form.amountUsd, vendor: form.vendor, description: form.description,
      startDate: form.startDate, endDate: form.endDate || undefined, active: form.active,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) });
    setEditMode(false);
    setMsg('✅ Expense updated.');
  }

  async function handleDelete() {
    if (!confirm(`Delete "${expense.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try { await deleteExpense(expense.id, expense.name, performer); onDeleted(expense.id); }
    catch (e: any) { setMsg(`❌ ${e.message}`); setDeleting(false); }
  }

  const monthly = monthlyEquivalent(expense);

  useBreadcrumb([{ label: 'Expenses', onClick: onBack }, { label: expense.name }]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900 }}>{expense.name}</h1>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{expense.vendor}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <CatBadge cat={expense.category} />
            <Chip label={FREQ_LABELS[expense.frequency]} color="#6366f1" />
            <Chip label={expense.active ? 'Active' : 'Inactive'} color={expense.active ? '#22c55e' : '#94a3b8'} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444' }}>{fmt(expense.amountUsd)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{FREQ_LABELS[expense.frequency]}{monthly !== expense.amountUsd ? ` · ${fmt(monthly)}/mo equiv.` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditMode(v => !v); setMsg(''); }}>
              {editMode ? '✕ Cancel' : '✏️ Edit'}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={handleDelete} disabled={deleting}>
              {deleting ? '…' : '🗑 Delete'}
            </button>
          </div>
        </div>
      </div>

      {msg && <div style={{ marginBottom: 18, padding: '9px 14px', borderRadius: 8, fontSize: 13, background: msg.startsWith('✅') ? '#22c55e15' : '#ef444415', color: msg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>{msg}</div>}

      {editMode ? (
        <ExpenseForm
          title="✏️ Edit Expense"
          initial={localToForm(expense)}
          onSave={handleSave}
          onCancel={() => { setEditMode(false); setMsg(''); }}
        />
      ) : (
        <div style={{ maxWidth: 680, background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {[
              { label: 'Amount',      value: fmt(expense.amountUsd) },
              { label: 'Frequency',   value: FREQ_LABELS[expense.frequency] },
              { label: 'Monthly Equiv.', value: monthly ? fmt(monthly) : '—' },
              { label: 'Annual Equiv.', value: monthly ? fmt(monthly * 12) : fmt(expense.amountUsd) },
              { label: 'Start Date',  value: fmtDate(expense.startDate) },
              { label: 'End Date',    value: expense.endDate ? fmtDate(expense.endDate) : '—' },
              { label: 'Vendor',      value: expense.vendor || '—' },
              { label: 'Created By',  value: expense.createdBy },
            ].map(r => (
              <div key={r.label} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{r.label}</div>
                <div style={{ fontWeight: 600 }}>{r.value}</div>
              </div>
            ))}
          </div>
          {expense.description && (
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-canvas)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {expense.description}
            </div>
          )}
          {expense.tags.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {expense.tags.map(t => <Chip key={t} label={t} color="#6366f1" />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New Expense View (must be module-level to keep identity stable) ──────────

function NewExpenseView({ goList, setExpenses, openDetail, performer }: {
  goList: () => void;
  setExpenses: React.Dispatch<React.SetStateAction<PlatformExpense[]>>;
  openDetail: (e: PlatformExpense) => void;
  performer: { uid: string };
}) {
  useBreadcrumb([{ label: 'Expenses', onClick: goList }, { label: 'New Expense' }]);
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>💸 New Expense</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>Add a recurring or one-time business expense to track platform profitability.</p>
      <ExpenseForm
        title="Expense Details"
        initial={BLANK}
        onSave={async (form) => {
          const created = await createExpense({
            name: form.name, category: form.category, frequency: form.frequency,
            amountUsd: form.amountUsd, vendor: form.vendor, description: form.description,
            startDate: form.startDate, endDate: form.endDate || undefined, active: form.active,
            tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), createdBy: performer.uid,
          }, performer);
          setExpenses(prev => [created, ...prev]);
          openDetail(created);
        }}
        onCancel={goList}
      />
    </div>
  );
}

// ─── Main Expenses Page ────────────────────────────────────────────────────────

type PageView = 'list' | 'new' | 'detail';

export default function ExpensesPage() {
  const { user } = useAuth();
  usePageTitle('Expenses');
  const performer = { uid: user?.uid ?? 'unknown' };

  const [expenses, setExpenses] = useState<PlatformExpense[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<PageView>('list');
  const [selected, setSelected] = useState<PlatformExpense | null>(null);
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState<ExpenseCategory | 'all'>('all');
  const [activeOnly, setActiveOnly] = useState(true);
  const [msg, setMsg]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setExpenses(await getAllExpenses()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSeed() {
    const seeded = await seedExpensesIfEmpty(performer);
    if (seeded) await load();
    else alert('Expenses already seeded.');
  }

  const filtered = useMemo(() => expenses.filter(e => {
    if (activeOnly && !e.active) return false;
    if (catFilter !== 'all' && e.category !== catFilter) return false;
    const q = search.toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || e.vendor.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
  }), [expenses, search, catFilter, activeOnly]);

  // KPIs
  const activeExpenses = expenses.filter(e => e.active);
  const totalMonthlyOpex = activeExpenses.reduce((s, e) => s + monthlyEquivalent(e), 0);
  const totalAnnualOpex  = totalMonthlyOpex * 12;
  const byCategory = (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map(c => ({
    cat: c,
    monthly: activeExpenses.filter(e => e.category === c).reduce((s, e) => s + monthlyEquivalent(e), 0),
  })).filter(c => c.monthly > 0).sort((a, b) => b.monthly - a.monthly);

  function openDetail(e: PlatformExpense) { setSelected(e); setView('detail'); }
  function goList() { setSelected(null); setView('list'); }

  // ── New expense view ────────────────────────────────────────────────────────
  if (view === 'new') {
    return <NewExpenseView goList={goList} setExpenses={setExpenses} openDetail={openDetail} performer={performer} />;
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <ExpenseDetail
          expense={selected}
          performer={performer}
          onBack={goList}
          onUpdated={updated => { setSelected(updated); setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e)); }}
          onDeleted={id => { setExpenses(prev => prev.filter(e => e.id !== id)); goList(); }}
        />
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
              Platform <span style={{ color: 'var(--brand-500)', fontWeight: 400 }}>Expenses</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Track all SaaS operating expenses to measure platform profitability in real time.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleSeed}>↑ Seed</button>
            <button className="btn btn-ghost btn-sm" onClick={load}>↻</button>
            <button className="btn btn-primary btn-sm" onClick={() => setView('new')}>+ Add Expense</button>
          </div>
        </div>
      </header>

      {msg && <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: '#22c55e15', color: '#22c55e' }}>{msg}</div>}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Monthly OPEX',   value: fmt(totalMonthlyOpex),  sub: 'Active expenses',        color: '#ef4444' },
          { label: 'Annual OPEX',    value: fmt(totalAnnualOpex),   sub: 'Projected yearly total',  color: '#f59e0b' },
          { label: 'Active Items',   value: activeExpenses.length,  sub: `${expenses.filter(e => !e.active).length} inactive`, color: '#6366f1' },
          { label: 'Largest Item',   value: activeExpenses.length ? fmt(Math.max(...activeExpenses.map(e => monthlyEquivalent(e)))) : '—',
            sub: activeExpenses.sort((a,b) => monthlyEquivalent(b) - monthlyEquivalent(a))[0]?.name ?? '', color: '#22d3ee' },
        ].map(k => (
          <div key={k.label} style={{ padding: '18px 20px', background: 'var(--bg-elevated)', border: `1px solid ${k.color}33`, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown + list side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>

        {/* Category bar chart */}
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', padding: '20px 18px' }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 18 }}>OPEX by Category</div>
          {byCategory.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No active expenses.</div>
          ) : byCategory.map(({ cat, monthly }) => {
            const { color, icon, label } = EXPENSE_CATEGORIES[cat];
            const pct = Math.round((monthly / totalMonthlyOpex) * 100);
            return (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>{icon} {label}</span>
                  <span style={{ fontSize: 12, color, fontWeight: 700 }}>{fmt(monthly)}</span>
                </div>
                <div style={{ height: 5, background: 'var(--bg-canvas)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{pct}% of total</div>
              </div>
            );
          })}
        </div>

        {/* Expense table */}
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="🔍 Search expenses…" value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ width: 240 }} />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value as any)} className="input" style={{ padding: '8px 12px' }}>
              <option value="all">All Categories</option>
              {(Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map(k => (
                <option key={k} value={k}>{EXPENSE_CATEGORIES[k].icon} {EXPENSE_CATEGORIES[k].label}</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} style={{ accentColor: 'var(--brand-500)' }} />
              Active only
            </label>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 40px', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💸</div>
              <h2 style={{ fontWeight: 800, marginBottom: 8 }}>No expenses found</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Add expenses to track platform operating costs.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={handleSeed}>↑ Seed Sample Data</button>
                <button className="btn btn-primary" onClick={() => setView('new')}>+ Add Expense</button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                    {['Expense', 'Category', 'Vendor', 'Amount', 'Frequency', 'Monthly Equiv.', 'Start Date', 'Status'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(exp => (
                    <tr key={exp.id} onClick={() => openDetail(exp)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} className="hover-lift">
                      <td style={{ padding: '13px 14px', fontWeight: 700, fontSize: 13 }}>{exp.name}</td>
                      <td style={{ padding: '13px 14px' }}><CatBadge cat={exp.category} /></td>
                      <td style={{ padding: '13px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{exp.vendor || '—'}</td>
                      <td style={{ padding: '13px 14px', fontWeight: 800, fontSize: 14, color: '#ef4444' }}>{fmt(exp.amountUsd)}</td>
                      <td style={{ padding: '13px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{FREQ_LABELS[exp.frequency]}</td>
                      <td style={{ padding: '13px 14px', fontWeight: 700, color: monthlyEquivalent(exp) > 0 ? '#f59e0b' : 'var(--text-tertiary)' }}>
                        {monthlyEquivalent(exp) > 0 ? fmt(monthlyEquivalent(exp)) : '—'}
                      </td>
                      <td style={{ padding: '13px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{fmtDate(exp.startDate)}</td>
                      <td style={{ padding: '13px 14px' }}>
                        <Chip label={exp.active ? 'Active' : 'Inactive'} color={exp.active ? '#22c55e' : '#94a3b8'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
                <span>{filtered.length} expense{filtered.length !== 1 ? 's' : ''} shown</span>
                <span style={{ fontWeight: 700, color: '#ef4444' }}>
                  Total monthly OPEX (filtered): {fmt(filtered.reduce((s, e) => s + monthlyEquivalent(e), 0))}/mo
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
