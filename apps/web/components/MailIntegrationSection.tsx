'use client';

/**
 * MailIntegrationSection.tsx
 *
 * Full-featured email integration settings panel.
 *
 * Features:
 *  • Loads real connection state from Firestore on mount
 *  • OAuth PKCE connect via /api/oauth/{provider}/start (server-side, no client secret)
 *  • Handles oauth_success / oauth_error URL params after redirect-back
 *  • Sync settings (direction, auto-log, window) persisted to Firestore
 *  • Test connection — calls /api/mail/test
 *  • Manual sync — calls /api/mail/sync
 *  • Disconnect — calls /api/oauth/{provider}/revoke then deletes Firestore record
 *  • Recent email log view — last 20 emails from Firestore
 *  • Manual "Log to CRM" per email entry
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useSearchParams } from 'next/navigation';
import {
  getMailConnection, getAllMailConnections, disconnectMailProvider,
  updateSyncSettings, triggerManualSync, testMailConnection,
  getRecentEmailLogs, buildOAuthStartUrl, formatLastSync,
  PROVIDER_META,
  type MailProvider,
  type MailConnectionRecord,
  type EmailLogEntry,
  type ConnectionTestResult,
} from '@/lib/emailIntegrationService';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MailConnectionRecord['status'] | 'disconnected' }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    connected:    { bg: '#22c55e18', color: '#22c55e', label: '● Connected' },
    disconnected: { bg: '#64748b18', color: '#64748b', label: '○ Not connected' },
    error:        { bg: '#ef444418', color: '#ef4444', label: '⚠ Error' },
    expired:      { bg: '#f59e0b18', color: '#f59e0b', label: '⚠ Token expired' },
  };
  const c = cfg[status] ?? cfg.disconnected;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
      background: c.bg, color: c.color, letterSpacing: '0.03em',
    }}>
      {c.label}
    </span>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
      <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  display: 'block', marginBottom: 6,
};

// ─── Provider Card ────────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider:  MailProvider;
  record:    MailConnectionRecord | null;
  onRefresh: () => void;
}

function ProviderCard({ provider, record, onRefresh }: ProviderCardProps) {
  const { user, tenant }   = useAuth();
  const meta               = PROVIDER_META[provider];
  const isConnected        = record?.status === 'connected';
  const hasRecord          = !!record;
  const [testing,    setTesting]    = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [syncMsg,    setSyncMsg]    = useState<string | null>(null);
  const [syncDir,    setSyncDir]    = useState<MailConnectionRecord['syncDirection']>(record?.syncDirection ?? 'both');
  const [autoLog,    setAutoLog]    = useState(record?.autoLogToCrm ?? true);
  const [syncDays,   setSyncDays]   = useState(record?.syncWindowDays ?? 30);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Sync local state when record changes
  useEffect(() => {
    if (record) {
      setSyncDir(record.syncDirection);
      setAutoLog(record.autoLogToCrm);
      setSyncDays(record.syncWindowDays);
    }
  }, [record?.syncDirection, record?.autoLogToCrm, record?.syncWindowDays]);

  async function handleConnect() {
    if (provider === 'google') {
      try {
        const idToken = await (await import('firebase/auth')).getAuth().currentUser?.getIdToken();
        if (!idToken || !user?.uid) {
          alert('You must be signed in to connect an email account.');
          return;
        }
        const res = await fetch('/api/oauth/google/prepare', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ idToken, uid: user.uid, tenantId: tenant?.id, returnTo: '/settings?tab=mail' }),
        });
        if (!res.ok) throw new Error(`Prepare failed: ${res.status}`);
        const { authUrl } = await res.json();
        window.location.href = authUrl;
      } catch (e: any) {
        alert(`Could not start Google OAuth: ${e.message}`);
      }
    } else {
      // Microsoft — pass the Firebase idToken so the callback can identify the user
      try {
        const idToken = await (await import('firebase/auth')).getAuth().currentUser?.getIdToken();
        const returnTo = encodeURIComponent('/settings?tab=mail');
        const idTokenParam = idToken ? `&idToken=${encodeURIComponent(idToken)}` : '';
        const tenantParam = tenant?.id ? `&tenantId=${encodeURIComponent(tenant.id)}` : '';
        window.location.href = `/api/oauth/microsoft/start?returnTo=${returnTo}${idTokenParam}${tenantParam}`;
      } catch (e: any) {
        alert(`Could not start Microsoft OAuth: ${e.message}`);
      }
    }
  }

  async function handleTest() {
    if (!hasRecord || !user?.uid) return;
    setTesting(true);
    setTestResult(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated — please refresh the page.');
      if (!tenant?.id) throw new Error('No active tenant context.');
      const result = await testMailConnection(tenant.id, provider, user.uid, idToken);
      // Classify error for better UX
      if (!result.ok && result.details) {
        const d = result.details.toLowerCase();
        if (d.includes('client_id') || d.includes('invalid_request') || d.includes('not configured')) {
          result.details = '❌ OAuth credentials not configured on the server. Contact your administrator.';
        } else if (d.includes('refresh') || d.includes('expired') || d.includes('re-connect')) {
          result.details = '🔄 Token expired — please disconnect and re-connect your Google account.';
          result.needsReconnect = true;
        }
      }
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ ok: false, latency: 0, details: e.message ?? 'Test request failed' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSync() {
    if (!user?.uid || !hasRecord) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated — please refresh the page.');
      if (!tenant?.id) throw new Error('No active tenant context.');
      const result = await triggerManualSync(tenant.id, user.uid, provider, idToken);
      setSyncMsg(`✅ Synced ${result.newEmails} new email${result.newEmails !== 1 ? 's' : ''}${
        result.newActivities ? ` · ${result.newActivities} CRM activities created` : ''
      }`);
      onRefresh();
    } catch (e: any) {
      const msg = e.message ?? 'Sync failed';
      const d = msg.toLowerCase();
      if (d.includes('client_id') || d.includes('invalid_request') || d.includes('not configured')) {
        setSyncMsg('❌ OAuth not configured on the server. Contact your administrator.');
      } else if (d.includes('refresh') || d.includes('expired') || d.includes('re-connect')) {
        setSyncMsg('🔄 Token expired — please Disconnect and Re-connect your Google account.');
      } else {
        setSyncMsg(`❌ Sync failed: ${msg}`);
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!user?.uid || !hasRecord) return;
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      setTimeout(() => setConfirmDisconnect(false), 5000);
      return;
    }
    setDisconnecting(true);
    try {
      if (!tenant?.id) throw new Error('No active tenant context.');
      await disconnectMailProvider(tenant.id, user.uid, provider, user.name ?? '');
      onRefresh();
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSaveSettings() {
    if (!user?.uid || !hasRecord) return;
    setSavingSettings(true);
    try {
      if (!tenant?.id) return;
      await updateSyncSettings(tenant.id, user.uid, provider, {
        syncDirection: syncDir,
        autoLogToCrm:  autoLog,
        syncWindowDays: syncDays,
      });
      setSettingsDirty(false);
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div style={{
      border: `1px solid ${hasRecord ? 'var(--brand-500)30' : 'var(--border)'}`,
      borderRadius: 14,
      padding: '18px 20px',
      background: hasRecord ? 'var(--brand-900)08' : 'var(--bg-surface)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{meta.icon}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{meta.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{meta.description}</div>
          </div>
        </div>
        <StatusBadge status={record?.status ?? 'disconnected'} />
      </div>

      {hasRecord ? (
        <>
          {/* Connected info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <FieldRow label="Connected Account" value={record!.connectedEmail} />
            <FieldRow label="Last Sync"         value={formatLastSync(record?.lastSyncAt)} />
            {record?.emailsSynced !== undefined && (
              <FieldRow label="Emails Synced" value={record.emailsSynced.toString()} />
            )}
          </div>

          {/* Sync settings */}
          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 14,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>Sync Settings</div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {/* Direction */}
              <div style={{ flex: '1 1 140px' }}>
                <label style={labelStyle}>Sync Direction</label>
                <select className="input" value={syncDir}
                  onChange={e => { setSyncDir(e.target.value as any); setSettingsDirty(true); }}
                  style={{ width: '100%', fontSize: 12 }}
                >
                  <option value="inbound">Inbound only</option>
                  <option value="outbound">Outbound only</option>
                  <option value="both">Inbound + Outbound</option>
                </select>
              </div>

              {/* Sync window */}
              <div style={{ flex: '1 1 120px' }}>
                <label style={labelStyle}>Sync Window</label>
                <select className="input" value={syncDays}
                  onChange={e => { setSyncDays(Number(e.target.value)); setSettingsDirty(true); }}
                  style={{ width: '100%', fontSize: 12 }}
                >
                  {[7, 14, 30, 60, 90].map(d => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto-log toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <div
                onClick={() => { setAutoLog(v => !v); setSettingsDirty(true); }}
                style={{
                  width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                  background: autoLog ? 'var(--brand-500)' : 'var(--border)',
                  position: 'relative', transition: 'background 0.15s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: autoLog ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'white', transition: 'left 0.15s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-log to CRM</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Automatically create activity entries for synced emails
                </div>
              </div>
            </label>

            {settingsDirty && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                style={{ alignSelf: 'flex-start', fontSize: 12 }}
              >
                {savingSettings ? '⏳ Saving…' : '💾 Save Settings'}
              </button>
            )}
          </div>

          {/* Test result */}
          {testResult && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 12,
              background: testResult.ok ? '#22c55e15' : '#ef444415',
              color:      testResult.ok ? '#22c55e'   : '#ef4444',
            }}>
              {testResult.details}
            </div>
          )}

          {syncMsg && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 12,
              background: syncMsg.startsWith('❌') ? '#ef444415' : '#22c55e15',
              color:      syncMsg.startsWith('❌') ? '#ef4444'   : '#22c55e',
            }}>
              {syncMsg}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={handleTest}
              disabled={testing} style={{ fontSize: 12 }}>
              {testing ? '⏳ Testing…' : '⚡ Test Connection'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleSync}
              disabled={syncing} style={{ fontSize: 12 }}>
              {syncing ? '⏳ Syncing…' : '🔄 Sync Now'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleDisconnect}
              disabled={disconnecting} style={{ fontSize: 12, color: '#ef4444', marginLeft: 'auto' }}>
              {disconnecting ? '⏳ Disconnecting…' : (confirmDisconnect ? '⚠️ Click again to confirm' : '✕ Disconnect')}
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            Connect your {meta.name} account to automatically sync emails and log communications
            to the CRM activity feed. Uses secure <strong>OAuth 2.0 PKCE</strong> — your password
            is never shared with this application.
          </p>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Permissions requested: {meta.scopes.slice(0, 3).join(', ')}{meta.scopes.length > 3 ? ` +${meta.scopes.length - 3} more` : ''}
          </div>
          <div>
            <button className="btn btn-primary btn-sm" onClick={handleConnect} style={{ fontSize: 13 }}>
              {meta.icon} Connect {meta.name}
            </button>
          </div>
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button onClick={() => setShowSetupGuide(!showSetupGuide)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--brand-500)', display: 'flex', alignItems: 'center' }}>
               {showSetupGuide ? 'Hide' : 'Show'} {meta.name} App Setup Guide
            </button>
            {showSetupGuide && provider === 'microsoft' && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                 <p><strong>1. Entra ID App Registration</strong><br/>Create an App Registration in Azure AD and add your CRM domain as a Single-Page Application (SPA) redirect URI (e.g. <code>https://your-crm.com/api/oauth/microsoft/callback</code>).</p>
                 <p style={{ marginTop: 8 }}><strong>2. API Permissions</strong><br/>Add the following standard Microsoft Graph delegated permissions:</p>
                 <ul style={{ paddingLeft: 16, marginTop: 4, fontFamily: 'monospace', color: 'var(--brand-700)' }}>
                   <li>Mail.Read</li>
                   <li>Mail.Send</li>
                   <li>User.Read</li>
                   <li>offline_access</li>
                 </ul>
              </div>
            )}
            {showSetupGuide && provider === 'google' && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-surface)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                 <p><strong>1. Google Cloud Console</strong><br/>Enable the Gmail API in your Google Cloud Project. Go to Credentials and create an OAuth 2.0 Client ID for a Web Application.</p>
                 <p style={{ marginTop: 8 }}><strong>2. Redirect URI Config</strong><br/>Add <code>https://your-crm.com/api/oauth/google/callback</code> to the Authorized Redirect URIs.</p>
                 <p style={{ marginTop: 8 }}><strong>3. Environment Variables</strong><br/>Copy the generated Client ID and secret into your <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> environment variables. Add these scopes to your OAuth consent screen:</p>
                 <ul style={{ paddingLeft: 16, marginTop: 4, fontFamily: 'monospace', color: 'var(--brand-700)' }}>
                   <li>https://www.googleapis.com/auth/gmail.modify</li>
                   <li>https://www.googleapis.com/auth/calendar.events</li>
                 </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Email Log Table ──────────────────────────────────────────────────────────

