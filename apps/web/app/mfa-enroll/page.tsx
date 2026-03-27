'use client';

/**
 * /mfa-enroll — Mandatory TOTP authenticator enrollment.
 *
 * Shown when stage === 'mfa_enroll' (new users who haven't set up TOTP yet).
 * Users CANNOT skip this page — access to the dashboard is blocked until
 * they successfully scan the QR code and verify a code from their authenticator.
 */

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { firebaseApp } from '@mfo-crm/config';
import { useAuth } from '@/lib/AuthContext';
import {
  startTotpEnrollment, finalizeTotpEnrollment, totpSecondsRemaining,
  type MfaEnrollmentSession,
} from '@/lib/mfaService';

type EnrollStep = 'scan' | 'verify' | 'success';

// ─── OTP digit inputs ─────────────────────────────────────────────────────────

function OtpInput({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
      onChange(value.slice(0, i - 1));
    }
  }
  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    const next = value.slice(0, i) + digit + value.slice(i + 1);
    onChange(next.slice(0, 6));
    if (digit && i < 5) refs.current[i + 1]?.focus();
  }
  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {[0,1,2,3,4,5].map(i => (
        <input key={i} ref={el => { refs.current[i] = el; }}
          type="text" inputMode="numeric" maxLength={1}
          value={value[i] ?? ''} disabled={disabled}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          style={{
            width: 52, height: 64, textAlign: 'center',
            fontSize: 26, fontWeight: 800, fontFamily: 'ui-monospace, monospace',
            borderRadius: 12, outline: 'none', caretColor: 'transparent',
            background: value[i] ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.07)',
            border: `2px solid ${value[i] ? '#818cf8' : 'rgba(255,255,255,0.25)'}`,
            color: '#ffffff',
            boxShadow: value[i] ? '0 0 0 4px rgba(99,102,241,0.2)' : '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'all 0.15s',
          }}
        />
      ))}
    </div>
  );
}

// ─── TOTP countdown ring ──────────────────────────────────────────────────────

