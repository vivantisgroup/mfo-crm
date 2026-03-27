'use client';

/**
 * /mfa-verify — Email OTP verification page.
 * Shown when stage === 'mfa_required' (tenant has mfaRequired: true).
 * Calls /api/mfa/send-code to dispatch the OTP, then /api/mfa/verify-code to verify.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { firebaseApp } from '@mfo-crm/config';
import { useAuth } from '@/lib/AuthContext';

export default function MfaVerifyPage() {
  const router = useRouter();
  const { stage, user, tenantRecord, pendingTenantId, completeMfa, logout } = useAuth();
  const auth = getAuth(firebaseApp);

  const [code,        setCode]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [sending,     setSending]     = useState(false);
  const [error,       setError]       = useState('');
  const [sent,        setSent]        = useState(false);
  const [countdown,   setCountdown]   = useState(0);
  const [devCode,     setDevCode]     = useState<string | null>(null); // dev-only
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect if not in the right stage
  useEffect(() => {
    if (stage === 'authenticated')   router.replace('/dashboard');
    if (stage === 'select_tenant')   router.replace('/select-tenant');
    if (stage === 'unauthenticated') router.replace('/login');
  }, [stage, router]);

  // Auto-send on mount
  useEffect(() => {
    if (stage === 'mfa_required') sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => setCountdown(c => c - 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [countdown]);

  async function getIdToken(): Promise<string | null> {
    const fbUser = auth.currentUser;
    if (!fbUser) return null;
    try { return await fbUser.getIdToken(true); } catch { return null; }
  }

  async function sendCode() {
    setSending(true); setError('');
    try {
      const idToken = await getIdToken();
      if (!idToken || !pendingTenantId) throw new Error('Session expired. Please sign in again.');
      const res  = await fetch('/api/mfa/send-code', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken, tenantId: pendingTenantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send code.');
      setSent(true);
      setCountdown(60); // 60s cool-down before resend allowed
      if (data.devCode) setDevCode(data.devCode);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setLoading(true); setError('');
    try {
      const idToken = await getIdToken();
      if (!idToken || !pendingTenantId) throw new Error('Session expired. Please sign in again.');
      const res  = await fetch('/api/mfa/verify-code', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken, tenantId: pendingTenantId, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Verification failed.');
      await completeMfa();
      // AuthContext sets stage to 'authenticated' → useEffect above redirects
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const tenantName = tenantRecord?.name ?? 'your workspace';
  const userEmail  = user?.email ?? '';

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

        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, marginBottom: 48, flexShrink: 0,
        }}>🔐</div>

        <div style={{ color: 'white' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 12 }}>
            Two-Factor Authentication
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15 }}>
            Verify Your<br />Identity
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8, margin: '0 0 40px' }}>
            <strong>{tenantName}</strong> requires an additional verification step to protect your account.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '📧', text: `Code sent to ${userEmail}` },
              { icon: '⏱️', text: 'Valid for 10 minutes' },
              { icon: '🛡️', text: '5 attempts before lockout' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                }}>{icon}</div>
                <span style={{ fontSize: 13, opacity: 0.85 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 32, left: 48, opacity: 0.4, fontSize: 11, color: 'white' }}>
          MFO Nexus Platform · Security
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div style={{
            background: '#1a1a2e',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
          }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#6366f1,#818cf8,#a5b4fc)' }} />
            <div style={{ padding: '36px 36px 32px' }}>

              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>
                Verification Code
              </h2>
              <p style={{ fontSize: 13, color: '#8892b0', margin: '0 0 24px', lineHeight: 1.5 }}>
                {sent
                  ? <>We sent a 6-digit code to <strong style={{ color: '#e2e8f0' }}>{userEmail}</strong>.</>
                  : sending ? 'Sending code…' : 'Preparing verification…'}
              </p>

              {/* Dev-only: show the code */}
              {devCode && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 12,
                  background: '#f59e0b10', border: '1px solid #f59e0b30', color: '#fbbf24',
                }}>
                  🛠️ Development mode — SMTP not configured. Your code: <strong style={{ fontFamily: 'monospace', fontSize: 15 }}>{devCode}</strong>
                </div>
              )}

              <form onSubmit={verifyCode} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* OTP input */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700,
                    color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
                  }}>
                    6-Digit Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="_ _ _ _ _ _"
                    autoFocus
                    disabled={!sent || loading}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#0f0f1a',
                      border: `1px solid ${error ? '#ef444460' : 'rgba(99,102,241,0.3)'}`,
                      borderRadius: 10, padding: '14px 16px',
                      fontSize: 24, fontFamily: 'ui-monospace, monospace',
                      fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.3em',
                      textAlign: 'center', outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#6366f1')}
                    onBlur={e => (e.target.style.borderColor = error ? '#ef444460' : 'rgba(99,102,241,0.3)')}
                  />
                </div>

                {error && (
                  <div style={{
                    padding: '12px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5',
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !sent || code.length !== 6}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: (loading || !sent || code.length !== 6)
                      ? 'rgba(99,102,241,0.4)'
                      : 'linear-gradient(135deg, #6366f1, #818cf8)',
                    color: 'white', fontSize: 15, fontWeight: 800,
                    cursor: (loading || !sent || code.length !== 6) ? 'not-allowed' : 'pointer',
                    boxShadow: (loading || !sent || code.length !== 6) ? 'none' : '0 8px 24px rgba(99,102,241,0.4)',
                    transition: 'all 0.2s',
                  }}
                >
                  {loading ? '⏳ Verifying…' : '🔓 Verify & Enter Workspace →'}
                </button>

                {/* Resend */}
                <div style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
                  {countdown > 0 ? (
                    <span>Resend available in {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={sendCode}
                      disabled={sending}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: 13, textDecoration: 'underline' }}
                    >
                      {sending ? 'Sending…' : 'Resend code'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button
              onClick={logout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', fontSize: 12, textDecoration: 'underline' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
