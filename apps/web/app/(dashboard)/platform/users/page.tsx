'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  getAllUsers, updateUserProfile, getTenantUsers, grantSaasMasterAdmin,
  type UserProfile, type PlatformRole,
} from '@/lib/platformService';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, getTenantMembers } from '@/lib/tenantMemberService';
import {
  ROLE_PERMISSIONS, PERMISSION_META, PERMISSION_MODULES, permissionsByModule,
  effectivePermissions, setUserPermissionOverride, clearUserPermissionOverride,
  getUserPermissionOverride,
  type Permission, type AuthzContext,
} from '@/lib/rbacService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowISO() { return new Date().toISOString(); }

const ROLE_COLOR: Record<PlatformRole, { bg: string; fg: string }> = {
  saas_master_admin:   { bg: '#6366f120', fg: '#818cf8' },
  tenant_admin:        { bg: '#f59e0b20', fg: '#f59e0b' },
  relationship_manager:{ bg: '#22c55e20', fg: '#22c55e' },
  cio:                 { bg: '#0ea5e920', fg: '#38bdf8' },
  controller:          { bg: '#a78bfa20', fg: '#a78bfa' },
  compliance_officer:  { bg: '#ef444420', fg: '#f87171' },
  report_viewer:       { bg: '#64748b20', fg: '#94a3b8' },
  external_advisor:    { bg: '#f97316 20', fg: '#fb923c' },
};

function RoleBadge({ role }: { role: PlatformRole }) {
  const c = ROLE_COLOR[role] ?? { bg: '#64748b20', fg: '#94a3b8' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8,
      background: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue},60%,45%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800, fontSize: size * 0.38,
    }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function Modal({ onClose, children, width = 780 }: { onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--bg-elevated)', borderRadius: 20, border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    active:    { bg: '#22c55e18', fg: '#22c55e', label: 'Active' },
    suspended: { bg: '#ef444418', fg: '#ef4444', label: 'Suspended' },
    invited:   { bg: '#f59e0b18', fg: '#f59e0b', label: 'Invited' },
  };
  const c = map[status] ?? { bg: '#64748b18', fg: '#94a3b8', label: status };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8,
      background: c.bg, color: c.fg }}>
      {c.label}
    </span>
  );
}

// ─── Permission Matrix Panel ──────────────────────────────────────────────────

