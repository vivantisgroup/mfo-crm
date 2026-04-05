'use client';

import { Search } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
 getAllUsers, updateUserProfile, suspendUser, reactivateUser, deleteUser,
 type UserProfile, type PlatformRole,
} from '@/lib/platformService';
import { getAllSubscriptions, type TenantSubscription } from '@/lib/subscriptionService';
import { ROLE_LABELS, TENANT_ROLES } from '@/lib/tenantMemberService';
import { usePageTitle } from '@/lib/PageTitleContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_ROLES: PlatformRole[] = [
 'saas_master_admin', 'tenant_admin', 'relationship_manager',
 'cio', 'controller', 'compliance_officer', 'report_viewer', 'external_advisor',
];

const ROLE_COLOR: Record<string, { bg: string; fg: string }> = {
 saas_master_admin: { bg: '#6366f120', fg: '#818cf8' },
 tenant_admin: { bg: '#f59e0b20', fg: '#f59e0b' },
 relationship_manager: { bg: '#22c55e20', fg: '#22c55e' },
 cio: { bg: '#0ea5e920', fg: '#38bdf8' },
 controller: { bg: '#a78bfa20', fg: '#a78bfa' },
 compliance_officer: { bg: '#ef444420', fg: '#f87171' },
 report_viewer: { bg: '#64748b20', fg: '#94a3b8' },
 external_advisor: { bg: '#f9731620', fg: '#fb923c' },
};

function RoleBadge({ role }: { role: string }) {
 const c = ROLE_COLOR[role] ?? { bg: '#64748b20', fg: '#94a3b8' };
 return (
 <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8,
 background: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>
 {ROLE_LABELS[role as PlatformRole] ?? role}
 </span>
 );
}

function StatusBadge({ status }: { status: string }) {
 const map: Record<string, { bg: string; fg: string; label: string }> = {
 active: { bg: '#22c55e18', fg: '#22c55e', label: 'Active' },
 suspended: { bg: '#ef444418', fg: '#ef4444', label: 'Suspended' },
 invited: { bg: '#f59e0b18', fg: '#f59e0b', label: 'Invited' },
 };
 const c = map[status] ?? { bg: '#64748b18', fg: '#94a3b8', label: status };
 return (
 <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8,
 background: c.bg, color: c.fg }}>{c.label}</span>
 );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
 const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
 return (
 <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0,
 background: `hsl(${hue},60%,45%)`,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 color: '#fff', fontWeight: 800, fontSize: size * 0.38 }}>
 {name[0]?.toUpperCase() ?? '?'}
 </div>
 );
}

