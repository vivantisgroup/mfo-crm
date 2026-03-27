'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface ApiKeyField {
  id: string; label: string; placeholder: string;
  value: string; saved: boolean; description: string;
  required?: boolean; docsUrl?: string;
}

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

function ApiKeyCard({ field, onSave }: { field: ApiKeyField; onSave: (id: string, value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const handleSave = () => { if (draft.trim()) onSave(field.id, draft.trim()); setEditing(false); setDraft(''); };

  return (
    <div style={{
      padding: '20px 24px', background: 'var(--bg-elevated)',
      border: `1px solid ${field.saved ? 'var(--brand-500)44' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot ok={field.saved} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{field.label}</span>
            {field.required && <span style={{ fontSize: 10, color: 'var(--color-red)', fontWeight: 700, textTransform: 'uppercase' }}>Required</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{field.description}</div>
          {field.docsUrl && (
            <a href={field.docsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--brand-400)', textDecoration: 'none', marginTop: 2, display: 'inline-block' }}>📖 Documentation →</a>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {field.saved && <span className="badge badge-success" style={{ fontSize: 10 }}>Configured</span>}
          <button className={`btn btn-sm ${editing ? 'btn-primary' : 'btn-outline'}`} onClick={editing ? handleSave : () => setEditing(true)}>
            {editing ? '💾 Save' : field.saved ? '🔄 Rotate' : '+ Set Key'}
          </button>
          {editing && <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(false); setDraft(''); }}>Cancel</button>}
        </div>
      </div>
      {field.saved && !editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)' }}>
          <span>🔑</span><span>{mask(field.value)}</span>
        </div>
      )}
      {editing && (
        <input type="password" autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder={field.placeholder} className="input"
          style={{ fontFamily: 'monospace', fontSize: 13, padding: '10px 14px' }} />
      )}
    </div>
  );
}

export default function DbSettingsPage() {
  const { isSaasMasterAdmin } = useAuth();

  const [keys, setKeys] = useState<ApiKeyField[]>([
    { id: 'firestore_project_id', label: 'Firebase Project ID', value: 'mfo-crm', saved: true, placeholder: 'your-firebase-project-id', description: 'Primary Firestore database project identifier', docsUrl: 'https://firebase.google.com/docs/projects/learn-more' },
    { id: 'firestore_service_account', label: 'Firebase Service Account (JSON)', value: '', saved: false, placeholder: 'Paste full service account JSON...', description: 'Server-side service account for Admin SDK access', required: true, docsUrl: 'https://firebase.google.com/docs/admin/setup' },
    { id: 'firebase_storage_bucket', label: 'Firebase Storage Bucket', value: 'mfo-crm.firebasestorage.app', saved: true, placeholder: 'project-id.appspot.com', description: 'Cloud Storage bucket for documents and attachments' },
    { id: 'smtp_host', label: 'SMTP Host (Transactional Email)', value: 'smtp.sendgrid.net', saved: true, placeholder: 'smtp.mailprovider.com', description: 'SMTP server for system emails (password resets, notifications)', docsUrl: 'https://docs.sendgrid.com/for-developers/sending-email/smtp-alerts' },
    { id: 'smtp_api_key', label: 'SMTP / SendGrid API Key', value: 'SG.xxxxx...', saved: true, placeholder: 'SG.your_sendgrid_api_key', description: 'API key for transactional email delivery (free tier: 100 emails/day)', docsUrl: 'https://app.sendgrid.com/settings/api_keys' },
    { id: 'redis_url', label: 'Redis / Upstash URL (optional)', value: '', saved: false, placeholder: 'redis://default:password@host:6379', description: 'Optional: for rate limiting and session caching in production' },
    { id: 'db_connection_pool', label: 'DB Connection Pool Size', value: '10', saved: true, placeholder: '10', description: 'Maximum concurrent Firestore connections (per instance)' },
    { id: 'firestore_emulator', label: 'Firestore Emulator Host (dev only)', value: '', saved: false, placeholder: 'localhost:8080', description: 'Override for local development with Firebase Emulator Suite' },
  ]);

  const handleSave = (id: string, val: string) => setKeys(prev => prev.map(k => k.id === id ? { ...k, value: val, saved: true } : k));

  if (!isSaasMasterAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Access Restricted</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>This page is only accessible to Super Admins (saas_master_admin).</div>
      </div>
    );
  }

  const configuredCount = keys.filter(k => k.saved).length;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #06b6d444, #0891b244)', border: '1px solid #22d3ee33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🗄</div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Database Settings</h1>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{configuredCount}/{keys.length} providers configured</div>
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, margin: '0 0 12px' }}>
          Configure primary data providers, storage backends, and messaging infrastructure. Changes affect all tenants.
        </p>
        <div style={{ padding: '10px 16px', background: '#f59e0b11', border: '1px solid #f59e0b44', borderRadius: 10, fontSize: 13, color: '#f59e0b', display: 'flex', gap: 10, alignItems: 'center' }}>
          ⚠️ These are critical infrastructure settings. Incorrect values may affect platform availability.
        </div>
      </div>

      {/* Status overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Firebase / Firestore', icon: '🔥', status: 'Connected', ok: true },
          { label: 'SMTP / Email', icon: '📧', status: 'SendGrid Active', ok: true },
          { label: 'Redis / Cache', icon: '⚡', status: 'Not configured', ok: false },
        ].map(item => (
          <div key={item.label} style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderRadius: 12, border: `1px solid ${item.ok ? 'var(--brand-500)22' : 'var(--border)'}` }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{item.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{item.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusDot ok={item.ok} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Keys */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {keys.map(k => <ApiKeyCard key={k.id} field={k} onSave={handleSave} />)}
      </div>

      {/* Firestore Rules info */}
      <div style={{ marginTop: 32, padding: '20px 24px', background: 'var(--bg-canvas)', borderRadius: 14, border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📋 Firestore Security Rules</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Security rules are managed in <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>firestore.rules</code> and deployed via Firebase CLI.
          Use the <strong>Catalog Explorer</strong> for direct database inspection and the <strong>Consistency Inspector</strong> for integrity checks.
        </div>
      </div>
    </div>
  );
}
