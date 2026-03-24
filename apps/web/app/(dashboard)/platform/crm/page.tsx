'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  getAllOrgs, getContactsForOrg, createOrg, createContact, updateOrg, seedCrmIfEmpty,
  STAGE_COLORS, STAGE_LABELS, STAGES, ORG_SIZE_LABELS,
  type PlatformOrg, type PlatformContact, type DealStage, type OrgSize,
} from '@/lib/crmService';
import { getAllSubscriptions, type TenantSubscription } from '@/lib/subscriptionService';
import { CommunicationPanel } from '@/components/CommunicationPanel';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtAum(n: number) {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}
function Chip({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: `${color}20`, color, border: `1px solid ${color}40` }}>{label}</span>;
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{children}</div>;
}
function Breadcrumb({ crumbs }: { crumbs: { label: string; onClick?: () => void }[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)' }}>
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span>/</span>}
          {c.onClick
            ? <button onClick={c.onClick} style={{ background: 'none', border: 'none', color: 'var(--brand-400)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>{c.label}</button>
            : <span style={{ color: 'var(--text-primary)' }}>{c.label}</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── New Org — Inline Breadcrumb Form ────────────────────────────────────────

function NewOrgView({ onBack, onCreated, performer }: {
  onBack: () => void;
  onCreated: (org: PlatformOrg) => void;
  performer: { uid: string };
}) {
  const [form, setForm] = useState({
    name: '', country: '', size: 'small' as OrgSize, estAumUsd: 0,
    stage: 'lead' as DealStage, assignedTo: '', tags: '', notes: '', website: '',
    contactName: '', contactEmail: '', contactRole: '', contactPhone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setLoading(true); setError('');
    try {
      const org = await createOrg({
        name: form.name, country: form.country, size: form.size,
        estAumUsd: form.estAumUsd, stage: form.stage,
        assignedTo: form.assignedTo, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        notes: form.notes, website: form.website, tenantIds: [], createdBy: performer.uid,
      }, performer);
      if (form.contactName && form.contactEmail) {
        await createContact({
          orgId: org.id, name: form.contactName, email: form.contactEmail,
          role: form.contactRole || '', phone: form.contactPhone || '',
          isPrimary: true, notes: '', createdBy: performer.uid,
        }, performer);
      }
      onCreated(org);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create organization.');
    } finally { setLoading(false); }
  }

  return (
    <div className="animate-fade-in">
      <Breadcrumb crumbs={[{ label: 'Platform CRM', onClick: onBack }, { label: 'New Organization' }]} />
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>🏢 New Organization</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>Create a new CRM customer and optionally add a primary contact.</p>

      {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#ef444415', color: '#ef4444', borderRadius: 8, fontSize: 13 }}>❌ {error}</div>}

      <form onSubmit={handleCreate} style={{ maxWidth: 720 }}>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)', padding: '24px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18 }}>Organization Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <FieldLabel>Organization Name *</FieldLabel>
              <input required className="input" style={{ width: '100%' }} value={form.name} onChange={f('name')} placeholder="Andrade Family Office" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><FieldLabel>Country</FieldLabel><input className="input" style={{ width: '100%' }} value={form.country} onChange={f('country')} placeholder="Brazil" /></div>
              <div>
                <FieldLabel>Size</FieldLabel>
                <select className="input" style={{ width: '100%' }} value={form.size} onChange={f('size')}>
                  {(Object.keys(ORG_SIZE_LABELS) as OrgSize[]).map(s => <option key={s} value={s}>{ORG_SIZE_LABELS[s]}</option>)}
                </select>
              </div>
              <div><FieldLabel>Est. AUM (USD)</FieldLabel><input type="number" min={0} className="input" style={{ width: '100%' }} value={form.estAumUsd} onChange={f('estAumUsd')} /></div>
              <div>
                <FieldLabel>Deal Stage</FieldLabel>
                <select className="input" style={{ width: '100%' }} value={form.stage} onChange={f('stage')}>
                  {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s].replace(/^.+ /, '')}</option>)}
                </select>
              </div>
              <div><FieldLabel>Assigned To</FieldLabel><input className="input" style={{ width: '100%' }} value={form.assignedTo} onChange={f('assignedTo')} placeholder="Sales rep name" /></div>
              <div><FieldLabel>Website</FieldLabel><input className="input" style={{ width: '100%' }} value={form.website} onChange={f('website')} placeholder="https://…" /></div>
            </div>
            <div><FieldLabel>Tags (comma-separated)</FieldLabel><input className="input" style={{ width: '100%' }} value={form.tags} onChange={f('tags')} placeholder="hot, enterprise, brazil" /></div>
            <div><FieldLabel>Notes</FieldLabel><textarea className="input" rows={3} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} value={form.notes} onChange={f('notes')} /></div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: 14, border: '1px solid var(--border)', padding: '24px', marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18 }}>👤 Primary Contact <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 12 }}>(optional)</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><FieldLabel>Name</FieldLabel><input className="input" style={{ width: '100%' }} value={form.contactName} onChange={f('contactName')} placeholder="Felipe Andrade" /></div>
            <div><FieldLabel>Email</FieldLabel><input type="email" className="input" style={{ width: '100%' }} value={form.contactEmail} onChange={f('contactEmail')} placeholder="f@andrade.com.br" /></div>
            <div><FieldLabel>Role</FieldLabel><input className="input" style={{ width: '100%' }} value={form.contactRole} onChange={f('contactRole')} placeholder="CEO / CIO / Partner" /></div>
            <div><FieldLabel>Phone</FieldLabel><input className="input" style={{ width: '100%' }} value={form.contactPhone} onChange={f('contactPhone')} placeholder="+55 11 …" /></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={onBack} style={{ flex: 1 }}>← Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading || !form.name} style={{ flex: 2 }}>
            {loading ? '…' : '✅ Create Organization'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Org Detail — Inline Breadcrumb View ──────────────────────────────────────

function OrgDetail({ org: initialOrg, subscriptions, onBack, onUpdated, performer }: {
  org: PlatformOrg;
  subscriptions: TenantSubscription[];
  onBack: () => void;
  onUpdated: () => void;
  performer: { uid: string };
}) {
  const [org, setOrg] = useState<PlatformOrg>(initialOrg);
  const [contacts, setContacts] = useState<PlatformContact[]>([]);
  const [loadingC, setLoadingC] = useState(true);
  const [tab, setTab] = useState<'info' | 'communications' | 'contacts' | 'tenants'>('info');

  // Edit org
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: org.name, country: org.country, size: org.size,
    estAumUsd: org.estAumUsd, stage: org.stage, assignedTo: org.assignedTo,
    website: org.website ?? '', tags: org.tags.join(', '), notes: org.notes,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState('');

  // Add contact
  const [showAddContact, setShowAddContact] = useState(false);
  const [nc, setNc] = useState({ name: '', email: '', role: '', phone: '', isPrimary: false, notes: '' });
  const [addingContact, setAddingContact] = useState(false);
  const [contactMsg, setContactMsg] = useState('');

  useEffect(() => {
    setLoadingC(true);
    getContactsForOrg(org.id).then(c => { setContacts(c); setLoadingC(false); });
  }, [org.id]);

  const linkedSubs = subscriptions.filter(s => org.tenantIds.includes(s.tenantId));

  // ── Save org edits ──────────────────────────────────────────────────────────
  async function saveOrgEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!org.id) { setEditMsg('❌ Org ID missing — please reload the page.'); return; }
    setSavingEdit(true); setEditMsg('');
    try {
      const patch = {
        name:       editForm.name,
        country:    editForm.country,
        size:       editForm.size as OrgSize,
        estAumUsd:  Number(editForm.estAumUsd),
        stage:      editForm.stage as DealStage,
        assignedTo: editForm.assignedTo,
        website:    editForm.website,
        tags:       editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        notes:      editForm.notes,
      };
      await updateOrg(org.id, patch);
      setOrg(prev => ({ ...prev, ...patch }));
      setEditMode(false);
      setEditMsg('✅ Saved.');
      onUpdated();
    } catch (err: any) {
      setEditMsg(`❌ ${err.message}`);
    } finally { setSavingEdit(false); }
  }

  // ── Add contact ─────────────────────────────────────────────────────────────
  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!nc.name || !nc.email) return;
    if (!org.id) { setContactMsg('❌ Org ID missing — please close and reopen this record.'); return; }
    setAddingContact(true); setContactMsg('');
    try {
      const created = await createContact(
        { orgId: org.id, name: nc.name, email: nc.email,
          role: nc.role || '', phone: nc.phone || '',
          isPrimary: nc.isPrimary, notes: nc.notes || '', createdBy: performer.uid },
        performer,
      );
      setContacts(prev => [...prev, created]);
      setNc({ name: '', email: '', role: '', phone: '', isPrimary: false, notes: '' });
      setShowAddContact(false);
      setContactMsg('✅ Contact added.');
    } catch (err: any) {
      setContactMsg(`❌ ${err.message}`);
    } finally { setAddingContact(false); }
  }

  const ef = (k: keyof typeof editForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditForm(p => ({ ...p, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }));
  const nf = (k: keyof typeof nc) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setNc(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const stageColor = STAGE_COLORS[org.stage];
  const TABS = [
    { id: 'info',           label: '📋 Info' },
    { id: 'communications', label: '💬 Comms' },
    { id: 'contacts',       label: `👤 Contacts (${contacts.length})` },
    { id: 'tenants',        label: `🏢 Tenants (${linkedSubs.length})` },
  ];

  return (
    <div className="animate-fade-in">
      <Breadcrumb crumbs={[{ label: 'Platform CRM', onClick: onBack }, { label: org.name }]} />

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>{org.name}</h1>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>{org.country} · {ORG_SIZE_LABELS[org.size]}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip label={STAGE_LABELS[org.stage].replace(/^.+ /, '')} color={stageColor} />
              {org.tags.map(t => <Chip key={t} label={t} color={t === 'hot' ? '#ef4444' : t === 'warm' ? '#f59e0b' : '#6366f1'} />)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#a78bfa' }}>{fmtAum(org.estAumUsd)}</div>
            <button
              className={`btn btn-sm ${editMode ? 'btn-ghost' : 'btn-secondary'}`}
              onClick={() => { setEditMode(v => !v); setEditMsg(''); }}>
              {editMode ? '✕ Cancel' : '✏️ Edit'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)} style={{
              padding: '10px 18px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: tab === t.id ? 700 : 500,
              borderBottom: `2px solid ${tab === t.id ? 'var(--brand-500)' : 'transparent'}`,
              color: tab === t.id ? 'var(--brand-500)' : 'var(--text-secondary)',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ paddingTop: 24 }}>

        {/* ── EDIT FORM (shown over Info tab) ────────────────────────────────── */}
        {editMode && tab === 'info' && (
          <form onSubmit={saveOrgEdit} style={{ maxWidth: 680, marginBottom: 24, padding: '22px 24px', background: 'var(--bg-canvas)', borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 18 }}>✏️ Edit Organization</div>
            {editMsg && (
              <div style={{ marginBottom: 14, padding: '9px 14px', borderRadius: 8, fontSize: 13,
                background: editMsg.startsWith('✅') ? '#22c55e15' : '#ef444415',
                color: editMsg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>
                {editMsg}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldLabel>Organization Name *</FieldLabel>
                <input required className="input" style={{ width: '100%' }} value={editForm.name} onChange={ef('name')} />
              </div>
              <div><FieldLabel>Country</FieldLabel><input className="input" style={{ width: '100%' }} value={editForm.country} onChange={ef('country')} /></div>
              <div>
                <FieldLabel>Size</FieldLabel>
                <select className="input" style={{ width: '100%' }} value={editForm.size} onChange={ef('size')}>
                  {(Object.keys(ORG_SIZE_LABELS) as OrgSize[]).map(s => <option key={s} value={s}>{ORG_SIZE_LABELS[s]}</option>)}
                </select>
              </div>
              <div><FieldLabel>Est. AUM (USD)</FieldLabel><input type="number" min={0} className="input" style={{ width: '100%' }} value={editForm.estAumUsd} onChange={ef('estAumUsd')} /></div>
              <div>
                <FieldLabel>Deal Stage</FieldLabel>
                <select className="input" style={{ width: '100%' }} value={editForm.stage} onChange={ef('stage')}>
                  {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s].replace(/^.+ /, '')}</option>)}
                </select>
              </div>
              <div><FieldLabel>Assigned To</FieldLabel><input className="input" style={{ width: '100%' }} value={editForm.assignedTo} onChange={ef('assignedTo')} placeholder="Sales rep" /></div>
              <div><FieldLabel>Website</FieldLabel><input className="input" style={{ width: '100%' }} value={editForm.website} onChange={ef('website')} placeholder="https://…" /></div>
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldLabel>Tags (comma-separated)</FieldLabel>
                <input className="input" style={{ width: '100%' }} value={editForm.tags} onChange={ef('tags')} placeholder="hot, enterprise, brazil" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <FieldLabel>Notes</FieldLabel>
                <textarea className="input" rows={3} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} value={editForm.notes} onChange={ef('notes')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditMode(false); setEditMsg(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingEdit || !editForm.name}>
                {savingEdit ? '…' : '✅ Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* ── INFO (read-only) ───────────────────────────────────────────────── */}
        {tab === 'info' && !editMode && (
          <div style={{ maxWidth: 620 }}>
            {editMsg && (
              <div style={{ marginBottom: 16, padding: '9px 14px', borderRadius: 8, fontSize: 13, background: '#22c55e15', color: '#22c55e' }}>{editMsg}</div>
            )}
            {[
              { label: 'Est. AUM',       value: fmtAum(org.estAumUsd) },
              { label: 'Deal Stage',     value: <Chip label={STAGE_LABELS[org.stage].replace(/^.+ /, '')} color={stageColor} /> },
              { label: 'Assigned To',    value: org.assignedTo || '—' },
              { label: 'Website',        value: org.website ? <a href={org.website} target="_blank" rel="noopener" style={{ color: 'var(--brand-400)' }}>{org.website}</a> : '—' },
              { label: 'Linked Tenants', value: org.tenantIds.length },
              { label: 'Org ID',         value: <code style={{ fontSize: 11 }}>{org.id ?? '⚠ undefined — reload'}</code> },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{f.label}</span>
                <span style={{ fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
            {org.notes && (
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-canvas)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {org.notes}
              </div>
            )}
          </div>
        )}

        {/* ── COMMUNICATIONS ─────────────────────────────────────────────────── */}
        {tab === 'communications' && (
          <div style={{ height: 600, maxWidth: 900 }}>
            <CommunicationPanel familyId={org.id} familyName={org.name} linkedRecordType="crm" linkedRecordId={org.id} />
          </div>
        )}

        {/* ── CONTACTS ───────────────────────────────────────────────────────── */}
        {tab === 'contacts' && (
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Contacts ({contacts.length})</div>
              <button className="btn btn-primary btn-sm" onClick={() => { setShowAddContact(v => !v); setContactMsg(''); }}>
                {showAddContact ? '✕ Cancel' : '+ Add Contact'}
              </button>
            </div>

            {contactMsg && (
              <div style={{ marginBottom: 14, padding: '9px 14px', borderRadius: 8, fontSize: 13,
                background: contactMsg.startsWith('✅') ? '#22c55e15' : '#ef444415',
                color: contactMsg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>
                {contactMsg}
              </div>
            )}

            {showAddContact && (
              <form onSubmit={handleAddContact} style={{ marginBottom: 20, padding: '18px 20px', background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>👤 New Contact</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><FieldLabel>Full Name *</FieldLabel><input required className="input" style={{ width: '100%' }} value={nc.name} onChange={nf('name')} placeholder="Felipe Andrade" /></div>
                  <div><FieldLabel>Email *</FieldLabel><input required type="email" className="input" style={{ width: '100%' }} value={nc.email} onChange={nf('email')} placeholder="contact@firm.com" /></div>
                  <div><FieldLabel>Role / Title</FieldLabel><input className="input" style={{ width: '100%' }} value={nc.role} onChange={nf('role')} placeholder="CIO / CEO / Partner" /></div>
                  <div><FieldLabel>Phone</FieldLabel><input className="input" style={{ width: '100%' }} value={nc.phone} onChange={nf('phone')} placeholder="+55 11 99988-7766" /></div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <FieldLabel>Notes</FieldLabel>
                  <textarea className="input" rows={2} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} value={nc.notes} onChange={nf('notes')} />
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="ncPrimary" checked={nc.isPrimary}
                    onChange={e => setNc(p => ({ ...p, isPrimary: e.target.checked }))}
                    style={{ accentColor: 'var(--brand-500)', width: 14, height: 14, cursor: 'pointer' }} />
                  <label htmlFor="ncPrimary" style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>Primary billing / admin contact</label>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddContact(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={addingContact || !nc.name || !nc.email}>
                    {addingContact ? '…' : '✅ Save Contact'}
                  </button>
                </div>
              </form>
            )}

            {loadingC ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading…</div>
            ) : contacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-tertiary)' }}>
                No contacts yet. Add the first one above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contacts.map(c => (
                  <div key={c.id} style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {c.name}
                      {c.isPrimary && <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, background: '#6366f115', padding: '2px 6px', borderRadius: 5, marginLeft: 8 }}>★ PRIMARY</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.role}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
                    {c.notes && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6, fontStyle: 'italic' }}>{c.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TENANTS ────────────────────────────────────────────────────────── */}
        {tab === 'tenants' && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
              Tenant subscriptions associated with <strong>{org.name}</strong>.
            </div>
            {linkedSubs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🏢</div>
                <div>No tenants linked yet.</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Link a tenant via Tenant Management → New Tenant.</div>
              </div>
            ) : linkedSubs.map(sub => {
              const sc: Record<string, string> = { trial: '#f59e0b', active: '#22c55e', past_due: '#ef4444', suspended: '#94a3b8', cancelled: '#64748b' };
              return (
                <div key={sub.tenantId} style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, background: 'var(--bg-elevated)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{sub.tenantName}</div>
                      <code style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{sub.tenantId}</code>
                    </div>
                    <Chip label={sub.status} color={sc[sub.status] ?? '#94a3b8'} />
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span>📋 {sub.planId}</span><span>👥 {sub.licensedSeats} seats</span><span>📅 Since {sub.subscriptionStart?.slice(0, 10)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Comboboxes (exported for use in Tenant management page) ─────────────────

export function OrgCombobox({ orgs, value, onChange, placeholder = 'Search organizations…' }: {
  orgs: PlatformOrg[]; value: string; onChange: (orgId: string, orgName: string) => void; placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = orgs.find(o => o.id === value);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = useMemo(() => { const lq = q.toLowerCase(); return orgs.filter(o => !lq || o.name.toLowerCase().includes(lq) || o.country.toLowerCase().includes(lq)); }, [orgs, q]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }} onClick={() => setOpen(v => !v)}>
        {selected ? <span style={{ fontWeight: 600 }}>{selected.name} <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>· {selected.country}</span></span> : <span style={{ color: 'var(--text-tertiary)' }}>{placeholder}</span>}
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>▾</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input className="input" autoFocus style={{ width: '100%', padding: '7px 10px', fontSize: 13 }} placeholder="Type to filter…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No matches</div>
              : filtered.map(o => (
                <div key={o.id} onClick={() => { onChange(o.id, o.name); setOpen(false); setQ(''); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="hover-lift">
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{o.name}</div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{o.country} · {ORG_SIZE_LABELS[o.size]}</div></div>
                  <div style={{ fontSize: 11, color: STAGE_COLORS[o.stage] }}>{STAGE_LABELS[o.stage].replace(/^.+ /, '')}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ContactCombobox({ contacts, value, onChange, disabled = false }: {
  contacts: PlatformContact[]; value: string; onChange: (contactId: string, contactName: string, contactEmail: string) => void; disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = contacts.find(c => c.id === value);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = contacts.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase()));
  return (
    <div ref={ref} style={{ position: 'relative', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : undefined }}>
      <div className="input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: disabled ? 'default' : 'pointer', userSelect: 'none' }} onClick={() => !disabled && setOpen(v => !v)}>
        {selected ? <span style={{ fontWeight: 600 }}>{selected.name} <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>· {selected.role}</span></span> : <span style={{ color: 'var(--text-tertiary)' }}>{disabled ? 'Select an organization first' : 'Select contact…'}</span>}
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>▾</span>
      </div>
      {open && !disabled && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input className="input" autoFocus style={{ width: '100%', padding: '7px 10px', fontSize: 13 }} placeholder="Filter contacts…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>No contacts</div>
              : filtered.map(c => (
                <div key={c.id} onClick={() => { onChange(c.id, c.name, c.email); setOpen(false); setQ(''); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }} className="hover-lift">
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{c.name} {c.isPrimary && <span style={{ fontSize: 10, color: '#6366f1' }}>★ primary</span>}</div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.role} · {c.email}</div></div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main CRM Page ────────────────────────────────────────────────────────────

type PageView = 'list' | 'new' | 'detail';

export default function CrmPage() {
  const { user } = useAuth();
  const performer = { uid: user?.uid ?? 'unknown' };

  const [orgs,    setOrgs]   = useState<PlatformOrg[]>([]);
  const [subs,    setSubs]   = useState<TenantSubscription[]>([]);
  const [loading, setL]      = useState(true);
  const [search,  setSearch] = useState('');
  const [stageF,  setStageF] = useState<DealStage | 'all'>('all');
  const [kanban,  setKanban] = useState(true);

  // Navigation state — no modals, no drawers
  const [view,     setView]     = useState<PageView>('list');
  const [selected, setSelected] = useState<PlatformOrg | null>(null);

  const load = useCallback(async () => {
    setL(true);
    try { const [o, s] = await Promise.all([getAllOrgs(), getAllSubscriptions()]); setOrgs(o); setSubs(s); }
    catch {} finally { setL(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSeed() {
    const seeded = await seedCrmIfEmpty(performer);
    if (seeded) await load();
    else alert('CRM already has data — seed skipped.');
  }

  function openOrg(org: PlatformOrg) { setSelected(org); setView('detail'); }
  function goList()                   { setSelected(null); setView('list');   }

  const filtered = useMemo(() => orgs.filter(o => {
    if (stageF !== 'all' && o.stage !== stageF) return false;
    const q = search.toLowerCase();
    return !q || `${o.name} ${o.country} ${o.tags.join(' ')}`.toLowerCase().includes(q);
  }), [orgs, search, stageF]);

  const pipelineStages = STAGES.filter(s => s !== 'closed_lost');
  const kpis = useMemo(() => ({
    total: orgs.length,
    open:  orgs.filter(o => !['closed_won','closed_lost'].includes(o.stage)).length,
    won:   orgs.filter(o => o.stage === 'closed_won').length,
    tenants: subs.length,
    estAum: orgs.reduce((s, o) => s + o.estAumUsd, 0),
  }), [orgs, subs]);

  // ── New Org view ──────────────────────────────────────────────────────────────
  if (view === 'new') {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <NewOrgView
          performer={performer}
          onBack={goList}
          onCreated={org => { setOrgs(prev => [org, ...prev]); openOrg(org); }}
        />
      </div>
    );
  }

  // ── Org detail view ───────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <OrgDetail org={selected} subscriptions={subs} onBack={goList} onUpdated={load} performer={performer} />
      </div>
    );
  }

  // ── List / Kanban view ────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
              Platform <span style={{ color: 'var(--brand-500)', fontWeight: 400 }}>CRM</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Manage customer organizations and link them to tenant subscriptions.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleSeed}>↑ Seed</button>
            <button className="btn btn-ghost btn-sm" onClick={load}>↻</button>
            <button className="btn btn-primary btn-sm" onClick={() => setView('new')}>+ New Org</button>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Organizations',  value: kpis.total,          color: '#6366f1' },
          { label: 'Open Deals',     value: kpis.open,           color: '#f59e0b' },
          { label: 'Closed Won',     value: kpis.won,            color: '#22c55e' },
          { label: 'Active Tenants', value: kpis.tenants,        color: '#22d3ee' },
          { label: 'Total Est. AUM', value: fmtAum(kpis.estAum), color: '#a78bfa' },
        ].map(k => (
          <div key={k.label} style={{ padding: '14px 18px', background: 'var(--bg-elevated)', border: `1px solid ${k.color}33`, borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Search organizations…" value={search} onChange={e => setSearch(e.target.value)} className="input" style={{ width: 260 }} />
        <select value={stageF} onChange={e => setStageF(e.target.value as any)} className="input" style={{ padding: '8px 12px' }}>
          <option value="all">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s].replace(/^.+ /, '')}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: 'var(--bg-canvas)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border)' }}>
          <button onClick={() => setKanban(true)} className={`btn btn-sm ${kanban ? 'btn-secondary' : 'btn-ghost'}`} style={{ border: 'none' }}>📌 Kanban</button>
          <button onClick={() => setKanban(false)} className={`btn btn-sm ${!kanban ? 'btn-secondary' : 'btn-ghost'}`} style={{ border: 'none' }}>📋 List</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : orgs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 40px', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
          <h2 style={{ fontWeight: 800, marginBottom: 8 }}>No organizations yet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Seed sample data or create your first organization.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={handleSeed}>↑ Seed Sample Data</button>
            <button className="btn btn-primary" onClick={() => setView('new')}>+ New Organization</button>
          </div>
        </div>
      ) : kanban ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pipelineStages.length}, 1fr)`, gap: 14, overflowX: 'auto', minWidth: 900 }}>
          {pipelineStages.map(stage => {
            const cards = filtered.filter(o => o.stage === stage);
            const c = STAGE_COLORS[stage];
            return (
              <div key={stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: `${c}18`, borderRadius: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c }}>{STAGE_LABELS[stage].replace(/^.+ /, '')}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{cards.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cards.map(org => (
                    <div key={org.id} onClick={() => openOrg(org)}
                      style={{ padding: '14px 16px', background: 'var(--bg-elevated)', border: `1px solid ${c}44`, borderLeft: `3px solid ${c}`, borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'transform 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{org.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{org.country} · {fmtAum(org.estAumUsd)}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {org.tags.slice(0,3).map(t => <Chip key={t} label={t} color={t === 'hot' ? '#ef4444' : t === 'warm' ? '#f59e0b' : '#6366f1'} />)}
                      </div>
                      {org.tenantIds.length > 0 && <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>🏢 {org.tenantIds.length} tenant{org.tenantIds.length !== 1 ? 's' : ''}</div>}
                    </div>
                  ))}
                  {cards.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 8 }}>Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                {['Organization', 'Stage', 'Country', 'Est. AUM', 'Tenants', 'Assigned', 'Tags'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(org => {
                const c = STAGE_COLORS[org.stage];
                return (
                  <tr key={org.id} onClick={() => openOrg(org)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} className="hover-lift">
                    <td style={{ padding: '13px 14px' }}><div style={{ fontWeight: 700, fontSize: 13, borderLeft: `3px solid ${c}`, paddingLeft: 8 }}>{org.name}</div></td>
                    <td style={{ padding: '13px 14px' }}><Chip label={STAGE_LABELS[org.stage].replace(/^.+ /, '')} color={c} /></td>
                    <td style={{ padding: '13px 14px', fontSize: 13 }}>{org.country}</td>
                    <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>{fmtAum(org.estAumUsd)}</td>
                    <td style={{ padding: '13px 14px', fontSize: 13 }}>{org.tenantIds.length > 0 ? <span style={{ color: '#22c55e', fontWeight: 700 }}>🏢 {org.tenantIds.length}</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</td>
                    <td style={{ padding: '13px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{org.assignedTo}</td>
                    <td style={{ padding: '13px 14px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {org.tags.slice(0,2).map(t => <Chip key={t} label={t} color={t === 'hot' ? '#ef4444' : '#6366f1'} />)}
                      </div>
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
