'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Search, X, Users } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Organization {
  id:                string;
  name:              string;
  type:              string;   // trust, llc, corporation, foundation, holding, fund, bank, law_firm, other
  jurisdiction?:     string;
  linkedFamilyIds:   string[];
  linkedFamilyNames: string[];
  linkedContactIds:  string[];
  linkedContactNames:string[];
  status?:           string;
  aum?:              number;
  currency?:         string;
  notes?:            string;
  createdAt?:        string;
}

const ORG_TYPES = ['trust', 'llc', 'corporation', 'foundation', 'holding', 'fund', 'bank', 'law_firm', 'accounting_firm', 'other'];

const TYPE_COLORS: Record<string, string> = {
  trust:           '#8b5cf6',
  llc:             '#06b6d4',
  corporation:     '#6366f1',
  foundation:      '#10b981',
  holding:         '#f59e0b',
  fund:            '#ec4899',
  bank:            '#3b82f6',
  law_firm:        '#f59e0b',
  accounting_firm: '#10b981',
  other:           'var(--text-tertiary)',
};

const TYPE_ICONS: Record<string, string> = {
  trust: '🔒', llc: '🏢', corporation: '🌐', foundation: '🌱',
  holding: '🏦', fund: '📊', bank: '🏦', law_firm: '⚖️',
  accounting_firm: '🧾', other: '🏢',
};

// ─── Create org drawer ────────────────────────────────────────────────────────

function CreateOrgDrawer({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', type: 'trust', jurisdiction: '', notes: '', status: 'active' });
  const [saving, setSaving] = useState(false);

  const valid = form.name.trim().length > 0;

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'tenants', tenantId, 'organizations'), {
        ...form,
        linkedFamilyIds: [], linkedFamilyNames: [],
        linkedContactIds: [], linkedContactNames: [],
        createdAt: new Date().toISOString(),
      });
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  const inp = (label: string, key: keyof typeof form) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{label}</label>
      <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'inherit', fontSize: 13 }} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: '#00000060' }} />
      <div style={{ width: 420, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>New Organization</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Add a company, trust, or entity</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}><X size={18} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto' }}>
          {inp('Organization Name', 'name')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Type</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'inherit', fontSize: 13 }}>
              {ORG_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </div>
          {inp('Jurisdiction', 'jurisdiction')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'inherit', fontSize: 13, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!valid || saving}>
            {saving ? 'Saving…' : 'Create Organization'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrganizationsPage() {
  const router = useRouter();
  const [orgs,       setOrgs]       = useState<Organization[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [tenantId,   setTenantId]   = useState('');

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id) setTenantId(t.id);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const q = query(collection(db, 'tenants', tenantId, 'organizations'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orgs.filter(o => {
      const matchSearch = !q || o.name.toLowerCase().includes(q)
        || o.type?.toLowerCase().includes(q)
        || o.jurisdiction?.toLowerCase().includes(q)
        || o.linkedFamilyNames?.some(f => f.toLowerCase().includes(q))
        || o.linkedContactNames?.some(c => c.toLowerCase().includes(q));
      const matchType = typeFilter === 'All' || o.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [orgs, search, typeFilter]);

  return (
    <div className="page animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 30, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={28} style={{ color: 'var(--brand-400)' }} /> Organizations
          </h1>
          <p className="page-subtitle" style={{ marginTop: 6 }}>
            Companies, trusts, funds, and legal entities{!loading && <span style={{ marginLeft: 8, padding: '2px 8px', background: 'var(--brand-900)', color: 'var(--brand-300)', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{orgs.length}</span>}
          </p>
        </div>
        <button className="btn btn-primary" style={{ gap: 8, display: 'flex', alignItems: 'center' }} onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New Organization
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, type, jurisdiction…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'inherit', fontSize: 13 }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={14} /></button>}
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'inherit', fontSize: 13 }}>
          <option value="All">All Types</option>
          {ORG_TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 140, borderRadius: 'var(--radius-xl)', background: 'var(--bg-elevated)', animation: 'pulse 1.5s infinite' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            {orgs.length === 0 ? 'No organizations yet' : 'No organizations match your search'}
          </div>
          {orgs.length === 0 && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>Add first organization</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 16 }}>
          {filtered.map(o => {
            const color = TYPE_COLORS[o.type] ?? 'var(--text-tertiary)';
            const icon  = TYPE_ICONS[o.type] ?? '🏢';
            return (
              <div key={o.id} onClick={() => router.push(`/organizations/${o.id}`)}
                className="card hover-lift"
                style={{ padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0, fontSize: 22,
                    background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{o.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 8, background: `${color}22`, color, fontWeight: 700, textTransform: 'capitalize' }}>
                        {o.type.replace(/_/g, ' ')}
                      </span>
                      {o.jurisdiction && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {o.jurisdiction}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  {o.linkedContactNames?.slice(0, 3).map(c => (
                    <span key={c} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontWeight: 600 }}>👤 {c}</span>
                  ))}
                  {(o.linkedContactNames?.length ?? 0) > 3 && (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>+{o.linkedContactNames!.length - 3} more</span>
                  )}
                  {o.linkedFamilyNames?.map(f => (
                    <span key={f} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'var(--brand-500)22', color: 'var(--brand-400)', fontWeight: 700 }}>👥 {f}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && tenantId && <CreateOrgDrawer tenantId={tenantId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
