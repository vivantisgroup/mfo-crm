'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/context';
import { logAction } from '@/lib/auditLog';
import { useAuth } from '@/lib/AuthContext';
import { Avatar } from '@/components/Avatar';
import { useTheme, PRESET_THEMES, FONTS } from '@/lib/ThemeContext';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import { NotificationPanel } from '@/components/NotificationPanel';
import type { FontFamily } from '@/lib/ThemeContext';
import { useUserSettings } from '@/lib/UserSettingsContext';
import { usePageTitle } from '@/lib/PageTitleContext';
import { MailIntegrationSection } from '@/components/MailIntegrationSection';
import { saveUserProfile, uploadAvatar } from '@/lib/userProfileService';
import { logAction as logAudit } from '@/lib/auditLog';
import {
  getUserTimezone, groupedTimezones,
} from '@/lib/timezones';
import { getTenantsForUser, getUserProfile, type TenantRecord } from '@/lib/platformService';

// ─── Auto-breadcrumb from pathname ────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  platform: 'Platform',
  tenants: 'Tenants',
  users: 'Users',
  plans: 'Plans',
  billing: 'Billing & Subscriptions',
  renewals: 'Renewals',
  expenses: 'Expenses',
  crm: 'CRM',
  support: 'Support',
  analytics: 'Analytics',
  audit: 'Compliance',
  admin: 'Admin',
  families: 'Families',
  activities: 'Activities',
  tasks: 'Tasks',
  calendar: 'Calendar',
  portfolio: 'Portfolio',
  documents: 'Documents',
  governance: 'Governance',
  estate: 'Succession',
  concierge: 'Concierge',
  reports: 'Reports',
  inbox: 'Inbox',
  account: 'Account',
  mfa: 'MFA Setup',
  settings: 'Settings',
  new: 'New',
  edit: 'Edit',
};

function buildAutoCrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    const label = ROUTE_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
    crumbs.push({ label, href: acc });
  }
  return crumbs;
}

// ─── Mini Theme Picker (in quick dropdown) ────────────────────────────────────

