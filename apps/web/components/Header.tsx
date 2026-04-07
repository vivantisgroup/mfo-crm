'use client';

import { Search } from 'lucide-react';

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
import { MessagingIntegrationSection } from '@/components/MessagingIntegrationSection';
import { saveUserProfile, uploadAvatar } from '@/lib/userProfileService';
import { logAction as logAudit } from '@/lib/auditLog';
import {
  getUserTimezone, groupedTimezones,
} from '@/lib/timezones';
import { getTenantsForUser, getUserProfile, type TenantRecord } from '@/lib/platformService';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/lib/tenantMemberService';

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
  const { theme, setThemeById, resetCustom, fontOverride } = useTheme();
  const hasCustom = fontOverride !== null;
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

export function TenantSwitcher() {
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
                background: t.id === tenant.id ? 'var(--brand-500)' : 'transparent',
                border: 'none', padding: '7px 10px', borderRadius: 4, cursor: 'pointer',
                color: t.id === tenant.id ? '#ffffff' : 'var(--text-secondary)',
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

// ─── Header ───────────────────────────────────────────────────────────────────

export default function Header() {
  const { title, crumbs } = usePageTitle() as any;
  const pathname = usePathname();
  const router   = useRouter();
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
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
    const handleOpenSettings = (e: any) => {
      const section = e.detail?.section || 'profile';
      router.push(`/settings?tab=${section}`);
    };
    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, [router]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Resolve breadcrumbs: prefer explicit crumbs from page, else auto-generate from URL
  const resolvedCrumbs = crumbs && crumbs.length > 0
    ? crumbs
    : buildAutoCrumbs(pathname || '').map(c => ({ label: c.label, onClick: c.href !== pathname ? () => router.push(c.href) : undefined }));

  return (
    <>
      {/* Main Header Container */}
      <header className="header relative flex items-center h-14 px-6 gap-4 bg-surface border-b border-border z-40 sticky top-0">

        {/* ── Breadcrumb (left) ─────────────────────────────────────────── */}
        <div className="flex-1 flex items-center min-w-0">
          {resolvedCrumbs.map((crumb: any, i: number) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span className="text-tertiary text-xs mx-1 select-none">/</span>
              )}
              {crumb.onClick ? (
                <button onClick={crumb.onClick} className={`bg-transparent border-none cursor-pointer px-1.5 py-0.5 whitespace-nowrap rounded hover:bg-elevated transition-colors ${i === resolvedCrumbs.length - 1 ? 'text-sm font-bold text-primary' : 'text-[13px] font-medium text-brand-500 hover:text-brand-600'}`}>
                  {crumb.label}
                </button>
              ) : (
                <span className={`px-1.5 py-0.5 whitespace-nowrap ${i === resolvedCrumbs.length - 1 ? 'text-sm font-bold text-primary' : 'text-[13px] font-medium text-tertiary'}`}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <div className="header-search cursor-text max-w-sm flex-1 hidden md:flex">
          <Search size={16} className="text-tertiary shrink-0" />
          <input type="text" placeholder={t('header.search')} readOnly className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-primary placeholder-tertiary" />
          <span className="text-[10px] text-tertiary bg-canvas border border-border rounded px-1.5 py-px shrink-0 font-medium">⌘K</span>
        </div>

        {/* ── Right actions ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">

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
          <div ref={menuRef} className="relative">
            {(!isHydrated || !user) ? (
              <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-border bg-elevated opacity-40">
                <div className="w-6 h-6 rounded-full bg-canvas animate-pulse" />
                <div className="w-16 h-3 rounded bg-canvas animate-pulse" />
              </div>
            ) : (
              <button 
                onClick={() => setMenuOpen(p => !p)} 
                className="flex items-center gap-2 px-2 py-1 rounded-md border border-border bg-elevated hover:border-brand-500 hover:bg-surface transition-all cursor-pointer text-left"
              >
                <Avatar id={`user-${user.id}`} name={user.name} size="sm" />
                <div className="leading-tight hidden sm:block">
                  <div className="text-xs font-semibold text-primary">{user.name}</div>
                </div>
              </button>
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
                  onClick={() => { setMenuOpen(false); router.push('/settings'); }}
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