function EmailLogPanel({ uid, tenantId }: { uid: string, tenantId: string }) {
  const [logs,    setLogs]    = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId) {
      getRecentEmailLogs(tenantId, uid, 20).then(l => { setLogs(l); setLoading(false); });
    }
  }, [uid, tenantId]);

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '12px 0' }}>Loading email log…</div>;
  if (!logs.length) return (
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '12px 0', textAlign: 'center' }}>
      No emails synced yet. Connect a provider and click "Sync Now".
    </div>
  );

  const dirIcon = (d: string) => d === 'inbound' ? '↙' : '↗';
  const provIcon = (p: string) => p === 'microsoft' ? '🟦' : '🔴';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {logs.map(log => (
        <div key={log.id} style={{
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: 'var(--bg-surface)',
        }}>
          {/* Direction + provider */}
          <div style={{ fontSize: 13, width: 22, flexShrink: 0, color: log.direction === 'inbound' ? 'var(--brand-400)' : 'var(--text-tertiary)' }}>
            {dirIcon(log.direction)}
          </div>

          {/* Body */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 10 }}>{provIcon(log.provider)}</span>
              <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.subject}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {log.direction === 'inbound' ? `From: ${log.fromName || log.fromEmail}` : `To: ${log.toEmails.join(', ')}`}
              {' · '}{new Date(log.receivedAt).toLocaleDateString()}
            </div>
            {log.snippet && (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.snippet}
              </div>
            )}
          </div>

          {/* CRM status */}
          <div style={{ flexShrink: 0 }}>
            {log.loggedToCrm ? (
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: '#22c55e18', color: '#22c55e', fontWeight: 700 }}>
                ✓ CRM
              </span>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 10, padding: '2px 8px' }}
                disabled={loggingId === log.id}
                title="Log this email to the CRM activity feed"
                onClick={() => {
                  const fam = prompt('Enter the family name to link this email to:');
                  if (fam) {
                    setLoggingId(log.id);
                    import('@/lib/emailIntegrationService').then(m =>
                      m.logEmailToCrm(tenantId, uid, log, [{ id: `fam-${fam.toLowerCase().replace(/\s/g, '-')}`, name: fam }])
                        .then(() => {
                          setLogs(prev => prev.map(l => l.id === log.id ? { ...l, loggedToCrm: true } : l));
                        })
                        .finally(() => setLoggingId(null))
                    );
                  }
                }}
              >
                {loggingId === log.id ? '⏳' : '+ CRM'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function MailIntegrationSection() {
  const { user, tenant } = useAuth();
  const searchParams   = useSearchParams();

  const [connections, setConnections] = useState<Partial<Record<MailProvider, MailConnectionRecord>>>({});
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<'accounts' | 'log'>('accounts');

  // Handle OAuth redirect-back params
  const oauthSuccess = searchParams?.get('oauth_success');
  const oauthError   = searchParams?.get('oauth_error');

  const loadConnections = useCallback(async () => {
    if (!user?.uid || !tenant?.id) return;
    setLoading(true);
    const all = await getAllMailConnections(tenant.id, user.uid);
    setConnections(all);
    setLoading(false);
  }, [user?.uid, tenant?.id]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>⟳ Loading email connections…</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* OAuth feedback banners */}
      {oauthSuccess && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#22c55e15', color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
          ✅ {oauthSuccess === 'microsoft' ? 'Microsoft 365' : 'Google Workspace'} connected successfully!
        </div>
      )}
      {oauthError && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#ef444415', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
          ❌ OAuth error: {oauthError}. Please try connecting again.
        </div>
      )}

      {/* Description */}
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Connect your email accounts to automatically sync communications to the CRM activity feed.
        All connections use <strong>OAuth 2.0 PKCE</strong> — your credentials are never stored in this app.
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['accounts', 'log'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 14px', fontSize: 13, fontWeight: activeTab === tab ? 700 : 400,
              cursor: 'pointer', border: 'none', background: 'transparent',
              borderBottom: activeTab === tab ? '2px solid var(--brand-500)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--brand-400)' : 'var(--text-secondary)',
              marginBottom: -1, transition: 'all 0.12s',
            }}
          >
            {tab === 'accounts' ? '🔗 Accounts' : '📋 Email Log'}
          </button>
        ))}
      </div>

      {/* Accounts tab */}
      {activeTab === 'accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(['microsoft', 'google'] as MailProvider[]).map(provider => (
            <ProviderCard
              key={provider}
              provider={provider}
              record={connections[provider] ?? null}
              onRefresh={loadConnections}
            />
          ))}

          {/* Security note */}
          <div style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-tertiary)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
            <div>
              <strong style={{ color: 'var(--text-secondary)' }}>Security & Privacy</strong>
              <br />
              OAuth tokens are stored encrypted server-side and are never sent to the browser.
              Only email metadata (subject, sender, date, snippet) is synced — message bodies are not stored.
              You can disconnect at any time and your email access will be immediately revoked.
            </div>
          </div>
        </div>
      )}

      {/* Email log tab */}
      {activeTab === 'log' && user?.uid && tenant?.id && (
        <EmailLogPanel uid={user.uid} tenantId={tenant.id} />
      )}
    </div>
  );
}
