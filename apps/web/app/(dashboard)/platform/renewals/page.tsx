'use client';

/**
 * /platform/renewals — Subscription Renewal Management
 *
 * 3 tabs:
 *  1. Upcoming  — renewals due in the next 30/60/90 days with risk flags
 *  2. Pipeline  — kanban-style board (Pending → Sent → Accepted / Declined)
 *  3. History   — completed & expired renewals
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import {
  listRenewals,
  updateRenewalStatus,
  renewalDaysLeft,
  formatRenewalDate,
  type RenewalRecord,
  type RenewalStatus,
} from '@/lib/renewalService';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const STATUS_META: Record<RenewalStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#6366f1', bg: '#6366f115' },
  sent:      { label: 'Sent',      color: '#f59e0b', bg: '#f59e0b15' },
  accepted:  { label: 'Accepted',  color: '#22c55e', bg: '#22c55e15' },
  declined:  { label: 'Declined',  color: '#ef4444', bg: '#ef444415' },
  expired:   { label: 'Expired',   color: '#64748b', bg: '#64748b15' },
  completed: { label: 'Completed', color: '#22d3ee', bg: '#22d3ee15' },
};

const RISK_META = {
  low:    { label: 'Low Risk',    color: '#22c55e', icon: '🟢' },
  medium: { label: 'Medium Risk', color: '#f59e0b', icon: '🟡' },
  high:   { label: 'High Risk',   color: '#ef4444', icon: '🔴' },
};

function StatusPill({ status }: { status: RenewalStatus }) {
  const m = STATUS_META[status];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      background: m.bg, color: m.color, border: `1px solid ${m.color}44`,
      textTransform: 'capitalize',
    }}>
      {m.label}
    </span>
  );
}

function RiskBadge({ risk }: { risk: RenewalRecord['risk'] }) {
  const m = RISK_META[risk];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: m.color }}>
      {m.icon} {m.label}
    </span>
  );
}

function DaysLeftBadge({ days, status }: { days: number; status: RenewalStatus }) {
  if (['completed', 'declined', 'expired'].includes(status)) return null;
  const color = days <= 14 ? '#ef4444' : days <= 30 ? '#f59e0b' : '#22c55e';
  return (
    <span style={{
      fontSize: 12, fontWeight: 800, color,
      background: `${color}15`, padding: '2px 8px', borderRadius: 20,
    }}>
      {days === 0 ? 'Today!' : `${days}d`}
    </span>
  );
}

function fmt(n: number) { return `$${n.toLocaleString()}`; }

// ─── Renewal detail drawer (slide-in) ────────────────────────────────────────

function RenewalDrawer({
  renewal,
  onClose,
  onStatusChange,
}: {
  renewal: RenewalRecord | null;
  onClose: () => void;
  onStatusChange: (id: string, status: RenewalStatus) => void;
}) {
  const [notes, setNotes] = useState('');

  if (!renewal) return null;
  const days = renewalDaysLeft(renewal);
  const sm = STATUS_META[renewal.status];

  const ALL_ACTIONS: { status: RenewalStatus; label: string; btnClass: string }[] = [
    { status: 'sent',      label: '📧 Mark as Sent',     btnClass: 'btn btn-outline btn-sm' },
    { status: 'accepted',  label: '✅ Accept Renewal',   btnClass: 'btn btn-primary btn-sm' },
    { status: 'declined',  label: '❌ Mark Declined',    btnClass: 'btn btn-ghost btn-sm' },
    { status: 'completed', label: '🎉 Mark Completed',   btnClass: 'btn btn-primary btn-sm' },
  ];
  const actions = ALL_ACTIONS.filter(a => a.status !== renewal.status);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 40, backdropFilter: 'blur(2px)',
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 480,
        background: 'var(--bg-canvas)', borderLeft: '1px solid var(--border)',
        zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.3)',
        animation: 'slideInRight 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${sm.bg}, transparent)`,
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
              Renewal Record
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>{renewal.tenantName}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusPill status={renewal.status} />
              <RiskBadge risk={renewal.risk} />
              <DaysLeftBadge days={days} status={renewal.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-tertiary)', padding: 4 }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Key info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Plan', value: `${renewal.planName} (${renewal.billingCycle})` },
              { label: 'Current MRR', value: fmt(renewal.currentMrr) },
              { label: 'Proposed MRR', value: renewal.proposedMrr ? fmt(renewal.proposedMrr) : '—' },
              { label: 'Period End', value: formatRenewalDate(renewal.periodEnd) },
              { label: 'Days Left', value: days > 0 ? `${days} days` : 'Overdue' },
              { label: 'Assigned To', value: renewal.assignedName ?? 'Unassigned' },
            ].map(r => (
              <div key={r.label} style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{r.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{r.value}</div>
              </div>
            ))}
          </div>

          {/* Risk reason */}
          {renewal.riskReason && (
            <div style={{
              padding: '12px 14px', borderRadius: 10, font: '13px/1.5 inherit',
              background: RISK_META[renewal.risk].color + '10',
              border: `1px solid ${RISK_META[renewal.risk].color}30`,
              color: RISK_META[renewal.risk].color,
            }}>
              <strong>⚠ Risk note:</strong>{' '}{renewal.riskReason}
            </div>
          )}

          {/* Opportunity link */}
          {renewal.opportunityId && (
            <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Linked Opportunity</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--brand-400)' }}>#{renewal.opportunityId}</div>
            </div>
          )}

          {/* Notes / action taken */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>
              Action Notes
            </label>
            <textarea
              value={notes || renewal.notes || ''}
              onChange={e => setNotes(e.target.value)}
              placeholder="Log a call, meeting note, or next step here…"
              rows={4}
              className="input"
              style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.6 }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {actions.map(a => (
              <button
                key={a.status}
                className={a.btnClass}
                style={{ fontSize: 12 }}
                onClick={() => onStatusChange(renewal.id, a.status)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tab: Upcoming ────────────────────────────────────────────────────────────

function UpcomingTab({
  renewals,
  onSelect,
}: {
  renewals: RenewalRecord[];
  onSelect: (r: RenewalRecord) => void;
}) {
  const [filterDays, setFilterDays] = useState<30 | 60 | 90>(30);

  const filtered = useMemo(() =>
    renewals
      .filter(r => !['completed', 'declined', 'expired'].includes(r.status))
      .filter(r => renewalDaysLeft(r) <= filterDays)
      .sort((a, b) => renewalDaysLeft(a) - renewalDaysLeft(b)),
    [renewals, filterDays],
  );

  const totalAtRisk = filtered.reduce((s, r) => s + r.currentMrr, 0);

  return (
    <div className="animate-fade-in">
      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: `Due ≤ ${filterDays}d`, value: filtered.length, color: '#6366f1' },
          { label: 'MRR at Risk', value: fmt(totalAtRisk), color: '#f59e0b' },
          { label: 'High Risk', value: filtered.filter(r => r.risk === 'high').length, color: '#ef4444' },
        ].map(k => (
          <div key={k.label} style={{ padding: '18px 20px', background: 'var(--bg-elevated)', border: `1px solid ${k.color}33`, borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>Show upcoming:</span>
        {([30, 60, 90] as const).map(d => (
          <button
            key={d}
            onClick={() => setFilterDays(d)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
              borderColor: filterDays === d ? 'var(--brand-500)' : 'var(--border)',
              background: filterDays === d ? 'var(--brand-500)15' : 'transparent',
              color: filterDays === d ? 'var(--brand-400)' : 'var(--text-secondary)',
            }}
          >
            {d} days
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)', fontSize: 14 }}>
          🎉 No renewals due in the next {filterDays} days.
        </div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                {['Tenant', 'Plan', 'MRR', 'Period End', 'Days Left', 'Risk', 'Status', 'Assigned', ''].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const days = renewalDaysLeft(r);
                return (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    className="hover-lift"
                    onClick={() => onSelect(r)}
                  >
                    <td style={{ padding: '14px 14px', fontWeight: 700, fontSize: 14 }}>{r.tenantName}</td>
                    <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {r.planName} · {r.billingCycle}
                    </td>
                    <td style={{ padding: '14px 14px', fontWeight: 800, color: '#22c55e' }}>
                      {fmt(r.currentMrr)}
                      {r.proposedMrr && r.proposedMrr !== r.currentMrr && (
                        <span style={{ fontSize: 10, color: '#6366f1', marginLeft: 6 }}>→ {fmt(r.proposedMrr)}</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {formatRenewalDate(r.periodEnd)}
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      <DaysLeftBadge days={days} status={r.status} />
                    </td>
                    <td style={{ padding: '14px 14px' }}><RiskBadge risk={r.risk} /></td>
                    <td style={{ padding: '14px 14px' }}><StatusPill status={r.status} /></td>
                    <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {r.assignedName ?? '—'}
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Open →</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Pipeline (Kanban) ───────────────────────────────────────────────────

const PIPELINE_COLS: { status: RenewalStatus; label: string; color: string }[] = [
  { status: 'pending',  label: 'Pending',  color: '#6366f1' },
  { status: 'sent',     label: 'Sent',     color: '#f59e0b' },
  { status: 'accepted', label: 'Accepted', color: '#22c55e' },
  { status: 'declined', label: 'Declined', color: '#ef4444' },
];

function PipelineTab({
  renewals,
  onSelect,
}: {
  renewals: RenewalRecord[];
  onSelect: (r: RenewalRecord) => void;
}) {
  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'start' }}>
      {PIPELINE_COLS.map(col => {
        const cards = renewals.filter(r => r.status === col.status);
        const colMrr = cards.reduce((s, r) => s + r.currentMrr, 0);
        return (
          <div key={col.status} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Column header */}
            <div style={{
              padding: '12px 16px', borderRadius: 10,
              background: `${col.color}10`, border: `1px solid ${col.color}30`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: col.color }}>{col.label}</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: col.color }}>{cards.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fmt(colMrr)} MRR</div>
              </div>
            </div>

            {/* Cards */}
            {cards.length === 0 && (
              <div style={{
                padding: '20px 16px', borderRadius: 10,
                border: `2px dashed ${col.color}30`,
                textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)',
              }}>
                No renewals
              </div>
            )}
            {cards.map(r => {
              const days = renewalDaysLeft(r);
              const rMeta = RISK_META[r.risk];
              return (
                <div
                  key={r.id}
                  onClick={() => onSelect(r)}
                  style={{
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    background: 'var(--bg-elevated)', border: `1px solid ${col.color}30`,
                    display: 'flex', flexDirection: 'column', gap: 8,
                    transition: 'all 0.15s', boxShadow: '0 1px 6px rgba(0,0,0,0.1)',
                  }}
                  className="hover-lift"
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.tenantName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.planName} · {r.billingCycle}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: '#22c55e', fontSize: 14 }}>{fmt(r.currentMrr)}</span>
                    <DaysLeftBadge days={days} status={r.status} />
                  </div>
                  {r.riskReason && (
                    <div style={{ fontSize: 11, color: rMeta.color, background: rMeta.color + '10', padding: '4px 8px', borderRadius: 6 }}>
                      {rMeta.icon} {r.riskReason.slice(0, 60)}{r.riskReason.length > 60 ? '…' : ''}
                    </div>
                  )}
                  {r.assignedName && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>👤 {r.assignedName}</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

function HistoryTab({ renewals, onSelect }: { renewals: RenewalRecord[]; onSelect: (r: RenewalRecord) => void }) {
  const historical = renewals
    .filter(r => ['completed', 'declined', 'expired'].includes(r.status))
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));

  const wonMrr     = historical.filter(r => r.status === 'completed').reduce((s, r) => s + r.currentMrr, 0);
  const lostMrr    = historical.filter(r => r.status === 'declined').reduce((s, r) => s + r.currentMrr, 0);
  const winRate    = historical.length > 0
    ? Math.round((historical.filter(r => r.status === 'completed').length / historical.length) * 100)
    : 0;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Win Rate', value: `${winRate}%`, color: '#22c55e' },
          { label: 'MRR Retained', value: fmt(wonMrr), color: '#6366f1' },
          { label: 'MRR Lost', value: fmt(lostMrr), color: '#ef4444' },
        ].map(k => (
          <div key={k.label} style={{ padding: '18px 20px', background: 'var(--bg-elevated)', border: `1px solid ${k.color}33`, borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {historical.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)', fontSize: 14 }}>
          No historical renewals yet.
        </div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                {['Tenant', 'Plan', 'MRR', 'Period End', 'Outcome', 'Assigned', ''].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historical.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} className="hover-lift" onClick={() => onSelect(r)}>
                  <td style={{ padding: '14px 14px', fontWeight: 700, fontSize: 14 }}>{r.tenantName}</td>
                  <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.planName}</td>
                  <td style={{ padding: '14px 14px', fontWeight: 800 }}>{fmt(r.currentMrr)}</td>
                  <td style={{ padding: '14px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{formatRenewalDate(r.periodEnd)}</td>
                  <td style={{ padding: '14px 14px' }}><StatusPill status={r.status} /></td>
                  <td style={{ padding: '14px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.assignedName ?? '—'}</td>
                  <td style={{ padding: '14px 14px' }}><button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>View →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'upcoming' | 'pipeline' | 'history';

export default function RenewalsPage() {
  usePageTitle('Renewals');

  const [tab, setTab] = useState<Tab>('upcoming');
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RenewalRecord | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listRenewals().then(data => {
      if (mounted) {
        setRenewals(data);
        setLoading(false);
      }
    }).catch(e => {
      console.error('Failed to fetch renewals:', e);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const handleStatusChange = useCallback(async (id: string, status: RenewalStatus) => {
    // Optimistic UI update
    setRenewals(prev =>
      prev.map(r => r.id === id ? { ...r, status } : r)
    );
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
    
    // Server update
    try {
      await updateRenewalStatus(id, status, { uid: 'system', name: 'System' }); // Assuming we don't have user object directly accessible here without useAuth
    } catch (e) {
      console.error('Failed to update renewal status:', e);
      // Let it fail silently in UI or add toast
    }
  }, []);

  // Summary KPIs
  const activeMrr     = renewals.filter(r => !['completed', 'declined', 'expired'].includes(r.status)).reduce((s, r) => s + r.currentMrr, 0);
  const dueSoon       = renewals.filter(r => !['completed', 'declined', 'expired'].includes(r.status) && renewalDaysLeft(r) <= 30).length;
  const highRiskCount = renewals.filter(r => r.risk === 'high' && !['declined', 'expired'].includes(r.status)).length;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* Compact action bar — KPIs + CTA */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 24, marginBottom: 16 }}>
        {[
          { label: 'MRR at stake', value: fmt(activeMrr),  color: '#22c55e' },
          { label: 'Due ≤ 30d',    value: dueSoon,          color: '#f59e0b' },
          { label: 'High risk',    value: highRiskCount,    color: '#ef4444' },
        ].map(k => (
          <div key={k.label} style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
        <button className="btn btn-primary btn-sm" style={{ fontSize: 13 }} disabled={loading}>
          {loading ? '...' : '+ New Renewal'}
        </button>
      </div>

      {loading && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          ⏳ Loading lively renewals...
        </div>
      )}

      {/* Tabs */}
      {!loading && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)' }}>
        {([
          { id: 'upcoming' as Tab, label: '⏰ Upcoming' },
          { id: 'pipeline' as Tab, label: '🗂 Pipeline' },
          { id: 'history'  as Tab, label: '📋 History' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="btn btn-ghost btn-sm"
            style={{
              borderRadius: '8px 8px 0 0',
              borderBottom: tab === t.id ? '2px solid var(--brand-500)' : '2px solid transparent',
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? 'var(--brand-400)' : 'var(--text-secondary)',
              paddingBottom: 12,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      )}

      {/* Tab content */}
      {!loading && tab === 'upcoming' && <UpcomingTab renewals={renewals} onSelect={setSelected} />}
      {!loading && tab === 'pipeline' && <PipelineTab renewals={renewals} onSelect={setSelected} />}
      {!loading && tab === 'history'  && <HistoryTab  renewals={renewals} onSelect={setSelected} />}

      {/* Slide-in drawer */}
      <RenewalDrawer
        renewal={selected}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