function TotpTimer() {
  const [secs, setSecs] = React.useState(totpSecondsRemaining());
  React.useEffect(() => {
    const id = setInterval(() => setSecs(totpSecondsRemaining()), 1000);
    return () => clearInterval(id);
  }, []);
  const color = secs <= 5 ? '#ef4444' : secs <= 10 ? '#f59e0b' : '#22c55e';
  const r = 10, circ = 2 * Math.PI * r, dash = circ * (secs / 30);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
      <svg width={28} height={28} viewBox="0 0 26 26" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={13} cy={13} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={2.5} />
        <circle cx={13} cy={13} r={r} fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s' }} />
      </svg>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
        Code refreshes in <strong style={{ color }}>{secs}s</strong>
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MfaEnrollPage() {
  const router        = useRouter();
  const { stage, user, userProfile, completeMfaEnroll, logout } = useAuth();
  const auth          = getAuth(firebaseApp);

  const [step,        setStep]        = useState<EnrollStep>('scan');
  const [session,     setSession]     = useState<MfaEnrollmentSession | null>(null);
  const [otp,         setOtp]         = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [copied,      setCopied]      = useState(false);
  const [starting,    setStarting]    = useState(true);

  // Redirect if not in the right stage
  useEffect(() => {
    if (stage === 'authenticated') { router.replace('/dashboard'); return; }
    if (stage === 'unauthenticated') { router.replace('/login'); return; }
    if (stage === 'mfa_required') { router.replace('/mfa-verify'); return; }
  }, [stage, router]);

  // Start TOTP enrollment automatically on mount
  useEffect(() => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    setStarting(true);
    startTotpEnrollment(fbUser).then(s => {
      setSession(s);
      setStarting(false);
    }).catch(err => {
      setError(err?.message ?? 'Failed to start MFA setup.');
      setStarting(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-submit on 6th digit
  useEffect(() => {
    if (step === 'verify' && otp.length === 6 && !loading) handleVerify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step]);

  async function handleVerify() {
    if (!session || !auth.currentUser || otp.length < 6) return;
    setLoading(true); setError('');
    try {
      await finalizeTotpEnrollment(auth.currentUser, session, otp);
      setStep('success');
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/invalid-verification-code' || code === 'auth/code-expired') {
        setError('Incorrect or expired code. Try again with the current 6-digit code.');
      } else {
        setError(e.message ?? 'Verification failed. Please try again.');
      }
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    setLoading(true);
    try {
      await completeMfaEnroll();
      // AuthContext sets stage to 'authenticated' → useEffect above redirects to /dashboard
    } catch (e: any) {
      setError(e?.message ?? 'Could not complete setup.');
      setLoading(false);
    }
  }

  function copySecret() {
    if (!session) return;
    navigator.clipboard.writeText(session.secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const userEmail = user?.email ?? userProfile?.email ?? '';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: '#0f0f17', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* ─── Left branding panel ─────────────────────────────────────────── */}
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
          width: 56, height: 56, borderRadius: 16, flexShrink: 0,
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, marginBottom: 48,
        }}>🔐</div>

        <div style={{ color: 'white' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 12 }}>
            Security Setup Required
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15 }}>
            Set Up Two-Factor<br />Authentication
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8, margin: '0 0 40px' }}>
            Your account requires an authenticator app to protect access.
            This only takes a minute and keeps your workspace secure.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: '📱', text: 'Open Google Authenticator, Authy, or 1Password' },
              { icon: '📷', text: 'Scan the QR code with your app' },
              { icon: '✅', text: 'Enter the 6-digit code to verify' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
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

      {/* ─── Right form panel ────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: 480 }}>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
            {(['scan', 'verify', 'success'] as EnrollStep[]).map((s, idx) => {
              const labels = { scan: 'Scan QR', verify: 'Verify Code', success: 'Done' };
              const done = (step === 'verify' && idx === 0) || (step === 'success' && idx <= 1);
              const active = step === s;
              return (
                <React.Fragment key={s}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800,
                      background: done ? '#22c55e' : active ? '#6366f1' : 'rgba(255,255,255,0.08)',
                      color: (done || active) ? 'white' : 'rgba(255,255,255,0.3)',
                      border: `2px solid ${done ? '#22c55e' : active ? '#6366f1' : 'rgba(255,255,255,0.15)'}`,
                    }}>
                      {done ? '✓' : idx + 1}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? 'white' : 'rgba(255,255,255,0.4)' }}>
                      {labels[s]}
                    </span>
                  </div>
                  {idx < 2 && <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)', margin: '0 12px' }} />}
                </React.Fragment>
              );
            })}
          </div>

          <div style={{
            background: '#1a1a2e', border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
          }}>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#6366f1,#818cf8,#a5b4fc)' }} />

            {/* ── Loading / error during TOTP session start ── */}
            {starting && (
              <div style={{ padding: '48px 36px', textAlign: 'center' }}>
                <div style={{ width: 36, height: 36, border: '3px solid #6366f133', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Preparing your authenticator setup…</div>
              </div>
            )}

            {/* ── Step 1: Scan QR ── */}
            {!starting && step === 'scan' && session && (
              <div style={{ padding: '36px 36px 32px' }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>
                  Scan QR Code
                </h2>
                <p style={{ fontSize: 13, color: '#8892b0', margin: '0 0 24px', lineHeight: 1.5 }}>
                  Open your authenticator app and scan this code to add your account.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                  <div style={{ padding: 16, background: 'white', borderRadius: 14, display: 'inline-block', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                    <QRCodeSVG value={session.qrCodeUrl} size={200} level="M" includeMargin={false} />
                  </div>
                </div>

                <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', marginBottom: 24 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 600 }}>
                    Can't scan? Enter this key manually:
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ flex: 1, fontSize: 12, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.12em', color: '#e2e8f0', wordBreak: 'break-all' }}>
                      {session.secretKey.match(/.{1,4}/g)?.join(' ') ?? session.secretKey}
                    </code>
                    <button onClick={copySecret} style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: copied ? '#22c55e18' : 'rgba(255,255,255,0.05)',
                      color: copied ? '#22c55e' : 'rgba(255,255,255,0.6)',
                      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
                    {userEmail} · MFO Nexus · TOTP · 30s
                  </div>
                </div>

                {error && (
                  <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={() => { setOtp(''); setError(''); setStep('verify'); }}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                    color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
                  }}
                >
                  I've scanned it — Next →
                </button>
              </div>
            )}

            {/* ── Step 2: Verify ── */}
            {!starting && step === 'verify' && (
              <div style={{ padding: '36px 36px 32px' }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>
                  Verify Your Code
                </h2>
                <p style={{ fontSize: 13, color: '#8892b0', margin: '0 0 28px', lineHeight: 1.5 }}>
                  Enter the 6-digit code from your authenticator app to confirm setup.
                </p>

                <OtpInput value={otp} onChange={setOtp} disabled={loading} />

                <div style={{ marginTop: 16, marginBottom: 8 }}>
                  <TotpTimer />
                </div>

                {error && (
                  <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 8, fontSize: 13, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button onClick={() => { setOtp(''); setError(''); setStep('scan'); }} style={{
                    flex: 1, padding: '13px', borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}>
                    ← Back
                  </button>
                  <button
                    onClick={handleVerify}
                    disabled={otp.length < 6 || loading}
                    style={{
                      flex: 2, padding: '13px', borderRadius: 12, border: 'none',
                      background: (otp.length < 6 || loading) ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                      color: 'white', fontSize: 14, fontWeight: 800,
                      cursor: (otp.length < 6 || loading) ? 'not-allowed' : 'pointer',
                      boxShadow: (otp.length < 6 || loading) ? 'none' : '0 8px 24px rgba(99,102,241,0.4)',
                    }}
                  >
                    {loading ? '⏳ Verifying…' : 'Verify & Enable MFA →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Success ── */}
            {step === 'success' && (
              <div style={{ padding: '48px 36px', textAlign: 'center' }}>
                <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#22c55e', margin: '0 0 12px' }}>
                  MFA Setup Complete!
                </h2>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: '0 0 32px' }}>
                  Your account is now protected by two-factor authentication.
                  You'll be asked for a code from your authenticator app on future logins.
                </p>
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  style={{
                    padding: '15px 40px', borderRadius: 12, border: 'none',
                    background: loading ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: 'white', fontSize: 15, fontWeight: 800,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : '0 8px 24px rgba(34,197,94,0.35)',
                  }}
                >
                  {loading ? 'Loading…' : '🚀 Enter My Workspace →'}
                </button>
              </div>
            )}
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button
              onClick={logout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', fontSize: 12 }}
            >
              Sign out and set this up later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
