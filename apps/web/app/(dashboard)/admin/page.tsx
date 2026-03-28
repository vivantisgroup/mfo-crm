'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import { type TaskQueue } from '@/lib/types';
import { Card, Title, Subtitle, Text, Divider, Flex, Grid, Col, Badge, TextInput, Select, SelectItem, Switch, Button } from '@tremor/react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId =
  | 'platform'
  | 'database'
  | 'mfa'
  | 'integrations'
  | 'ai_keys'
  | 'firm'
  | 'compliance'
  | 'tasks'
  | 'users'
  | 'communications'
  | 'entity_types';

interface ApiKeyField {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  saved: boolean;
  description: string;
  required?: boolean;
  docsUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mask(val: string) {
  if (!val) return '';
  if (val.length <= 8) return '•'.repeat(val.length);
  return val.slice(0, 4) + '•'.repeat(Math.max(0, val.length - 8)) + val.slice(-4);
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: ok ? '#22d3ee' : '#475569', marginRight: 6,
      boxShadow: ok ? '0 0 6px #22d3ee88' : 'none'
    }} />
  );
}

// ─── Reusable API Key Card ─────────────────────────────────────────────────────

function ApiKeyCard({ field, onSave }: {
  field: ApiKeyField;
  onSave: (id: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const handleSave = () => {
    if (draft.trim()) {
      onSave(field.id, draft.trim());
    }
    setEditing(false);
    setDraft('');
  };

  return (
    <Card decoration={field.saved ? "left" : undefined} decorationColor="emerald" className="mb-4 shadow-sm">
      <Flex alignItems="start" justifyContent="between">
        <div>
          <Flex alignItems="center" justifyContent="start" className="space-x-2">
            <StatusDot ok={field.saved} />
            <Text className="font-bold text-tremor-content-strong text-sm">{field.label}</Text>
            {field.required && <Badge color="rose" size="xs">Required</Badge>}
          </Flex>
          <Text className="mt-2 text-xs text-tremor-content">{field.description}</Text>
          {field.docsUrl && (
            <a href={field.docsUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline mt-2 inline-block font-medium">
              📖 Documentation &rarr;
            </a>
          )}
        </div>
        <Flex className="space-x-3 w-auto" alignItems="center">
          {field.saved && <Badge color="emerald" size="xs">Configured</Badge>}
          <Button 
            size="xs" 
            variant={editing ? "primary" : field.saved ? "secondary" : "light"} 
            onClick={editing ? handleSave : () => setEditing(true)}
          >
            {editing ? '💾 Save' : field.saved ? '🔄 Rotate' : '+ Set Key'}
          </Button>
          {editing && (
            <Button size="xs" variant="light" onClick={() => { setEditing(false); setDraft(''); }}>
              Cancel
            </Button>
          )}
        </Flex>
      </Flex>

      {field.saved && !editing && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-tremor-background-subtle rounded-tremor-small border border-tremor-border font-mono text-xs text-tremor-content-strong shadow-inner">
          <span>🔑</span>
          <span>{mask(field.value)}</span>
        </div>
      )}

      {editing && (
        <div className="mt-4">
          <TextInput
            type="password"
            autoFocus
            value={draft}
            onValueChange={setDraft}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder={field.placeholder}
            className="font-mono text-sm"
          />
        </div>
      )}
    </Card>
  );
}

// ─── Section: Platform Settings (Super Admin) ──────────────────────────────────

function PlatformSection() {
  const [settings, setSettings] = useState({
    platformName: 'MFO Nexus',
    version: '2.0.0',
    region: 'us-central1',
    backupBucket: 'gs://mfo-nexus-backups',
    logLevel: 'info',
    maintenanceMode: false,
    analyticsEnabled: true,
    dataResidency: 'brazil',
    sessionTimeout: 60,
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Platform Configuration</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Core platform parameters. Changes affect all tenants. Requires Super Admin role.
        </p>
        <div style={{ marginTop: 12, padding: '10px 16px', background: '#f59e0b11', border: '1px solid #f59e0b44', borderRadius: 'var(--radius-md)', fontSize: 13, color: '#f59e0b', display: 'flex', gap: 10, alignItems: 'center' }}>
          ⚠️ These settings are global and infrastructure-level. Incorrect values may impact platform availability.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        {[
          { label: 'Platform Name', key: 'platformName', type: 'text' },
          { label: 'Platform Version', key: 'version', type: 'text' },
          { label: 'Deployment Region', key: 'region', type: 'text', hint: 'GCP / Firebase region' },
          { label: 'Backup Bucket URI', key: 'backupBucket', type: 'text', hint: 'gs:// or s3://' },
          { label: 'Session Timeout (min)', key: 'sessionTimeout', type: 'number' },
          { label: 'Log Level', key: 'logLevel', type: 'select', options: ['debug', 'info', 'warn', 'error'] },
          { label: 'Data Residency', key: 'dataResidency', type: 'select', options: ['brazil', 'us', 'eu', 'multi-region'] },
        ].map(field => (
          <div key={field.key}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {field.label}
            </label>
            {field.type === 'select' ? (
              <select
                className="input"
                style={{ width: '100%', padding: '10px 12px' }}
                value={(settings as any)[field.key]}
                onChange={e => setSettings(prev => ({ ...prev, [field.key]: e.target.value }))}
              >
                {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={field.type}
                className="input"
                style={{ width: '100%', padding: '10px 12px' }}
                value={(settings as any)[field.key]}
                onChange={e => setSettings(prev => ({ ...prev, [field.key]: e.target.value }))}
              />
            )}
            {field.hint && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{field.hint}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
        {[
          { key: 'maintenanceMode', label: 'Maintenance Mode', desc: 'Block all non-admin logins and show maintenance page' },
          { key: 'analyticsEnabled', label: 'Platform Analytics', desc: 'Collect anonymous usage metrics for performance optimization' },
        ].map(toggle => (
          <div key={toggle.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{toggle.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{toggle.desc}</div>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, [toggle.key]: !(prev as any)[toggle.key] }))}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                background: (settings as any)[toggle.key] ? 'var(--brand-500)' : 'var(--bg-canvas)',
                boxShadow: 'inset 0 0 0 1px var(--border)',
                position: 'relative', transition: 'background 0.2s'
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: (settings as any)[toggle.key] ? 24 : 4,
                width: 20, height: 20, borderRadius: '50%', background: 'white',
                transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
              }} />
            </button>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={handleSave} style={{ padding: '10px 32px' }}>
        {saved ? '✅ Saved!' : '💾 Save Platform Configuration'}
      </button>
    </div>
  );
}

// ─── Section: Database & Infrastructure ───────────────────────────────────────

function DatabaseSection() {
  const [keys, setKeys] = useState<ApiKeyField[]>([
    {
      id: 'firestore_project_id', label: 'Firebase Project ID', value: 'mfo-crm', saved: true,
      placeholder: 'your-firebase-project-id',
      description: 'Primary Firestore database project identifier',
      docsUrl: 'https://firebase.google.com/docs/projects/learn-more'
    },
    {
      id: 'firestore_service_account', label: 'Firebase Service Account (JSON)', value: '', saved: false,
      placeholder: 'Paste full service account JSON...',
      description: 'Server-side service account for admin SDK access',
      required: true,
      docsUrl: 'https://firebase.google.com/docs/admin/setup'
    },
    {
      id: 'firebase_storage_bucket', label: 'Firebase Storage Bucket', value: 'mfo-crm.firebasestorage.app', saved: true,
      placeholder: 'project-id.appspot.com',
      description: 'Cloud Storage bucket for documents and attachments'
    },
    {
      id: 'smtp_host', label: 'SMTP Host (Transactional Email)', value: 'smtp.sendgrid.net', saved: true,
      placeholder: 'smtp.mailprovider.com',
      description: 'SMTP server for system emails (password resets, notifications)',
      docsUrl: 'https://docs.sendgrid.com/for-developers/sending-email/smtp-alerts'
    },
    {
      id: 'smtp_api_key', label: 'SMTP / SendGrid API Key', value: 'SG.xxxxx...', saved: true,
      placeholder: 'SG.your_sendgrid_api_key',
      description: 'API key for transactional email delivery (free tier: 100 emails/day)',
      docsUrl: 'https://app.sendgrid.com/settings/api_keys'
    },
    {
      id: 'redis_url', label: 'Redis / Upstash URL (optional)', value: '', saved: false,
      placeholder: 'redis://default:password@host:6379',
      description: 'Optional: for rate limiting and session caching in production'
    },
  ]);

  const handleSave = (id: string, val: string) => {
    setKeys(prev => prev.map(k => k.id === id ? { ...k, value: val, saved: true } : k));
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Database & Infrastructure</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Configure your primary data providers, storage, and messaging infrastructure.
        </p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          {['Firebase / Firestore', 'Cloud Storage', 'SMTP / Email'].map(badge => (
            <span key={badge} className="badge badge-neutral" style={{ fontSize: 11 }}>{badge}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {keys.map(k => <ApiKeyCard key={k.id} field={k} onSave={handleSave} />)}
      </div>
    </div>
  );
}

// ─── Section: MFA (TOTP — Free) ───────────────────────────────────────────────

function MfaSection() {
  const { tenant } = useAuth();
  const [mfaMode, setMfaMode] = useState<'totp' | 'disabled'>('disabled');
  const [totpIssuer, setTotpIssuer] = useState('MFO Nexus');
  const [totpWindow, setTotpWindow] = useState(1);
  const [backupCodes, setBackupCodes] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!tenant?.id) return;
    const fetchConfig = async () => {
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch(`/api/admin/tenant-config?tenantId=${tenant.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.mfaConfig) {
          if (data.mfaConfig.mfaMode) setMfaMode(data.mfaConfig.mfaMode);
          if (data.mfaConfig.totpIssuer) setTotpIssuer(data.mfaConfig.totpIssuer);
          if (data.mfaConfig.totpWindow !== undefined) setTotpWindow(data.mfaConfig.totpWindow);
          if (data.mfaConfig.backupCodes !== undefined) setBackupCodes(data.mfaConfig.backupCodes);
        }
      } catch (e) {
        console.error('Failed to load tenant MFA config', e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  const handleSave = async () => {
    if (!tenant?.id) return;
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) return;
      await fetch('/api/admin/tenant-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          mfaConfig: { mfaMode, totpIssuer, totpWindow, backupCodes }
        })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('Failed to save MFA config to backend', e);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Multi-Factor Authentication</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Zero-cost TOTP (Time-based One-Time Password) via RFC 6238 — compatible with Google Authenticator, Authy, and Microsoft Authenticator.
        </p>
        <div style={{ marginTop: 12, padding: '12px 16px', background: '#22d3ee0a', border: '1px solid #22d3ee33', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontWeight: 700, color: '#22d3ee', fontSize: 13, marginBottom: 6 }}>✅ Why TOTP is Best for You</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              '🆓 Completely free — no SMS costs, no third-party subscription',
              '🔐 Industry standard (RFC 6238) used by Google, GitHub, AWS',
              '📱 Works offline — no data connection needed on client device',
              '🌐 Compatible with any TOTP app: Authenticator, Authy, 1Password',
              '⚡ Sub-second verification — no waiting for SMS delivery',
              '🏦 ANBIMA & CVM compliant — satisfies strong authentication requirements',
            ].map(item => (
              <div key={item} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MFA Mode Toggle */}
      <div style={{ marginBottom: 32 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Authentication Mode</label>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { id: 'totp', label: '🔐 TOTP (Recommended)', desc: 'Free, offline-capable, RFC 6238' },
            { id: 'disabled', label: '⚠️ Disabled', desc: 'Only for development environments' },
          ].map(opt => (
            <div
              key={opt.id}
              onClick={() => setMfaMode(opt.id as any)}
              style={{
                flex: 1, padding: '16px 20px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                border: `2px solid ${mfaMode === opt.id ? 'var(--brand-500)' : 'var(--border)'}`,
                background: mfaMode === opt.id ? 'var(--brand-500)0d' : 'var(--bg-elevated)',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {mfaMode === 'totp' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issuer Name (shown in authenticator app)</label>
            <input
              type="text"
              className="input"
              style={{ width: '100%', padding: '10px 12px' }}
              value={totpIssuer}
              onChange={e => setTotpIssuer(e.target.value)}
              placeholder="Your Company Name"
            />
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>e.g. "Vivants MFO" — displayed in Google Authenticator</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTP Window (± tokens)</label>
            <select
              className="input"
              style={{ width: '100%', padding: '10px 12px' }}
              value={totpWindow}
              onChange={e => setTotpWindow(Number(e.target.value))}
            >
              <option value={0}>Strict (±0 — current code only)</option>
              <option value={1}>Standard (±1 — 30s tolerance)</option>
              <option value={2}>Lenient (±2 — 60s tolerance)</option>
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Larger window allows for clock drift on user devices</div>
          </div>
        </div>
      )}

      {/* Backup Codes */}
      <div style={{ marginBottom: 32, padding: '16px 20px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>One-Time Backup Codes</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Generate 10 single-use emergency codes for account recovery (stored in Firestore)</div>
        </div>
        <button
          onClick={() => setBackupCodes(prev => !prev)}
          style={{
            width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
            background: backupCodes ? 'var(--brand-500)' : 'var(--bg-canvas)',
            boxShadow: 'inset 0 0 0 1px var(--border)', position: 'relative', transition: 'background 0.2s'
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: backupCodes ? 24 : 4,
            width: 20, height: 20, borderRadius: '50%', background: 'white',
            transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
          }} />
        </button>
      </div>

      {/* Implementation card */}
      <div style={{ padding: '20px 24px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginBottom: 32 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>📦 TOTP Implementation — Production Ready</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>• Library: <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>otplib</code> (MIT licensed, 0 cost) — generates and validates TOTP codes</div>
          <div>• QR Code: <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>qrcode</code> — renders setup QR for authenticator apps</div>
          <div>• Storage: TOTP secrets stored as AES-256 encrypted values in Firestore <code>/users/{'{uid}'}/mfa_secret</code></div>
          <div>• Flow: Enroll → Scan QR → Verify first code → Mark as active → Require on next login</div>
          <div>• Bypass: Admin can generate backup codes or temporarily disable MFA per-user</div>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave} style={{ padding: '10px 32px' }}>
        {saved ? '✅ Saved!' : '💾 Save MFA Configuration'}
      </button>
    </div>
  );
}

// ─── Section: Tenant-level Integrations ────────────────────────────────────────

function IntegrationsSection() {
  const [microsoftKeys, setMicrosoftKeys] = useState<ApiKeyField[]>([
    {
      id: 'ms_tenant_id', label: 'Azure AD Tenant ID', value: '', saved: false,
      placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      description: 'Your Microsoft Azure Active Directory tenant identifier',
      docsUrl: 'https://learn.microsoft.com/en-us/azure/active-directory/fundamentals/active-directory-how-to-find-tenant'
    },
    {
      id: 'ms_client_id', label: 'Azure App Client ID', value: '', saved: false,
      placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      description: 'OAuth 2.0 client ID from your Azure App Registration',
      docsUrl: 'https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app',
      required: true
    },
    {
      id: 'ms_client_secret', label: 'Azure App Client Secret', value: '', saved: false,
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Client secret for server-to-server Microsoft Graph calls',
      required: true
    },
  ]);

  const [googleKeys, setGoogleKeys] = useState<ApiKeyField[]>([
    {
      id: 'google_client_id', label: 'Google OAuth Client ID', value: '', saved: false,
      placeholder: 'xxxxxxxxx.apps.googleusercontent.com',
      description: 'OAuth 2.0 Client ID from Google Cloud Console',
      docsUrl: 'https://console.cloud.google.com/apis/credentials',
      required: true
    },
    {
      id: 'google_client_secret', label: 'Google OAuth Client Secret', value: '', saved: false,
      placeholder: 'GOCSPX-xxxxxxxxxxxxxxxxxx',
      description: 'Client secret for Google Workspace and Gmail API access',
      required: true
    },
    {
      id: 'google_workspace_domain', label: 'Google Workspace Domain', value: '', saved: false,
      placeholder: 'yourcompany.com',
      description: 'Restrict Google OAuth to your company domain only'
    },
  ]);

  const [storageKeys, setStorageKeys] = useState<ApiKeyField[]>([
    {
      id: 'onedrive_tenant', label: 'OneDrive for Business — Tenant ID', value: '', saved: false,
      placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      description: 'Microsoft 365 tenant for OneDrive / SharePoint document sync',
      docsUrl: 'https://learn.microsoft.com/en-us/onedrive/developer/rest-api/'
    },
    {
      id: 'gdrive_service_account', label: 'Google Drive Service Account Email', value: '', saved: false,
      placeholder: 'service-account@project.iam.gserviceaccount.com',
      description: 'Service account for Google Drive document synchronization',
      docsUrl: 'https://developers.google.com/drive/api/guides/about-auth'
    },
  ]);

  const saveMs = (id: string, val: string) => setMicrosoftKeys(p => p.map(k => k.id === id ? { ...k, value: val, saved: true } : k));
  const saveGoogle = (id: string, val: string) => setGoogleKeys(p => p.map(k => k.id === id ? { ...k, value: val, saved: true } : k));
  const saveStorage = (id: string, val: string) => setStorageKeys(p => p.map(k => k.id === id ? { ...k, value: val, saved: true } : k));

  const Section = ({ title, icon, color, desc, children }: any) => (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ width: 40, height: 40, background: `${color}22`, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{desc}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Tenant Integrations — BYOK</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Bring Your Own Keys. Each tenant manages their own integration credentials — Vivants never has access to tenant API secrets.
        </p>
        <div style={{ marginTop: 12, padding: '10px 16px', background: '#6366f10a', border: '1px solid #6366f133', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--brand-400)', display: 'flex', gap: 10 }}>
          🔒 Keys are AES-256 encrypted before storage. Even platform admins cannot view tenant secrets in plaintext.
        </div>
      </div>

      <Section title="Microsoft 365 / Outlook / OneDrive" icon="Ⓜ️" color="#0078d4" desc="Email sync, Calendar, Teams, SharePoint, OneDrive">
        {microsoftKeys.map(k => <ApiKeyCard key={k.id} field={k} onSave={saveMs} />)}
      </Section>

      <Section title="Google Workspace / Gmail / Drive" icon="Ⓖ" color="#ea4335" desc="Gmail integration, Google Calendar, Google Drive access">
        {googleKeys.map(k => <ApiKeyCard key={k.id} field={k} onSave={saveGoogle} />)}
      </Section>

      <Section title="Cloud Document Storage" icon="☁️" color="#22d3ee" desc="OneDrive for Business and Google Drive sync">
        {storageKeys.map(k => <ApiKeyCard key={k.id} field={k} onSave={saveStorage} />)}
      </Section>
    </div>
  );
}

// ─── Section: AI Providers ────────────────────────────────────────────────────

function AiKeysSection() {
  const { tenant } = useAuth();
  console.log('[AiKeysSection] Triggering forced HMR recompile for Groq UI synchronization');
  
  const providers = [
    {
      group: 'OpenAI', icon: '🤖', color: '#10a37f', desc: 'GPT-4o, o1, DALL·E — for document analysis, meeting summaries, portfolio narratives',
      keys: [
        { id: 'openai_api_key', label: 'OpenAI API Key', value: '', saved: false, placeholder: 'sk-proj-xxxxxxxxxxxxxxxx', description: 'Primary key for GPT-4o and embeddings', docsUrl: 'https://platform.openai.com/api-keys', required: true },
        { id: 'openai_org_id', label: 'OpenAI Organization ID (optional)', value: '', saved: false, placeholder: 'org-xxxxxxxxxxxxxxxx', description: 'For enterprise billing tracking' },
      ]
    },
    {
      group: 'Google Gemini', icon: '✨', color: '#4285f4', desc: 'Gemini 2.0 Flash / Pro — multilingual document analysis (Portuguese + English)',
      keys: [
        { id: 'gemini_api_key', label: 'Gemini API Key', value: '', saved: false, placeholder: 'AIzaSy-xxxxxxxxxxxxxxxxxxxxxxxxxx', description: 'Google AI Studio / Vertex AI key', docsUrl: 'https://aistudio.google.com/app/apikey', required: true },
        { id: 'vertex_project', label: 'Vertex AI Project ID (Enterprise)', value: '', saved: false, placeholder: 'your-gcp-project-id', description: 'For Vertex AI / Gemini Enterprise access' },
      ]
    },
    {
      group: 'Anthropic / Claude', icon: '🧠', color: '#d97706', desc: 'Claude 3.5 Sonnet — contract analysis, legal document review, compliance narratives',
      keys: [
        { id: 'anthropic_api_key', label: 'Anthropic API Key', value: '', saved: false, placeholder: 'sk-ant-api03-xxxxxxxxxxxxxx', description: 'Claude 3.5 Sonnet and Haiku for legal and compliance tasks', docsUrl: 'https://console.anthropic.com/settings/keys', required: true },
      ]
    },
    {
      group: 'Groq', icon: '⚡', color: '#f55036', desc: 'Ultra-fast LPU inference — for real-time applications and low-latency models (Llama 3, Mixtral)',
      keys: [
        { id: 'groq_api_key', label: 'Groq API Key', value: '', saved: false, placeholder: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxxx', description: 'Primary key for Groq inference cloud', docsUrl: 'https://console.groq.com/keys', required: true }
      ]
    },
    {
      group: 'Additional Providers', icon: '⚙️', color: '#64748b', desc: 'Custom or specialized AI models',
      keys: [
        { id: 'azure_openai_key', label: 'Azure OpenAI API Key', value: '', saved: false, placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', description: 'For Azure-hosted OpenAI models (data residency compliance)', docsUrl: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service' },
        { id: 'azure_openai_endpoint', label: 'Azure OpenAI Endpoint', value: '', saved: false, placeholder: 'https://your-resource.openai.azure.com/', description: 'Regional endpoint for Azure OpenAI service' },
        { id: 'custom_llm_url', label: 'Custom LLM Base URL (self-hosted)', value: '', saved: false, placeholder: 'https://your-ollama-instance.com/api', description: 'For self-hosted models (Ollama, LM Studio, vLLM)' },
      ]
    }
  ];

  const [allKeys, setAllKeys] = useState<Record<string, ApiKeyField[]>>(
    Object.fromEntries(providers.map(p => [p.group, p.keys as ApiKeyField[]]))
  );
  
  const [activeProvider, setActiveProvider] = useState('OpenAI');
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!tenant?.id) return;
    const fetchKeys = async () => {
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch(`/api/admin/tenant-config?tenantId=${tenant.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.aiKeys && Object.keys(data.aiKeys).length > 0) {
          // Merge fetched keys with the default provider template to ensure we don't lose new fields
          const mergedKeys: Record<string, ApiKeyField[]> = {};
          for (const p of providers) {
            mergedKeys[p.group] = p.keys.map(defaultKey => {
              const remoteGroup = data.aiKeys[p.group] || [];
              const remoteKey = remoteGroup.find((k: any) => k.id === defaultKey.id);
              return remoteKey ? { ...defaultKey, ...remoteKey } : defaultKey;
            });
          }
          setAllKeys(mergedKeys);
        }
      } catch (e) {
        console.error('Failed to load tenant aiKeys', e);
      } finally {
        setLoading(false);
      }
    };
    fetchKeys();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  const handleSave = (group: string) => async (id: string, val: string) => {
    const newKeys = {
      ...allKeys,
      [group]: allKeys[group].map(k => k.id === id ? { ...k, value: val, saved: true } : k)
    };
    setAllKeys(newKeys);
    
    if (tenant?.id) {
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        if (token) {
          await fetch('/api/admin/tenant-config', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId: tenant.id, aiKeys: newKeys })
          });
        }
      } catch (err) {
        console.error('Failed to save key to backend', err);
      }
    }
  };

  const current = providers.find(p => p.group === activeProvider)!;

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>AI API Keys — BYOK</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Bring your own AI provider keys. The platform supports multi-provider AI routing — automatically falls back to the next available provider.
        </p>
        <div style={{ marginTop: 12, padding: '10px 16px', background: '#10a37f0a', border: '1px solid #10a37f33', borderRadius: 'var(--radius-md)', fontSize: 13, color: '#10a37f', display: 'flex', gap: 10 }}>
          💡 Keys are encrypted and scoped per tenant. Usage costs belong to each tenant's AI provider account.
        </div>
      </div>

      {/* Provider Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {providers.map(p => {
          const savedCount = (allKeys[p.group] || []).filter(k => k.saved).length;
          return (
            <button
              key={p.group}
              onClick={() => setActiveProvider(p.group)}
              className={`btn btn-sm ${activeProvider === p.group ? 'btn-secondary' : 'btn-ghost'}`}
              style={{ gap: 8, border: activeProvider === p.group ? `1px solid ${p.color}44` : 'none' }}
            >
              <span>{p.icon}</span>
              {p.group}
              {savedCount > 0 && (
                <span style={{ fontSize: 10, background: `${p.color}33`, color: p.color, padding: '1px 6px', borderRadius: 8 }}>
                  {savedCount} key{savedCount > 1 ? 's' : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Current provider info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', background: `${current.color}0d`, border: `1px solid ${current.color}33`, borderRadius: 'var(--radius-lg)', marginBottom: 24 }}>
        <div style={{ fontSize: 36 }}>{current.icon}</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{current.group}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{current.desc}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(allKeys[activeProvider] || []).map(k => (
          <ApiKeyCard key={k.id} field={k} onSave={handleSave(activeProvider)} />
        ))}
      </div>

      {/* AI Routing Policy */}
      <div style={{ marginTop: 36, padding: '20px 24px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>🔄 AI Routing Policy</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            { label: 'Document Analysis', primary: 'Claude', fallback: 'GPT-4o' },
            { label: 'Portfolio Narrative', primary: 'GPT-4o', fallback: 'Gemini Pro' },
            { label: 'Compliance Review', primary: 'Claude', fallback: 'GPT-4o' },
          ].map(route => (
            <div key={route.label} style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>{route.label}</div>
              <div style={{ fontSize: 13 }}>Primary: <strong>{route.primary}</strong></div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Fallback: {route.fallback}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Compliance ───────────────────────────────────────────────────────

function ComplianceSection() {
  const [saved, setSaved] = useState(false);

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Regulatory Framework</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Configure parameters for ANBIMA, CVM 175, SEC Rule 204-2, and FINRA compliance.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {[
          {
            title: 'Brazilian Regulatory (ANBIMA/CVM)',
            fields: [
              { label: 'ANBIMA Category', type: 'select', options: ['Wealth Management / Private Banking', 'Asset Management', 'Distributor', 'Other'] },
              { label: 'CVM 175 Compliance Mode', type: 'select', options: ['Strict', 'Flexible'] },
              { label: 'Suitability Expiry (months)', type: 'number', default: '24' },
            ]
          },
          {
            title: 'US Regulatory (SEC/FINRA)',
            fields: [
              { label: 'RIA Registration Number', type: 'text', default: '' },
              { label: 'Audit Trail Granularity', type: 'select', options: ['High (All Interactions)', 'Medium (Financials Only)', 'Low (Documents Only)'] },
              { label: 'Record Retention (years)', type: 'number', default: '5' },
            ]
          },
        ].map(group => (
          <div key={group.title} style={{ padding: 24, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h4 style={{ fontWeight: 700, marginBottom: 20, fontSize: 14 }}>{group.title}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {group.fields.map(f => (
                <div key={f.label}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="input" style={{ width: '100%', padding: '8px 12px' }}>
                      {(f.options || []).map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} defaultValue={f.default} className="input" style={{ width: '100%', padding: '8px 12px' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary mt-8" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }} style={{ padding: '10px 32px', marginTop: 24 }}>
        {saved ? '✅ Saved!' : '💾 Save Compliance Settings'}
      </button>
    </div>
  );
}

// ─── Section: Firm Identity & Branding (admin-level) ─────────────────────────

function FirmSection() {
  const { tenantBranding: b, setTenantBranding } = useTheme();
  const [saved, setSaved] = useState(false);
  const logoFullRef = useRef<HTMLInputElement>(null);
  const logoMarkRef = useRef<HTMLInputElement>(null);

  const readImg = (file: File): Promise<string> =>
    new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target!.result as string); r.onerror = rej; r.readAsDataURL(file); });

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  const Field = ({ label, fk, type = 'text', mono = false, hint }: { label: string; fk: keyof typeof b; type?: string; mono?: boolean; hint?: string }) => (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</label>
      <input type={type} value={(b as any)[fk] as string} onChange={e => setTenantBranding({ [fk]: e.target.value })}
        className="input" style={{ width: '100%', padding: '9px 12px', fontFamily: mono ? 'monospace' : undefined, boxSizing: 'border-box' }} />
      {hint && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{hint}</div>}
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>🏢 Identidade &amp; Branding</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          Logos, endereço completo e cores são utilizados em relatórios, rodapés, faturas e comunicações com clientes.
        </p>
        <div style={{ marginTop: 12, padding: '10px 16px', background: '#6366f10a', border: '1px solid #6366f133', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--brand-400)', display: 'flex', gap: 10 }}>
          🔐 Alterações afetam todos os relatórios e comunicações com clientes deste tenant.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* LEFT: Logos + brand color */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Logos</div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Logo Completo — Relatórios &amp; Cabeçalhos</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div onClick={() => logoFullRef.current?.click()} style={{ width: 120, height: 56, borderRadius: 8, cursor: 'pointer', overflow: 'hidden', border: `2px dashed ${b.logoFull ? 'var(--brand-500)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: b.logoFull ? 'transparent' : 'var(--bg-elevated)' }}>
                {b.logoFull ? <img src={b.logoFull} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+ Upload</span>}
              </div>
              <div>
                <button className="btn btn-ghost btn-sm" onClick={() => logoFullRef.current?.click()} style={{ display: 'block', marginBottom: 4 }}>{b.logoFull ? '↺ Substituir' : '↑ Upload'}</button>
                {b.logoFull && <button className="btn btn-ghost btn-sm" onClick={() => setTenantBranding({ logoFull: null })} style={{ color: '#ef4444' }}>✕ Remover</button>}
              </div>
            </div>
            <input ref={logoFullRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; if (f) { setTenantBranding({ logoFull: await readImg(f) }); e.target.value = ''; } }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Logo Mark — Sidebar &amp; Favicon</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div onClick={() => logoMarkRef.current?.click()} style={{ width: 48, height: 48, borderRadius: '50%', cursor: 'pointer', overflow: 'hidden', border: `2px dashed ${b.logoMark ? 'var(--brand-500)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: b.logoMark ? 'transparent' : 'var(--bg-elevated)' }}>
                {b.logoMark ? <img src={b.logoMark} alt="mark" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 18, color: 'var(--text-tertiary)' }}>+</span>}
              </div>
              <div>
                <button className="btn btn-ghost btn-sm" onClick={() => logoMarkRef.current?.click()} style={{ display: 'block', marginBottom: 4 }}>{b.logoMark ? '↺ Substituir' : '↑ Upload'}</button>
                {b.logoMark && <button className="btn btn-ghost btn-sm" onClick={() => setTenantBranding({ logoMark: null })} style={{ color: '#ef4444' }}>✕ Remover</button>}
              </div>
            </div>
            <input ref={logoMarkRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; if (f) { setTenantBranding({ logoMark: await readImg(f) }); e.target.value = ''; } }} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tamanho em Relatórios</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-400)' }}>{b.logoSizeInReports}px</span>
            </div>
            <input type="range" min={60} max={240} step={10} value={b.logoSizeInReports} onChange={e => setTenantBranding({ logoSizeInReports: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--brand-500)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
              <span>Compacto (60px)</span><span>Grande (240px)</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Cor da Marca</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input type="color" value={b.brandColor} onChange={e => setTenantBranding({ brandColor: e.target.value })} style={{ width: 48, height: 48, borderRadius: 8, border: '2px solid var(--border)', cursor: 'pointer', padding: 3, background: 'none' }} />
              <div>
                <input type="text" value={b.brandColor} onChange={e => setTenantBranding({ brandColor: e.target.value })} className="input" style={{ padding: '8px 12px', fontFamily: 'monospace', width: 120 }} />
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Cabeçalhos, botões e tema</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Dados empresa + endereço */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Dados da Empresa</div>
          <Field label="Nome da Empresa" fk="firmName" />
          <Field label="Razão Social" fk="legalName" />
          <Field label="CNPJ / CVM / SEC" fk="cnpjCvm" mono hint="Aparece no rodapé de relatórios e faturas" />
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>📍 Endereço Completo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="Logradouro" fk="addressLine1" />
              <Field label="Complemento" fk="addressLine2" />
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <Field label="Cidade" fk="city" />
                <Field label="Estado" fk="state" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <Field label="País" fk="country" />
                <Field label="CEP" fk="postalCode" />
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>📞 Contato</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="Telefone" fk="phone" type="tel" />
              <Field label="E-mail" fk="email" type="email" />
              <Field label="Website / Portal" fk="website" />
            </div>
          </div>
        </div>
      </div>

      {/* Live document preview */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>📄 Prévia — Rodapé de Relatório/Fatura</div>
        <div style={{ padding: '20px 28px', background: 'white', borderRadius: 10, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', color: '#0f172a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid ' + b.brandColor, paddingBottom: 16, marginBottom: 16 }}>
            <div>
              {b.logoFull
                ? <img src={b.logoFull} alt="logo" style={{ height: 40, width: b.logoSizeInReports, objectFit: 'contain' }} />
                : <div style={{ fontSize: 20, fontWeight: 900, color: b.brandColor }}>{b.firmName}</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, color: '#64748b', lineHeight: 1.8 }}>
              <div>{b.legalName}</div>
              {b.cnpjCvm && <div>CNPJ/CVM: {b.cnpjCvm}</div>}
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#64748b', display: 'flex', justifyContent: 'space-between', lineHeight: 1.8 }}>
            <div>
              {b.addressLine1}{b.addressLine2 ? ` — ${b.addressLine2}` : ''}<br />
              {b.city}{b.state ? `, ${b.state}` : ''} — {b.country}{b.postalCode ? ` | CEP ${b.postalCode}` : ''}
            </div>
            <div style={{ textAlign: 'right' }}>{b.phone}<br />{b.email}<br />{b.website}</div>
          </div>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave} style={{ padding: '12px 36px', alignSelf: 'flex-start' }}>
        {saved ? '✅ Salvo!' : '💾 Salvar Branding'}
      </button>
    </div>
  );
}

// ─── Queue Settings Section ────────────────────────────────────────────────────

/**
 * Admin-only panel for creating, editing, and deleting task queues.
 * Deletion is blocked when tasks exist in the queue — user must migrate first.
 */
function QueueSettingsSection() {
  const { user, tenant } = useAuth();
  const { queues, queueTaskCount, addQueue, updateQueue, removeEmptyQueue, migrateAndRemoveQueue } = useTaskQueue();

  // ── New queue form ─────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newIcon,    setNewIcon]    = useState('📋');
  const [newColor,   setNewColor]   = useState('#6366f1');
  const [newSla,     setNewSla]     = useState(120);

  // ── Edit queue ─────────────────────────────────────────────────────────────
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editName,   setEditName]   = useState('');
  const [editIcon,   setEditIcon]   = useState('');
  const [editColor,  setEditColor]  = useState('');
  const [editSla,    setEditSla]    = useState(0);

  // ── Remove / migrate ───────────────────────────────────────────────────────
  const [removingId,      setRemovingId]      = useState<string | null>(null);
  const [migrateTargetId, setMigrateTargetId] = useState('');

  // ── Confirmation feedback ──────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);

  const actorId   = user?.id   ?? 'unknown';
  const actorName = user?.name ?? 'Admin';
  const tenantId  = tenant?.id ?? 'tenant-001';

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    addQueue(
      { name: newName.trim(), icon: newIcon, color: newColor, memberIds: [], assignSlaMinutes: newSla },
      actorId, actorName,
    );
    showToast(`Queue "${newName.trim()}" created`);
    setNewName(''); setNewIcon('📋'); setNewColor('#6366f1'); setNewSla(120);
    setShowCreate(false);
  }

  function startEdit(q: TaskQueue) {
    setEditingId(q.id);
    setEditName(q.name);
    setEditIcon(q.icon);
    setEditColor(q.color);
    setEditSla(q.assignSlaMinutes);
    setRemovingId(null);
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    updateQueue(editingId, { name: editName.trim(), icon: editIcon, color: editColor, assignSlaMinutes: editSla }, actorId, actorName);
    showToast(`Queue updated`);
    setEditingId(null);
  }

  function attemptRemove(queueId: string) {
    setRemovingId(queueId);
    setEditingId(null);
    setMigrateTargetId('');
  }

  function confirmRemove(queueId: string) {
    const count = queueTaskCount(queueId);
    const name  = queues.find(q => q.id === queueId)?.name ?? queueId;
    if (count > 0) {
      // Must migrate first — user selects in UI
      return;
    }
    removeEmptyQueue(queueId, actorId, actorName, tenantId);
    showToast(`Queue "${name}" deleted`);
    setRemovingId(null);
  }

  function confirmMigrate(fromId: string, toId: string) {
    const fromName = queues.find(q => q.id === fromId)?.name ?? fromId;
    const toName   = queues.find(q => q.id === toId)?.name   ?? toId;
    migrateAndRemoveQueue(fromId, toId, actorId, actorName, tenantId);
    showToast(`Tasks migrated "${fromName}" → "${toName}". Queue deleted.`);
    setRemovingId(null);
  }

  const PRESET_ICONS = ['📋', '⚖️', '🤝', '🗄️', '📊', '🛎️', '💰', '🔍', '🏛', '🔒', '🌐', '📞'];
  const PRESET_COLORS = [
    '#6366f1','#ef4444','#f59e0b','#22d3ee','#a78bfa','#34d399','#f87171','#60a5fa','#fb923c','#94a3b8',
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Task Queue Management</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Create, rename, or remove task queues. Queues with tasks cannot be deleted — you must migrate tasks first.
          All changes are recorded in the Audit Log.
        </p>
        <div style={{ marginTop: 12, padding: '10px 16px', background: '#6366f111', border: '1px solid #6366f144', borderRadius: 'var(--radius-md)', fontSize: 13, color: '#a78bfa', display: 'flex', gap: 10, alignItems: 'center' }}>
          🔐 Admin-only section. All queue changes are immutably audited.
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: '#22c55e', color: 'white', padding: '11px 22px', borderRadius: 30,
          fontSize: 13, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.3s ease',
        }}>
          ✓ {toast}
        </div>
      )}

      {/* Queue list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {queues.map(q => {
          const taskCount = queueTaskCount(q.id);
          const isEditing = editingId === q.id;
          const isRemoving = removingId === q.id;
          const migTargets = queues.filter(x => x.id !== q.id);

          return (
            <div key={q.id} style={{
              background: 'var(--bg-elevated)', border: `1px solid ${isEditing || isRemoving ? q.color + '66' : 'var(--border)'}`,
              borderLeft: `4px solid ${q.color}`, borderRadius: 'var(--radius-lg)',
              overflow: 'hidden', transition: 'border-color 0.2s',
            }}>
              {/* Queue row */}
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{q.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{q.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    Pick-up SLA: {q.assignSlaMinutes < 60 ? `${q.assignSlaMinutes}m` : `${q.assignSlaMinutes / 60}h`}
                    &nbsp;·&nbsp;
                    <span style={{ color: taskCount > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                      {taskCount} task{taskCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={() => isEditing ? setEditingId(null) : startEdit(q)}
                  >
                    {isEditing ? 'Cancel' : '✏️ Edit'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, color: isRemoving ? '#f59e0b' : '#ef4444' }}
                    onClick={() => isRemoving ? setRemovingId(null) : attemptRemove(q.id)}
                  >
                    {isRemoving ? '✕ Cancel' : '🗑 Remove'}
                  </button>
                </div>
              </div>

              {/* Edit inline form */}
              {isEditing && (
                <form onSubmit={handleSaveEdit} style={{
                  padding: '16px 18px 20px', borderTop: '1px solid var(--border)',
                  background: 'var(--bg-canvas)',
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Queue Name</label>
                      <input className="input" value={editName} onChange={e => setEditName(e.target.value)} required style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Pick-up SLA (min)</label>
                      <input className="input" type="number" min={5} max={10080} value={editSla} onChange={e => setEditSla(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Icon</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {PRESET_ICONS.map(ic => (
                        <button type="button" key={ic} onClick={() => setEditIcon(ic)}
                          style={{ fontSize: 18, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', border: `2px solid ${editIcon === ic ? q.color : 'var(--border)'}`, background: 'var(--bg-elevated)' }}>
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Colour</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {PRESET_COLORS.map(c => (
                        <div key={c} onClick={() => setEditColor(c)}
                          style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${editColor === c ? 'white' : 'transparent'}`, boxShadow: editColor === c ? `0 0 0 2px ${c}` : 'none' }} />
                      ))}
                      <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                        style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'none' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm">💾 Save Changes</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </form>
              )}

              {/* Remove / migrate panel */}
              {isRemoving && (
                <div style={{
                  padding: '16px 18px 20px', borderTop: '1px solid var(--border)',
                  background: taskCount > 0 ? '#f59e0b08' : '#ef444408',
                }}>
                  {taskCount > 0 ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 10 }}>
                        ⚠️ This queue contains {taskCount} task{taskCount !== 1 ? 's' : ''} (open, in progress, or completed).
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
                        To delete this queue, all tasks must first be migrated to another queue.
                        Select the destination queue, then confirm.
                      </p>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                          className="input"
                          value={migrateTargetId}
                          onChange={e => setMigrateTargetId(e.target.value)}
                          style={{ flex: 1, minWidth: 200 }}
                        >
                          <option value="">— Select destination queue —</option>
                          {migTargets.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.icon} {t.name} ({queueTaskCount(t.id)} tasks)
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn btn-sm"
                          disabled={!migrateTargetId}
                          onClick={() => confirmMigrate(q.id, migrateTargetId)}
                          style={{ background: '#ef4444', color: 'white', fontSize: 12, opacity: migrateTargetId ? 1 : 0.4 }}
                        >
                          Migrate &amp; Delete Queue
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                        This queue is empty. It will be permanently deleted and recorded in the audit log.
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-sm"
                          style={{ background: '#ef4444', color: 'white', fontSize: 12 }}
                          onClick={() => confirmRemove(q.id)}
                        >
                          🗑 Confirm Delete
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setRemovingId(null)} style={{ fontSize: 12 }}>Cancel</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new queue */}
      {!showCreate ? (
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Queue</button>
      ) : (
        <form onSubmit={handleCreate} style={{
          padding: '20px 24px', background: 'var(--bg-elevated)',
          border: '1px solid var(--brand-500)44', borderRadius: 'var(--radius-lg)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🆕 Create Queue</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Name *</label>
              <input className="input" required placeholder="e.g. Tax &amp; Reporting" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Pick-up SLA (minutes)</label>
              <input className="input" type="number" min={5} max={10080} value={newSla} onChange={e => setNewSla(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Icon</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESET_ICONS.map(ic => (
                <button type="button" key={ic} onClick={() => setNewIcon(ic)}
                  style={{ fontSize: 18, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', border: `2px solid ${newIcon === ic ? newColor : 'var(--border)'}`, background: 'var(--bg-elevated)' }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Colour</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {PRESET_COLORS.map(c => (
                <div key={c} onClick={() => setNewColor(c)}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${newColor === c ? 'white' : 'transparent'}`, boxShadow: newColor === c ? `0 0 0 2px ${c}` : 'none' }} />
              ))}
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'none' }} />
            </div>
          </div>

          {/* Preview */}
          <div style={{ padding: '10px 14px', background: 'var(--bg-canvas)', borderRadius: 8, border: `2px solid ${newColor}`, display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>{newIcon}</span>
            <span style={{ fontWeight: 700, color: newColor }}>{newName || 'Queue Name'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>SLA: {newSla < 60 ? `${newSla}m` : `${newSla / 60}h`}</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={!newName.trim()}>Create Queue</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: string; superAdminOnly?: boolean }[] = [
  { id: 'platform',       label: 'Platform Config',       icon: '⚙️',  superAdminOnly: true },
  { id: 'database',       label: 'Database & Infra',       icon: '🗄️', superAdminOnly: true },
  { id: 'mfa',            label: 'MFA / Security',         icon: '🔐' },
  { id: 'integrations',   label: 'Integrations (BYOK)',    icon: '🔌' },
  { id: 'ai_keys',        label: 'AI Providers',           icon: '🤖' },
  { id: 'firm',           label: 'Firm Identity',          icon: '🏢' },
  { id: 'compliance',     label: 'Compliance',             icon: '⚖️' },
  { id: 'tasks',          label: 'Task Queues',            icon: '🗂' },
  { id: 'entity_types',   label: 'CRM Entities',           icon: '🏛️', superAdminOnly: true },
  { id: 'communications', label: 'Communications',         icon: '📧', superAdminOnly: true },
];


// ─── Section: Communications (email templates) ────────────────────────────────
// Dynamically imports the email template editor to avoid a heavy bundle on load

const EmailTemplatesPage = React.lazy(
  () => import('@/app/(dashboard)/platform/email-templates/page')
);

function CommunicationsSection() {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>📧 Communications</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Manage platform-wide email templates. Changes apply to all tenant communications.
        </p>
      </div>
      <React.Suspense fallback={<div style={{ padding: 40, textAlign:'center', color:'var(--text-tertiary)' }}>Loading template editor…</div>}>
        <EmailTemplatesPage />
      </React.Suspense>
    </div>
  );
}

// ─── Section: CRM Entities Types ───────────────────────────────────────────────

function EntityTypesSection() {
  const { tenant } = useAuth();
  
  const [types, setTypes] = useState({
    clientTypes: [] as string[],
    organizationTypes: [] as string[],
    contactTypes: [] as string[]
  });
  
  const [drafts, setDrafts] = useState({
    clientTypes: '',
    organizationTypes: '',
    contactTypes: ''
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!tenant?.id) return;
    const fetchTypes = async () => {
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        const res = await fetch(`/api/admin/tenant-config?tenantId=${tenant.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.entityTypes) setTypes(data.entityTypes);
      } catch (err) {
        console.error('Failed to load entity types', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTypes();
  }, [tenant?.id]);

  const handleSave = async (updatedTypes: typeof types) => {
    if (!tenant?.id) return;
    setSaving(true);
    setTypes(updatedTypes);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      await fetch('/api/admin/tenant-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, entityTypes: updatedTypes })
      });
    } catch (err) {
      console.error('Failed to save entity types', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (key: keyof typeof types) => {
    const draft = drafts[key].trim();
    if (!draft || types[key].includes(draft)) return;
    const updated = { ...types, [key]: [...types[key], draft] };
    setDrafts(prev => ({ ...prev, [key]: '' }));
    handleSave(updated);
  };

  const handleRemove = (key: keyof typeof types, itemToRemove: string) => {
    const updated = { ...types, [key]: types[key].filter(i => i !== itemToRemove) };
    handleSave(updated);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading Types...</div>;

  const renderSection = (title: string, desc: string, key: keyof typeof types) => (
    <Card className="mb-6 shadow-sm">
      <Title>{title}</Title>
      <Text className="mb-4 text-xs">{desc}</Text>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {types[key].map(item => (
          <Badge key={item} color="indigo" size="sm" className="cursor-pointer">
            <div className="flex items-center gap-1">
              <span>{item}</span>
              <button 
                onClick={() => handleRemove(key, item)}
                className="ml-1 text-indigo-800 hover:text-red-500 rounded-full"
                title={`Remove ${item}`}
              >
                ✕
              </button>
            </div>
          </Badge>
        ))}
        {types[key].length === 0 && <Text className="text-xs italic">No types configured.</Text>}
      </div>

      <div className="flex gap-2 max-w-sm">
        <TextInput 
          placeholder={`Add new ${title.toLowerCase()}...`}
          value={drafts[key]}
          onChange={e => setDrafts(prev => ({ ...prev, [key]: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && handleAdd(key)}
        />
        <Button size="sm" onClick={() => handleAdd(key)} disabled={!drafts[key].trim() || saving}>
          Add
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>🏛️ CRM Entities Configuration</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Customize the classifications available for Clients, Organizations, and Contacts throughout the platform.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {renderSection('Client Types', 'Used to classify the primary Wealth owner (e.g., Family Group, Single Family Office).', 'clientTypes')}
        {renderSection('Organization Types', 'Used to classify connected institutions (e.g., Bank, Law Firm, Fund).', 'organizationTypes')}
        {renderSection('Contact Types', 'Used to classify individual professionals or family members (e.g., Private Banker, Trustee).', 'contactTypes')}
      </div>
    </div>
  );
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const { tenant } = useAuth();
  const isInternal = tenant?.isInternal;
  // Show demo_data tab only for non-internal (client) tenants — trial check would come from subscription context
  const [activeTab, setActiveTab] = useState<TabId>('platform');

  const visibleTabs = TABS.filter(t => {
    if (t.superAdminOnly && !isInternal) return false;
    return true;
  });

  return (
    <div className="page-wrapper animate-fade-in max-w-[1400px] mx-auto py-10 px-6">
      <div className="mb-10 pl-2 border-l-4 border-indigo-500">
        <Title className="text-3xl font-bold tracking-tight text-tremor-content-strong">Firm Administration & Security</Title>
        <Text className="mt-2 text-tremor-content">Manage platform configurations, billing metrics, API keys, compliance, and user lifecycles.</Text>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-12">
        {/* Sidebar Nav */}
        <aside className="flex flex-col gap-2">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-tremor-default text-sm transition-all text-left border ${
                activeTab === tab.id 
                  ? 'bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-600 font-semibold shadow-sm border-indigo-200' 
                  : 'text-tremor-content hover:bg-tremor-background-subtle hover:text-tremor-content-emphasis border-transparent hover:border-tremor-border'
              }`}
            >
              <span className="text-lg w-6 text-center">{tab.icon}</span>
              <span className="flex-1">{tab.label}</span>
              {tab.superAdminOnly && (
                <Badge size="xs" color="blue" className="ml-auto px-1.5 opacity-80">SA</Badge>
              )}
            </button>
          ))}
        </aside>

        {/* Content */}
        <Card className="min-h-[600px] shadow-sm ring-1 ring-tremor-border p-8 md:p-10">
          {activeTab === 'platform'       && <PlatformSection />}
          {activeTab === 'database'       && <DatabaseSection />}
          {activeTab === 'mfa'            && <MfaSection />}
          {activeTab === 'integrations'   && <IntegrationsSection />}
          {activeTab === 'ai_keys'        && <AiKeysSection />}
          {activeTab === 'firm'           && <FirmSection />}
          {activeTab === 'compliance'     && <ComplianceSection />}
          {activeTab === 'tasks'          && <QueueSettingsSection />}
          {activeTab === 'entity_types'   && <EntityTypesSection />}
          {activeTab === 'communications' && <CommunicationsSection />}
        </Card>
      </div>
    </div>
  );
}
