'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getAllUsers, type UserProfile, type PlatformRole } from '@/lib/platformService';
import {
  ROLE_LABELS, ROLE_DESCRIPTIONS,
} from '@/lib/tenantMemberService';
import {
  ROLE_PERMISSIONS, PERMISSION_META, PERMISSION_MODULES,
  type Permission, type PermissionModule,
} from '@/lib/rbacService';
import { usePageTitle } from '@/lib/PageTitleContext';
import { useAuth } from '@/lib/AuthContext';

// ─── Role colour palette ───────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  saas_master_admin:          { bg: '#6366f112', fg: '#818cf8', border: '#6366f133' },
  tenant_admin:               { bg: '#f59e0b12', fg: '#f59e0b', border: '#f59e0b33' },
  relationship_manager:       { bg: '#22c55e12', fg: '#22c55e', border: '#22c55e33' },
  cio:                        { bg: '#0ea5e912', fg: '#38bdf8', border: '#0ea5e933' },
  controller:                 { bg: '#a78bfa12', fg: '#a78bfa', border: '#a78bfa33' },
  compliance_officer:         { bg: '#ef444412', fg: '#f87171', border: '#ef444433' },
  report_viewer:              { bg: '#64748b12', fg: '#94a3b8', border: '#64748b33' },
  external_advisor:           { bg: '#f9731612', fg: '#fb923c', border: '#f9731633' },
  sales_operations:           { bg: '#10b98112', fg: '#34d399', border: '#10b98133' },
  business_manager:           { bg: '#8b5cf612', fg: '#c4b5fd', border: '#8b5cf633' },
  sales_manager:              { bg: '#eab30812', fg: '#fcd34d', border: '#eab30833' },
  revenue_manager:            { bg: '#06b6d412', fg: '#22d3ee', border: '#06b6d433' },
  account_executive:          { bg: '#3b82f612', fg: '#60a5fa', border: '#3b82f633' },
  sdr:                        { bg: '#84cc1612', fg: '#a3e635', border: '#84cc1633' },
  customer_success_manager:   { bg: '#ec489912', fg: '#f472b6', border: '#ec489933' },
};

const ALL_ROLES: PlatformRole[] = [
  'saas_master_admin', 'tenant_admin', 'relationship_manager',
  'cio', 'controller', 'compliance_officer', 'report_viewer', 'external_advisor',
  'sales_operations', 'business_manager',
  'sales_manager', 'revenue_manager', 'account_executive', 'sdr', 'customer_success_manager',
];

// Subset of modules to show in the matrix (keep it readable)
const MATRIX_MODULES: PermissionModule[] = [
  'Families', 'Portfolio', 'Documents', 'Reports',
  'Compliance', 'Audit', 'Admin', 'Platform',
];

// ─── Permission pill ──────────────────────────────────────────────────────────

function PermTag({ perm, sensitive }: { perm: string; sensitive?: boolean }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
      background: sensitive ? '#ef444415' : 'var(--bg-overlay)',
      color: sensitive ? '#f87171' : 'var(--text-secondary)',
      border: `1px solid ${sensitive ? '#ef444430' : 'var(--border)'}`,
      whiteSpace: 'nowrap',
    }}>
      {perm}
    </span>
  );
}

// ─── Role card ────────────────────────────────────────────────────────────────