function PermissionMatrixPanel({ user, tenantId, performer, onClose }: {
  user:      UserProfile;
  tenantId?: string;   // if set, show tenant-level context
  performer: { uid: string; name: string };
  onClose:   () => void;
}) {
  const [grants, setGrants]   = useState<Permission[]>([]);
  const [denies, setDenies]   = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [activeModule, setActiveModule] = useState<string>(PERMISSION_MODULES[0]);

  const tid = tenantId ?? user.tenantId ?? 'master';

  useEffect(() => {
    getUserPermissionOverride(user.uid, tid)
      .then(ov => { setGrants(ov?.grants ?? []); setDenies(ov?.denies ?? []); })
      .finally(() => setLoading(false));
  }, [user.uid, tid]);

  const ctx: AuthzContext = {
    role: user.role, groupPerms: [], grants, denies,
  };
  const effective = effectivePermissions(ctx);

  function toggleGrant(p: Permission) {
    setGrants(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    setDenies(prev => prev.filter(x => x !== p)); // can't both grant and deny
  }
  function toggleDeny(p: Permission) {
    setDenies(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    setGrants(prev => prev.filter(x => x !== p));
  }

  async function handleSave() {
    setSaving(true); setMsg('');
    try {
      if (grants.length === 0 && denies.length === 0) {
        await clearUserPermissionOverride(user.uid, tid, performer.uid);
      } else {
        await setUserPermissionOverride(user.uid, tid, grants, denies, performer.uid);
      }
      setMsg('✅ Permissions saved.');
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    finally { setSaving(false); }
  }

  const modulePerms = permissionsByModule(activeModule as any);
  const roleDefaultPerms = ROLE_PERMISSIONS[user.role] ?? [];

  return (
    <Modal onClose={onClose} width={900}>
      <div style={{ padding: '24px 28px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>🔐 Permission Override Matrix</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
              {user.displayName} · <RoleBadge role={user.role} />
              <span style={{ color: 'var(--text-tertiary)', marginLeft: 8, fontSize: 12 }}>
                Tenant: {tid}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22,
            cursor: 'pointer', color: 'var(--text-tertiary)' }}>✕</button>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 12, color: 'var(--text-secondary)' }}>
          <span>🟢 <strong style={{ color: '#22c55e' }}>Effective</strong> (role default)</span>
          <span>✅ <strong style={{ color: '#6366f1' }}>Granted</strong> (override +)</span>
          <span>🚫 <strong style={{ color: '#ef4444' }}>Denied</strong> (override −)</span>
          <span>⬜ <strong style={{ color: 'var(--text-tertiary)' }}>Not granted</strong></span>
        </div>
        {/* Module tabs */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          {PERMISSION_MODULES.map(m => (
            <button key={m} onClick={() => setActiveModule(m)} style={{
              padding: '8px 16px', fontSize: 12, fontWeight: activeModule === m ? 700 : 500,
              background: 'none', border: 'none', whiteSpace: 'nowrap',
              borderBottom: `2px solid ${activeModule === m ? 'var(--brand-500)' : 'transparent'}`,
              color: activeModule === m ? 'var(--brand-500)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}>{m}</button>
          ))}
        </div>
      </div>

      {msg && (
        <div style={{ margin: '12px 28px 0', padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: msg.startsWith('✅') ? '#22c55e15' : '#ef444415',
          color:      msg.startsWith('✅') ? '#22c55e'   : '#ef4444' }}>{msg}</div>
      )}

      <div style={{ padding: '16px 28px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {modulePerms.map(pm => {
                const isRoleDefault  = roleDefaultPerms.includes(pm.id);
                const isGranted      = grants.includes(pm.id);
                const isDenied       = denies.includes(pm.id);
                const isEffective    = effective.includes(pm.id);
                return (
                  <div key={pm.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px',
                    alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10,
                    background: isDenied ? '#ef444408' : isGranted ? '#6366f108' : isRoleDefault ? '#22c55e08' : 'var(--bg-canvas)',
                    border: `1px solid ${isDenied ? '#ef444430' : isGranted ? '#6366f130' : 'var(--border)'}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{pm.label}
                        {pm.sensitive && <span style={{ fontSize: 10, color: '#f59e0b', marginLeft: 6, fontWeight: 700 }}>⚠ SENSITIVE</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{pm.description}</div>
                      <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-tertiary)', marginTop: 1 }}>{pm.id}</div>
                    </div>
                    <button onClick={() => toggleGrant(pm.id)} style={{ padding: '6px 0', borderRadius: 8,
                      border: `1px solid ${isGranted ? '#6366f1' : 'var(--border)'}`,
                      background: isGranted ? '#6366f1' : 'none',
                      color: isGranted ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      {isGranted ? '✅ Grant' : '+ Grant'}
                    </button>
                    <button onClick={() => toggleDeny(pm.id)} style={{ padding: '6px 0', borderRadius: 8,
                      border: `1px solid ${isDenied ? '#ef4444' : 'var(--border)'}`,
                      background: isDenied ? '#ef4444' : 'none',
                      color: isDenied ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      {isDenied ? '🚫 Deny' : '− Deny'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {grants.length} grants · {denies.length} denies active
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '…' : '💾 Save Permission Overrides'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── User Detail Modal ────────────────────────────────────────────────────────

function UserDetailModal({ profile, performer, onClose, onUpdated }: {
  profile:   UserProfile;
  performer: { uid: string; name: string };
  onClose:   () => void;
  onUpdated: (u: UserProfile) => void;
}) {
  type Tab = 'profile' | 'permissions' | 'tenants';
  const [tab,     setTab]    = useState<Tab>('profile');
  const [role,    setRole]   = useState<PlatformRole>(profile.role);
  const [status,  setStatus] = useState(profile.status);
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]    = useState('');
  const [showMatrix, setShowMatrix] = useState(false);

  const effectivePerms = effectivePermissions({ role, groupPerms: [], grants: [], denies: [] });

  async function doUpdate() {
    setLoading(true); setMsg('');
    try {
      await updateUserProfile(profile.uid, { role, status });
      onUpdated({ ...profile, role, status });
      setMsg('✅ User updated successfully.');
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    finally { setLoading(false); }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'profile',     label: '👤 Profile & Role' },
    { id: 'permissions', label: '🔐 Effective Permissions' },
    { id: 'tenants',     label: '🏢 Tenant Access' },
  ];

  return (
    <>
      {showMatrix && (
        <PermissionMatrixPanel
          user={profile}
          performer={performer}
          onClose={() => setShowMatrix(false)}
        />
      )}
      <Modal onClose={onClose}>
        <div style={{ padding: '24px 28px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Avatar name={profile.displayName} size={52} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{profile.displayName}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{profile.email}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <RoleBadge role={profile.role} />
                  <StatusBadge status={profile.status} />
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22,
              cursor: 'pointer', color: 'var(--text-tertiary)' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '10px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${tab === t.id ? 'var(--brand-500)' : 'transparent'}`,
                color: tab === t.id ? 'var(--brand-500)' : 'var(--text-secondary)',
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {msg && (
          <div style={{ margin: '12px 28px 0', padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: msg.startsWith('✅') ? '#22c55e15' : '#ef444415',
            color:      msg.startsWith('✅') ? '#22c55e'   : '#ef4444' }}>{msg}</div>
        )}

        <div style={{ padding: '20px 28px 28px' }}>

          {/* ── Profile & Role ── */}
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>UID</div>
                  <code style={{ fontSize: 11, padding: '6px 10px', background: 'var(--bg-canvas)', borderRadius: 6, display: 'block' }}>{profile.uid}</code>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Member Since</div>
                  <div style={{ fontSize: 13 }}>{new Date(profile.createdAt).toLocaleDateString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Last Login</div>
                  <div style={{ fontSize: 13 }}>{profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>MFA</div>
                  <span style={{ fontSize: 12, fontWeight: 700,
                    color: profile.mfaEnabled ? '#22c55e' : '#ef4444' }}>
                    {profile.mfaEnabled ? '✓ Enabled' : '✗ Not Enrolled'}
                  </span>
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>🎭 Role Assignment</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Platform Role</div>
                    <select className="input" style={{ width: '100%' }} value={role}
                      onChange={e => setRole(e.target.value as PlatformRole)}>
                      {(Object.keys(ROLE_LABELS) as PlatformRole[]).map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      {ROLE_DESCRIPTIONS[role]}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Account Status</div>
                    <select className="input" style={{ width: '100%' }} value={status}
                      onChange={e => setStatus(e.target.value as any)}>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="invited">Invited</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowMatrix(true)}>
                  🔐 Override Permissions…
                </button>
                <button className="btn btn-primary" onClick={doUpdate} disabled={loading || (role === profile.role && status === profile.status)}>
                  {loading ? '…' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ── Effective Permissions ── */}
          {tab === 'permissions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Effective Permissions</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {effectivePerms.length} permissions from role <strong>{ROLE_LABELS[role]}</strong>
                  </div>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowMatrix(true)}>
                  🔒 Add Overrides →
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                {effectivePerms.map(p => {
                  const meta = PERMISSION_META[p];
                  return (
                    <div key={p} style={{ padding: '6px 10px', borderRadius: 8,
                      background: 'var(--bg-canvas)', border: '1px solid var(--border)',
                      fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: '#22c55e' }}>{meta?.label ?? p}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{p}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Tenant Access ── */}
          {tab === 'tenants' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🏢 Tenant Access</div>
              {(profile.tenantIds ?? []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: 10 }}>
                  No tenant assignments
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(profile.tenantIds ?? []).map(tid => (
                    <div key={tid} style={{ padding: '10px 14px', borderRadius: 8,
                      background: 'var(--bg-canvas)', border: `1px solid ${tid === profile.tenantId ? 'var(--brand-500)44' : 'var(--border)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{tid}</span>
                          {tid === profile.tenantId && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--brand-400)', fontWeight: 700 }}>Primary</span>
                          )}
                        </div>
                        <RoleBadge role={profile.role} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type MainTab = 'users' | 'roles';

export default function PlatformUsersPage() {
  const { user: me, isSaasMasterAdmin } = useAuth();
  const performer = { uid: me?.uid ?? 'unknown', name: me?.name ?? 'Admin' };

  const [mainTab,   setMainTab]   = useState<MainTab>('users');
  const [users,     setUsers]     = useState<UserProfile[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [roleF,     setRoleF]     = useState<PlatformRole | 'all'>('all');
  const [statusF,   setStatusF]   = useState<'all' | 'active' | 'suspended' | 'invited'>('all');
  const [selected,  setSelected]  = useState<UserProfile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await getAllUsers()); }
    catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    if (q && !`${u.displayName} ${u.email} ${u.uid}`.toLowerCase().includes(q)) return false;
    if (roleF !== 'all' && u.role !== roleF) return false;
    if (statusF !== 'all' && u.status !== statusF) return false;
    return true;
  }), [users, search, roleF, statusF]);

  const stats = useMemo(() => ({
    total:     users.length,
    active:    users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    mfa:       users.filter(u => u.mfaEnabled).length,
    admins:    users.filter(u => u.role === 'saas_master_admin').length,
  }), [users]);

  const MAIN_TABS: { id: MainTab; label: string }[] = [
    { id: 'users', label: '👤 All Users' },
    { id: 'roles', label: '🎭 Role Reference' },
  ];

  return (
    <div className="page animate-fade-in">
      {selected && (
        <UserDetailModal
          profile={selected}
          performer={performer}
          onClose={() => setSelected(null)}
          onUpdated={u => { setUsers(prev => prev.map(p => p.uid === u.uid ? u : p)); setSelected(null); }}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform User Management</h1>
          <p className="page-subtitle">Manage all platform users, roles, and security permissions.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Users',   value: stats.total,     color: 'var(--brand-500)' },
          { label: 'Active',        value: stats.active,    color: '#22c55e' },
          { label: 'Suspended',     value: stats.suspended, color: '#ef4444' },
          { label: 'MFA Enrolled',  value: stats.mfa,       color: '#f59e0b' },
          { label: 'Master Admins', value: stats.admins,    color: '#818cf8' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {MAIN_TABS.map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: mainTab === t.id ? 700 : 500,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: `2px solid ${mainTab === t.id ? 'var(--brand-500)' : 'transparent'}`,
            color: mainTab === t.id ? 'var(--brand-500)' : 'var(--text-secondary)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {mainTab === 'users' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input className="input" placeholder="🔍 Search by name, email, UID…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 260px' }} />
            <select className="input" value={roleF} onChange={e => setRoleF(e.target.value as any)}>
              <option value="all">All Roles</option>
              {(Object.keys(ROLE_LABELS) as PlatformRole[]).map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <select className="input" value={statusF} onChange={e => setStatusF(e.target.value as any)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="invited">Invited</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
              {filtered.length} of {users.length} users
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Loading users…</div>
          ) : (
            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>MFA</th>
                    <th>Tenants</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.uid} onClick={() => setSelected(u)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <Avatar name={u.displayName} size={32} />
                          <div>
                            <div style={{ fontWeight: 700 }}>{u.displayName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><RoleBadge role={u.role} /></td>
                      <td><StatusBadge status={u.status} /></td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 700, color: u.mfaEnabled ? '#22c55e' : '#ef4444' }}>
                          {u.mfaEnabled ? '✓' : '✗'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{(u.tenantIds ?? []).length} tenant{(u.tenantIds ?? []).length !== 1 ? 's' : ''}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn btn-sm btn-secondary" onClick={() => setSelected(u)}>
                          Manage →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── ROLES TAB ── */}
      {mainTab === 'roles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {(Object.keys(ROLE_LABELS) as PlatformRole[]).map(role => {
            const perms   = ROLE_PERMISSIONS[role] ?? [];
            const modules = [...new Set(perms.map(p => PERMISSION_META[p]?.module).filter(Boolean))];
            const c = ROLE_COLOR[role] ?? { bg: '#64748b20', fg: '#94a3b8' };
            return (
              <div key={role} style={{ background: 'var(--bg-surface)', border: `1px solid ${c.fg}33`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px 14px', background: c.bg }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: c.fg }}>{ROLE_LABELS[role]}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{ROLE_DESCRIPTIONS[role]}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                      background: c.bg, color: c.fg, border: `1px solid ${c.fg}44` }}>
                      {perms.length} perms
                    </span>
                  </div>
                </div>
                <div style={{ padding: '12px 20px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Modules Access
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {modules.map(m => (
                      <span key={m} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6,
                        background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {m}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {perms.map(p => (
                      <div key={p} style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-tertiary)', padding: '1px 0' }}>
                        ✓ {p}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
