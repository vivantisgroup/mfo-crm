'use client';

import { Search } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditAction =
  | 'USER_LOGIN' | 'USER_LOGOUT' | 'USER_LOGIN_FAILED'
  | 'TENANT_CREATED' | 'TENANT_UPDATED' | 'TENANT_SUSPENDED'
  | 'API_KEY_SET' | 'API_KEY_ROTATED' | 'SETTINGS_CHANGED'
  | 'SUBSCRIPTION_CHANGED' | 'INVOICE_GENERATED' | 'INVOICE_PAID'
  | 'SUPPORT_TICKET_CREATED' | 'SUPPORT_TICKET_RESOLVED'
  | 'ROLE_GRANTED' | 'ROLE_REVOKED' | 'USER_INVITED' | 'USER_REMOVED'
  | 'DATA_EXPORT' | 'DOCUMENT_ACCESS' | 'REPORT_GENERATED'
  | 'MFA_ENROLLED' | 'MFA_FAILED' | 'PASSWORD_RESET'
  | 'SUITABILITY_SUBMITTED' | 'CLIENT_SUBMIT_SUITABILITY'
  | 'CONFIG_UPDATED' | 'COMPLIANCE_FLAG';

type Severity = 'info' | 'warning' | 'critical';

interface AuditEntry {
  id: string;
  timestamp: string;
  tenantId: string;
  tenantName: string;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  resourceType: string;
  resourceName: string;
  severity: Severity;
  status: 'success' | 'failure' | 'warning';
  ipAddress: string;
  location: string;
  userAgent: string;
  metadata?: string;
  sessionId?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

// MOCK REMOVED - using live data

const SEVERITY_COLORS: Record<Severity, string> = {
  info: '#22d3ee',
  warning: '#f59e0b',
  critical: '#ef4444',
};

const ACTION_CATEGORY: Partial<Record<AuditAction, string>> = {
  USER_LOGIN: 'Auth', USER_LOGOUT: 'Auth', USER_LOGIN_FAILED: 'Auth',
  MFA_ENROLLED: 'Auth', MFA_FAILED: 'Auth', PASSWORD_RESET: 'Auth',
  ROLE_GRANTED: 'Access Control', ROLE_REVOKED: 'Access Control',
  USER_INVITED: 'Access Control', USER_REMOVED: 'Access Control',
  API_KEY_SET: 'Config', API_KEY_ROTATED: 'Config',
  CONFIG_UPDATED: 'Config', SETTINGS_CHANGED: 'Config',
  TENANT_CREATED: 'Tenants', TENANT_UPDATED: 'Tenants', TENANT_SUSPENDED: 'Tenants',
  SUBSCRIPTION_CHANGED: 'Billing', INVOICE_GENERATED: 'Billing', INVOICE_PAID: 'Billing',
  DOCUMENT_ACCESS: 'Data', DATA_EXPORT: 'Data', REPORT_GENERATED: 'Data',
  SUPPORT_TICKET_CREATED: 'Support', SUPPORT_TICKET_RESOLVED: 'Support',
  SUITABILITY_SUBMITTED: 'Compliance', CLIENT_SUBMIT_SUITABILITY: 'Compliance', COMPLIANCE_FLAG: 'Compliance',
};

function SeverityBadge({ severity }: { severity: Severity }) {
  const color = SEVERITY_COLORS[severity];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, textTransform: 'uppercase',
      background: `${color}22`, color, border: `1px solid ${color}44`
    }}>
      {severity === 'critical' ? '⚠ ' : ''}{severity}
    </span>
  );
}

