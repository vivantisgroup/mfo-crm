'use client';

/**
 * /select-tenant — Post-login workspace selector.
 * Shown when a user belongs to more than one tenant (or has none yet).
 * Routes to /mfa-verify if the selected tenant requires MFA, else to /dashboard.
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import type { TenantRecord } from '@/lib/platformService';

export default function SelectTenantPage() {
  const router = useRouter();
  const { stage, availableTenants = [], selectTenant, user, logout } = useAuth();

  // Redirect if not in the right stage
  useEffect(() => {
    if (stage === 'authenticated')   router.replace('/dashboard');
    if (stage === 'mfa_required')    router.replace('/mfa-verify');
    if (stage === 'unauthenticated') router.replace('/login');
  }, [stage, router]);

  async function handleSelect(tenantId: string) {
    await selectTenant(tenantId);
    // AuthContext will update stage; useEffect above will redirect
  }

  if (stage === 'loading' || stage === 'authenticated' || stage === 'mfa_required') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f17' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#0f0f17',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* ── Left branding panel ────────────────────────────────────────── */}
      <div style={{
        width: '38%', minHeight: '100vh',
        background: 'linear-gradient(155deg, #6366f1 0%, #4f46e5 45%, #1e1b4b 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 48px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Bg circles */}
        {[
          { top: '-20%', right: '-20%', size: 400 },
          { bottom: '-15%', left: '-15%', size: 300 },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            width: s.size, height: s.size,
            top: (s as any).top, right: (s as any).right,
            bottom: (s as any).bottom, left: (s as any).left,
          }} />
        ))}

        {/* Logo */}
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, marginBottom: 48, flexShrink: 0,
        }}>🏢</div>

        <div style={{ color: 'white' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 12 }}>
            Select Workspace
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15 }}>
            Welcome back,<br />{user?.name?.split(' ')[0] ?? 'there'}
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8, margin: 0 }}>
            You have access to multiple workspaces. Choose which one you'd like to enter.
          </p>
        </div>

        <div style={{ position: 'absolute', bottom: 32, left: 48, opacity: 0.4, fontSize: 11, color: 'white' }}>
          MFO Nexus Platform
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 48px', flexDirection: 'column',
      }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 8px' }}>
              Select a Workspace
            </h2>
            <p style={{ fontSize: 13, color: '#8892b0', margin: 0 }}>
              {availableTenants.length === 0
                ? 'No workspaces found. Contact your administrator.'
                : `${availableTenants.length} workspace${availableTenants.length > 1 ? 's' : ''} available`}
            </p>
          </div>

          {availableTenants.length === 0 ? (
            <div style={{
              padding: '32px', borderRadius: 16, border: '1px dashed #2a2a45',
              background: '#1a1a2e', textAlign: 'center', color: '#6b7280',
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
              <div style={{ fontSize: 14 }}>No workspaces assigned yet.<br/>Please contact your platform administrator.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {availableTenants.map((t: TenantRecord) => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  style={{
                    all: 'unset', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '18px 20px', borderRadius: 14,
                    background: '#1a1a2e', border: '1px solid #2a2a45',
                    transition: 'all 0.15s', width: '100%', boxSizing: 'border-box',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
                    (e.currentTarget as HTMLElement).style.background = '#1e1e38';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#2a2a45';
                    (e.currentTarget as HTMLElement).style.background = '#1a1a2e';
                  }}
                >
                  {/* Tenant avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: t.brandColor ?? `hsl(${(t.name.charCodeAt(0) * 7) % 360},55%,40%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 800, color: 'white',
                  }}>
                    {t.name[0]?.toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 2 }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {t.plan} · {t.status}
                      {t.mfaRequired && (
                        <span style={{
                          marginLeft: 8, fontSize: 10, fontWeight: 700,
                          padding: '2px 7px', borderRadius: 6,
                          background: '#6366f120', color: '#818cf8',
                          border: '1px solid #6366f130',
                        }}>
                          🔐 MFA Required
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ color: '#6366f1', fontSize: 18 }}>→</div>
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              onClick={logout}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#4b5563', fontSize: 12, textDecoration: 'underline',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
