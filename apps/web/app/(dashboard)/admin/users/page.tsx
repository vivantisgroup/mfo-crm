'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getAllUsers, updateUserProfile, type UserProfile, type PlatformRole } from '@/lib/platformService';
import { getTenantMembers, addMemberToTenant, addPlaceholderMember, removeMemberFromTenant, updateMemberRole, setMemberStatus, createInvitation, getInvitationsForTenant, revokeInvitation, ROLE_LABELS, ROLE_DESCRIPTIONS, TENANT_ROLES, type TenantMember, type TenantInvitation } from '@/lib/tenantMemberService';
import { getTenantGroups, getGroup, createGroup, updateGroup, deleteGroup, getGroupMembers, addMemberToGroup, removeMemberFromGroup, getGroupsForUser, type TenantGroup, type GroupMember } from '@/lib/groupService';
import { ROLE_PERMISSIONS, PERMISSION_META, PERMISSION_MODULES, permissionsByModule, effectivePermissions, setUserPermissionOverride, getUserPermissionOverride, type Permission, type AuthzContext } from '@/lib/rbacService';
import { ConfirmDialog, type ConfirmOptions } from '@/components/ConfirmDialog';

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Avatar({ name, size = 34, color }: { name: string; size?: number; color?: string }) {
  const hue = color ? 0 : name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: color ?? `hsl(${hue},55%,45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: color + '20', color, whiteSpace: 'nowrap' }}>{label}</span>;
}

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

function Msg({ text }: { text: string }) {
  if (!text) return null;
  const ok = text.startsWith('✅');
  return <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: ok ? '#22c55e15' : '#ef444415', color: ok ? '#22c55e' : '#ef4444', marginBottom: 12 }}>{text}</div>;
}

const GROUP_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#0ea5e9','#a78bfa','#ec4899','#14b8a6'];

// ─── Permission Override Panel (inline) ───────────────────────────────────────

function PermissionsPanel({ uid, tenantId, role, performer, onClose }: {
  uid: string; tenantId: string; role: PlatformRole;
  performer: { uid: string; name: string }; onClose: () => void;
}) {
  const [grants, setGrants] = useState<Permission[]>([]);
  const [denies, setDenies] = useState<Permission[]>([]);
  const [ready, setReady]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');
  const [mod, setMod]       = useState(PERMISSION_MODULES[0] as string);

  useEffect(() => {
    getUserPermissionOverride(uid, tenantId).then(ov => {
      setGrants(ov?.grants ?? []); setDenies(ov?.denies ?? []);
    }).finally(() => setReady(true));
  }, [uid, tenantId]);

  const roleDefaults = ROLE_PERMISSIONS[role] ?? [];

  function tog(type: 'grant' | 'deny', p: Permission) {
    if (type === 'grant') {
      setGrants(g => g.includes(p) ? g.filter(x => x !== p) : [...g, p]);
      setDenies(d => d.filter(x => x !== p));
    } else {
      setDenies(d => d.includes(p) ? d.filter(x => x !== p) : [...d, p]);
      setGrants(g => g.filter(x => x !== p));
    }
  }

  async function save() {
    setSaving(true); setMsg('');
    try {
      await setUserPermissionOverride(uid, tenantId, grants, denies, performer.uid);
      setMsg('✅ Saved.');
    } catch (e: any) { setMsg('❌ ' + e.message); }
    finally { setSaving(false); }
  }

  const modPerms = permissionsByModule(mod as any);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--brand-400)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Users</button>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>Permission Overrides</span>
      </div>
      <div style={{ padding: '0 0 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 24 }}>🔐 Permission Overrides</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Add explicit grants (+) or denies (−) on top of the {ROLE_LABELS[role]} role defaults
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 0 }}>
          {PERMISSION_MODULES.map(m => (
            <button key={m} onClick={() => setMod(m)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: mod === m ? 700 : 400, background: 'none', border: 'none', borderBottom: `2px solid ${mod === m ? 'var(--brand-500)' : 'transparent'}`, color: mod === m ? 'var(--brand-500)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>{m}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px 24px 20px' }}>
        <Msg text={msg} />
        {!ready ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {modPerms.map(pm => {
              const isDefault = roleDefaults.includes(pm.id);
              const isGrant   = grants.includes(pm.id);
              const isDeny    = denies.includes(pm.id);
              return (
                <div key={pm.id} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 72px', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: isDeny ? '#ef444408' : isGrant ? '#6366f108' : isDefault ? '#22c55e06' : 'var(--bg-canvas)', border: `1px solid ${isDeny ? '#ef444430' : isGrant ? '#6366f130' : 'var(--border)'}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{pm.label} {pm.sensitive && <span style={{ fontSize: 10, color: '#f59e0b' }}>⚠</span>}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{pm.id}{isDefault && ' · role default'}</div>
                  </div>
                  {(['grant','deny'] as const).map(type => {
                    const active = type === 'grant' ? isGrant : isDeny;
                    return (
                      <button key={type} onClick={() => tog(type, pm.id)} style={{ padding: '5px 0', borderRadius: 6, border: `1px solid ${active ? (type === 'grant' ? '#6366f1' : '#ef4444') : 'var(--border)'}`, background: active ? (type === 'grant' ? '#6366f1' : '#ef4444') : 'none', color: active ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        {type === 'grant' ? (active ? '✅ Grant' : '+ Grant') : (active ? '🚫 Deny' : '− Deny')}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{grants.length}G · {denies.length}D overrides</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? '…' : '💾 Save'}</button>
          </div>
      </div>
    </div>
    </div>
  );
}

// ─── Group Form Modal ─────────────────────────────────────────────────────────

function GroupFormModal({ tenantId, group, performer, onClose, onSaved }: {
  tenantId: string; group?: TenantGroup;
  performer: { uid: string; name: string };
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name:        group?.name        ?? '',
    description: group?.description ?? '',
    icon:        group?.icon        ?? '👥',
    color:       group?.color       ?? GROUP_COLORS[0],
    roleId:      (group?.roleId     ?? 'report_viewer') as PlatformRole,
    additionalPermissions: group?.additionalPermissions ?? [] as Permission[],
    deniedPermissions:     group?.deniedPermissions     ?? [] as Permission[],
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const f = (k: string) => (e: React.ChangeEvent<any>) => setForm(p => ({ ...p, [k]: e.target.value }));

  async function handle(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg('');
    try {
      if (group) {
        await updateGroup(group.id, { ...form }, performer);
      } else {
        await createGroup({ ...form, tenantId, createdBy: performer.uid }, performer);
      }
      onSaved();
    } catch (err: any) { setMsg('❌ ' + err.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal onClose={onClose} width={600}>
      <form onSubmit={handle}>
        <div style={{ padding: '22px 26px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 900, fontSize: 17 }}>{group ? '✏️ Edit Group' : '➕ New Group'}</div>
        </div>
        <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Msg text={msg} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Group Name *</div>
              <input required className="input" style={{ width: '100%' }} value={form.name} onChange={f('name')} placeholder="e.g. Portfolio Team" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Base Role *</div>
              <select required className="input" style={{ width: '100%' }} value={form.roleId} onChange={f('roleId')}>
                {TENANT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Description</div>
            <textarea className="input" rows={2} style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} value={form.description} onChange={f('description')} placeholder="What is this group for?" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Icon (emoji)</div>
              <input className="input" style={{ width: '100%' }} value={form.icon} onChange={f('icon')} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Color</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {GROUP_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: form.color === c ? '3px solid white' : '2px solid transparent', outline: form.color === c ? `2px solid ${c}` : 'none', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-canvas)', fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong>Base role:</strong> {ROLE_LABELS[form.roleId]} — {ROLE_DESCRIPTIONS[form.roleId]}
            <br /><span style={{ fontSize: 12 }}>{(ROLE_PERMISSIONS[form.roleId] ?? []).length} default permissions granted</span>
          </div>
        </div>
        <div style={{ padding: '0 26px 22px', display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
            {loading ? '…' : group ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Group Detail Modal ───────────────────────────────────────────────────────

function GroupDetailModal({ group, tenantId, allMembers, performer, onClose, onRefresh }: {
  group: TenantGroup; tenantId: string; allMembers: TenantMember[];
  performer: { uid: string; name: string }; onClose: () => void; onRefresh: () => void;
}) {
  const [members, setMembers]   = useState<GroupMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [msg, setMsg]           = useState('');
  const [editing, setEditing]   = useState(false);

  useEffect(() => { getGroupMembers(group.id).then(setMembers).finally(() => setLoading(false)); }, [group.id]);

  const nonMembers = allMembers.filter(m => !members.find(gm => gm.uid === m.uid));

  async function addUser(m: TenantMember) {
    try {
      await addMemberToGroup(group.id, tenantId, m, performer);
      setMembers(prev => [...prev, { uid: m.uid, groupId: group.id, tenantId, displayName: m.displayName, email: m.email, joinedAt: new Date().toISOString(), joinedBy: performer.uid }]);
      setMsg(`✅ ${m.displayName} added.`);
    } catch (e: any) { setMsg('❌ ' + e.message); }
  }

  async function removeUser(gm: GroupMember) {
    try {
      await removeMemberFromGroup(group.id, tenantId, gm.uid, gm.displayName, performer);
      setMembers(prev => prev.filter(x => x.uid !== gm.uid));
      setMsg(`✅ ${gm.displayName} removed.`);
    } catch (e: any) { setMsg('❌ ' + e.message); }
  }

  const filtered = nonMembers.filter(m => !search || m.displayName.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      {editing && <GroupFormModal tenantId={tenantId} group={group} performer={performer} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onRefresh(); onClose(); }} />}
      <div className="animate-fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 600 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--brand-400)', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Groups</button>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{group.name}</span>
        </div>
        <div style={{ padding: '0 0 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: group.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{group.icon}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 24 }}>{group.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{group.description}</div>
                <div style={{ marginTop: 5 }}><Chip label={ROLE_LABELS[group.roleId]} color={group.color} /></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>✏️ Edit Configuration</button>
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px 24px' }}>
          <Msg text={msg} />
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>👥 Members ({members.length})</div>
          {loading ? <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>Loading…</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {members.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: 10 }}>No members yet</div>}
              {members.map(gm => (
                <div key={gm.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-canvas)', border: '1px solid var(--border)' }}>
                  <Avatar name={gm.displayName} size={30} color={group.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{gm.displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{gm.email}</div>
                  </div>
                  <button onClick={() => removeUser(gm)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #ef444444', background: 'none', cursor: 'pointer', color: '#ef4444' }}>Remove</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>➕ Add Members</div>
          <input className="input" style={{ width: '100%', marginBottom: 8 }} placeholder="Search tenant members…" value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.slice(0, 20).map(m => (
              <div key={m.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8, background: 'var(--bg-canvas)', border: '1px solid var(--border)' }}>
                <Avatar name={m.displayName} size={28} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.email}</div>
                </div>
                <button onClick={() => addUser(m)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: `1px solid ${group.color}`, background: group.color + '15', cursor: 'pointer', color: group.color, fontWeight: 700 }}>+ Add</button>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>All members already in group</div>}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'members' | 'groups' | 'invitations' | 'permissions';

export default function TenantUsersPage() {
  const { user: me, tenant } = useAuth();
  const tenantId   = tenant?.id ?? '';
  const tenantName = tenant?.name ?? '';
  const performer  = { uid: me?.uid ?? '', name: me?.name ?? 'Admin' };

  const [tab,         setTab]         = useState<Tab>('members');
  const [members,     setMembers]     = useState<TenantMember[]>([]);
  const [invitations, setInvitations] = useState<TenantInvitation[]>([]);
  const [groups,      setGroups]      = useState<TenantGroup[]>([]);
  const [allUsers,    setAllUsers]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [roleF,       setRoleF]       = useState<PlatformRole | 'all'>('all');
  const [statusF,     setStatusF]     = useState<'all' | 'active' | 'suspended' | 'invited'>('all');
  const [joinedF,     setJoinedF]     = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [sortF,       setSortF]       = useState<'az' | 'za' | 'newest' | 'oldest'>('az');
  const [showAdv,     setShowAdv]     = useState(false);
  const [msg,         setMsg]         = useState('');

  // Read ?role= URL param on mount (set by Roles page click-through)
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('role');
    if (param) { setRoleF(param as PlatformRole); setShowAdv(true); }
  }, []);

  const [selectedMember,  setSelectedMember]  = useState<TenantMember | null>(null);
  const [selectedGroup,   setSelectedGroup]   = useState<TenantGroup | null>(null);
  const [showGroupForm,   setShowGroupForm]   = useState(false);
  const [showPerms,       setShowPerms]       = useState<TenantMember | null>(null);
  const [memberInput,     setMemberInput]     = useState('');
  const [memberRole,      setMemberRole]      = useState<PlatformRole>('report_viewer');
  const [sendInvite,      setSendInvite]      = useState(true);
  const [confirmOpts,     setConfirmOpts]     = useState<ConfirmOptions | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [m, inv, g, u] = await Promise.all([
        getTenantMembers(tenantId),
        getInvitationsForTenant(tenantId),
        getTenantGroups(tenantId),
        getAllUsers(),
      ]);
      setMembers(m); setInvitations(inv); setGroups(g); setAllUsers(u);
    } catch {}
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const filteredMembers = useMemo(() => {
    const cutoff = joinedF === 'all' ? null : new Date(Date.now() - { '7d': 7, '30d': 30, '90d': 90 }[joinedF]! * 86400000);
    let list = members.filter(m => {
      const q = search.toLowerCase();
      if (q && !`${m.displayName} ${m.email}`.toLowerCase().includes(q)) return false;
      if (roleF !== 'all' && m.role !== roleF) return false;
      if (statusF !== 'all' && m.status !== statusF) return false;
      if (cutoff && new Date(m.joinedAt) < cutoff) return false;
      return true;
    });
    if (sortF === 'az')     list = [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
    if (sortF === 'za')     list = [...list].sort((a, b) => b.displayName.localeCompare(a.displayName));
    if (sortF === 'newest') list = [...list].sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
    if (sortF === 'oldest') list = [...list].sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
    return list;
  }, [members, search, roleF, statusF, joinedF, sortF]);

  const nonMembers = allUsers.filter(u => !members.find(m => m.uid === u.uid));
  const filteredAdd = nonMembers.filter(u => !memberInput || u.displayName?.toLowerCase().includes(memberInput.toLowerCase()) || u.email?.toLowerCase().includes(memberInput.toLowerCase()));

  async function getClientIdToken(): Promise<string | null> {
    try {
      const { getAuth } = await import('firebase/auth');
      const { firebaseApp } = await import('@mfo-crm/config');
      const auth = getAuth(firebaseApp);
      return (await auth.currentUser?.getIdToken()) ?? null;
    } catch { return null; }
  }

  async function doSmartAdd() {
    if (!memberInput) return;
    const input = memberInput.trim().toLowerCase();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input)) {
      setMsg('❌ Please enter a valid email address.');
      return;
    }

    setLoading(true); setMsg('');
    try {
      const existingUser = allUsers.find(u => u.email.toLowerCase() === input);
      if (existingUser) {
        await addMemberToTenant(tenantId, tenantName, existingUser, memberRole, performer);
        setMsg(`✅ Existing user ${existingUser.displayName} added to tenant.`);
      } else {
        // New user — create via Admin SDK
        const idToken = await getClientIdToken();
        if (!idToken) {
          setMsg('❌ Not authenticated — please refresh the page and try again.');
          setLoading(false);
          return;
        }

        const { adminCreateFirebaseUser } = await import('@/lib/usersAdmin');
        const result = await adminCreateFirebaseUser(input, input.split('@')[0], idToken);
        if (!result.success || !result.userRecord) {
          setMsg(`❌ Error creating user: ${result.error}`);
          setLoading(false);
          return;
        }

        const uid = result.userRecord.uid;
        const newProfile = { uid, email: input, displayName: input.split('@')[0], tenantIds: [] };

        // Add them to the tenant (the API already wrote the base profile)
        await addMemberToTenant(tenantId, tenantName, newProfile, memberRole, performer);

        // Send welcome email with temp password
        let successMsg = `✅ User ${input} created and added to ${tenantName}.`;
        if (sendInvite && result.tempPassword) {
          try {
            const emailRes = await fetch('/api/email/send-welcome', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                idToken,
                to:           input,
                displayName:  input.split('@')[0],
                tempPassword: result.tempPassword,
                tenantName,
              }),
            });
            const emailData = await emailRes.json();
            if (emailData.sent) {
              successMsg += ' Welcome email with temporary password sent.';
            } else if (emailData.warning) {
              successMsg += ` ⚠️ Email not sent (SMTP not configured). Temp password: ${result.tempPassword}`;
            }
          } catch {
            successMsg += ` ⚠️ Email failed. Temp password: ${result.tempPassword}`;
          }
        } else if (!sendInvite && result.tempPassword) {
          successMsg += ` Temp password: ${result.tempPassword}`;
        }

        setMsg(successMsg);
      }
      setMemberInput('');
      await load();
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function doChangeRole(m: TenantMember, r: PlatformRole) {
    try {
      await updateMemberRole(tenantId, tenantName, m.uid, m.displayName, r, m.role, performer);
      setMembers(p => p.map(x => x.uid === m.uid ? { ...x, role: r } : x));
    } catch (e: any) { setMsg('❌ ' + e.message); }
  }

  async function doSuspend(m: TenantMember) {
    const next = m.status === 'suspended' ? 'active' : 'suspended';
    try {
      await setMemberStatus(tenantId, m.uid, m.displayName, next, performer);
      setMembers(p => p.map(x => x.uid === m.uid ? { ...x, status: next } : x));
    } catch (e: any) { setMsg('❌ ' + e.message); }
  }

  function doRemove(m: TenantMember) {
    setConfirmOpts({
      title:        'Remove Member',
      message:      `Remove ${m.displayName} from the tenant? They will lose access immediately.`,
      confirmLabel: 'Remove',
      variant:      'danger',
      onConfirm: async () => {
        try {
          await removeMemberFromTenant(tenantId, tenantName, m.uid, m.displayName, performer);
          setMembers(p => p.filter(x => x.uid !== m.uid));
        } catch (e: any) { setMsg('❌ ' + e.message); }
      },
      onCancel: () => setConfirmOpts(null),
    });
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'members',     label: `👤 Members (${members.length})` },
    { id: 'groups',      label: `👥 Groups (${groups.length})` },
    { id: 'invitations', label: `📧 Invitations (${invitations.filter(i => i.status === 'pending').length})` },
    { id: 'permissions', label: '🔐 Permissions' },
  ];

  return (
    <div className="page animate-fade-in">
      {confirmOpts && <ConfirmDialog {...confirmOpts} />}
      {showPerms && (
        <PermissionsPanel uid={showPerms.uid} tenantId={tenantId} role={showPerms.role}
          performer={performer} onClose={() => setShowPerms(null)} />
      )}
      {showGroupForm && (
        <GroupFormModal tenantId={tenantId} performer={performer}
          onClose={() => setShowGroupForm(false)} onSaved={() => { setShowGroupForm(false); load(); }} />
      )}
      {selectedGroup && (
        <GroupDetailModal group={selectedGroup} tenantId={tenantId} allMembers={members}
          performer={performer} onClose={() => setSelectedGroup(null)} onRefresh={load} />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage members, groups, roles, and fine-grained permissions for {tenantName}.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* KPI */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Members',     value: members.length,                              color: 'var(--brand-500)' },
          { label: 'Active',      value: members.filter(m => m.status === 'active').length,   color: '#22c55e' },
          { label: 'Suspended',   value: members.filter(m => m.status === 'suspended').length, color: '#ef4444' },
          { label: 'Groups',      value: groups.length,                               color: '#f59e0b' },
          { label: 'Pending Invites', value: invitations.filter(i => i.status === 'pending').length, color: '#818cf8' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {msg && <div style={{ marginBottom: 16 }}><Msg text={msg} /></div>}

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--brand-500)' : 'transparent'}`, color: tab === t.id ? 'var(--brand-500)' : 'var(--text-secondary)', cursor: 'pointer' }}>{t.label}</button>
        ))}
      </div>

      {/* ── MEMBERS ── */}
      {tab === 'members' && (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>➕ Add Member</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) 1fr auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>User Email (or select existing)</div>
                <input className="input" type="email" style={{ width: '100%' }} placeholder="user@firm.com" value={memberInput} onChange={e => setMemberInput(e.target.value)} list="add-users" />
                <datalist id="add-users">{filteredAdd.slice(0,20).map(u => <option key={u.uid} value={u.email}>{u.displayName || u.email}</option>)}</datalist>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Role</div>
                <select className="input" style={{ width: '100%' }} value={memberRole} onChange={e => setMemberRole(e.target.value as PlatformRole)}>
                  {TENANT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" style={{ height: 40, padding: '0 20px', whiteSpace: 'nowrap' }} onClick={doSmartAdd} disabled={!memberInput || loading}>
                {loading ? '…' : 'Add to Tenant'}
              </button>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="sendInv" checked={sendInvite} onChange={e => setSendInvite(e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--brand-500)', width: 14, height: 14 }} />
              <label htmlFor="sendInv" style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                Send welcome email with temporary password (new users only)
              </label>
            </div>
          </div>

          {/* ── Filter Bar ── */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input className="input" placeholder="🔍 Search name or email…" value={search}
                onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
              <select className="input" value={roleF} onChange={e => setRoleF(e.target.value as any)} style={{ minWidth: 160 }}>
                <option value="all">All Roles</option>
                {TENANT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button
                onClick={() => setShowAdv(v => !v)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: showAdv ? 'var(--brand-900)' : 'var(--bg-canvas)', color: showAdv ? 'var(--brand-400)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {showAdv ? '▲' : '▼'} Advanced
              </button>
              {(roleF !== 'all' || statusF !== 'all' || joinedF !== 'all' || search) && (
                <button
                  onClick={() => { setRoleF('all'); setStatusF('all'); setJoinedF('all'); setSearch(''); }}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ef444444', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Advanced filter panel */}
            {showAdv && (
              <div style={{ marginTop: 10, padding: '14px 16px', borderRadius: 10, background: 'var(--bg-canvas)', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Status</div>
                  <select className="input" style={{ width: '100%' }} value={statusF} onChange={e => setStatusF(e.target.value as any)}>
                    <option value="all">All Statuses</option>
                    <option value="active">✅ Active</option>
                    <option value="suspended">⛔ Suspended</option>
                    <option value="invited">📧 Invited</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Joined</div>
                  <select className="input" style={{ width: '100%' }} value={joinedF} onChange={e => setJoinedF(e.target.value as any)}>
                    <option value="all">Any time</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Sort By</div>
                  <select className="input" style={{ width: '100%' }} value={sortF} onChange={e => setSortF(e.target.value as any)}>
                    <option value="az">Name A → Z</option>
                    <option value="za">Name Z → A</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>
                    Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredMembers.length}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{members.length}</strong> members
                  </div>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading…</div>
          ) : (
            <div className="card table-wrap">
              <table>
                <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredMembers.map(m => (
                    <tr key={m.uid} style={{ opacity: m.status === 'suspended' ? 0.6 : 1 }}>
                      <td>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <Avatar name={m.displayName} size={30} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{m.displayName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select className="input" style={{ fontSize: 12, padding: '3px 8px', height: 28 }} value={m.role} onChange={e => doChangeRole(m, e.target.value as PlatformRole)}>
                          {TENANT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: m.status === 'active' ? '#22c55e18' : '#ef444418', color: m.status === 'active' ? '#22c55e' : '#ef4444' }}>
                          {m.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(m.joinedAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setShowPerms(m)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--brand-500)44', background: 'none', cursor: 'pointer', color: 'var(--brand-400)', fontWeight: 600 }}>🔐 Perms</button>
                          <button onClick={() => doSuspend(m)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: m.status === 'suspended' ? '#22c55e' : '#f59e0b' }}>
                            {m.status === 'suspended' ? '↩' : '⏸'}
                          </button>
                          <button onClick={() => doRemove(m)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #ef444444', background: 'none', cursor: 'pointer', color: '#ef4444' }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── GROUPS ── */}
      {tab === 'groups' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowGroupForm(true)}>+ New Group</button>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading…</div> :
            groups.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
                <h2 style={{ fontWeight: 800, marginBottom: 8 }}>No groups yet</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Create groups to batch-assign roles and permissions.</p>
                <button className="btn btn-primary" onClick={() => setShowGroupForm(true)}>+ Create First Group</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {groups.map(g => (
                  <div key={g.id} style={{ background: 'var(--bg-surface)', border: `1px solid ${g.color}33`, borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setSelectedGroup(g)}>
                    <div style={{ padding: '16px 18px', background: g.color + '12', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: g.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{g.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{g.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{g.description}</div>
                      </div>
                    </div>
                    <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip label={ROLE_LABELS[g.roleId]} color={g.color} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </>
      )}

      {/* ── INVITATIONS ── */}
      {tab === 'invitations' && (
        <div className="card table-wrap">
          {invitations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>No invitations sent yet.</div>
          ) : (
            <table>
              <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th>Sent By</th><th>Actions</th></tr></thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{inv.email}</td>
                    <td><span style={{ fontSize: 12 }}>{ROLE_LABELS[inv.role]}</span></td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        background: inv.status === 'pending' ? '#f59e0b18' : inv.status === 'accepted' ? '#22c55e18' : '#64748b18',
                        color:      inv.status === 'pending' ? '#f59e0b'   : inv.status === 'accepted' ? '#22c55e'   : '#64748b' }}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                    <td style={{ fontSize: 12 }}>{inv.invitedByName}</td>
                    <td>
                      {inv.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => {
                            const link = `${window.location.origin}/join?id=${inv.id}&token=${inv.token}`;
                            navigator.clipboard.writeText(link);
                            setMsg('✅ Invite link copied to clipboard!');
                          }}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--brand-500)44', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--brand-400)', fontWeight: 700 }}>
                            🔗 Copy Link
                          </button>
                          <button onClick={async () => { await revokeInvitation(inv.id, performer, tenantId); setInvitations(p => p.map(i => i.id === inv.id ? { ...i, status: 'revoked' as any } : i)); }}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            Revoke
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── PERMISSIONS ── */}
      {tab === 'permissions' && (
        <div>
          <div style={{ marginBottom: 16, padding: '14px 16px', background: 'var(--bg-canvas)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
            💡 Click <strong>🔐 Perms</strong> on any member in the Members tab to open the permission override matrix for that user.
            Overrides are additive grants or explicit denies on top of their base role.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {TENANT_ROLES.map(role => {
              const perms   = ROLE_PERMISSIONS[role] ?? [];
              const mods    = [...new Set(perms.map(p => PERMISSION_META[p]?.module).filter(Boolean))];
              return (
                <div key={role} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{ROLE_LABELS[role]}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>{ROLE_DESCRIPTIONS[role]}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Modules ({mods.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {mods.map(m => <span key={m} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{m}</span>)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{perms.length} permissions</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
