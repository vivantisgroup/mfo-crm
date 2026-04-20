'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

function Toggle({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{desc}</div>
      </div>
      <button onClick={() => onChange(!value)} style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: value ? 'var(--brand-500)' : 'var(--bg-canvas)', boxShadow: 'inset 0 0 0 1px var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: value ? 24 : 4, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
      </button>
    </div>
  );
}

export default function InfrastructurePage() {
  const { isSaasMasterAdmin } = useAuth();
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState({
    platformName:     'MFO Nexus',
    version:          '2.0.0',
    region:           'southamerica-east1',
    backupBucket:     'gs://mfo-nexus-backups',
    logLevel:         'info',
    sessionTimeout:   60,
    dataResidency:    'brazil',
    maintenanceMode:  false,
    analyticsEnabled: true,
    debugMode:        false,
    rateLimitEnabled: true,
    // MFA
    mfaMode:          'totp',
    totpIssuer:       'MFO Nexus',
    totpWindow:       1,
    backupCodesEnabled: true,
  });

  const set = (k: string, v: any) => setSettings(prev => ({ ...prev, [k]: v }));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  if (!isSaasMasterAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Access Restricted</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>This page is only accessible to Super Admins.</div>
      </div>
    );
  }

  const LabeledField = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{hint}</div>}
    </div>
  );

  const Section = ({ title, icon, children, color = '#6366f1' }: any) => (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #6366f144, #818cf844)', border: '1px solid #6366f133', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🏗</div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Infrastructure</h1>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Platform-wide settings, MFA, and runtime configuration</div>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: '10px 16px', background: '#f59e0b11', border: '1px solid #f59e0b44', borderRadius: 10, fontSize: 13, color: '#f59e0b' }}>
          ⚠️ Infrastructure changes are global and affect all tenants. Apply with care.
        </div>
      </div>

      {/* Platform Core */}
      <Section title="Platform Core" icon="⚙️">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {[
            { label: 'Platform Name', key: 'platformName', type: 'text' },
            { label: 'Platform Version', key: 'version', type: 'text' },
            { label: 'Deployment Region', key: 'region', type: 'text', hint: 'GCP / Firebase region code' },
            { label: 'Backup Bucket URI', key: 'backupBucket', type: 'text', hint: 'gs:// or s3://' },
            { label: 'Session Timeout (min)', key: 'sessionTimeout', type: 'number' },
            { label: 'Log Level', key: 'logLevel', type: 'select', options: ['debug', 'info', 'warn', 'error'] },
            { label: 'Data Residency', key: 'dataResidency', type: 'select', options: ['brazil', 'us', 'eu', 'multi-region'] },
          ].map(f => (
            <LabeledField key={f.key} label={f.label} hint={(f as any).hint}>
              {f.type === 'select' ? (
                <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={(settings as any)[f.key]} onChange={e => set(f.key, e.target.value)}>
                  {(f as any).options!.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type} className="input" style={{ width: '100%', padding: '10px 12px' }} value={(settings as any)[f.key]} onChange={e => set(f.key, e.target.value)} />
              )}
            </LabeledField>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Toggle value={settings.maintenanceMode} onChange={v => set('maintenanceMode', v)} label="🚧 Maintenance Mode" desc="Block all non-admin logins and show maintenance page" />
          <Toggle value={settings.analyticsEnabled} onChange={v => set('analyticsEnabled', v)} label="📊 Platform Analytics" desc="Collect anonymous usage metrics for performance optimization" />
          <Toggle value={settings.debugMode} onChange={v => set('debugMode', v)} label="🐛 Debug Mode" desc="Enable verbose logging — production: always off" />
          <Toggle value={settings.rateLimitEnabled} onChange={v => set('rateLimitEnabled', v)} label="🛡 Rate Limiting" desc="Enable API rate limiting (requires Redis)" />
        </div>
      </Section>

      {/* MFA Configuration */}
      <Section title="Multi-Factor Authentication (TOTP)" icon="🔐" color="#22d3ee">
        <div style={{ padding: '12px 16px', background: '#22d3ee0a', border: '1px solid #22d3ee33', borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: '#22d3ee', fontSize: 13, marginBottom: 4 }}>✅ TOTP — Zero Cost, Industry Standard</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>RFC 6238 · Works offline · Compatible with Google Authenticator, Authy, 1Password, Microsoft Authenticator</div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[
            { id: 'totp', label: '🔐 TOTP (Recommended)', desc: 'Free, offline-capable, RFC 6238' },
            { id: 'disabled', label: '⚠️ Disabled', desc: 'Development only' },
          ].map(opt => (
            <div key={opt.id} onClick={() => set('mfaMode', opt.id)} style={{ flex: 1, padding: '16px 20px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${settings.mfaMode === opt.id ? 'var(--brand-500)' : 'var(--border)'}`, background: settings.mfaMode === opt.id ? 'var(--brand-500)0d' : 'var(--bg-elevated)', transition: 'all 0.2s' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{opt.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <LabeledField label="Issuer Name (shown in authenticator)" hint='e.g. "Vivantis MFO" — displayed in Google Authenticator'>
            <input type="text" className="input" style={{ width: '100%', padding: '10px 12px' }} value={settings.totpIssuer} onChange={e => set('totpIssuer', e.target.value)} placeholder="Your Company Name" />
          </LabeledField>
          <LabeledField label="TOTP Window (± periods)" hint="Larger window allows clock drift tolerance">
            <select className="input" style={{ width: '100%', padding: '10px 12px' }} value={settings.totpWindow} onChange={e => set('totpWindow', Number(e.target.value))}>
              <option value={0}>Strict (±0 — current code only)</option>
              <option value={1}>Standard (±1 — 30s tolerance)</option>
              <option value={2}>Lenient (±2 — 60s tolerance)</option>
            </select>
          </LabeledField>
        </div>

        <Toggle value={settings.backupCodesEnabled} onChange={v => set('backupCodesEnabled', v)} label="One-Time Backup Codes" desc="Generate 10 single-use emergency codes for account recovery" />
      </Section>

      <button className="btn btn-primary" onClick={handleSave} style={{ padding: '12px 40px', fontSize: 15 }}>
        {saved ? '✅ Configuration Saved!' : '💾 Save Infrastructure Settings'}
      </button>
    </div>
  );
}