function RoleCard({ role, userCount }: { role: PlatformRole; userCount: number }) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const c = ROLE_COLOR[role] ?? { bg: '#64748b12', fg: '#94a3b8', border: '#64748b33' };
  const perms = ROLE_PERMISSIONS[role] ?? [];

  // Group permissions by module
  const byModule = useMemo(() => {
    const map = new Map<string, Permission[]>();
    perms.forEach(p => {
      const mod = PERMISSION_META[p]?.module ?? 'Other';
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(p);
    });
    return Array.from(map.entries());
  }, [perms]);

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 16, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: c.fg, marginBottom: 4 }}>
            {ROLE_LABELS[role]}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {ROLE_DESCRIPTIONS[role]}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
          <div
            onClick={() => userCount > 0 && router.push(`/admin/users?role=${role}`)}
            style={{ fontSize: 22, fontWeight: 900, color: c.fg, cursor: userCount > 0 ? 'pointer' : 'default',
              textDecoration: userCount > 0 ? 'underline' : 'none', textUnderlineOffset: 3 }}
            title={userCount > 0 ? `View ${userCount} ${userCount === 1 ? 'user' : 'users'} with this role` : undefined}
          >
            {userCount}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
            {userCount === 1 ? 'user' : 'users'}
          </div>
        </div>
      </div>

      {/* Permission summary */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
          {perms.length === Object.keys(PERMISSION_META).length ? 'All permissions' : `${perms.length} permissions`} across {byModule.length} modules
        </span>
      </div>

      {/* Expand/collapse permission list */}
      <button onClick={() => setExpanded(v => !v)}
        style={{ background: 'transparent', border: `1px solid ${c.border}`, borderRadius: 8,
          padding: '6px 12px', fontSize: 11, fontWeight: 700, color: c.fg, cursor: 'pointer',
          alignSelf: 'flex-start', transition: 'all 0.15s' }}>
        {expanded ? '▲ Hide permissions' : '▼ Show permissions'}
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {byModule.map(([mod, mPerms]) => (
            <div key={mod}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{mod}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {mPerms.map(p => (
                  <PermTag key={p} perm={PERMISSION_META[p]?.label ?? p}
                    sensitive={PERMISSION_META[p]?.sensitive} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Permission Matrix ─────────────────────────────────────────────────────────

function PermMatrix({ roles }: { roles: PlatformRole[] }) {
  // Collect all permissions in selected modules
  const rows = useMemo(() => {
    const result: { permission: Permission; module: string; label: string; sensitive?: boolean }[] = [];
    MATRIX_MODULES.forEach(mod => {
      Object.values(PERMISSION_META)
        .filter(p => p.module === mod)
        .forEach(p => result.push({ permission: p.id, module: mod, label: p.label, sensitive: p.sensitive }));
    });
    return result;
  }, []);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 14px', position: 'sticky', left: 0,
              background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
              color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.07em', whiteSpace: 'nowrap', minWidth: 180 }}>
              Permission
            </th>
            {roles.map(r => {
              const c = ROLE_COLOR[r];
              return (
                <th key={r} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)',
                  color: c?.fg ?? 'var(--text-secondary)', fontWeight: 800, fontSize: 10,
                  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  textAlign: 'center', minWidth: 90 }}>
                  {ROLE_LABELS[r]?.replace(/[🔐👑💼📊💰⚖️👁🤝]/u, '').trim()}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isModuleHeader = i === 0 || rows[i - 1].module !== row.module;
            return (
              <React.Fragment key={row.permission}>
                {isModuleHeader && (
                  <tr>
                    <td colSpan={roles.length + 1} style={{
                      padding: '10px 14px 4px',
                      fontSize: 10, fontWeight: 800, color: 'var(--text-tertiary)',
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      background: 'var(--bg-canvas)', borderTop: '1px solid var(--border)',
                    }}>
                      {row.module}
                    </td>
                  </tr>
                )}
                <tr style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-canvas)' }}>
                  <td style={{ padding: '6px 14px', position: 'sticky', left: 0,
                    background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-canvas)',
                    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    <span style={{ color: row.sensitive ? '#f87171' : 'var(--text-primary)', fontWeight: 600 }}>
                      {row.label}
                    </span>
                    {row.sensitive && <span style={{ marginLeft: 4, color: '#f87171' }}>⚠</span>}
                  </td>
                  {roles.map(r => {
                    const has = (ROLE_PERMISSIONS[r] ?? []).includes(row.permission);
                    const c = ROLE_COLOR[r];
                    return (
                      <td key={r} style={{ textAlign: 'center', padding: '6px 10px',
                        borderBottom: '1px solid var(--border)' }}>
                        {has ? (
                          <span style={{ fontSize: 13, color: c?.fg ?? '#22c55e', fontWeight: 900 }}>✓</span>
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--border)' }}>–</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PlatformRolesPage() {
  usePageTitle('Roles & Permissions');
  const { isSaasMasterAdmin } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'cards' | 'matrix'>('cards');

  useEffect(() => {
    if (!isSaasMasterAdmin) { setLoading(false); return; }
    getAllUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, [isSaasMasterAdmin]);

  // Count users per role
  const roleCounts = useMemo(() => {
    const map = new Map<PlatformRole, number>();
    ALL_ROLES.forEach(r => map.set(r, 0));
    users.forEach(u => {
      if (u.role) map.set(u.role, (map.get(u.role) ?? 0) + 1);
    });
    return map;
  }, [users]);

  return (
    <div className="page-wrapper animate-fade-in mx-auto max-w-7xl">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 pb-5 border-b border-tremor-border gap-4">
        <div>
          <h1 className="text-3xl font-bold text-tremor-content-strong tracking-tight">Roles &amp; Permissions</h1>
            <p className="mt-2 text-tremor-content">
            System-defined roles and their permission sets. Roles are code-defined for security auditability.
          </p>
        </div>
        <div className="page-actions">
          <button className={`btn ${view === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('cards')}>🃏 Role Cards</button>
          <button className={`btn ${view === 'matrix' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('matrix')}>📊 Permission Matrix</button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 24,
        background: 'var(--brand-500)10', border: '1px solid var(--brand-500)33',
        fontSize: 13, color: 'var(--brand-400)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>🛡</span>
        <span>
          <strong>Roles are code-defined</strong> for compliance auditability. To modify a role's permissions,
          update <code style={{ fontFamily: 'monospace', fontSize: 11 }}>rbacService.ts</code>.{' '}
          <span style={{ color: '#f87171' }}>⚠ Red</span> permissions require explicit authorization.{' '}
          <span style={{ color: 'var(--text-tertiary)' }}>Click a user count to view filtered members →</span>
        </span>
      </div>

      {/* KPI strip */}
      {!loading && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {ALL_ROLES.map(r => {
            const c = ROLE_COLOR[r];
            const count = roleCounts.get(r) ?? 0;
            return (
              <div
                key={r}
                onClick={() => count > 0 && router.push(`/admin/users?role=${r}`)}
                style={{ padding: '10px 16px', borderRadius: 10,
                  background: c.bg, border: `1px solid ${c.border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80,
                  cursor: count > 0 ? 'pointer' : 'default',
                  transition: 'opacity 0.15s',
                  opacity: count === 0 ? 0.5 : 1,
                }}
                title={count > 0 ? `View ${count} ${count === 1 ? 'user' : 'users'} →` : undefined}
              >
                <div style={{ fontSize: 18, fontWeight: 900, color: c.fg }}>{count}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700,
                  textTransform: 'uppercase', textAlign: 'center', marginTop: 2 }}>
                  {ROLE_LABELS[r]?.replace(/[🔐👑💼📊💰⚖️👁🤝]/u, '').trim().split(' ')[0]}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Content */}
      {view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {ALL_ROLES.map(r => (
            <RoleCard key={r} role={r} userCount={roleCounts.get(r) ?? 0} />
          ))}
        </div>
      )}

      {view === 'matrix' && (
        <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 0, overflow: 'hidden' }}>
          <PermMatrix roles={ALL_ROLES} />
        </div>
      )}
    </div>
  );
}
