'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Ticker } from '@/components/Ticker';
import { UserSettingsProvider } from '@/lib/UserSettingsContext';
import { I18nProvider } from '@/lib/i18n/context';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { ThemeCustomizer } from '@/components/ThemeCustomizer';
import { TaskQueueProvider } from '@/lib/TaskQueueContext';
import { usePathname, useRouter } from 'next/navigation';

function DashboardInner({ children }: { children: React.ReactNode }) {
  const [collapsed,    setCollapsed]    = useState(false);
  const [mfaBanner,   setMfaBanner]    = useState(true);
  const { tenant, isAuthenticated, isHydrated, stage, error, retryProfile, isSaasMasterAdmin, firebaseUser, userProfile } = useAuth();
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    if (!isHydrated) return;

    // Only redirect if Firebase itself has NO session.
    // profile_error means Firebase is valid but Firestore failed → show error, don't loop.
    if (stage === 'unauthenticated' || stage === 'needs_setup') {
      router.push('/login');
      return;
    }

    // Tenant-restricted route guard (internal users can't access family routes)
    if (isAuthenticated && tenant?.isInternal) {
      const privateRoutes = [
        '/families', '/activities', '/tasks', '/portfolio',
        '/documents', '/governance', '/estate', '/concierge', '/calendar',
      ];
      if (privateRoutes.some(r => pathname.startsWith(r))) {
        router.push('/dashboard');
      }
    }
  }, [isHydrated, isAuthenticated, stage, tenant, pathname, router]);

  // ── Loading splash ────────────────────────────────────────────────────────
  if (!isHydrated || stage === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #6366f133', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading your workspace…</div>
        </div>
      </div>
    );
  }

  // ── Profile error — show retry instead of looping to /login ──────────────
  if (stage === 'profile_error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Unable to load your profile</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Your Firebase session is valid but your Firestore profile could not be loaded. This is usually a temporary connectivity issue or a Firestore rules misconfiguration.
          </p>
          {error && (
            <div style={{ background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#fca5a5', fontFamily: 'monospace', textAlign: 'left' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => retryProfile?.()}
              style={{ padding: '10px 24px', background: 'var(--brand-500)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
            >
              🔄 Retry
            </button>
            <button
              onClick={() => window.location.assign('/login')}
              style={{ padding: '10px 24px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated shell ───────────────────────────────────────────────────
  const showMfaBanner = mfaBanner
    && isSaasMasterAdmin
    && !(userProfile?.mfaEnabled)
    && pathname !== '/account/mfa';

  return (
    <div
      className={`shell${collapsed ? ' collapsed' : ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: collapsed ? 'var(--sidebar-collapsed) 1fr' : 'var(--sidebar-width) 1fr',
        gridTemplateRows: `var(--header-height)${showMfaBanner ? ' auto' : ''} 1fr`,
        minHeight: '100vh',
        transition: 'grid-template-columns 300ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <Sidebar collapsed={collapsed} toggle={() => setCollapsed(c => !c)} />
      <Header title={tenant?.name} />
      {showMfaBanner && (
        <div style={{
          gridColumn: '2', gridRow: '2',
          background: 'linear-gradient(90deg, #b45309 0%, #92400e 100%)',
          padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid #78350f',
        }}>
          <span style={{ fontSize: 16 }}>🔐</span>
          <div style={{ flex: 1, fontSize: 13, color: '#fef3c7', lineHeight: 1.5 }}>
            <strong>Enable Two-Factor Authentication</strong> — As a SaaS Master Admin your account requires TOTP MFA for production security.{' '}
            <Link href="/account/mfa" style={{ color: '#fde68a', textDecoration: 'underline', fontWeight: 700 }}>Enable MFA now →</Link>
          </div>
          <button
            onClick={() => setMfaBanner(false)}
            style={{ background: 'none', border: 'none', color: '#fcd34d', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}
      <main className="main-content" style={{ overflow: 'auto', paddingBottom: '40px', gridRow: showMfaBanner ? '3' : '2' }}>
        {children}
      </main>
      <Ticker />
      <ThemeCustomizer />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <UserSettingsProvider>
          <ThemeProvider>
            <TaskQueueProvider>
              <DashboardInner>{children}</DashboardInner>
            </TaskQueueProvider>
          </ThemeProvider>
        </UserSettingsProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
