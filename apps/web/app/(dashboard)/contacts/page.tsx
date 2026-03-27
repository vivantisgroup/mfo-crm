'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { User, Building2, Plus, Search, X, Phone, Mail, Shield } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Contact {
  id:              string;
  firstName:       string;
  lastName:        string;
  email?:          string;
  phone?:          string;
  role:            string;        // beneficiary, advisor, attorney, accountant, banker, trustee, other
  linkedFamilyIds: string[];
  linkedFamilyNames: string[];
  linkedOrgIds:    string[];
  linkedOrgNames:  string[];
  pepFlag?:        boolean;
  nationality?:    string;
  notes?:          string;
  kycStatus?:      string;
  createdAt?:      string;
}

const ROLES = ['beneficiary', 'advisor', 'attorney', 'accountant', 'banker', 'trustee', 'benefactor', 'other'];

const ROLE_COLORS: Record<string, string> = {
  beneficiary: 'var(--brand-500)',
  advisor:     '#06b6d4',
  attorney:    '#f59e0b',
  accountant:  '#8b5cf6',
  banker:      '#10b981',
  trustee:     '#6366f1',
  benefactor:  '#ec4899',
  other:       'var(--text-tertiary)',
};

function getInitials(fn: string, ln: string) {
  return `${fn?.[0] ?? ''}${ln?.[0] ?? ''}`.toUpperCase();
}

// ─── Create drawer ────────────────────────────────────────────────────────────

function CreateContactDrawer({ tenantId, onClose, onCreate }: {
  tenantId: string; onClose: () => void; onCreate: () => void;
}) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', role: 'beneficiary', nationality: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const valid = form.firstName.trim() && form.lastName.trim();

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'tenants', tenantId, 'contacts'), {
        ...form,
        linkedFamilyIds: [], linkedFamilyNames: [],
        linkedOrgIds: [], linkedOrgNames: [],
        pepFlag: false, kycStatus: 'pending',
        createdAt: new Date().toISOString(),
      });
      onCreate();
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  const field = (label: string, key: keyof typeof form, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{label}</label>
      <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'inherit', fontSize: 13 }} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: '#00000060' }} />
      <div style={{ width: 420, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>New Contact</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Add a person to the CRM</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}><X size={18} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('First Name', 'firstName')}
            {field('Last Name', 'lastName')}
          </div>
          {field('Email', 'email', 'email')}
          {field('Phone', 'phone', 'tel')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'inherit', fontSize: 13 }}>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          {field('Nationality', 'nationality')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'inherit', fontSize: 13, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!valid || saving}>
            {saving ? 'Saving…' : 'Create Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const router  = useRouter();
  const [contacts,    setContacts]    = useState<Contact[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState('All');
  const [showCreate,  setShowCreate]  = useState(false);
  const [tenantId,    setTenantId]    = useState('');

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id) setTenantId(t.id);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const q = query(collection(db, 'tenants', tenantId, 'contacts'), orderBy('lastName', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Contact)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter(c => {
      const matchSearch = !q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
        || c.email?.toLowerCase().includes(q)
        || c.role?.toLowerCase().includes(q)
        || c.linkedOrgNames?.some(o => o.toLowerCase().includes(q))
        || c.linkedFamilyNames?.some(f => f.toLowerCase().includes(q));
      const matchRole = roleFilter === 'All' || c.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [contacts, search, roleFilter]);

  return (
    <div className="page animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 30, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <User size={28} style={{ color: 'var(--brand-400)' }} /> Contacts
          </h1>
          <p className="page-subtitle" style={{ marginTop: 6 }}>
            People across all families and organizations{!loading && <span style={{ marginLeft: 8, padding: '2px 8px', background: 'var(--brand-900)', color: 'var(--brand-300)', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{contacts.length}</span>}
          </p>
        </div>
        <button className="btn btn-primary" style={{ gap: 8, display: 'flex', alignItems: 'center' }} onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New Contact
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, org, family…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 34px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'inherit', fontSize: 13 }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={14} /></button>}
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'inherit', fontSize: 13 }}>
          <option value="All">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 130, borderRadius: 'var(--radius-xl)', background: 'var(--bg-elevated)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            {contacts.length === 0 ? 'No contacts yet' : 'No contacts match your search'}
          </div>
          {contacts.length === 0 && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>Add first contact</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 16 }}>
          {filtered.map(c => {
            const color = ROLE_COLORS[c.role] ?? 'var(--text-tertiary)';
            return (
              <div key={c.id} onClick={() => router.push(`/contacts/${c.id}`)}
                className="card hover-lift"
                style={{ padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', flexShrink: 0, fontSize: 16, fontWeight: 800,
                    background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {getInitials(c.firstName, c.lastName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{c.firstName} {c.lastName}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 8, background: `${color}22`, color, fontWeight: 700, textTransform: 'capitalize' }}>{c.role}</span>
                      {c.pepFlag && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#ef444422', color: '#ef4444', fontWeight: 700 }}>PEP</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {c.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={11} />{c.email}</div>}
                  {c.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={11} />{c.phone}</div>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  {c.linkedFamilyNames?.map(f => (
                    <span key={f} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'var(--brand-500)22', color: 'var(--brand-400)', fontWeight: 700 }}>👥 {f}</span>
                  ))}
                  {c.linkedOrgNames?.map(o => (
                    <span key={o} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#8b5cf622', color: '#a78bfa', fontWeight: 700 }}>🏢 {o}</span>
                  ))}
                  {!c.linkedFamilyNames?.length && !c.linkedOrgNames?.length && (
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>No links yet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && tenantId && (
        <CreateContactDrawer tenantId={tenantId} onClose={() => setShowCreate(false)} onCreate={() => {}} />
      )}
    </div>
  );
}
