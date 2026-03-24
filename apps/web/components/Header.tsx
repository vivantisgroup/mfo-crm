'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getInitials } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/context';
import { logAction } from '@/lib/auditLog';
import { useAuth } from '@/lib/AuthContext';
import { Avatar } from '@/components/Avatar';
import { useTheme, PRESET_THEMES, FONTS } from '@/lib/ThemeContext';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import { NotificationPanel } from '@/components/NotificationPanel';
import type { FontFamily } from '@/lib/ThemeContext';
import {
  getUserTimezone, groupedTimezones,
  type TimezoneOption,
} from '@/lib/timezones';
import { saveUserProfile, uploadAvatar } from '@/lib/userProfileService';
import { MailIntegrationSection } from '@/components/MailIntegrationSection';
import { getTenantsForUser, getUserProfile, type TenantRecord } from '@/lib/platformService';
import { usePageTitle } from '@/lib/PageTitleContext';

interface HeaderProps {
  // No props — title comes from PageTitleContext
}

// ─── Mini Theme Grid (profile dropdown) ───────────────────────────────────────

function MiniThemePicker() {
  const { theme, setThemeById, fontOverride, setFontOverride, resetCustom, customVars } = useTheme();
  const [tab, setTab] = useState<'themes' | 'fonts'>('themes');
  const darkThemes  = PRESET_THEMES.filter(t => t.mode === 'dark');
  const lightThemes = PRESET_THEMES.filter(t => t.mode === 'light');
  const hasCustom   = Object.keys(customVars).length > 0 || fontOverride !== null;

  const dot = (accent: string, active: boolean) => (
    <div style={{
      width: 18, height: 18, borderRadius: '50%',
      background: accent,
      border: `2px solid ${active ? 'white' : 'transparent'}`,
      boxShadow: active ? `0 0 0 2px ${accent}` : 'none',
      cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
    }} />
  );

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          🎨 Appearance
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['themes', 'fonts'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: tab === t ? 'var(--brand-500)22' : 'transparent',
              color: tab === t ? 'var(--brand-400)' : 'var(--text-tertiary)',
              fontWeight: tab === t ? 700 : 400,
            }}>{t === 'themes' ? 'Themes' : 'Fonts'}</button>
          ))}
          {hasCustom && (
            <button onClick={resetCustom} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', background: 'transparent', color: '#f59e0b' }}>
              ↺
            </button>
          )}
        </div>
      </div>

      {tab === 'themes' && (
        <>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 5 }}>Dark</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {darkThemes.map(t => (
                <div key={t.id} title={t.name} onClick={() => setThemeById(t.id)}>
                  {dot(t.accent, theme.id === t.id)}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 5 }}>Light</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {lightThemes.map(t => (
                <div key={t.id} title={t.name} onClick={() => setThemeById(t.id)}>
                  {dot(t.accent, theme.id === t.id)}
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--brand-400)', fontWeight: 600 }}>
            {theme.emoji} {theme.name}
          </div>
        </>
      )}

      {tab === 'fonts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {FONTS.map(f => {
            const active = (fontOverride ?? theme.font) === f.id;
            return (
              <button key={f.id} onClick={() => setFontOverride(active ? null : f.id as FontFamily)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                  background: active ? 'var(--brand-900)' : 'transparent',
                  border: `1px solid ${active ? 'var(--brand-500)' : 'transparent'}`,
                  color: active ? 'var(--brand-400)' : 'var(--text-secondary)',
                }}>
                <span style={{ fontFamily: f.stack, fontSize: 13, fontWeight: active ? 700 : 400 }}>{f.label}</span>
                {active && <span style={{ fontSize: 12 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Integration connection state (local session only) ────────────────────────

type ConnectionStatus = 'connected' | 'disconnected' | 'testing' | 'error';

interface IntegrationState {
  status:       ConnectionStatus;
  email?:       string;
  calSyncDays?: number;
  testResult?:  string;
}

// ─── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection({ onClose }: { onClose: () => void }) {
  const { user, userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(userProfile?.displayName ?? user?.name ?? '');
  const [phone,       setPhone]       = useState((userProfile as any)?.phone ?? '');
  const [timezone,    setTimezone]    = useState(
    (userProfile as any)?.timezone ?? getUserTimezone()
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Sync from Firestore profile when it loads
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
    fetch(dataUrl).then(r => r.blob()).then(blob => {
      setAvatarFile(new File([blob], 'avatar.jpg', { type: blob.type }));
    });
  }

  async function handleSave() {
    if (!user?.uid) return;
    setSaving(true); setMsg(null);
    try {
      let photoURL: string | null = userProfile?.photoURL ?? null;
      if (avatarFile) {
        photoURL = await uploadAvatar(user.uid, avatarFile);
      }
      await saveUserProfile(user.uid, {
        displayName,
        phone,
        timezone,
        ...(photoURL !== undefined ? { photoURL } : {}),
      });
      logAction({
        tenantId: user.uid, userId: user.uid, userName: displayName,
        action: 'PROFILE_UPDATED', resourceId: user.uid,
        resourceType: 'user', resourceName: `Profile: ${displayName}`, status: 'success',
      });
      setMsg({ type: 'ok', text: '✅ Profile saved successfully.' });
      setAvatarFile(null);
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setMsg({ type: 'err', text: `❌ ${e.message}` });
    } finally {
      setSaving(false);
    }
  }

  const groups     = groupedTimezones();
  const currentSrc = avatarPreview ?? userProfile?.photoURL ?? user?.photoURL ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
        Manage your personal profile. All changes are persisted to your account.
      </p>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar
          src={currentSrc}
          name={displayName || user?.name}
          size="xl"
          shape="circle"
          editable
          onUpload={handleAvatarPick}
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{displayName || user?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{user?.email}</div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 8, fontSize: 12 }}
            onClick={() => fileInputRef.current?.click()}
          >
            📷 Change Photo
          </button>
          <input
            ref={fileInputRef}
            type="file" accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = ev => handleAvatarPick(ev.target?.result as string);
              reader.readAsDataURL(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Display Name */}
      <div>
        <label style={profileLabelStyle}>Display Name</label>
        <input className="input" value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="Your full name" style={{ width: '100%' }} />
      </div>

      {/* Email — read-only */}
      <div>
        <label style={profileLabelStyle}>Email Address</label>
        <input className="input" value={user?.email ?? ''} disabled
          style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }} />
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Email is managed by your authentication provider.
        </div>
      </div>

      {/* Phone */}
      <div>
        <label style={profileLabelStyle}>Phone Number</label>
        <input className="input" type="tel" value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+1 (555) 000-0000" style={{ width: '100%' }} />
      </div>

      {/* Timezone — full IANA list, grouped by region */}
      <div>
        <label style={profileLabelStyle}>Time Zone</label>
        <select className="input" value={timezone}
          onChange={e => setTimezone(e.target.value)}
          style={{ width: '100%' }}
        >
          {Object.entries(groups).map(([region, zones]) => (
            <optgroup key={region} label={region}>
              {zones.map(tz => (
                <option key={tz.value} value={tz.value}>
                  {tz.utcOffset} — {tz.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Browser detected: <strong>{getUserTimezone()}</strong>
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: msg.type === 'ok' ? '#22c55e15' : '#ef444415',
          color:      msg.type === 'ok' ? '#22c55e'   : '#ef4444',
        }}>{msg.text}</div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Saving…' : '💾 Save Changes'}
        </button>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const profileLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  display: 'block', marginBottom: 6,
};


// ─── User Settings Modal ───────────────────────────────────────────────────────


function UserSettingsModal({ onClose, userName }: { onClose: () => void; userName: string }) {
  const [section, setSection] = useState<'profile' | 'mail' | 'calendar' | 'notifications'>('profile');

  const navItems = [
    { id: 'profile' as const, icon: '👤', label: 'Profile' },
    { id: 'mail' as const, icon: '📧', label: 'Mail Integration' },
    { id: 'calendar' as const, icon: '📅', label: 'Calendar Sync' },
    { id: 'notifications' as const, icon: '🔔', label: 'Notifications' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: 740, maxHeight: '88vh', background: 'var(--bg-elevated)',
        border: '1px solid var(--border)', borderRadius: 20,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        display: 'flex', overflow: 'hidden',
      }}>
        {/* Sidebar nav */}
        <div style={{
          width: 190, background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          padding: '24px 12px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, padding: '0 10px', marginBottom: 16 }}>
            ⚙️ My Settings
          </div>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: section === item.id ? 'var(--brand-900)' : 'transparent',
                border: `1px solid ${section === item.id ? 'var(--brand-500)44' : 'transparent'}`,
                color: section === item.id ? 'var(--brand-400)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: section === item.id ? 700 : 400,
                cursor: 'pointer', width: '100%', textAlign: 'left',
                transition: 'all 0.12s',
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Content pane */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
              {navItems.find(n => n.id === section)?.icon} {navItems.find(n => n.id === section)?.label}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-tertiary)' }}>✕</button>
          </div>


          {/* ─ PROFILE ─ (real Firestore data) */}
          {section === 'profile' && <ProfileSection onClose={onClose} />}


          {/* ─ MAIL INTEGRATION ─ (full OAuth integration) */}
          {section === 'mail' && <MailIntegrationSection />}

          {/* ─ CALENDAR SYNC ─ (inherits connection from mail integration) */}
          {section === 'calendar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                Calendar sync uses the same OAuth connection as Mail Integration.
                Connect Microsoft 365 or Google Workspace on the <strong>Mail Integration</strong> tab
                to enable calendar sync. Events are synced according to the window you set there.
              </p>
              <div style={{
                padding: '16px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <span style={{ fontSize: 32 }}>📅</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Calendar events sync automatically</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Once connected, your Outlook / Google Calendar events appear in the platform calendar.
                    Go to <strong>Mail Integration → Sync Settings</strong> to configure the sync window.
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* ─ NOTIFICATIONS ─ */}
          {section === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Choose how and when you receive alerts.</p>
              {[
                { label: 'SLA breach alerts',    desc: 'Notify when a task SLA is about to expire',     defaultOn: true  },
                { label: 'Unassigned task alert', desc: 'Alert when a task stays unassigned beyond SLA', defaultOn: true  },
                { label: 'Capital call reminders',desc: 'Remind 48h before capital call due dates',      defaultOn: true  },
                { label: 'KYC review due',        desc: 'Alert 7 days before KYC renewal is required',  defaultOn: false },
                { label: 'Email digest',          desc: 'Daily summary email of open tasks',             defaultOn: false },
              ].map(n => (
                <Toggle key={n.label} label={n.label} desc={n.desc} defaultOn={n.defaultOn} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function IntegrationCard({
  icon, name, description, status, isTesting, testResult, children,
}: {
  icon: string; name: string; description: string;
  status: ConnectionStatus; isTesting: boolean;
  testResult?: string; children: React.ReactNode;
}) {
  const statusColor: Record<ConnectionStatus, string> = {
    connected:    '#22c55e',
    disconnected: '#94a3b8',
    testing:      '#f59e0b',
    error:        '#ef4444',
  };
  const statusLabel: Record<ConnectionStatus, string> = {
    connected: 'Connected', disconnected: 'Disconnected', testing: 'Testing…', error: 'Error',
  };

  return (
    <div style={{
      border: `1px solid ${status === 'connected' ? '#22c55e33' : 'var(--border)'}`,
      borderRadius: 12, overflow: 'hidden',
      background: status === 'connected' ? '#22c55e06' : 'var(--bg-surface)',
    }}>
      {/* Card header */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--border)' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10, fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-elevated)',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{description}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isTesting && (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1s infinite' }} />
          )}
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10,
            background: `${statusColor[isTesting ? 'testing' : status]}18`,
            color: statusColor[isTesting ? 'testing' : status],
          }}>
            {isTesting ? 'Testing…' : statusLabel[status]}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '14px 18px' }}>
        {children}
        {/* Test result */}
        {testResult && !isTesting && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 6,
            background: testResult.includes('OK') || testResult.includes('reachable') ? '#22c55e10' : '#ef444410',
            border: `1px solid ${testResult.includes('OK') || testResult.includes('reachable') ? '#22c55e33' : '#ef444433'}`,
            fontSize: 11, color: 'var(--text-primary)',
          }}>
            {testResult.includes('OK') || testResult.includes('reachable') ? '✅' : '❌'} {testResult}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', borderRadius: 10,
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{desc}</div>
      </div>
      <button
        onClick={() => setOn(v => !v)}
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: on ? 'var(--brand-500)' : 'var(--bg-elevated)',
          border: `1px solid ${on ? 'var(--brand-500)' : 'var(--border)'}`,
          position: 'relative', cursor: 'pointer', flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 2,
          left: on ? 20 : 2,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  );
}

function TenantSwitcher() {
  const { userProfile, tenant, switchTenant } = useAuth();
  const [tenants,  setTenants]  = useState<TenantRecord[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-fetch fresh from Firestore every time the dropdown opens.
  // We intentionally bypass the cached userProfile.tenantIds because it was
  // set at login and may not reflect memberships added in the same session.
  useEffect(() => {
    if (!userProfile || !open) return;
    setLoading(true);
    // Re-read the user doc so we always have the latest tenantIds array
    getUserProfile(userProfile.uid)
      .then(freshProfile => {
        const profile = freshProfile ?? userProfile;
        return getTenantsForUser(profile);
      })
      .then(setTenants)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userProfile, open]); // intentionally omit tenants — re-fetch on every open

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!userProfile || !tenant) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-canvas)', border: '1px solid var(--border)',
          padding: '6px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
          transition: 'border-color var(--transition)'
        }}
        title="Switch Tenant"
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: tenant.brandColor || 'var(--brand-500)'
        }} />
        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tenant.name}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '6px', width: 220,
          boxShadow: 'var(--shadow-lg)', zIndex: 100,
        }}>
          {loading ? (
            <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              ⏳ Loading workspaces…
            </div>
          ) : (
            tenants.map(t => (
              <button
                key={t.id}
                onClick={async () => {
                  setOpen(false);
                  if (t.id !== tenant.id) {
                    await switchTenant(t.id);
                    window.location.assign('/dashboard');
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  background: t.id === tenant.id ? 'var(--brand-900)' : 'transparent',
                  border: 'none', padding: '8px 10px', borderRadius: 4, cursor: 'pointer',
                  color: t.id === tenant.id ? 'var(--brand-400)' : 'var(--text-secondary)',
                  textAlign: 'left', transition: 'background 0.15s'
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.brandColor || 'var(--text-tertiary)' }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: t.id === tenant.id ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                </span>
                {t.id === tenant.id && <span style={{ fontSize: 11 }}>✓</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export default function Header() {
  const { title, subtitle, crumbs } = usePageTitle();
  const router = useRouter();
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { language, setLanguage, t } = useTranslation();
  const { user, tenant, logout, isHydrated } = useAuth();
  const { unreadCount } = useTaskQueue();
  const menuRef  = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    if (user && tenant) {
      await logAction({
        tenantId: tenant.id || 'firm-default',
        userId: user.id || 'unknown',
        userName: user.name,
        action: 'USER_LOGOUT',
        resourceId: user.id || 'session',
        resourceType: 'auth_session',
        resourceName: 'User Session',
        status: 'success'
      });
    }
    logout();
    router.push('/login');
  };

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuRef]);

  return (
    <>
      {settingsOpen && user && (
        <UserSettingsModal onClose={() => setSettingsOpen(false)} userName={user.name} />
      )}

      <header className="header" style={{ position: 'relative' }}>
        {/* Breadcrumb / title — fed via PageTitleContext */}
        <div className="header-breadcrumb" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          {crumbs.length > 0 ? (
            crumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: '0 2px' }}>›</span>}
                {crumb.onClick ? (
                  <button
                    onClick={crumb.onClick}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                      fontSize: 13, fontWeight: 500,
                      color: i === crumbs.length - 1 ? 'var(--text-primary)' : 'var(--brand-400)',
                      borderRadius: 4,
                    }}
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span style={{
                    fontSize: 13, fontWeight: i === crumbs.length - 1 ? 600 : 500,
                    color: i === crumbs.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                    padding: '2px 4px',
                  }}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))
          ) : (
            <>
              {title && <span className="header-breadcrumb-current">{title}</span>}
              {subtitle && (
                <>
                  <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{subtitle}</span>
                </>
              )}
            </>
          )}
        </div>

        {/* Search */}
        <div className="header-search" style={{ cursor: 'text', minWidth: 380 }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>🔍</span>
          <input type="text" placeholder={t('header.search')} readOnly style={{ minWidth: 300 }} />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>⌘K</span>
        </div>

        {/* Right actions */}
        <div className="header-right">

          {/* Notifications */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              className="icon-btn"
              title={t('header.notifications')}
              onClick={() => setNotifOpen(o => !o)}
              style={{ position: 'relative' }}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 8, height: 8,
                  background: '#ef4444', borderRadius: '50%',
                  border: '1.5px solid var(--bg-surface)',
                  animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none',
                }} />
              )}
            </button>
            {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
          </div>

          {/* Help */}
          <button className="icon-btn" title={t('header.help')}>?</button>

          {/* Tenant Switcher */}
          <TenantSwitcher />

          {/* User avatar */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            {(!isHydrated || !user) ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--bg-elevated)', opacity: 0.4
              }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-canvas)' }} />
                <div style={{ width: 80, height: 16, borderRadius: 4, background: 'var(--bg-canvas)' }} />
              </div>
            ) : (
              <div
                onClick={() => setMenuOpen(prev => !prev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '4px 8px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                  transition: 'border-color var(--transition)'
                }}
              >
                <Avatar id={`user-${user.id}`} name={user.name} size="sm" editable />
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{user.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                    {t(`role.${user.role}` as any) || user.role.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
            )}

            {/* Dropdown menu */}
            {menuOpen && user && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: 16, width: 272,
                boxShadow: 'var(--shadow-lg)', zIndex: 100,
                maxHeight: '90vh', overflowY: 'auto',
              }}>
                {/* User info */}
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <Avatar id={`user-${user.id}`} name={user.name} size="md" editable />
                    <div>
                      <div className="fw-600">{user.name}</div>
                      <div className="text-secondary text-xs" style={{ textTransform: 'capitalize' }}>
                        {t(`role.${user.role}` as any) || user.role.replace(/_/g, ' ')}
                      </div>
                      {tenant && (
                        <div className="text-secondary text-xs" style={{ marginTop: 2, opacity: 0.7 }}>
                          {tenant.name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    Click the avatar to change your photo
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* My Settings shortcut */}
                  <button
                    onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      background: 'var(--bg-canvas)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: 13, width: '100%', textAlign: 'left',
                      transition: 'all 0.12s',
                    }}
                  >
                    ⚙️
                    <span style={{ fontWeight: 600 }}>My Settings</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>Mail · Calendar →</span>
                  </button>

                  {/* Language */}
                  <div>
                    <label className="text-xs fw-600 text-secondary mb-1 block">{t('profile.language')}</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-canvas)', color: 'var(--text-primary)', fontSize: 13 }}
                    >
                      <option value="en-US">English (US)</option>
                      <option value="pt-BR">Português (BR)</option>
                    </select>
                  </div>

                  <hr style={{ borderColor: 'var(--border)', margin: '0' }} />

                  {/* Appearance */}
                  <MiniThemePicker />

                  <hr style={{ borderColor: 'var(--border)', margin: '0' }} />

                  {/* Sign out */}
                  <button
                    onClick={handleSignOut}
                    className="btn btn-ghost text-red"
                    style={{ justifyContent: 'flex-start', padding: '6px 8px', width: '100%' }}
                  >
                    {t('profile.signout')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
