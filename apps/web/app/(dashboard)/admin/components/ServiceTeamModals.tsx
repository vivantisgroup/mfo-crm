'use client';

import React, { useState, useEffect } from 'react';
import { type ServiceTeam, type ServiceTeamMember, saveServiceTeam, deleteServiceTeam, TEAM_ROLES, TEAM_ROLE_LABELS } from '@/lib/serviceTeamService';
import { type TenantMember } from '@/lib/tenantMemberService';
import { ConfirmDialog } from '@/components/ConfirmDialog';

function Modal({ onClose, children, width = 760 }: { onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>
        {children}
      </div>
    </div>
  );
}

function Avatar({ name, size = 34, color }: { name: string; size?: number; color?: string }) {
  const hue = color ? 0 : name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: color ?? `hsl(${hue},55%,45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function Msg({ text }: { text: React.ReactNode }) {
  if (!text) return null;
  const ok = typeof text === 'string' ? text.startsWith('✅') : true;
  return <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: ok ? '#22c55e15' : '#ef444415', color: ok ? '#22c55e' : '#ef4444', marginBottom: 12, wordBreak: 'break-word' }}>{text}</div>;
}

export function ServiceTeamFormModal({ tenantId, team, onClose, onSaved }: {
  tenantId: string; team?: ServiceTeam; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: team?.name ?? '',
    description: team?.description ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const f = (k: string) => (e: React.ChangeEvent<any>) => setForm(p => ({ ...p, [k]: e.target.value }));

  async function handle(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg('');
    try {
      await saveServiceTeam(tenantId, {
        id: team?.id,
        name: form.name,
        description: form.description,
        members: team?.members || [],
      });
      onSaved();
    } catch (err: any) { setMsg('❌ ' + err.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal onClose={onClose} width={500}>
      <form onSubmit={handle}>
        <div style={{ padding: '22px 26px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 900, fontSize: 17 }}>{team ? '✏️ Edit Team' : '🛡️ New Service Team'}</div>
        </div>
        <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Msg text={msg} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Team Name *</div>
            <input required className="input" style={{ width: '100%' }} value={form.name} onChange={f('name')} placeholder="e.g. Alpha Wealth Team" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Description</div>
            <textarea className="input" rows={2} style={{ width: '100%', resize: 'vertical', fontSize: 13 }} value={form.description} onChange={f('description')} placeholder="Team focus or region..." />
          </div>
        </div>
        <div style={{ padding: '0 26px 22px', display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
            {loading ? '…' : team ? 'Save Changes' : 'Create Team'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ServiceTeamDetailModal({ team, tenantId, allMembers, onClose, onRefresh }: {
  team: ServiceTeam; tenantId: string; allMembers: TenantMember[]; onClose: () => void; onRefresh: () => void;
}) {
  const [members, setMembers] = useState<ServiceTeamMember[]>(team.members || []);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);

  // For adding
  const nonMembers = allMembers.filter(m => !members.find(tm => tm.uid === m.uid));
  const filtered = nonMembers.filter(m => !search || m.displayName.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()));

  async function updateMembers(newMembers: ServiceTeamMember[]) {
    try {
      await saveServiceTeam(tenantId, { id: team.id, name: team.name, description: team.description, members: newMembers });
      setMembers(newMembers);
      onRefresh();
    } catch(err: any) { setMsg('❌ ' + err.message); throw err; }
  }

  async function addUser(m: TenantMember) {
    const newMember: ServiceTeamMember = { uid: m.uid, name: m.displayName, email: m.email, role: 'operations', photoURL: m.photoURL };
    const updated = [...members, newMember];
    try {
      await updateMembers(updated);
      setMsg(`✅ ${m.displayName} added to team.`);
    } catch {}
  }

  async function removeUser(tm: ServiceTeamMember) {
    const updated = members.filter(x => x.uid !== tm.uid);
    try {
      await updateMembers(updated);
      setMsg(`✅ ${tm.name} removed from team.`);
    } catch {}
  }

  async function changeRole(uid: string, role: ServiceTeamMember['role']) {
    const updated = members.map(m => m.uid === uid ? { ...m, role } : m);
    try {
      await updateMembers(updated);
      setMsg(`✅ Role updated.`);
    } catch {}
  }

  return (
    <>
      {editing && <ServiceTeamFormModal tenantId={tenantId} team={team} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onRefresh(); onClose(); }} />}
      
      <div className="animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--brand-400)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Teams</button>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{team.name}</span>
        </div>

        <div style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--brand-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🛡️</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 24 }}>{team.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{team.description || 'No description provided.'}</div>
                <div style={{ fontSize: 11, color: 'var(--brand-500)', fontWeight: 700, marginTop: 4 }}>Service Team · {members.length} member(s)</div>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>✏️ Edit</button>
          </div>
        </div>

        <div style={{ padding: '16px 24px 24px' }}>
          <Msg text={msg} />
          
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>👥 Team Composition ({members.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
            {members.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: 10 }}>No members in this team</div>}
            {members.map(tm => (
              <div key={tm.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-canvas)', border: '1px solid var(--border)' }}>
                <Avatar name={tm.name} size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{tm.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tm.email}</div>
                </div>
                <select className="input" style={{ fontSize: 11, padding: '4px 8px', height: 28 }} value={tm.role} onChange={e => changeRole(tm.uid, e.target.value as any)}>
                   {TEAM_ROLES.map(r => <option key={r} value={r}>{TEAM_ROLE_LABELS[r]}</option>)}
                </select>
                <button onClick={() => removeUser(tm)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #ef444444', background: 'none', cursor: 'pointer', color: '#ef4444' }}>Remove</button>
              </div>
            ))}
          </div>

          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>➕ Add Member</div>
          <input className="input" style={{ width: '100%', marginBottom: 8 }} placeholder="Search tenant members by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.slice(0, 50).map(m => (
              <div key={m.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <Avatar name={m.displayName} size={28} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.email}</div>
                </div>
                <button onClick={() => addUser(m)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: `1px solid var(--brand-500)`, background: 'var(--brand-faint)', cursor: 'pointer', color: 'var(--brand-600)', fontWeight: 700 }}>+ Add</button>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>No available members to add.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