function StatusDot({ status }: { status: 'success' | 'failure' | 'warning' }) {
  const colors = { success: '#22c55e', failure: '#ef4444', warning: '#f59e0b' };
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: colors[status], marginRight: 5, boxShadow: `0 0 5px ${colors[status]}88` }} />;
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function AuditStats({ logs }: { logs: AuditEntry[] }) {
  const stats = useMemo(() => ({
    total: logs.length,
    critical: logs.filter(l => l.severity === 'critical').length,
    authEvents: logs.filter(l => ACTION_CATEGORY[l.action] === 'Auth').length,
    failures: logs.filter(l => l.status === 'failure').length,
    tenants: new Set(logs.map(l => l.tenantId)).size,
  }), [logs]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
      {[
        { label: 'Total Events', value: stats.total, color: '#6366f1', icon: '📋' },
        { label: 'Auth Events', value: stats.authEvents, color: '#22d3ee', icon: '🔑' },
        { label: 'Failures', value: stats.failures, color: '#ef4444', icon: '✗' },
        { label: 'Critical', value: stats.critical, color: '#f59e0b', icon: '⚠' },
        { label: 'Tenants Active', value: stats.tenants, color: '#22c55e', icon: '🏢' },
      ].map(stat => (
        <div key={stat.label} style={{ padding: '16px 20px', background: 'var(--bg-elevated)', border: `1px solid ${stat.color}33`, borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: stat.color }}>{stat.value}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('All');
  const [sevFilter, setSevFilter] = useState<'all' | Severity>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');

  const [logsList, setLogsList] = useState<AuditEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchLogs = async () => {
    setFetching(true);
    try {
      const q = query(collection(db, 'audit_logs'), orderBy('occurredAt', 'desc'), limit(500));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => {
        const d = doc.data();
        let severity: Severity = 'info';
        if (d.status === 'failure') severity = 'critical';
        else if (d.action?.includes('DELETE') || d.action?.includes('REMOVE') || d.action?.includes('FAIL') || d.action?.includes('RESET')) severity = 'warning';
        return {
          id: doc.id,
          timestamp: d.occurredAt || new Date().toISOString(),
          tenantId: d.tenantId || 'unknown',
          tenantName: d.tenantId === 'master' ? 'Platform HQ' : (d.tenantId || 'Unknown'),
          userId: d.userId || 'system',
          userName: d.userName || 'System',
          userRole: d.userRole || 'User',
          action: (d.action || 'UNKNOWN') as AuditAction,
          resourceType: d.resourceType || 'system',
          resourceName: d.resourceName || d.resourceId || 'System',
          severity,
          status: (d.status || 'success') as 'success' | 'failure' | 'warning',
          ipAddress: d.ipAddress || 'unknown',
          location: d.location || 'unknown',
          userAgent: d.userAgent || 'unknown',
          metadata: typeof d.metadata === 'string' ? d.metadata : JSON.stringify(d.metadata ?? {}),
          sessionId: d.sessionId || ''
        };
      });
      setLogsList(data);
    } catch (e) {
      console.error('[audit] Failed to fetch:', e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const tenants = useMemo(() => ['All', ...Array.from(new Set(logsList.map(l => l.tenantName)))], [logsList]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(Object.values(ACTION_CATEGORY)))], []);

  const filtered = useMemo(() => {
    return logsList.filter(log => {
      if (search && !`${log.userName} ${log.action} ${log.resourceName} ${log.tenantName}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (tenantFilter !== 'All' && log.tenantName !== tenantFilter) return false;
      if (sevFilter !== 'all' && log.severity !== sevFilter) return false;
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (categoryFilter !== 'All' && ACTION_CATEGORY[log.action] !== categoryFilter) return false;
      return true;
    });
  }, [logsList, search, tenantFilter, sevFilter, statusFilter, categoryFilter]);

  return (
    <div className="page-wrapper animate-fade-in w-full h-full flex flex-col flex-1 px-4 lg:px-6 pt-6 pb-12 overflow-y-auto">
      <AuditStats logs={filtered} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <div className="header-search cursor-text max-w-md w-full" style={{ flex: '1 1 220px', padding: '8px 12px', fontSize: 13 }}>
          <Search size={16} className="text-tertiary shrink-0" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events (user, action, resource…)" className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-primary placeholder-tertiary" />
        </div>
        <select value={tenantFilter} onChange={e => setTenantFilter(e.target.value)} className="input" style={{ padding: '8px 12px', fontSize: 13 }}>
          {tenants.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input" style={{ padding: '8px 12px', fontSize: 13 }}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value as any)} className="input" style={{ padding: '8px 12px', fontSize: 13 }}>
          <option value="all">All Severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="input" style={{ padding: '8px 12px', fontSize: 13 }}>
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" style={{ padding: '8px 12px', fontSize: 13 }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{filtered.length} events</span>
      </div>

      {/* Audit Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
              {['Timestamp', 'Tenant', 'User / Role', 'Event', 'Resource', 'Severity', 'Status', 'IP / Location', ''].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => (
              <React.Fragment key={log.id}>
                <tr
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s', background: expanded === log.id ? 'var(--bg-elevated)' : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = expanded === log.id ? 'var(--bg-elevated)' : 'transparent')}
                >
                  <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {new Date(log.timestamp).toLocaleString('pt-BR', { hour12: false, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--bg-canvas)', borderRadius: 6, border: '1px solid var(--border)', fontWeight: 600 }}>
                      {log.tenantName}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{log.userName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{log.userRole}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: log.status === 'failure' ? '#ef4444' : 'var(--text-primary)' }}>
                      {log.action}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{ACTION_CATEGORY[log.action]}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.resourceName}
                  </td>
                  <td style={{ padding: '12px 14px' }}><SeverityBadge severity={log.severity} /></td>
                  <td style={{ padding: '12px 14px' }}>
                    <StatusDot status={log.status} />
                    <span style={{ fontSize: 12, textTransform: 'capitalize' }}>{log.status}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, fontFamily: 'monospace' }}>{log.ipAddress}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{log.location}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-tertiary)', fontSize: 14 }}>
                    {expanded === log.id ? '▲' : '▼'}
                  </td>
                </tr>
                {expanded === log.id && (
                  <tr style={{ background: 'var(--bg-canvas)', borderBottom: '2px solid var(--brand-500)33' }}>
                    <td colSpan={9} style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                        {[
                          { label: 'Event ID', value: log.id },
                          { label: 'Session ID', value: log.sessionId || '—' },
                          { label: 'User Agent', value: log.userAgent },
                          { label: 'Full Timestamp', value: new Date(log.timestamp).toISOString() },
                          { label: 'Tenant ID', value: log.tenantId },
                          { label: 'User ID', value: log.userId },
                          { label: 'Resource Type', value: log.resourceType },
                          { label: 'Metadata', value: log.metadata ? JSON.stringify(JSON.parse(log.metadata), null, 2) : '{}' },
                        ].map(field => (
                          <div key={field.label}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em', marginBottom: 4 }}>{field.label}</div>
                            <div style={{ fontSize: 12, fontFamily: 'monospace', background: 'var(--bg-elevated)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {field.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No audit events match your filters</div>
          </div>
        )}
      </div>

      {/* Retention policy note */}
      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
        📋 Audit logs are retained for <strong>5 years</strong> per SEC Rule 204-2 / ANBIMA compliance standards.
        Immutable records enforced via Firestore security rules.
      </div>
    </div>
  );
}