function Modal({ onClose, children, width = 520 }: { onClose: () => void; children: React.ReactNode; width?: number }) {
 return (
 <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center',
 justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
 onClick={e => e.target === e.currentTarget && onClose()}>
 <div style={{ width, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
 background: 'var(--bg-elevated)', borderRadius: 20, border: '1px solid var(--border)',
 boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
 {children}
 </div>
 </div>
 );
}

// ─── Add/Edit User Modal ───────────────────────────────────────────────────────

function UserModal({
 mode, user, onClose, onSaved, performer, tenants,
}: {
 mode: 'add' | 'edit';
 user?: UserProfile;
 onClose: () => void;
 onSaved: () => void;
 performer: { uid: string; name: string };
 tenants: TenantSubscription[];
}) {
 const [displayName, setDisplayName] = useState(user?.displayName ?? '');
 const [email, setEmail] = useState(user?.email ?? '');
 const [role, setRole] = useState<PlatformRole>(user?.role ?? 'report_viewer');
 const [department, setDepartment] = useState(user?.department ?? '');
 const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
 const [phone, setPhone] = useState(user?.phone ?? '');
 const [saving, setSaving] = useState(false);
 const [msg, setMsg] = useState<string | null>(null);
 const [sendWelcome, setSendWelcome] = useState(true);

 async function handleSubmit() {
 if (!email.trim() || !displayName.trim()) { setMsg('❌ Email and Display Name are required.'); return; }
 setSaving(true); setMsg(null);
 try {
 if (mode === 'add') {
 // Create Firebase Auth user via Admin SDK API
 const { getAuth } = await import('firebase/auth');
 const { firebaseApp } = await import('@mfo-crm/config');
 const idToken = await getAuth(firebaseApp).currentUser?.getIdToken(true);
 if (!idToken) { setMsg('❌ Session expired.'); return; }

 const res = await fetch('/api/admin/users', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ idToken, email: email.trim(), displayName: displayName.trim() }),
 });
 const data = await res.json();
 if (!res.ok) { setMsg(`❌ ${data.error ?? 'Failed to create user'}`); return; }

 // Send welcome email with temporary password (instead of Firebase password-reset)
 let statusNote = '';
 if (sendWelcome && data.tempPassword) {
 try {
 const emailRes = await fetch('/api/email/send-welcome', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 idToken,
 to: email.trim(),
 displayName: displayName.trim(),
 tempPassword: data.tempPassword,
 tenantName: 'Platform HQ',
 }),
 });
 const emailData = await emailRes.json();
 if (emailData.sent) {
 statusNote = ' Welcome email with temporary password sent.';
 } else {
 // SMTP not configured — show temp password inline so admin can communicate it
 statusNote = ` ⚠️ SMTP not configured. Temporary password: ${data.tempPassword}`;
 }
 } catch {
 statusNote = ` ⚠️ Email failed. Temporary password: ${data.tempPassword}`;
 }
 } else if (data.tempPassword) {
 statusNote = ` Temporary password: ${data.tempPassword}`;
 }

 setMsg(`✅ User created.${statusNote} They must change their password on first login.`);
 } else if (user) {
 await updateUserProfile(user.uid, { displayName: displayName.trim(), role, department: department.trim() || undefined, jobTitle: jobTitle.trim() || undefined, phone: phone.trim() || undefined });
 setMsg('✅ User updated.');
 }
 setTimeout(() => { onSaved(); onClose(); }, 1400);
 } catch (e: any) { setMsg(`❌ ${e.message}`); }
 finally { setSaving(false); }
 }

 return (
 <Modal onClose={onClose}>
 <div style={{ padding: '28px 32px' }}>
 <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>
 {mode === 'add' ? '+ Add Platform User' : `Edit — ${user?.displayName}`}
 </div>

 {msg && (
 <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
 background: msg.startsWith('✅') ? '#22c55e15' : '#ef444415',
 color: msg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>{msg}</div>
 )}

 <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
 {mode === 'add' && (
 <div>
 <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Email</div>
 <input className="input" style={{ width: '100%' }} type="email"
 value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com" />
 </div>
 )}

 <div>
 <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Display Name</div>
 <input className="input" style={{ width: '100%' }}
 value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Full name" />
 </div>

 <div>
 <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Platform Role</div>
 <select className="input" style={{ width: '100%' }} value={role} onChange={e => setRole(e.target.value as PlatformRole)}>
 {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
 </select>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
 Tenant-specific roles are managed in the Tenants page.
 </div>
 </div>

 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
 <div>
 <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Department</div>
 <select className="input" style={{ width: '100%' }} value={department} onChange={e => setDepartment(e.target.value)}>
 <option value="">— None —</option>
 {['Sales', 'Revenue Operations', 'Customer Success', 'Marketing', 'Engineering', 'Operations', 'Finance', 'Executive', 'Legal', 'HR'].map(d => (
 <option key={d} value={d}>{d}</option>
 ))}
 </select>
 </div>
 <div>
 <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Job Title</div>
 <input className="input" style={{ width: '100%' }} value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Account Executive" />
 </div>
 <div style={{ gridColumn: '1/-1' }}>
 <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Phone</div>
 <input className="input" style={{ width: '100%' }} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555-000-0000" />
 </div>
 </div>

 {mode === 'add' && (
 <>
 <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
 <input type="checkbox" checked={sendWelcome} onChange={e => setSendWelcome(e.target.checked)}
 style={{ accentColor: 'var(--brand-500)', width: 14, height: 14 }} />
 <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
 Send welcome email with temporary password
 </span>
 </label>
 <div style={{ padding: '10px 14px', background: '#6366f108', borderRadius: 8,
 border: '1px solid #6366f130', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
 🔐 A system-generated password will be created. The user <strong style={{ color: 'var(--text-primary)' }}>must change it</strong> on first login.
 </div>
 </>
 )}

 <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
 <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
 <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
 {saving ? '…' : mode === 'add' ? 'Create & Send Invite' : 'Save Changes'}
 </button>
 </div>
 </div>
 </div>
 </Modal>
 );
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({ user, onClose, onDeleted, performer }: {
 user: UserProfile;
 onClose: () => void;
 onDeleted: () => void;
 performer: { uid: string; name: string };
}) {
 const [confirm, setConfirm] = useState('');
 const [deleting, setDeleting] = useState(false);
 const [msg, setMsg] = useState<string | null>(null);
 const match = confirm.trim() === user.displayName.trim();

 async function handleDelete() {
 if (!match) return;
 setDeleting(true); setMsg(null);
 try {
 await deleteUser(user.uid, user.displayName, performer);
 setMsg('✅ User deleted.');
 setTimeout(() => { onDeleted(); onClose(); }, 700);
 } catch (e: any) { setMsg(`❌ ${e.message}`); setDeleting(false); }
 }

 return (
 <Modal onClose={onClose} width={480}>
 <div style={{ padding: '28px 32px' }}>
 <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', marginBottom: 12 }}>🗑 Delete User</div>
 <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
 This will permanently remove <strong>{user.displayName}</strong> ({user.email}) from the platform
 and revoke access to all tenants. This action cannot be undone.
 </div>
 {msg && (
 <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13,
 background: msg.startsWith('✅') ? '#22c55e15' : '#ef444415',
 color: msg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>{msg}</div>
 )}
 <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6 }}>
 Type <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{user.displayName}</span> to confirm
 </div>
 <input className="input" style={{ width: '100%', marginBottom: 16,
 borderColor: match ? '#22c55e' : confirm ? '#ef4444' : undefined }}
 value={confirm} onChange={e => setConfirm(e.target.value)}
 placeholder={`Type "${user.displayName}"`} />
 <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
 <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
 <button className="btn" style={{ background: '#ef4444', color: '#fff', opacity: match ? 1 : 0.4 }}
 onClick={handleDelete} disabled={!match || deleting}>
 {deleting ? '…' : 'Delete Permanently'}
 </button>
 </div>
 </div>
 </Modal>
 );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PlatformUsersPage() {
 const { user: me, isSaasMasterAdmin } = useAuth();
 usePageTitle('Platform Users');

 const [users, setUsers] = useState<UserProfile[]>([]);
 const [tenants, setTenants] = useState<TenantSubscription[]>([]);
 const [loading, setLoading] = useState(true);
 const [msg, setMsg] = useState<string | null>(null);

 // Filters
 const [search, setSearch] = useState('');
 const [roleF, setRoleF] = useState('all');
 const [statusF, setStatusF] = useState('all');

 // Modals
 const [showAdd, setShowAdd] = useState(false);
 const [editing, setEditing] = useState<UserProfile | null>(null);
 const [deleting, setDeleting] = useState<UserProfile | null>(null);

 const performer = useMemo(() => ({
 uid: me?.uid ?? 'unknown',
 name: me?.name ?? me?.email ?? 'Admin',
 }), [me]);

 const tenantMap = useMemo(() =>
 new Map(tenants.map(t => [t.tenantId, t.tenantName])), [tenants]);

 const load = useCallback(async () => {
 setLoading(true);
 try {
 const [u, t] = await Promise.all([getAllUsers(), getAllSubscriptions()]);
 setUsers(u.sort((a, b) => a.displayName.localeCompare(b.displayName)));
 setTenants(t);
 } catch {}
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
 total: users.length,
 active: users.filter(u => u.status === 'active').length,
 suspended: users.filter(u => u.status === 'suspended').length,
 invited: users.filter(u => u.status === 'invited').length,
 mfa: users.filter(u => u.mfaEnabled).length,
 admins: users.filter(u => u.role === 'saas_master_admin').length,
 }), [users]);

 async function handleFixWorkspace(u: UserProfile) {
 setMsg(null);
 try {
 const { addMemberToTenant } = await import('@/lib/tenantMemberService');
 await addMemberToTenant(
 'master', 'Platform HQ',
 { uid: u.uid, email: u.email, displayName: u.displayName, tenantIds: u.tenantIds ?? [] },
 u.role, performer,
 );
 setMsg(`✅ ${u.displayName} workspace fixed — assigned to Platform HQ.`);
 await load();
 } catch (e: any) { setMsg(`❌ ${e.message}`); }
 }

 async function handleToggleSuspend(u: UserProfile) {
 setMsg(null);
 try {
 if (u.status === 'suspended') {
 await reactivateUser(u.uid, u.displayName, performer);
 setMsg(`✅ ${u.displayName} reactivated.`);
 } else {
 await suspendUser(u.uid, u.displayName, performer);
 setMsg(`✅ ${u.displayName} suspended.`);
 }
 await load();
 } catch (e: any) { setMsg(`❌ ${e.message}`); }
 }

 return (
 <div className="page-wrapper animate-fade-in w-full px-4 lg:px-8">

 {/* Modals */}
 {showAdd && (
 <UserModal mode="add" onClose={() => setShowAdd(false)}
 onSaved={load} performer={performer} tenants={tenants} />
 )}
 {editing && (
 <UserModal mode="edit" user={editing} onClose={() => setEditing(null)}
 onSaved={load} performer={performer} tenants={tenants} />
 )}
 {deleting && (
 <DeleteModal user={deleting} onClose={() => setDeleting(null)}
 onDeleted={load} performer={performer} />
 )}

 {/* Header */}
 

 {/* Global message */}
 {msg && (
 <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
 background: msg.startsWith('✅') ? '#22c55e15' : '#ef444415',
 color: msg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>
 {msg}
 </div>
 )}

 {/* KPI Row */}
 <div className="stat-grid" style={{ marginBottom: 24 }}>
 {[
 { label: 'Total', value: stats.total, color: 'var(--brand-500)' },
 { label: 'Active', value: stats.active, color: '#22c55e' },
 { label: 'Suspended', value: stats.suspended, color: '#ef4444' },
 { label: 'Invited', value: stats.invited, color: '#f59e0b' },
 { label: 'MFA On', value: stats.mfa, color: '#38bdf8' },
 { label: 'Admins', value: stats.admins, color: '#818cf8' },
 ].map(k => (
 <div key={k.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)',
 borderRadius: 12, padding: '16px 20px' }}>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700,
 textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{k.label}</div>
 <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.value}</div>
 </div>
 ))}
 </div>

 {/* Filters */}
 <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
 <div className="header-search cursor-text max-w-md w-full" style={{ flex: '1 1 260px' }}>
   <Search size={16} className="text-tertiary shrink-0" />
   <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, UID…" className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-primary placeholder-tertiary" />
 </div>
 <select className="input" value={roleF} onChange={e => setRoleF(e.target.value)}>
 <option value="all">All Roles</option>
 {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
 </select>
 <select className="input" value={statusF} onChange={e => setStatusF(e.target.value)}>
 <option value="all">All Statuses</option>
 <option value="active">Active</option>
 <option value="suspended">Suspended</option>
 <option value="invited">Invited</option>
 </select>
 <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
 {filtered.length} of {users.length}
 </span>
 </div>

 {/* Table */}
 {loading ? (
 <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>Loading users…</div>
 ) : filtered.length === 0 ? (
 <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>No users found</div>
 ) : (
 <div className="card table-wrap">
 <table>
 <thead>
 <tr>
 <th>User</th>
 <th>Department / Title</th>
 <th>Platform Role</th>
 <th>Status</th>
 <th>MFA</th>
 <th>Tenants</th>
 <th>Last Login</th>
 <th style={{ textAlign: 'right' }}>Actions</th>
 </tr>
 </thead>
 <tbody>
 {filtered.map(u => (
 <tr key={u.uid}>
 <td>
 <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
 <Avatar name={u.displayName} size={32} />
 <div>
 <div style={{ fontWeight: 700 }}>{u.displayName}</div>
 <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.email}</div>
 </div>
 </div>
 </td>
 <td>
 {(u as any).department || (u as any).jobTitle ? (
 <div>
 {(u as any).department && <div style={{ fontSize: 12, fontWeight: 700 }}>{(u as any).department}</div>}
 {(u as any).jobTitle && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{(u as any).jobTitle}</div>}
 </div>
 ) : <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>—</span>}
 </td>
 <td><RoleBadge role={u.role} /></td>
 <td><StatusBadge status={u.status} /></td>
 <td>
 <span style={{ fontSize: 12, fontWeight: 700,
 color: u.mfaEnabled ? '#22c55e' : '#64748b' }}>
 {u.mfaEnabled ? '✓ On' : '✗ Off'}
 </span>
 </td>
 <td>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
 {(u.tenantIds ?? []).length === 0 ? (
 <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>—</span>
 ) : (u.tenantIds ?? []).slice(0, 3).map(tid => (
 <span key={tid} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6,
 background: tid === u.tenantId ? 'var(--brand-500)22' : 'var(--bg-overlay)',
 color: tid === u.tenantId ? 'var(--brand-400)' : 'var(--text-secondary)',
 border: `1px solid ${tid === u.tenantId ? 'var(--brand-500)44' : 'var(--border)'}`,
 fontWeight: tid === u.tenantId ? 700 : 400 }}>
 {tenantMap.get(tid) ?? tid}
 </span>
 ))}
 {(u.tenantIds ?? []).length > 3 && (
 <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{(u.tenantIds ?? []).length - 3}</span>
 )}
 </div>
 </td>
 <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
 {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
 </td>
 <td>
 <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
 {isSaasMasterAdmin && u.uid !== me?.uid && (
 <>
 <button className="btn btn-sm btn-secondary"
 onClick={() => setEditing(u)}>✏ Edit</button>
 <button className="btn btn-sm btn-secondary"
 style={{ color: u.status === 'suspended' ? '#22c55e' : '#f59e0b' }}
 onClick={() => handleToggleSuspend(u)}>
 {u.status === 'suspended' ? '✓ Activate' : '⏸ Suspend'}
 </button>
 <button className="btn btn-sm btn-secondary"
 style={{ color: '#ef4444', borderColor: '#ef444440' }}
 onClick={() => setDeleting(u)}>🗑</button>
 </>
 )}
 {isSaasMasterAdmin && (u.tenantIds ?? []).length === 0 && (
 <button className="btn btn-sm btn-secondary"
 style={{ color: '#f59e0b', borderColor: '#f59e0b40', fontWeight: 700 }}
 onClick={() => handleFixWorkspace(u)}
 title="User has no workspace assigned — click to fix">
 🔧 Fix Workspace
 </button>
 )}
 {u.uid === me?.uid && (
 <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>You</span>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 );
}
