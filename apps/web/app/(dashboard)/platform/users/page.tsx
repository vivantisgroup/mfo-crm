'use client';

/**
 * /platform/users — Redirects to tenant-gated user management.
 * 
 * Per the architecture requirement: user management must always go through
 * tenant selection. This page lists all users but in read-only mode with
 * clickable tenant badges that navigate to /platform/tenants/[id]/users.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getAllUsers, type UserProfile, type PlatformRole } from '@/lib/platformService';
import { getAllSubscriptions, type TenantSubscription } from '@/lib/subscriptionService';
import { ROLE_LABELS } from '@/lib/tenantMemberService';
import {
  ROLE_PERMISSIONS, PERMISSION_META, PERMISSION_MODULES,
  effectivePermissions,
} from '@/lib/rbacService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, { bg: string; fg: string }> = {
  saas_master_admin:    { bg: '#6366f120', fg: '#818cf8' },
  tenant_admin:         { bg: '#f59e0b20', fg: '#f59e0b' },
  relationship_manager: { bg: '#22c55e20', fg: '#22c55e' },
  cio:                  { bg: '#0ea5e920', fg: '#38bdf8' },
  controller:           { bg: '#a78bfa20', fg: '#a78bfa' },
  compliance_officer:   { bg: '#ef444420', fg: '#f87171' },
  report_viewer:        { bg: '#64748b20', fg: '#94a3b8' },
  external_advisor:     { bg: '#f9731620', fg: '#fb923c' },
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PlatformUsersPage() {
  const { user: me, isSaasMasterAdmin } = useAuth();
  const router = useRouter();

  const [users,    setUsers]    = useState<UserProfile[]>([]);
  const [tenants,  setTenants]  = useState<TenantSubscription[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [roleF,    setRoleF]    = useState<string>('all');
  const [statusF,  setStatusF]  = useState<string>('all');

  // Build tenantId → tenantName map for display
  const tenantMap = useMemo(() =>
    new Map(tenants.map(t => [t.tenantId, t.tenantName])),
    [tenants]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, t] = await Promise.all([getAllUsers(), getAllSubscriptions()]);
      setUsers(u);
      setTenants(t);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    if (q && !`${u.displayName} ${u.email} ${u.uid}`.toLowerCase().includes(q)) return false;
    if (roleF   !== 'all' && u.role   !== roleF)   return false;
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

  return (
    <div className="page animate-fade-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Users</h1>
          <p className="page-subtitle">
            Read-only directory. To manage a user, click their tenant badge → opens that tenant's user management.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        padding: '12px 16px', borderRadius: 10, marginBottom: 24,
        background: 'var(--brand-500)10', border: '1px solid var(--brand-500)33',
        fontSize: 13, color: 'var(--brand-400)', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span>ℹ️</span>
        <span>
          To <strong>add, edit, or remove</strong> a user from a tenant, go to{' '}
          <button
            onClick={() => router.push('/platform/tenants')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-400)', fontWeight: 700, textDecoration: 'underline', padding: 0, fontSize: 13 }}
          >
            Tenant Management
          </button>
          {' '}→ select a tenant → click the <strong>Members</strong> tab.
        </span>
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
          <div key={k.label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px 20px',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="input" placeholder="🔍 Search by name, email, UID…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 260px' }} />
        <select className="input" value={roleF} onChange={e => setRoleF(e.target.value)}>
          <option value="all">All Roles</option>
          {(Object.keys(ROLE_LABELS) as PlatformRole[]).map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select className="input" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="invited">Invited</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
          {filtered.length} of {users.length} users
        </span>
      </div>

      {/* User table */}
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
                <th style={{ minWidth: 220 }}>Tenants (click to manage)</th>
                <th>Last Login</th>
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
                  <td><RoleBadge role={u.role} /></td>
                  <td><StatusBadge status={u.status} /></td>
                  <td>
                    <span style={{ fontSize: 12, fontWeight: 700,
                      color: u.mfaEnabled ? '#22c55e' : '#ef4444' }}>
                      {u.mfaEnabled ? '✓' : '✗'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(u.tenantIds ?? []).length === 0 ? (
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No tenants</span>
                      ) : (u.tenantIds ?? []).map(tid => {
                        const name = tenantMap.get(tid) ?? tid;
                        return (
                          <button
                            key={tid}
                            onClick={() => router.push(`/platform/tenants?open=${tid}&tab=members`)}
                            title={`Manage users in ${name}`}
                            style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 8,
                              background: tid === u.tenantId ? 'var(--brand-500)22' : 'var(--bg-elevated)',
                              color:      tid === u.tenantId ? 'var(--brand-400)' : 'var(--text-secondary)',
                              border:     `1px solid ${tid === u.tenantId ? 'var(--brand-500)44' : 'var(--border)'}`,
                              cursor: 'pointer', fontWeight: tid === u.tenantId ? 700 : 400,
                              transition: 'all 0.12s',
                            }}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
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