function MiniThemePicker() {
  const { theme, setThemeById, resetCustom, customVars, fontOverride } = useTheme();
  const hasCustom = Object.keys(customVars).length > 0 || fontOverride !== null;
  const darkThemes  = PRESET_THEMES.filter(t => t.mode === 'dark');
  const lightThemes = PRESET_THEMES.filter(t => t.mode === 'light');

  const dot = (accent: string, active: boolean) => (
    <div style={{
      width: 16, height: 16, borderRadius: '50%', background: accent,
      border: `2px solid ${active ? 'white' : 'transparent'}`,
      boxShadow: active ? `0 0 0 2px ${accent}` : 'none',
      cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
    }} />
  );

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Theme
        </span>
        {hasCustom && (
          <button onClick={resetCustom} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'transparent', color: '#f59e0b' }}>
            ↺ Reset
          </button>
        )}
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>Dark</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {darkThemes.map(t => (
            <div key={t.id} title={t.name} onClick={() => setThemeById(t.id)}>{dot(t.accent, theme.id === t.id)}</div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>Light</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {lightThemes.map(t => (
            <div key={t.id} title={t.name} onClick={() => setThemeById(t.id)}>{dot(t.accent, theme.id === t.id)}</div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--brand-400)', fontWeight: 600 }}>
        {theme.emoji} {theme.name}
      </div>
    </div>
  );
}

// ─── Notification bell ────────────────────────────────────────────────────────

// ─── Tenant Switcher ──────────────────────────────────────────────────────────

function TenantSwitcher() {
  const { userProfile, tenant, switchTenant } = useAuth();
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userProfile || !open) return;
    setLoading(true);
    getUserProfile(userProfile.uid)
      .then(p => getTenantsForUser(p ?? userProfile))
      .then(setTenants)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userProfile, open]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (!userProfile || !tenant) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-canvas)', border: '1px solid var(--border)',
          padding: '5px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
          transition: 'border-color var(--transition)',
        }}
        title="Switch Workspace"
      >
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: tenant.brandColor || 'var(--brand-500)', flexShrink: 0 }} />
        <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.name}</span>
        <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: 6, width: 210,
          boxShadow: 'var(--shadow-lg)', zIndex: 100,
        }}>
          {loading ? (
            <div style={{ padding: '10px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>Loading…</div>
          ) : tenants.map(t => (
            <button key={t.id}
              onClick={async () => { setOpen(false); if (t.id !== tenant.id) { await switchTenant(t.id); window.location.assign('/dashboard'); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                background: t.id === tenant.id ? 'var(--brand-900)' : 'transparent',
                border: 'none', padding: '7px 10px', borderRadius: 4, cursor: 'pointer',
                color: t.id === tenant.id ? 'var(--brand-400)' : 'var(--text-secondary)',
                textAlign: 'left', transition: 'background 0.15s', fontSize: 12,
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.brandColor || 'var(--text-tertiary)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: t.id === tenant.id ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              {t.id === tenant.id && <span style={{ fontSize: 11 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Profile Section (in full Settings modal) ─────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6,
};

function ProfileSection({ onClose }: { onClose: () => void }) {
  const { user, userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(userProfile?.displayName ?? user?.name ?? '');
  const [phone,       setPhone]       = useState((userProfile as any)?.phone ?? '');
  const [timezone,    setTimezone]    = useState((userProfile as any)?.timezone ?? getUserTimezone());
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (userProfile) {
      setDisplayName((userProfile as any).displayName ?? user?.name ?? '');
      setPhone((userProfile as any).phone ?? '');
      setTimezone((userProfile as any).timezone ?? getUserTimezone());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(userProfile as any)?.uid]);

  function handleAvatarPick(dataUrl: string) {
    setAvatarPreview(dataUrl);
    fetch(dataUrl).then(r => r.blob()).then(blob => setAvatarFile(new File([blob], 'avatar.jpg', { type: blob.type })));
  }

  async function handleSave() {
    if (!user?.uid) return;
    setSaving(true); setMsg(null);
    try {
      let photoURL: string | null = userProfile?.photoURL ?? null;
      if (avatarFile) photoURL = await uploadAvatar(user.uid, avatarFile);
      await saveUserProfile(user.uid, { displayName, phone, timezone, ...(photoURL !== undefined ? { photoURL } : {}) });
      setMsg({ type: 'ok', text: '✅ Profile saved.' });
      setAvatarFile(null);
      setTimeout(onClose, 1200);
    } catch (e: any) {
      setMsg({ type: 'err', text: `❌ ${e.message}` });
    } finally { setSaving(false); }
  }

  const groups   = groupedTimezones();
  const currentSrc = avatarPreview ?? userProfile?.photoURL ?? user?.photoURL ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Avatar — editable only here */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar src={currentSrc} name={displayName || user?.name} size="xl" shape="circle" editable onUpload={handleAvatarPick} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{displayName || user?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{user?.email}</div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: 11 }} onClick={() => fileInputRef.current?.click()}>
            📷 Change Photo
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => handleAvatarPick(ev.target?.result as string); r.readAsDataURL(f); e.target.value = ''; }}
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Display Name</label>
        <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your full name" style={{ width: '100%' }} />
      </div>
      <div>
        <label style={labelStyle}>Email Address</label>
        <input className="input" value={user?.email ?? ''} disabled style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }} />
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>Managed by your auth provider.</div>
      </div>
      <div>
        <label style={labelStyle}>Phone Number</label>
        <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" style={{ width: '100%' }} />
      </div>
      <div>
        <label style={labelStyle}>Time Zone</label>
        <select className="input" value={timezone} onChange={e => setTimezone(e.target.value)} style={{ width: '100%' }}>
          {Object.entries(groups).map(([region, zones]) => (
            <optgroup key={region} label={region}>
              {zones.map((tz: any) => <option key={tz.value} value={tz.value}>{tz.utcOffset} — {tz.label}</option>)}
            </optgroup>
          ))}
        </select>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>Detected: <strong>{getUserTimezone()}</strong></div>
      </div>
      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, background: msg.type === 'ok' ? '#22c55e15' : '#ef444415', color: msg.type === 'ok' ? '#22c55e' : '#ef4444' }}>
          {msg.text}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving…' : '💾 Save Changes'}</button>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Appearance Section (font choice in Settings modal) ───────────────────────

function AppearanceSection() {
  const { theme, setThemeById, fontOverride, setFontOverride, resetCustom, customVars } = useTheme();
  const hasCustom = Object.keys(customVars).length > 0 || fontOverride !== null;
  const darkThemes  = PRESET_THEMES.filter(t => t.mode === 'dark');
  const lightThemes = PRESET_THEMES.filter(t => t.mode === 'light');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Font */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={labelStyle}>Interface Font</label>
          {hasCustom && <button onClick={resetCustom} style={{ fontSize: 11, color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer' }}>↺ Reset to defaults</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {FONTS.map(f => {
            const active = (fontOverride ?? theme.font) === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFontOverride(active ? null : f.id as FontFamily)}
                style={{
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  background: active ? 'var(--brand-900)' : 'var(--bg-surface)',
                  border: `1px solid ${active ? 'var(--brand-500)' : 'var(--border)'}`,
                  color: active ? 'var(--brand-400)' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontFamily: f.stack, fontSize: 13, fontWeight: active ? 700 : 500 }}>{f.label}</div>
                <div style={{ fontSize: 10, color: active ? 'var(--brand-400)' : 'var(--text-tertiary)', marginTop: 2, opacity: 0.8 }}>{f.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Themes */}
      <div>
        <label style={labelStyle}>Color Theme</label>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>Dark</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {darkThemes.map(t => (
              <div key={t.id} title={t.name} onClick={() => setThemeById(t.id)}
                style={{ width: 26, height: 26, borderRadius: '50%', background: t.accent, cursor: 'pointer', flexShrink: 0,
                  border: `2px solid ${theme.id === t.id ? 'white' : 'transparent'}`,
                  boxShadow: theme.id === t.id ? `0 0 0 2px ${t.accent}` : 'none', transition: 'all 0.15s' }}
              />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>Light</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {lightThemes.map(t => (
              <div key={t.id} title={t.name} onClick={() => setThemeById(t.id)}
                style={{ width: 26, height: 26, borderRadius: '50%', background: t.accent, cursor: 'pointer', flexShrink: 0,
                  border: `2px solid ${theme.id === t.id ? 'rgba(0,0,0,0.8)' : 'transparent'}`,
                  boxShadow: theme.id === t.id ? `0 0 0 2px ${t.accent}` : 'none', transition: 'all 0.15s' }}
              />
            ))}
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--brand-400)', fontWeight: 600 }}>
          {theme.emoji} {theme.name} · {(fontOverride ?? theme.font)}
        </div>
      </div>
    </div>
  );
}

// ─── Notifications toggle ──────────────────────────────────────────────────────

function Toggle({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{desc}</div>
      </div>
      <button onClick={() => setOn(v => !v)} style={{ width: 38, height: 20, borderRadius: 10, background: on ? 'var(--brand-500)' : 'var(--bg-elevated)', border: `1px solid ${on ? 'var(--brand-500)' : 'var(--border)'}`, position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: on ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </button>
    </div>
  );
}

// ─── Full Settings Modal ───────────────────────────────────────────────────────

type SettingsSection = 'profile' | 'appearance' | 'mail' | 'calendar' | 'notifications';

function UserSettingsModal({ onClose, userName }: { onClose: () => void; userName: string }) {
  const [section, setSection] = useState<SettingsSection>('profile');
  const { tickerSpeed, setTickerSpeed } = useUserSettings();
  const { language, setLanguage, t } = useTranslation();

  const navItems: { id: SettingsSection; icon: string; label: string }[] = [
    { id: 'profile',       icon: '👤', label: 'Profile' },
    { id: 'appearance',    icon: '🎨', label: 'Appearance' },
    { id: 'mail',          icon: '📧', label: 'Mail Integration' },
    { id: 'calendar',      icon: '📅', label: 'Calendar Sync' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 760, maxHeight: '88vh', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.5)', display: 'flex', overflow: 'hidden' }}>
        {/* Left nav */}
        <div style={{ width: 180, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 12, fontWeight: 800, padding: '0 8px', marginBottom: 14, color: 'var(--text-primary)' }}>⚙️ Settings</div>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 7,
              background: section === item.id ? 'var(--brand-900)' : 'transparent',
              border: `1px solid ${section === item.id ? 'var(--brand-500)44' : 'transparent'}`,
              color: section === item.id ? 'var(--brand-400)' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: section === item.id ? 700 : 400, cursor: 'pointer', width: '100%', textAlign: 'left',
            }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}

          {/* Language + Ticker in settings sidebar */}
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 8px', marginBottom: 8 }}>Language</div>
            <select value={language} onChange={e => setLanguage(e.target.value as any)}
              style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'var(--text-primary)', fontSize: 12 }}>
              <option value="en-US">English (US)</option>
              <option value="pt-BR">Português (BR)</option>
            </select>
          </div>
        </div>

        {/* Content pane */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
              {navItems.find(n => n.id === section)?.icon} {navItems.find(n => n.id === section)?.label}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-tertiary)' }}>✕</button>
          </div>

          {section === 'profile'       && <ProfileSection onClose={onClose} />}
          {section === 'appearance'    && <AppearanceSection />}
          {section === 'mail'          && <MailIntegrationSection />}
          {section === 'calendar'      && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                Calendar sync uses the same OAuth connection as Mail Integration. Events from Outlook / Google Calendar appear in the platform calendar once connected.
              </p>
              <div style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>📅</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Calendar sync is automatic once connected</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Configure the sync window in <strong>Mail Integration → Sync Settings</strong>.</div>
                </div>
              </div>

              {/* Ticker speed, fits here */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Ticker Speed</div>
                <input type="range" min="20" max="400" step="10" value={420 - tickerSpeed} onChange={e => setTickerSpeed(420 - parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--brand-500)', cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  <span>Slow</span><span>Fast</span>
                </div>
              </div>
            </div>
          )}
          {section === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'SLA breach alerts',    desc: 'Notify when a task SLA is about to expire',    defaultOn: true  },
                { label: 'Unassigned task alert',desc: 'Alert when a task stays unassigned beyond SLA', defaultOn: true  },
                { label: 'Capital call reminders',desc: 'Remind 48h before capital call due dates',     defaultOn: true  },
                { label: 'KYC review due',       desc: 'Alert 7 days before KYC renewal is required',  defaultOn: false },
                { label: 'Email digest',         desc: 'Daily summary email of open tasks',             defaultOn: false },
              ].map(n => <Toggle key={n.label} {...n} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export default function Header() {
  const { title, crumbs } = usePageTitle();
  const pathname = usePathname();
  const router   = useRouter();
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t } = useTranslation();
  const { user, tenant, logout, isHydrated } = useAuth();
  const { unreadCount } = useTaskQueue();
  const menuRef  = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    if (user && tenant) {
      await logAction({ tenantId: tenant.id || 'firm-default', userId: user.id || 'unknown', userName: user.name, action: 'USER_LOGOUT', resourceId: user.id || 'session', resourceType: 'auth_session', resourceName: 'User Session', status: 'success' });
    }
    logout();
    router.push('/login');
  };

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Resolve breadcrumbs: prefer explicit crumbs from page, else auto-generate from URL
  const resolvedCrumbs = crumbs.length > 0
    ? crumbs
    : buildAutoCrumbs(pathname || '').map(c => ({ label: c.label, onClick: c.href !== pathname ? () => router.push(c.href) : undefined }));

  return (
    <>
      {settingsOpen && user && <UserSettingsModal onClose={() => setSettingsOpen(false)} userName={user.name} />}

      <header className="header" style={{ position: 'relative', height: 52 }}>

        {/* ── Breadcrumb (left) ─────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, minWidth: 0 }}>
          {resolvedCrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12, margin: '0 4px', userSelect: 'none' }}>/</span>
              )}
              {crumb.onClick ? (
                <button onClick={crumb.onClick} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px',
                  fontSize: i === resolvedCrumbs.length - 1 ? 14 : 13,
                  fontWeight: i === resolvedCrumbs.length - 1 ? 700 : 500,
                  color: i === resolvedCrumbs.length - 1 ? 'var(--text-primary)' : 'var(--brand-400)',
                  borderRadius: 5, transition: 'background 0.12s',
                  whiteSpace: 'nowrap',
                }}>
                  {crumb.label}
                </button>
              ) : (
                <span style={{
                  fontSize: i === resolvedCrumbs.length - 1 ? 14 : 13,
                  fontWeight: i === resolvedCrumbs.length - 1 ? 700 : 500,
                  color: i === resolvedCrumbs.length - 1 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  padding: '2px 5px', whiteSpace: 'nowrap',
                }}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <div className="header-search" style={{ cursor: 'text', minWidth: 340, maxWidth: 460 }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>🔍</span>
          <input type="text" placeholder={t('header.search')} readOnly style={{ flex: 1, minWidth: 0 }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>⌘K</span>
        </div>

        {/* ── Right actions ──────────────────────────────────────────────── */}
        <div className="header-right" style={{ gap: 8 }}>

          {/* Notifications */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button className="icon-btn" title={t('header.notifications')} onClick={() => setNotifOpen(o => !o)} style={{ position: 'relative' }}>
              🔔
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, background: '#ef4444', borderRadius: '50%', border: '1.5px solid var(--bg-surface)', animation: 'pulse 2s infinite' }} />
              )}
            </button>
            {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
          </div>

          {/* Help */}
          <button className="icon-btn" title={t('header.help')}>?</button>

          {/* Tenant Switcher */}
          <TenantSwitcher />

          {/* Avatar + quick menu */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            {(!isHydrated || !user) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', opacity: 0.4 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-canvas)' }} />
                <div style={{ width: 70, height: 14, borderRadius: 4, background: 'var(--bg-canvas)' }} />
              </div>
            ) : (
              <div onClick={() => setMenuOpen(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '3px 7px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', transition: 'border-color var(--transition)' }}>
                <Avatar id={`user-${user.id}`} name={user.name} size="sm" />
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{user.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                    {t(`role.${user.role}` as any) || user.role.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
            )}

            {/* Quick dropdown */}
            {menuOpen && user && (
              <div style={{ position: 'absolute', top: 'calc(100% + 7px)', right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, width: 240, boxShadow: 'var(--shadow-lg)', zIndex: 100 }}>
                {/* Identity */}
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{user.email}</div>
                  {tenant && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, opacity: 0.7 }}>{tenant.name}</div>}
                </div>

                {/* Settings button */}
                <button
                  onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 7, cursor: 'pointer', background: 'var(--bg-canvas)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12, width: '100%', textAlign: 'left', marginBottom: 10 }}
                >
                  ⚙️ <span style={{ fontWeight: 600 }}>Settings</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)' }}>Profile · Fonts →</span>
                </button>

                {/* Mini theme picker */}
                <MiniThemePicker />

                <hr style={{ borderColor: 'var(--border)', margin: '10px 0' }} />

                {/* Sign out */}
                <button onClick={handleSignOut} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '5px 7px', width: '100%', fontSize: 12, color: '#ef4444' }}>
                  {t('profile.signout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
