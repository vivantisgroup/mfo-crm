'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import { type TaskQueue } from '@/lib/types';
import { VERTICAL_REGISTRY } from '@/lib/verticalRegistry';
import { Card, Title, Subtitle, Text, Divider, Flex, Grid, Col, Badge, TextInput, Select, SelectItem, Switch, Button, TabGroup, TabList, Tab, TabPanels, TabPanel } from '@tremor/react';
import { Settings, Database, Shield, Plug, Bot, Building2, Scale, Sliders, Landmark, Mail, DatabaseBackup, Settings2, Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId =
  | 'platform'
  | 'database'
  | 'mfa'
  | 'integrations'
  | 'ai_keys'
  | 'firm'
  | 'compliance'
  | 'customizations'
  | 'users'
  | 'communications'
  | 'data_explorer';

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
  const [config, setConfig] = useState({
    firestoreProjectId: 'mfo-crm',
    firestoreServiceAccount: '',
    firebaseStorageBucket: 'mfo-crm.firebasestorage.app',
    redisUrl: '',
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="animate-fade-in flex flex-col h-full">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Database Infrastructure</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Configure your primary data providers, admin SDK access, and storage layer.
        </p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          {['Firebase / Firestore', 'Cloud Storage', 'Redis / Upstash'].map(badge => (
            <span key={badge} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-semibold" style={{ fontSize: 11 }}>{badge}</span>
          ))}
        </div>
      </div>

      <div className="bg-tremor-background-subtle rounded-tremor-default border border-tremor-border p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-6 border-b border-tremor-border pb-4">
          <span className="text-xl">🗄️</span>
          <h3 className="font-bold text-tremor-content-strong">Core Infrastructure Configuration</h3>
        </div>

        <Grid numItemsMd={2} className="gap-6">
          <Col>
            <label className="text-xs font-bold uppercase tracking-wider text-tremor-content mb-2 block">Firebase Project ID *</label>
            <TextInput value={config.firestoreProjectId} onValueChange={(val) => setConfig(p => ({...p, firestoreProjectId: val}))} className="font-mono text-sm" />
            <Text className="text-[11px] mt-1 text-tremor-content">Primary Firestore database project identifier</Text>
          </Col>
          <Col>
            <label className="text-xs font-bold uppercase tracking-wider text-tremor-content mb-2 block">Firebase Storage Bucket *</label>
            <TextInput value={config.firebaseStorageBucket} onValueChange={(val) => setConfig(p => ({...p, firebaseStorageBucket: val}))} className="font-mono text-sm" />
            <Text className="text-[11px] mt-1 text-tremor-content">Cloud Storage bucket for documents</Text>
          </Col>
          <Col numColSpanMd={2}>
            <label className="text-xs font-bold uppercase tracking-wider text-tremor-content mb-2 block">Firebase Service Account (JSON) *</label>
            <TextInput type="password" placeholder="Paste full service account JSON..." value={config.firestoreServiceAccount} onValueChange={(val) => setConfig(p => ({...p, firestoreServiceAccount: val}))} className="font-mono text-sm" />
            <Text className="text-[11px] mt-1 text-tremor-content">Server-side service account for admin SDK access</Text>
          </Col>
          <Col numColSpanMd={2}>
            <label className="text-xs font-bold uppercase tracking-wider text-tremor-content mb-2 block">Redis / Upstash URL (Optional)</label>
            <TextInput placeholder="redis://default:password@host:6379" value={config.redisUrl} onValueChange={(val) => setConfig(p => ({...p, redisUrl: val}))} className="font-mono text-sm" />
            <Text className="text-[11px] mt-1 text-tremor-content">Optional: for rate limiting and session caching in production</Text>
          </Col>
        </Grid>
      </div>

      <div className="flex justify-end mt-auto">
        <Button onClick={handleSave} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-8 shadow-sm">
          {saved ? '✅ Saved!' : 'Save Infrastructure Configuration'}
        </Button>
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
        
        <div style={{ marginTop: 16, padding: '16px 20px', border: '1px solid #0078d444', borderRadius: 'var(--radius-md)', background: '#0078d408' }}>
          <div style={{ fontWeight: 700, color: '#0078d4', fontSize: 13, marginBottom: 6 }}>Global Teams Firehose Initialization</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Provision a cross-tenant Application webhook for both Channels and 1x1 Chats. Requires Client ID and Secret to be configured first.
          </div>
          <Button size="xs" variant="secondary" onClick={async () => {
             const btn = document.getElementById('init-hook-btn');
             const msgContainer = document.getElementById('init-hook-msg');
             if (btn) btn.innerText = 'Provisioning...';
             if (msgContainer) msgContainer.innerText = '';
             try {
                const res = await fetch('/api/admin/webhooks/provision-teams', {
                   method: 'POST',
                   headers: { 'Authorization': 'Bearer sandbox-admin-key' }
                });
                if (!res.ok) {
                   const txt = await res.text();
                   if (msgContainer) { msgContainer.innerText = 'Failed: ' + txt; msgContainer.className = 'text-red-500 text-xs mt-2 font-semibold'; }
                } else {
                   if (msgContainer) { msgContainer.innerText = '✓ Global Teams webhooks provisioned successfully!'; msgContainer.className = 'text-emerald-500 text-xs mt-2 font-semibold'; }
                }
             } catch(e: any) {
                if (msgContainer) { msgContainer.innerText = 'Error: ' + e.message; msgContainer.className = 'text-red-500 text-xs mt-2 font-semibold'; }
             } finally {
                if (btn) btn.innerText = 'Initialize Native Webhooks';
             }
          }} id="init-hook-btn">Initialize Native Webhooks</Button>
          <div id="init-hook-msg" className="mt-2 text-xs"></div>
        </div>
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

  const isInternal = tenant?.isInternal ?? false;
  const [activeVertical, setActiveVertical] = useState<string>('global');

  // Determine which queues to display
  const visibleQueues = queues.filter(q => {
    if (isInternal) {
      return (q.tenantType || 'global') === activeVertical;
    } else {
      // Regular tenants see global queues (read-only) and their own vertical queues
      return (q.tenantType || 'global') === 'global' || q.tenantType === tenant?.industryVertical;
    }
  });

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

    const targetVertical = isInternal ? activeVertical : (tenant?.industryVertical || 'global');

    addQueue(
      { name: newName.trim(), icon: newIcon, color: newColor, memberIds: [], assignSlaMinutes: newSla, tenantType: targetVertical },
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

      {isInternal && (
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Manage Tenant Type:</div>
          <select 
            className="input" 
            style={{ width: 240, padding: '8px 12px' }}
            value={activeVertical}
            onChange={(e) => setActiveVertical(e.target.value)}
          >
            <option value="global">🌍 Global (All Tenants)</option>
            <option value="saas_platform">☁️ SaaS Platform</option>
            {Object.values(VERTICAL_REGISTRY).map(v => (
              <option key={v.id} value={v.id}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>
      )}

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
        {visibleQueues.length === 0 && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-tertiary)', border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
            No queues found for this tenant type.
          </div>
        )}
        {visibleQueues.map(q => {
          const taskCount = queueTaskCount(q.id);
          const isEditing = editingId === q.id;
          const isRemoving = removingId === q.id;
          const migTargets = queues.filter(x => x.id !== q.id);
          const canManage = isInternal || q.tenantType === tenant?.industryVertical;

          return (
            <div key={q.id} style={{
              background: 'var(--bg-elevated)',
              borderTop: `1px solid ${isEditing || isRemoving ? q.color + '66' : 'var(--border)'}`,
              borderRight: `1px solid ${isEditing || isRemoving ? q.color + '66' : 'var(--border)'}`,
              borderBottom: `1px solid ${isEditing || isRemoving ? q.color + '66' : 'var(--border)'}`,
              borderLeft: `4px solid ${q.color}`, 
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden', transition: 'border-color 0.2s',
            }}>
              {/* Queue row */}
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{q.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {q.name}
                    {!canManage && (
                      <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', background: 'var(--bg-canvas)', borderRadius: 4, color: 'var(--text-tertiary)', border: '1px solid var(--border)' }}>Global (Read-Only)</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    Pick-up SLA: {q.assignSlaMinutes < 60 ? `${q.assignSlaMinutes}m` : `${q.assignSlaMinutes / 60}h`}
                    &nbsp;·&nbsp;
                    <span style={{ color: taskCount > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                      {taskCount} task{taskCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                {canManage && (
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
                )}
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

const TABS: { id: TabId; label: string; icon: React.ElementType; superAdminOnly?: boolean }[] = [
  { id: 'platform',       label: 'Platform Config',       icon: Settings,  superAdminOnly: true },
  { id: 'database',       label: 'Database',              icon: Database,  superAdminOnly: true },
  { id: 'data_explorer',  label: 'Data',                  icon: DatabaseBackup, superAdminOnly: true },
  { id: 'mfa',            label: 'MFA / Security',        icon: Shield },
  { id: 'integrations',   label: 'Integrations (BYOK)',   icon: Plug },
  { id: 'ai_keys',        label: 'AI Providers',          icon: Bot },
  { id: 'firm',           label: 'Firm Identity',         icon: Building2 },
  { id: 'compliance',     label: 'Compliance',            icon: Scale },
  { id: 'customizations', label: 'Customizations',        icon: Sliders },
  { id: 'communications', label: 'Communications',        icon: Mail, superAdminOnly: true },
];


// ─── Section: Communications (email templates) ────────────────────────────────
// Dynamically imports the email template editor to avoid a heavy bundle on load

const EmailTemplatesPage = React.lazy(
  () => import('@/app/(dashboard)/platform/email-templates/page')
);

// Helper: shows a small badge — reflects actual field value
function FieldStatus({ filled }: { filled: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
      padding: '2px 8px', borderRadius: 20,
      background: filled ? '#dcfce7' : '#fef2f2',
      color:      filled ? '#166534' : '#991b1b',
      border: `1px solid ${filled ? '#86efac' : '#fca5a5'}`,
      marginLeft: 8, verticalAlign: 'middle',
    }}>
      {filled ? '✓ Configured' : '○ Empty'}
    </span>
  );
}

// Reusable secret field with eye-toggle
function SecretField({
  label, value, onChange, placeholder, isLoading,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-tremor-content mb-2 block">
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '••••••••••••••••••••••••••••••••'}
          disabled={isLoading}
          style={{
            width: '100%', fontFamily: 'monospace', fontSize: 13,
            padding: '8px 36px 8px 12px',
            border: '1px solid var(--tremor-border-color, #e5e7eb)',
            borderRadius: 6,
            background: isLoading ? '#f9fafb' : 'white',
            outline: 'none',
            color: '#111827',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          title={show ? 'Hide' : 'Show'}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', padding: 2,
            display: 'flex', alignItems: 'center',
          }}
        >
          {show
            ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

function CommunicationsSection() {
  const [activeProvider, setActiveProvider] = useState<'teams' | 'slack' | 'google'>('teams');

  const [teamsEnabled,      setTeamsEnabled]      = useState(false);
  const [teamsAppId,        setTeamsAppId]         = useState('');
  const [teamsTenantId,     setTeamsTenantId]      = useState('');
  const [teamsClientSecret, setTeamsClientSecret]  = useState('');
  const [teamsSaved,        setTeamsSaved]         = useState(false);
  const [teamsSaveError,    setTeamsSaveError]     = useState('');
  const [isSavingTeams,     setIsSavingTeams]      = useState(false);
  const [isLoadingTeams,    setIsLoadingTeams]     = useState(true);

  const [slackEnabled,      setSlackEnabled]      = useState(false);
  const [slackAppId,        setSlackAppId]         = useState('');
  const [slackClientId,     setSlackClientId]      = useState('');
  const [slackClientSecret, setSlackClientSecret]  = useState('');
  const [slackSigningSecret,setSlackSigningSecret] = useState('');
  const [slackSaved,        setSlackSaved]         = useState(false);

  const [googleEnabled,      setGoogleEnabled]      = useState(false);
  const [googleClientId,     setGoogleClientId]     = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleSaved,        setGoogleSaved]        = useState(false);
  const [googleSaveError,    setGoogleSaveError]    = useState('');
  const [isSavingGoogle,     setIsSavingGoogle]     = useState(false);
  const [isLoadingGoogle,    setIsLoadingGoogle]    = useState(true);

  React.useEffect(() => {
    setIsLoadingTeams(true);
    fetch('/api/admin/platform/microsoft')
      .then(async res => {
        // Even a 503 may return JSON with _unavailable flag
        const data = await res.json().catch(() => ({ error: true }));
        return data;
      })
      .then(data => {
        if (!data.error) {
          // Always set enabled from the persisted value (this was the bug: skipping on data.error)
          const enabled = data.enabled ?? false;
          setTeamsEnabled(enabled);
          setTeamsAppId(data.appId        || '');
          setTeamsTenantId(data.tenantId  || '');
          setTeamsClientSecret(data.clientSecret || '');
        } else {
          console.warn('[CommunicationsSection] Could not load Microsoft config; UI will show current defaults.');
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingTeams(false));

    setIsLoadingGoogle(true);
    fetch('/api/admin/platform/google')
      .then(async res => {
        const data = await res.json().catch(() => ({ error: true }));
        return data;
      })
      .then(data => {
        if (!data.error) {
          const enabled = data.enabled ?? false;
          setGoogleEnabled(enabled);
          setGoogleClientId(data.clientId || '');
          setGoogleClientSecret(data.clientSecret || '');
        } else {
          console.warn('[CommunicationsSection] Could not load Google config.');
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingGoogle(false));
  }, []);

  const handleSaveTeams = async () => {
    setIsSavingTeams(true);
    setTeamsSaveError('');
    try {
      const res = await fetch('/api/admin/platform/microsoft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled:      teamsEnabled,
          appId:        teamsAppId,
          tenantId:     teamsTenantId,
          clientSecret: teamsClientSecret,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setTeamsSaveError(data.error || `Server error ${res.status}. Check Admin SDK credentials.`);
      } else {
        setTeamsSaved(true);
        setTimeout(() => setTeamsSaved(false), 2500);
      }
    } catch (e: any) {
      setTeamsSaveError(e.message);
    } finally {
      setIsSavingTeams(false);
    }
  };

  const handleSaveGoogle = async () => {
    setIsSavingGoogle(true);
    setGoogleSaveError('');
    try {
      const res = await fetch('/api/admin/platform/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled:      googleEnabled,
          clientId:     googleClientId,
          clientSecret: googleClientSecret,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setGoogleSaveError(data.error || `Server error ${res.status}`);
      } else {
        setGoogleSaved(true);
        setTimeout(() => setGoogleSaved(false), 2500);
      }
    } catch (e: any) {
      setGoogleSaveError(e.message);
    } finally {
      setIsSavingGoogle(false);
    }
  };

  const handleSaveSlack = () => {
    setSlackSaved(true);
    setTimeout(() => setSlackSaved(false), 2500);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>📧 Communications Platform</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Manage global messaging integrations and platform-wide email templates.
        </p>
      </div>

      <TabGroup>
        <TabList className="mb-6">
          <Tab>Email Templates</Tab>
          <Tab>Messaging Pipelines</Tab>
          <Tab>SMTP Settings</Tab>
        </TabList>
        <TabPanels>
          {/* Email Templates Panel */}
          <TabPanel>
            <div className="bg-tremor-background-subtle rounded-tremor-default p-4 mb-4">
              <Text className="text-sm">Manage platform-wide email templates. Changes apply to all tenant communications.</Text>
            </div>
            <React.Suspense fallback={<div style={{ padding: 40, textAlign:'center', color:'var(--text-tertiary)' }}>Loading template editor…</div>}>
              <EmailTemplatesPage />
            </React.Suspense>
          </TabPanel>

          {/* Messaging Pipelines Panel */}
          <TabPanel>
            <Grid numItemsMd={3} className="gap-6 mt-4">
              {/* MASTER LIST */}
              <Col numColSpanMd={1} className="flex flex-col gap-3">
                <button 
                  onClick={() => setActiveProvider('teams')}
                  className={`flex items-center gap-3 p-4 rounded-tremor-default border text-left transition-all ${
                    activeProvider === 'teams' ? 'bg-[#5B5FC7]/10 border-[#5B5FC7] shadow-sm' : 'bg-tremor-background-subtle border-transparent hover:border-tremor-border opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="w-10 h-10 rounded-md bg-[#EEF2FC] flex items-center justify-center text-[#5B5FC7] shrink-0 font-bold">M</div>
                  <div>
                    <div className="font-semibold text-tremor-content-strong text-sm">Microsoft Teams</div>
                    <div className="text-xs text-tremor-content mt-1">Azure AD Graph API</div>
                  </div>
                  {teamsEnabled && <Badge size="xs" color="emerald" className="ml-auto">Active</Badge>}
                </button>

                <button 
                  onClick={() => setActiveProvider('slack')}
                  className={`flex items-center gap-3 p-4 rounded-tremor-default border text-left transition-all ${
                    activeProvider === 'slack' ? 'bg-[#E01E5A]/10 border-[#E01E5A] shadow-sm' : 'bg-tremor-background-subtle border-transparent hover:border-tremor-border opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="w-10 h-10 rounded-md bg-stone-100 flex items-center justify-center text-[#E01E5A] shrink-0 font-bold">S</div>
                  <div>
                    <div className="font-semibold text-tremor-content-strong text-sm">Slack app</div>
                    <div className="text-xs text-tremor-content mt-1">Events API Webhook</div>
                  </div>
                  {slackEnabled && <Badge size="xs" color="emerald" className="ml-auto">Active</Badge>}
                </button>

                <button 
                  onClick={() => setActiveProvider('google')}
                  className={`flex items-center gap-3 p-4 rounded-tremor-default border text-left transition-all ${
                    activeProvider === 'google' ? 'bg-[#4285F4]/10 border-[#4285F4] shadow-sm' : 'bg-tremor-background-subtle border-transparent hover:border-tremor-border opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center text-[#4285F4] shrink-0 font-bold" style={{ fontSize: 18 }}>G</div>
                  <div>
                    <div className="font-semibold text-tremor-content-strong text-sm">Google Workspace</div>
                    <div className="text-xs text-tremor-content mt-1">OAuth & Gmail API</div>
                  </div>
                  {googleEnabled && <Badge size="xs" color="emerald" className="ml-auto">Active</Badge>}
                </button>
              </Col>

              {/* DETAIL VIEW */}
              <Col numColSpanMd={2}>
                <Card className="h-full min-h-[500px] shadow-sm ring-1 ring-tremor-border flex flex-col p-6">
                  {activeProvider === 'teams' && (
                    <div className="flex-1 flex flex-col gap-6 animate-fade-in">
                      <Flex alignItems="start" justifyContent="between">
                        <div>
                          <Title className="text-[#5B5FC7] flex items-center gap-2 font-bold">
                            Microsoft Teams Pipeline
                          </Title>
                          <Text className="text-xs mt-1 text-tremor-content">Enable secure messaging boundaries via Microsoft Graph.</Text>
                        </div>
                        <div className="flex items-center gap-3 bg-tremor-background-subtle px-3 py-1.5 rounded-full border border-tremor-border">
                          <Text className="text-xs font-semibold text-tremor-content-strong">{teamsEnabled ? 'Enabled' : 'Disabled'}</Text>
                          <Switch id="teams-switch" checked={teamsEnabled} onChange={setTeamsEnabled} />
                        </div>
                      </Flex>
                      <Divider className="my-1" />
                      <div className="text-xs text-tremor-content bg-indigo-50/50 p-4 rounded-tremor-small border border-indigo-100 leading-relaxed shadow-sm">
                        <strong className="text-indigo-900">Provisioning Requirements:</strong> Register an App within your Azure Active Directory / Entra Portal. Make sure to grant Admin Consent for <code className="text-xs font-mono text-indigo-700 bg-indigo-100 px-1 py-0.5 rounded">ChannelMessage.Send</code>, <code className="text-xs font-mono text-indigo-700 bg-indigo-100 px-1 py-0.5 rounded">Channel.ReadBasic.All</code>, and <code className="text-xs font-mono text-indigo-700 bg-indigo-100 px-1 py-0.5 rounded">Team.ReadBasic.All</code> to allow automatic message routing to channels from CRM entities.
                      </div>

                      {isLoadingTeams && (
                        <div className="text-xs text-tremor-content animate-pulse">Loading saved configuration…</div>
                      )}

                      <div className="grid grid-cols-1 gap-5 mt-2">
                        <SecretField
                          label={<>Application (Client) ID * <FieldStatus filled={!!teamsAppId} /></>}
                          value={teamsAppId}
                          onChange={setTeamsAppId}
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          isLoading={isLoadingTeams}
                        />
                        <SecretField
                          label={<>Directory (Tenant) ID * <FieldStatus filled={!!teamsTenantId} /></>}
                          value={teamsTenantId}
                          onChange={setTeamsTenantId}
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          isLoading={isLoadingTeams}
                        />
                        <SecretField
                          label={<>Client Secret Value * <FieldStatus filled={!!teamsClientSecret} /></>}
                          value={teamsClientSecret}
                          onChange={setTeamsClientSecret}
                          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          isLoading={isLoadingTeams}
                        />
                      </div>

                      {teamsSaveError && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-tremor-small p-3 mt-2">
                          ⚠️ Save failed: {teamsSaveError}
                        </div>
                      )}

                      <div className="mt-auto pt-6 flex justify-end">
                        <Button
                          onClick={handleSaveTeams}
                          disabled={isSavingTeams || isLoadingTeams}
                          className="bg-[#5B5FC7] hover:bg-[#4d51a6] text-white border-transparent px-8 shadow-sm"
                        >
                          {teamsSaved ? '✅ Configuration Saved!' : isSavingTeams ? 'Saving…' : 'Save Connection Details'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeProvider === 'google' && (
                    <div className="flex-1 flex flex-col gap-6 animate-fade-in">
                      <Flex alignItems="start" justifyContent="between">
                        <div>
                          <Title className="text-[#4285F4] flex items-center gap-2 font-bold">
                            Google Workspace Integration
                          </Title>
                          <Text className="text-xs mt-1 text-tremor-content">Configure OAuth for user email and calendar syncing.</Text>
                        </div>
                        <div className="flex items-center gap-3 bg-tremor-background-subtle px-3 py-1.5 rounded-full border border-tremor-border">
                          <Text className="text-xs font-semibold text-tremor-content-strong">{googleEnabled ? 'Enabled' : 'Disabled'}</Text>
                          <Switch id="google-switch" checked={googleEnabled} onChange={setGoogleEnabled} />
                        </div>
                      </Flex>
                      <Divider className="my-1" />
                      <div className="text-xs text-tremor-content bg-blue-50/50 p-4 rounded-tremor-small border border-blue-100 leading-relaxed shadow-sm">
                        <strong className="text-blue-900">Provisioning Requirements:</strong> Create an OAuth Client in the Google Cloud Console. Configure the authorized redirect URI to exactly <code className="text-xs font-mono text-blue-700 bg-blue-100 px-1 py-0.5 rounded">https://app.vivantisgroup.com/api/oauth/google/callback</code> (or localhost for dev). This will be used by all tenant members globally to connect their inboxes.
                      </div>

                      {isLoadingGoogle && (
                        <div className="text-xs text-tremor-content animate-pulse">Loading saved configuration…</div>
                      )}

                      <div className="grid grid-cols-1 gap-5 mt-2">
                        <SecretField
                          label={<>Client ID * <FieldStatus filled={!!googleClientId} /></>}
                          value={googleClientId}
                          onChange={setGoogleClientId}
                          placeholder="xxxxxxxxxx-xxxxxxxxxxxxxxx.apps.googleusercontent.com"
                          isLoading={isLoadingGoogle}
                        />
                        <SecretField
                          label={<>Client Secret * <FieldStatus filled={!!googleClientSecret} /></>}
                          value={googleClientSecret}
                          onChange={setGoogleClientSecret}
                          placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxx"
                          isLoading={isLoadingGoogle}
                        />
                      </div>

                      {googleSaveError && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-tremor-small p-3 mt-2">
                          ⚠️ Save failed: {googleSaveError}
                        </div>
                      )}

                      <div className="mt-auto pt-6 flex justify-end">
                        <Button
                          onClick={handleSaveGoogle}
                          disabled={isSavingGoogle || isLoadingGoogle}
                          className="bg-[#4285F4] hover:bg-[#3367d6] text-white border-transparent px-8 shadow-sm"
                        >
                          {googleSaved ? '✅ Configuration Saved!' : isSavingGoogle ? 'Saving…' : 'Save Connection Details'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeProvider === 'slack' && (
                    <div className="flex-1 flex flex-col gap-6 animate-fade-in">
                      <Flex alignItems="start" justifyContent="between">
                        <div>
                          <Title className="text-[#E01E5A] flex items-center gap-2 font-bold">
                            Slack Workspace Pipeline
                          </Title>
                          <Text className="text-xs mt-1 text-tremor-content">Route real-time alerts into native channels.</Text>
                        </div>
                        <div className="flex items-center gap-3 bg-tremor-background-subtle px-3 py-1.5 rounded-full border border-tremor-border">
                          <Text className="text-xs font-semibold text-tremor-content-strong">{slackEnabled ? 'Enabled' : 'Disabled'}</Text>
                          <Switch id="slack-switch" checked={slackEnabled} onChange={setSlackEnabled} />
                        </div>
                      </Flex>
                      <Divider className="my-1" />
                      <div className="text-xs text-tremor-content bg-pink-50 p-4 rounded-tremor-small border border-pink-100 leading-relaxed shadow-sm">
                        <strong className="text-pink-900">Provisioning Requirements:</strong> Create an App in your Slack developer portal. Add OAuth scopes for <code className="text-xs font-mono text-pink-700 bg-pink-100 px-1 py-0.5 rounded">chat:write</code> and <code className="text-xs font-mono text-pink-700 bg-pink-100 px-1 py-0.5 rounded">channels:read</code>. Configure your Event Webhooks to point back to the CRM routing engine.
                      </div>

                      <div className="grid grid-cols-2 gap-5 mt-2">
                        <div className="col-span-2">
                          <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-tremor-content mb-2 block">App ID *</label>
                          <TextInput placeholder="A0XXXXXXXXX" value={slackAppId} onValueChange={setSlackAppId} className="font-mono text-sm shadow-sm" />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-tremor-content mb-2 block">Client ID *</label>
                          <TextInput placeholder="1234.5678" value={slackClientId} onValueChange={setSlackClientId} className="font-mono text-sm shadow-sm" />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-tremor-content mb-2 block">Client Secret *</label>
                          <TextInput type="password" placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" value={slackClientSecret} onValueChange={setSlackClientSecret} className="font-mono text-sm shadow-sm" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[11px] font-bold uppercase tracking-[0.05em] text-tremor-content mb-2 block">Signing Secret *</label>
                          <TextInput type="password" placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" value={slackSigningSecret} onValueChange={setSlackSigningSecret} className="font-mono text-sm shadow-sm" />
                        </div>
                      </div>

                      <div className="mt-auto pt-6 flex justify-end">
                         <Button onClick={handleSaveSlack} className="bg-[#E01E5A] hover:bg-[#c91a50] text-white border-transparent px-8 shadow-sm">
                           {slackSaved ? '✅ Configuration Saved!' : 'Save Connection Details'}
                         </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </Col>
            </Grid>
          </TabPanel>

          {/* SMTP Settings Panel */}
          <TabPanel>
            <div className="bg-tremor-background-subtle rounded-tremor-default border border-tremor-border p-6 shadow-sm mt-4">
              <div className="flex items-center gap-2 mb-6 border-b border-tremor-border pb-4">
                <span className="text-xl">📫</span>
                <div>
                  <h3 className="font-bold text-tremor-content-strong leading-none">SMTP Email Routing</h3>
                  <Text className="text-xs text-tremor-content mt-1">Configure SendGrid or custom SMTP for system alerts and platform notifications.</Text>
                </div>
              </div>

              <Grid numItemsMd={2} className="gap-6">
                <Col>
                  <label className="text-xs font-bold uppercase tracking-wider text-tremor-content mb-2 block">SMTP Host *</label>
                  <TextInput defaultValue="smtp.sendgrid.net" className="font-mono text-sm" />
                  <Text className="text-[11px] mt-1 text-tremor-content">Server address for outgoing mail</Text>
                </Col>
                <Col>
                  <label className="text-xs font-bold uppercase tracking-wider text-tremor-content mb-2 block">SMTP Port *</label>
                  <TextInput defaultValue="587" className="font-mono text-sm" />
                  <Text className="text-[11px] mt-1 text-tremor-content">Standard 587 (TLS) or 465 (SSL)</Text>
                </Col>
                <Col numColSpanMd={2}>
                  <label className="text-xs font-bold uppercase tracking-wider text-tremor-content mb-2 block">Username *</label>
                  <TextInput defaultValue="apikey" className="font-mono text-sm" />
                </Col>
                <Col numColSpanMd={2}>
                  <label className="text-xs font-bold uppercase tracking-wider text-tremor-content mb-2 block">SMTP Password / API Key *</label>
                  <TextInput type="password" placeholder="SG.xxxxx..." defaultValue="SG.xxxxx..." className="font-mono text-sm" />
                  <Text className="text-[11px] mt-1 text-tremor-content">For SendGrid, use 'apikey' as username and input the API token here.</Text>
                </Col>
              </Grid>

              <div className="mt-8 flex justify-end">
                <Button className="bg-[#6366f1] hover:bg-[#4f46e5] text-white border-transparent px-8 shadow-sm" onClick={() => alert('Saved SMTP Configuration')}>
                  Save Email Configuration
                </Button>
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
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

// ─── Section: Customizations ───────────────────────────────────────────────────

function AIRoutingPolicySection() {
  const { tenant } = useAuth();
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState([
    { id: 'document_analysis', label: 'Document Analysis', primary: 'Claude', fallback: 'GPT-4o' },
    { id: 'portfolio_narrative', label: 'Portfolio Narrative', primary: 'GPT-4o', fallback: 'Gemini Pro' },
    { id: 'compliance_review', label: 'Compliance Review', primary: 'Claude', fallback: 'GPT-4o' },
  ]);

  const providers = ['GPT-4o', 'Claude', 'Gemini Pro', 'Llama 3'];
  const [toast, setToast] = useState('');

  const handleSave = async () => {
    setLoading(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (token && tenant?.id) {
        await fetch('/api/admin/tenant-config', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: tenant.id, aiRoutingPolicy: routes })
        });
        setToast('AI Routing configuration safely persisted.');
        setTimeout(() => setToast(''), 3000);
      }
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateRoute = (id: string, field: 'primary' | 'fallback', val: string) => {
    setRoutes(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>🔄 AI Routing Policy</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Define explicitly which AI models should be used by internal agent systems to handle asynchronous workloads. Ensures compliance to tenant-specific LLM restrictions.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {routes.map(r => (
          <div key={r.id} style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 12 }}>
              {r.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Primary Engine</label>
                <select className="input" value={r.primary} onChange={e => updateRoute(r.id, 'primary', e.target.value)} style={{ width: '100%', padding: '6px 10px', fontSize: 13 }}>
                  {providers.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Fallback Engine</label>
                <select className="input" value={r.fallback} onChange={e => updateRoute(r.id, 'fallback', e.target.value)} style={{ width: '100%', padding: '6px 10px', fontSize: 13 }}>
                  {providers.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <Button onClick={handleSave} color="indigo" loading={loading} size="xs">
          Deploy Fallback Config
        </Button>
        {toast && <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>✓ {toast}</span>}
      </div>
    </div>
  );
}

function TenantTypesSection() {
  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>🏢 Supported Tenant Types</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Visual list of all pre-configured SaaS verticals hosted over this platform. Definitions enforce CRM metadata and standard navigational hierarchies.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {VERTICAL_REGISTRY.map(v => (
          <div key={v.id} style={{ padding: '16px', border: `1px solid ${v.color}44`, background: `${v.color}0a`, borderRadius: 'var(--radius-lg)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 28 }}>{v.icon}</span>
                <div>
                  <h4 style={{ fontWeight: 800, color: v.color, fontSize: 15 }}>{v.label}</h4>
                  <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg-canvas)', borderRadius: 12, color: 'var(--text-secondary)' }}>
                     {v.status === 'ga' ? '🟢 General Availability' : v.status === 'beta' ? '🟡 Beta' : '🔒 Coming Soon'}
                  </span>
                </div>
             </div>
             <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{v.tagline}</p>
             <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {v.defaultModules.slice(0,4).map(m => (
                  <span key={m} style={{ fontSize: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-tertiary)' }}>
                    {m.replace('_',' ')}
                  </span>
                ))}
                {v.defaultModules.length > 4 && <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>+{v.defaultModules.length - 4} more</span>}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomizationsSection() {
  const [activeTab, setActiveTab] = useState<'routing' | 'queues' | 'entities' | 'types'>('routing');

  const tabs = [
    { id: 'routing', label: 'AI Routing Policy' },
    { id: 'queues', label: 'Task Queue Management' },
    { id: 'entities', label: 'CRM Entities' },
    { id: 'types', label: 'Tenant Types' },
  ] as const;

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      
      {/* Top Dock TabGroup */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 10, padding: 4, alignSelf: 'flex-start' }}>
        {tabs.map(t => (
          <button 
            key={t.id} 
            onClick={() => setActiveTab(t.id)} 
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: activeTab === t.id ? 'var(--brand-500)' : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bg-canvas)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '24px' }}>
         {activeTab === 'routing' && <AIRoutingPolicySection />}
         {activeTab === 'queues' && <QueueSettingsSection />}
         {activeTab === 'entities' && <EntityTypesSection />}
         {activeTab === 'types' && <TenantTypesSection />}
      </div>
      
    </div>
  );
}

// ─── Section: Data Explorer ────────────────────────────────────────────────────

// ─── Section: Data Explorer ────────────────────────────────────────────────────

function DataExplorerSection() {
  const { tenant } = useAuth();
  
  // Active states
  const [activeTab, setActiveTab] = useState<'query' | 'export' | 'consistency'>('query');
  const [loading, setLoading] = useState(false);
  
  // Query
  const [collectionName, setCollectionName] = useState('users');
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [queryError, setQueryError] = useState('');
  
  // CRUD & Explorer
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isEditingRecord, setIsEditingRecord] = useState<boolean>(false);
  const [editJsonStr, setEditJsonStr] = useState<string>('');
  const [executingCrud, setExecutingCrud] = useState<boolean>(false);
  const [depReport, setDepReport] = useState<any>(null);
  const [explorerSearch, setExplorerSearch] = useState('');


  // Consistency
  const [consistencyReport, setConsistencyReport] = useState<any>(null);
  
  // Errors
  const [exportError, setExportError] = useState('');
  const [consistencyError, setConsistencyError] = useState('');

  const handleQuery = async () => {
    setLoading(true);
    setQueryError('');
    setQueryResults([]);
    setSelectedRecordId(null);
    setIsEditingRecord(false);
    setDepReport(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ collectionName, tenantId: tenant?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQueryResults(data.docs || []);
    } catch (err: any) {
      setQueryError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInspect = async (recordId: string) => {
    setExecutingCrud(true);
    setDepReport(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/db/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'INSPECT', collectionName, recordId, tenantId: tenant?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDepReport(data.dependencies);
    } catch (err: any) {
      setQueryError(err.message);
    } finally {
      setExecutingCrud(false);
    }
  };

  const handleSaveRecord = async (recordId: string) => {
    setExecutingCrud(true);
    setQueryError('');
    try {
      const parsedData = JSON.parse(editJsonStr);
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      
      const res = await fetch('/api/admin/db/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'UPDATE', collectionName, recordId, payload: parsedData, tenantId: tenant?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Update local array
      setQueryResults(prev => prev.map(p => p.id === recordId ? { ...parsedData, id: recordId } : p));
      setIsEditingRecord(false);
    } catch (err: any) {
      setQueryError('Update failed: ' + err.message);
    } finally {
      setExecutingCrud(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('WARNING: Deleting this record will force remove it. Integrity relations have been checked?')) return;
    setExecutingCrud(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/admin/db/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'DELETE', collectionName, recordId, tenantId: tenant?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setQueryResults(prev => prev.filter(p => p.id !== recordId));
      if (selectedRecordId === recordId) {
        setSelectedRecordId(null);
        setIsEditingRecord(false);
      }
    } catch (err: any) {
      setQueryError('Delete failed: ' + err.message);
    } finally {
      setExecutingCrud(false);
    }
  };


  const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
    if (!obj || typeof obj !== 'object') return {};
    return Object.keys(obj).reduce((acc: Record<string, any>, k: string) => {
      const pre = prefix.length ? prefix + '_' : '';
      const val = obj[k];
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        Object.assign(acc, flattenObject(val, pre + k));
      } else {
        acc[pre + k] = Array.isArray(val) ? JSON.stringify(val) : val;
      }
      return acc;
    }, {});
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setLoading(true);
    setExportError('');
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/backups/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: tenant?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      let baseFilename = `mfo-export-${tenant?.id || 'platform'}-${new Date().toISOString().slice(0,10)}`;

      if (format === 'csv') {
        if (data.backup) {
          const collections = Object.keys(data.backup);
          
          collections.forEach((col, idx) => {
             setTimeout(() => {
                const rows: Record<string, any>[] = [];
                for (const doc of (data.backup[col] as any[])) {
                  rows.push(flattenObject(doc));
                }
                if (rows.length === 0) return;
                
                const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
                const sortedHeaders = headers.sort();
                
                let csvContent = sortedHeaders.map(h => `"${h}"`).join(',') + '\n';
                for (const row of rows) {
                  csvContent += sortedHeaders.map(h => {
                     let val = row[h];
                     if (val === null || val === undefined) return '""';
                     if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
                     return `"${val}"`;
                  }).join(',') + '\n';
                }
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${baseFilename}-${col}.csv`;
                a.click();
                URL.revokeObjectURL(url);
             }, idx * 250);
          });
        }
      } else {
        const blob = new Blob([JSON.stringify({ meta: data.meta, backup: data.backup }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseFilename}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      setExportError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConsistencyCheck = async () => {
    setLoading(true);
    setConsistencyReport(null);
    setConsistencyError('');
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Unauthorized');
      const res = await fetch('/api/admin/db/consistency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: tenant?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConsistencyReport(data.report);
    } catch (err: any) {
      setConsistencyError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>🗄️ Database Explorer</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Query, modify, trace, and execute consistency checks directly against the underlying datastore.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card 
          onClick={() => setActiveTab('query')}
          className={`flex flex-col gap-2 items-center justify-center p-6 border border-dashed transition-colors cursor-pointer ${activeTab==='query' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}>
          <Search className="text-indigo-600 mb-2" size={24} />
          <h3 className="font-bold text-sm text-indigo-900 dark:text-indigo-300">Explorer</h3>
          <p className="text-xs text-center text-indigo-700/70 dark:text-indigo-400">Query, edit, investigate references</p>
        </Card>
        <Card 
          onClick={() => setActiveTab('export')}
          className={`flex flex-col gap-2 items-center justify-center p-6 border border-dashed transition-colors cursor-pointer ${activeTab==='export' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}>
          <DatabaseBackup className="text-emerald-600 mb-2" size={24} />
          <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-300">Export Defaults</h3>
          <p className="text-xs text-center text-emerald-700/70 dark:text-emerald-400">Export full tenant JSON structure</p>
        </Card>
        <Card 
          onClick={() => setActiveTab('consistency')}
          className={`flex flex-col gap-2 items-center justify-center p-6 border border-dashed transition-colors cursor-pointer ${activeTab==='consistency' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-amber-200 bg-amber-50/30 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}>
          <Shield className="text-amber-600 mb-2" size={24} />
          <h3 className="font-bold text-sm text-amber-900 dark:text-amber-300">Consistency Check</h3>
          <p className="text-xs text-center text-amber-700/70 dark:text-amber-400">Scan metadata and CRM relations</p>
        </Card>
      </div>

      <Card className="border border-border p-0 overflow-hidden">
        {/* QUERY TAB */}
        {activeTab === 'query' && (
          <div className="flex flex-col">
             <div className="p-4 border-b border-border bg-surface flex justify-between items-center bg-elevated/30">
                <div className="flex items-center gap-3">
                   <select 
                     value={collectionName} 
                     onChange={e => setCollectionName(e.target.value)}
                     className="bg-surface border border-border text-sm rounded-md px-3 py-1.5 font-mono"
                   >
                      <option value="users">users</option>
                      <option value="tenants">tenants</option>
                      <option value="tenant_invitations">tenant_invitations</option>
                      <option value="platform_orgs">platform_orgs</option>
                      <option value="platform_contacts">platform_contacts</option>
                   </select>
                   <Button size="xs" color="indigo" onClick={handleQuery} loading={loading}>Execute Filter</Button>
                </div>
                <Badge color="zinc">Read-Only View</Badge>
             </div>
             
             <div className="flex h-[600px] bg-surface relative">
                {queryError && <div className="absolute top-0 left-0 w-full p-2 bg-red-50 text-red-500 text-xs z-10 border-b border-red-100">{queryError}</div>}
                
                {queryResults.length === 0 && !loading && !queryError ? (
                   <div className="w-full flex-1 flex flex-col items-center justify-center text-center text-tertiary shadow-inner">
                     <Database size={32} className="mx-auto mb-3 opacity-40" />
                     <p className="text-sm font-semibold tracking-wide">No Results</p>
                     <p className="text-xs mt-1">Run a query to populate the table.</p>
                   </div>
                ) : (
                   <Grid numItemsMd={3} className="w-full h-full gap-0">
                     {/* Master List */}
                     <Col numColSpanMd={1} className="h-full border-r border-border flex flex-col bg-elevated/20 transition-all shadow-inner">
                       <div className="p-3 border-b border-border">
                         <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2">
                            <Search size={14} className="text-tertiary" />
                            <input 
                               type="text" 
                               placeholder="Filter records..." 
                               className="bg-transparent border-none outline-none text-xs w-full font-mono text-primary focus:ring-0"
                               value={explorerSearch}
                               onChange={e => setExplorerSearch(e.target.value)}
                            />
                         </div>
                       </div>
                       <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                          {queryResults.filter(r => explorerSearch === '' || JSON.stringify(r).toLowerCase().includes(explorerSearch.toLowerCase())).map(r => {
                            const isSelected = selectedRecordId === r.id;
                            
                            // Try to find a display name
                            const displayName = r.name || r.email || r.title || r.id;
                            
                            return (
                              <button
                                key={r.id}
                                onClick={() => {
                                  setSelectedRecordId(r.id);
                                  setIsEditingRecord(false);
                                  setDepReport(null);
                                }}
                                className={`w-full text-left px-3 py-2.5 rounded-md text-xs font-mono transition-all border ${
                                  isSelected 
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm dark:bg-indigo-900/40 dark:text-indigo-100' 
                                    : 'border-transparent text-secondary hover:bg-surface hover:border-border'
                                }`}
                              >
                                <div className="font-bold truncate">{displayName}</div>
                                {displayName !== r.id && <div className="text-[10px] text-tertiary truncate mt-1">ID: {r.id}</div>}
                              </button>
                            );
                          })}
                          {queryResults.filter(r => explorerSearch === '' || JSON.stringify(r).toLowerCase().includes(explorerSearch.toLowerCase())).length === 0 && explorerSearch !== '' && (
                            <div className="text-center text-tertiary text-xs py-4">No matching records found.</div>
                          )}
                       </div>
                     </Col>
                     
                     {/* Detail View */}
                     <Col numColSpanMd={2} className="h-full flex flex-col overflow-hidden bg-surface relative shadow-inner">
                       {selectedRecordId ? (
                         (() => {
                           const record = queryResults.find(r => r.id === selectedRecordId);
                           if (!record) return null;
                           
                           return (
                             <div className="flex flex-col h-full animate-fade-in">
                               <div className="p-4 flex items-center justify-between border-b border-border bg-elevated/30">
                                 <div>
                                   <div className="text-[10px] uppercase font-bold text-tertiary tracking-widest">{collectionName}</div>
                                   <div className="font-mono text-sm font-bold text-indigo-600 mt-0.5">{record.id}</div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                   {!isEditingRecord ? (
                                     <>
                                       <Button size="xs" variant="secondary" onClick={() => handleInspect(record.id)} loading={executingCrud}>Dependencies</Button>
                                       <Button size="xs" variant="secondary" onClick={() => { 
                                         setIsEditingRecord(true); 
                                         const { id, _sync, ...editable } = record; 
                                         setEditJsonStr(JSON.stringify(editable, null, 2)); 
                                       }}>Edit Record</Button>
                                       <Button size="xs" color="rose" onClick={() => handleDeleteRecord(record.id)} loading={executingCrud}>Delete</Button>
                                     </>
                                   ) : (
                                     <>
                                       <Button size="xs" variant="secondary" onClick={() => setIsEditingRecord(false)}>Cancel</Button>
                                       <Button size="xs" color="indigo" onClick={() => handleSaveRecord(record.id)} loading={executingCrud}>Save Changes</Button>
                                     </>
                                   )}
                                 </div>
                               </div>
                               
                               <div className="flex-1 overflow-y-auto custom-scrollbar p-0 flex flex-col bg-surface relative">
                                 {depReport && depReport.recordId === record.id && (
                                   <div className="m-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 rounded-lg text-amber-800 shadow-sm animate-fade-in">
                                      <div className="font-bold mb-2 flex items-center gap-2">
                                        <DatabaseBackup size={16} /> Dependency Report
                                      </div>
                                      {depReport.references.length === 0 ? <p className="text-sm">No dangling references found.</p> : (
                                        <ul className="list-disc pl-4 mt-2 space-y-1 text-xs">
                                          {depReport.references.map((dr: any, idx: number) => (
                                             <li key={idx}>Coll: <b className="font-mono">{dr.collection}</b>, ID: <b className="font-mono">{dr.id}</b> {dr.description && `(${dr.description})`}</li>
                                          ))}
                                        </ul>
                                      )}
                                   </div>
                                 )}
                                 
                                 {isEditingRecord ? (
                                   <div className="flex flex-col flex-1 p-4">
                                     <div className="flex justify-between items-center mb-2">
                                       <label className="text-[11px] font-bold uppercase tracking-wider text-tertiary">Edit JSON Payload</label>
                                       <span className="text-[10px] text-tertiary opacity-70">Strict JSON formatting required</span>
                                     </div>
                                     <textarea
                                       className="flex-1 w-full bg-slate-50 dark:bg-slate-900 border border-border shadow-inner rounded-md p-4 text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-mono text-xs custom-scrollbar resize-none"
                                       value={editJsonStr}
                                       onChange={e => setEditJsonStr(e.target.value)}
                                       spellCheck={false}
                                     />
                                   </div>
                                 ) : (
                                   <div className="p-4">
                                     <div className="bg-slate-50 dark:bg-slate-900 border border-border rounded-md p-4 overflow-x-auto text-xs font-mono text-primary custom-scrollbar shadow-inner relative group">
                                       <button 
                                         className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 border border-border p-1.5 rounded-md text-tertiary hover:text-primary shadow-sm z-10"
                                         onClick={() => navigator.clipboard.writeText(JSON.stringify(record, null, 2))}
                                         title="Copy JSON"
                                       >
                                         <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                       </button>
                                       <pre>{JSON.stringify(record, null, 2)}</pre>
                                     </div>
                                   </div>
                                 )}
                               </div>
                             </div>
                           );
                         })()
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center text-tertiary animate-fade-in bg-slate-50/50 dark:bg-slate-900/50">
                           <Database size={48} strokeWidth={1} className="mx-auto mb-4 opacity-20 text-indigo-500" />
                           <p className="text-base font-semibold text-secondary">Select a Record</p>
                           <p className="text-xs mt-1">Choose an item from the master list to view details.</p>
                         </div>
                       )}
                     </Col>
                   </Grid>
                )}
             </div>
          </div>
        )}

        {/* EXPORT TAB */}
        {activeTab === 'export' && (
          <div className="p-8 text-center text-tertiary flex flex-col items-center">
            <h3 className="text-emerald-600 font-bold text-lg mb-2">Export Protocol</h3>
            <p className="text-sm mb-6 max-w-md mx-auto">This will fetch all platform structures attached to your environment to construct a localized backup file.</p>
            {exportError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm w-full max-w-md">{exportError}</div>}
            <div className="flex gap-4">
              <Button color="emerald" onClick={() => handleExport('json')} loading={loading}>
                Download JSON Database
              </Button>
              <Button color="indigo" onClick={() => handleExport('csv')} loading={loading}>
                Download CSV Database
              </Button>
            </div>
          </div>
        )}

        {/* CONSISTENCY TAB */}
        {activeTab === 'consistency' && (
          <div className="p-8">
            <div className="text-center mb-6">
              <h3 className="text-amber-600 font-bold text-lg mb-2">Relational Consistency Scan</h3>
              <p className="text-sm text-tertiary">Scans dangling references across User and Tenant records.</p>
            </div>
            
            {consistencyReport ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                 <div className="p-4 border border-border rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                    <p className="text-4xl mb-1 text-emerald-600 font-black">{consistencyReport.passed}</p>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">Passed</p>
                 </div>
                 <div className="p-4 border border-border rounded-lg bg-red-50 dark:bg-red-900/10">
                    <p className="text-4xl mb-1 text-red-600 font-black">{consistencyReport.errors.length}</p>
                    <p className="text-xs font-bold uppercase tracking-widest text-red-800 dark:text-red-400">Errors</p>
                 </div>
                 <div className="p-4 border border-border rounded-lg bg-zinc-50 dark:bg-zinc-900/20">
                    <p className="text-4xl mb-1 text-zinc-600 font-black">{consistencyReport.scannedEntities}</p>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Scanned</p>
                 </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                 {consistencyError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm w-full max-w-md">{consistencyError}</div>}
                 <Button color="amber" onClick={handleConsistencyCheck} loading={loading}>
                   Commence Scan
                 </Button>
              </div>
            )}
            
            {consistencyReport && (
               <div className="mt-6 p-4 rounded-lg bg-surface border border-border">
                 <h4 className="font-bold text-sm mb-3">Scan Details</h4>
                 <div className="space-y-4 text-xs font-mono">
                   {consistencyReport.scanSteps && consistencyReport.scanSteps.length > 0 && (
                     <div>
                       <strong className="text-secondary">Scanned Objects:</strong>
                       <ul className="list-disc pl-4 text-tertiary mt-1">
                         {consistencyReport.scanSteps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                       </ul>
                     </div>
                   )}
                   
                   {consistencyReport.warnings && consistencyReport.warnings.length > 0 && (
                     <div>
                       <strong className="text-amber-500">Warnings:</strong>
                       <ul className="list-disc pl-4 text-amber-600 mt-1">
                         {consistencyReport.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                       </ul>
                     </div>
                   )}
                   
                   {consistencyReport.errors && consistencyReport.errors.length > 0 && (
                     <div>
                       <strong className="text-red-500">Integrity Errors Found:</strong>
                       <ul className="list-disc pl-4 text-red-600 mt-1">
                         {consistencyReport.errors.map((err: string, i: number) => <li key={i}>{err}</li>)}
                       </ul>
                     </div>
                   )}
                   
                   {consistencyReport.errors?.length === 0 && consistencyReport.warnings?.length === 0 && (
                     <div className="text-emerald-500">No inconsistencies found. Relationships are intact.</div>
                   )}
                 </div>
               </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const { tenant } = useAuth();
  const isInternal = tenant?.isInternal;
  
  const visibleTabs = React.useMemo(() => TABS.filter(t => {
    if (t.superAdminOnly && !isInternal) return false;
    return true;
  }), [isInternal]);

  // Use the first visible tab as the default unless a manual selection is made
  const [activeTabOverride, setActiveTabOverride] = useState<TabId | null>(null);
  const activeTab = activeTabOverride || visibleTabs[0]?.id || 'firm';

  return (
    <div className="absolute inset-0 flex flex-col animate-fade-in w-full bg-[var(--bg-background)] overflow-hidden">
      <div className="flex h-full w-full">
        {/* Action Board (Doc 2 / Sidebar) */}
        <div className="w-[300px] flex flex-col shrink-0 bg-[var(--bg-canvas)] border-r border-[var(--border)] overflow-hidden relative">
          <div className="p-4 border-b border-border bg-elevated/50 flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
               <Settings2 size={16} strokeWidth={2.5} />
             </div>
             <div>
               <h2 className="font-bold text-sm tracking-tight text-primary">Settings</h2>
               <p className="text-[10px] uppercase tracking-widest text-tertiary">Platform Admin</p>
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1 relative custom-scrollbar">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTabOverride(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left border ${
                  activeTab === tab.id 
                    ? 'bg-surface shadow text-primary border-border/50 font-semibold' 
                    : 'text-tertiary hover:bg-elevated border-transparent hover:text-secondary'
                }`}
              >
                <div className={`flex items-center justify-center ${activeTab === tab.id ? 'text-indigo-500' : ''}`}>
                  <tab.icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                </div>
                <span className="flex-1">{tab.label}</span>
                {tab.superAdminOnly && (
                  <Badge size="xs" color="blue" className="ml-auto px-1.5 opacity-80 text-[9px] py-0">SA</Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Central View */}
        <div className="flex-1 bg-[var(--bg-surface)] flex flex-col overflow-y-auto relative custom-scrollbar">
          <div className="p-8 md:p-10 w-full">
            {activeTab === 'platform'       && isInternal && <PlatformSection />}
            {activeTab === 'database'       && isInternal && <DatabaseSection />}
            {activeTab === 'data_explorer'  && isInternal && <DataExplorerSection />}
            {activeTab === 'mfa'            && <MfaSection />}
            {activeTab === 'integrations'   && <IntegrationsSection />}
            {activeTab === 'ai_keys'        && <AiKeysSection />}
            {activeTab === 'firm'           && <FirmSection />}
            {activeTab === 'compliance'     && <ComplianceSection />}
            {activeTab === 'customizations' && <CustomizationsSection />}
            {activeTab === 'communications' && isInternal && <CommunicationsSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
