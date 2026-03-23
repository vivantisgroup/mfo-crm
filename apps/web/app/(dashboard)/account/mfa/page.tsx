'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/lib/AuthContext';
import {
  startTotpEnrollment, finalizeTotpEnrollment, unenrollMfa,
  totpSecondsRemaining,
  type MfaEnrollmentSession,
} from '@/lib/mfaService';

type EnrollStep = 'idle' | 'scan' | 'verify' | 'success';

// ─── OTP input ────────────────────────────────────────────────────────────────

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
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[0,1,2,3,4,5].map(i => (
        <input key={i} ref={el => { refs.current[i] = el; }}
          type="text" inputMode="numeric" maxLength={1}
          value={value[i] ?? ''} disabled={disabled}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          style={{ width: 48, height: 60, textAlign: 'center', fontSize: 22, fontWeight: 800,
            fontFamily: 'ui-monospace, monospace', borderRadius: 12, outline: 'none', caretColor: 'transparent',
            background: value[i] ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.07)',
            border: `2px solid ${value[i] ? '#818cf8' : 'rgba(255,255,255,0.28)'}`,
            color: '#ffffff',
            boxShadow: value[i] ? '0 0 0 3px rgba(99,102,241,0.25)' : '0 2px 6px rgba(0,0,0,0.3)',
            transition: 'all 0.15s' }}
        />
      ))}
    </div>
  );
}

// ─── TOTP countdown ───────────────────────────────────────────────────────────

function TotpTimer() {
  const [secs, setSecs] = React.useState(totpSecondsRemaining());
  React.useEffect(() => {
    const id = setInterval(() => setSecs(totpSecondsRemaining()), 1000);
    return () => clearInterval(id);
  }, []);
  const color = secs <= 5 ? '#ef4444' : secs <= 10 ? '#f59e0b' : '#22c55e';
  const r = 10, circ = 2 * Math.PI * r, dash = circ * (secs / 30);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width={26} height={26} viewBox="0 0 26 26" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={13} cy={13} r={r} fill="none" stroke="var(--border)" strokeWidth={2.5} />
        <circle cx={13} cy={13} r={r} fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s' }} />
      </svg>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        Refreshes in <strong style={{ color }}>{secs}s</strong>
      </span>
    </div>
  );
}

// ─── Main MFA Settings Page ───────────────────────────────────────────────────

export default function MfaSettingsPage() {
  const { firebaseUser, user, userProfile } = useAuth();

  const [enrollStep,    setEnrollStep]    = useState<EnrollStep>('idle');
  const [enrollSession, setEnrollSession] = useState<MfaEnrollmentSession | null>(null);
  const [otp,           setOtp]           = useState('');
  const [verifyError,   setVerifyError]   = useState('');
  const [loading,       setLoading]       = useState(false);
  const [msg,           setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copied,        setCopied]        = useState(false);

  const mfaActive = userProfile?.mfaEnabled ?? false;

  // ── Start enrollment ──────────────────────────────────────────────────────────
  async function handleStartEnroll() {
    if (!firebaseUser) return;
    setLoading(true); setMsg(null);
    try {
      const session = await startTotpEnrollment(firebaseUser);
      setEnrollSession(session);
      setOtp('');
      setVerifyError('');
      setEnrollStep('scan');
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/operation-not-allowed') {
        setMsg({
          type: 'err',
          text: 'TOTP MFA is not enabled in your Firebase project. A SaaS Platform Admin must enable it in the Firebase Console before enrollment is available.',
        });
      } else if (code === 'auth/user-token-expired' || code === 'auth/requires-recent-login') {
        setMsg({
          type: 'err',
          text: 'For security, MFA enrollment requires a fresh session. Please sign out and sign in again before enrolling.',
        });
      } else {
        setMsg({ type: 'err', text: e.message ?? 'Failed to start enrollment. Please try again.' });
      }
    } finally { setLoading(false); }
  }

  // ── Verify and finalize ───────────────────────────────────────────────────────
  async function handleVerify() {
    if (!firebaseUser || !enrollSession || otp.length < 6) return;
    setLoading(true); setVerifyError('');
    try {
      await finalizeTotpEnrollment(firebaseUser, enrollSession, otp);
      setEnrollStep('success');
      setMsg({ type: 'ok', text: 'MFA enrolled successfully. Your account is now protected by TOTP authentication.' });
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/invalid-verification-code' || code === 'auth/code-expired') {
        setVerifyError('Incorrect or expired code. Please try again with the current code from your app.');
      } else {
        setVerifyError(e.message ?? 'Verification failed.');
      }
      setOtp('');
    } finally { setLoading(false); }
  }

  // Auto-submit on 6th digit
  useEffect(() => {
    if (enrollStep === 'verify' && otp.length === 6 && !loading) handleVerify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, enrollStep]);

  // ── Unenroll ──────────────────────────────────────────────────────────────────
  async function handleUnenroll() {
    if (!firebaseUser) return;
    if (!confirm('Remove MFA from your account? You will no longer be required to enter a verification code at sign-in.')) return;
    setLoading(true); setMsg(null);
    try {
      await unenrollMfa(firebaseUser);
      setMsg({ type: 'ok', text: 'MFA has been removed from your account.' });
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message ?? 'Failed to remove MFA.' });
    } finally { setLoading(false); }
  }

  // ── Copy secret key ───────────────────────────────────────────────────────────
  function copySecret() {
    if (!enrollSession) return;
    navigator.clipboard.writeText(enrollSession.secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 20,
  };
  const sectionHead: React.CSSProperties = {
    padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10,
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>

      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>🔐 Two-Factor Authentication</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          Protect your account with TOTP (Time-based One-Time Password) authentication.
          Once enabled, you will need your authenticator app every time you sign in.
        </div>
      </div>

      {/* Status card */}
      <div style={{ ...sectionStyle, border: `1px solid ${mfaActive ? '#22c55e44' : '#f59e0b44'}`, marginBottom: 24 }}>
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: mfaActive ? '#22c55e18' : '#f59e0b18',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>
            {mfaActive ? '🛡️' : '⚠️'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: mfaActive ? '#22c55e' : '#f59e0b' }}>
              {mfaActive ? 'MFA is Active' : 'MFA is Not Enabled'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              {mfaActive
                ? `Authenticator app enrolled. Your account is protected.`
                : 'Your account uses only a password. Enable MFA for additional security.'}
            </div>
          </div>
          {!mfaActive && enrollStep === 'idle' && (
            <button
              onClick={handleStartEnroll}
              disabled={loading}
              className="btn btn-primary"
              style={{ whiteSpace: 'nowrap' }}
            >
              {loading ? 'Starting…' : '+ Enable MFA'}
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div style={{
          marginBottom: 20, padding: '16px 18px', borderRadius: 10, fontSize: 13,
          background: msg.type === 'ok' ? '#22c55e11' : '#ef444411',
          border: `1px solid ${msg.type === 'ok' ? '#22c55e33' : '#ef444433'}`,
          color: msg.type === 'ok' ? '#22c55e' : '#fca5a5',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: msg.type === 'ok' ? '#22c55e' : '#ef4444' }}>
            {msg.type === 'ok' ? '✅ Success' : '❌ Cannot Enable MFA'}
          </div>
          {msg.text}
          {msg.text.includes('Firebase Console') && (
            <div style={{ marginTop: 12 }}>
              <a
                href="https://console.firebase.google.com/project/mfo-crm/authentication/providers"
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 8, color: '#fca5a5', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}
              >
                🔗 Open Firebase Console → Authentication
              </a>
              <div style={{ marginTop: 10, fontSize: 12, color: '#f87171', lineHeight: 1.8 }}>
                <strong>Steps:</strong><br />
                1. Authentication → Sign-in method tab<br />
                2. Scroll to <strong>Advanced</strong> → Multi-factor authentication<br />
                3. Add second factor → <strong>Time-based one-time password (TOTP)</strong><br />
                4. Save → then return here to enroll
              </div>
            </div>
          )}
        </div>
      )}


      {/* Enrollment wizard */}
      {enrollStep !== 'idle' && enrollStep !== 'success' && (
        <div style={sectionStyle}>
          {/* Step indicator */}
          <div style={{ padding: '14px 20px', background: 'var(--bg-canvas)', display: 'flex', gap: 0 }}>
            {[['1','Scan QR','scan'],['2','Verify','verify']].map(([n, label, step], idx) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
                    background: enrollStep === step ? 'var(--brand-500)' : 'var(--bg-elevated)',
                    color: enrollStep === step ? 'white' : 'var(--text-tertiary)',
                    border: `2px solid ${enrollStep === step ? 'var(--brand-500)' : 'var(--border)'}`,
                  }}>{n}</div>
                  <span style={{ fontSize: 13, fontWeight: enrollStep === step ? 700 : 400,
                    color: enrollStep === step ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{label}</span>
                </div>
                {idx < 1 && <div style={{ width: 32, height: 1, background: 'var(--border)', margin: '0 12px' }} />}
              </div>
            ))}
          </div>

          {/* Step 1: Scan QR */}
          {enrollStep === 'scan' && enrollSession && (
            <div style={{ padding: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Scan this QR code</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                Open Google Authenticator, Authy, 1Password, or any TOTP app, then scan this code to add your account.
              </div>

              {/* QR code */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <div style={{ padding: 16, background: 'white', borderRadius: 12, display: 'inline-block', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                  <QRCodeSVG
                    value={enrollSession.qrCodeUrl}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>

              {/* Manual entry */}
              <div style={{ padding: '14px 16px', background: 'var(--bg-canvas)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
                  Can't scan? Enter this key manually in your app:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ flex: 1, fontSize: 13, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.15em', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    {enrollSession.secretKey.match(/.{1,4}/g)?.join(' ') ?? enrollSession.secretKey}
                  </code>
                  <button onClick={copySecret} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid var(--border)', background: copied ? '#22c55e18' : 'var(--bg-elevated)', color: copied ? '#22c55e' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {copied ? '✓ Copied' : 'Copy key'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  Account: {firebaseUser?.email} · Issuer: MFO Nexus · Type: TOTP · Period: 30s
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setEnrollStep('idle')} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button onClick={() => setEnrollStep('verify')} className="btn btn-primary" style={{ flex: 2 }}>
                  I've scanned it — Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Verify */}
          {enrollStep === 'verify' && (
            <div style={{ padding: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Enter verification code</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
                Enter the 6-digit code from your authenticator app to confirm the setup is working correctly.
              </div>

              <OtpInput value={otp} onChange={setOtp} disabled={loading} />

              {/* Timer */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <TotpTimer />
              </div>

              {verifyError && (
                <div style={{ marginTop: 16, padding: '12px 14px', background: '#ef444411', border: '1px solid #ef444433', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>
                  {verifyError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setEnrollStep('scan')} className="btn btn-ghost" style={{ flex: 1 }}>← Back</button>
                <button onClick={handleVerify} disabled={otp.length < 6 || loading} className="btn btn-primary" style={{ flex: 2, opacity: otp.length < 6 ? 0.6 : 1 }}>
                  {loading ? 'Verifying…' : 'Verify & Enable MFA →'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success banner */}
      {enrollStep === 'success' && (
        <div style={{ marginBottom: 20, padding: '20px 24px', background: '#22c55e11', border: '1px solid #22c55e33', borderRadius: 12 }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#22c55e', marginBottom: 6 }}>MFA Successfully Enabled!</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            From now on, you'll need to enter a code from your authenticator app every time you sign in.
            Make sure your authenticator app is backed up or that you have a recovery method.
          </div>
          <button onClick={() => setEnrollStep('idle')} className="btn btn-ghost" style={{ marginTop: 16 }}>Done</button>
        </div>
      )}

      {/* Enrolled factor */}
      {mfaActive && enrollStep !== 'scan' && enrollStep !== 'verify' && (
        <div style={sectionStyle}>
          <div style={sectionHead}>
            <span style={{ fontSize: 15 }}>📱</span>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Enrolled Authenticator</div>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#6366f118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🔑</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Authenticator App (TOTP)</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Enrolled {userProfile?.mfaEnrolledAt ? new Date(userProfile.mfaEnrolledAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'recently'}
                </div>
              </div>
              <button
                onClick={handleUnenroll}
                disabled={loading}
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #ef444444', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { icon: '📲', title: 'Compatible Apps', text: 'Google Authenticator, Authy, 1Password, Bitwarden, Microsoft Authenticator, and any standard TOTP app.' },
          { icon: '🔒', title: 'Security Note', text: 'TOTP codes expire every 30 seconds and work offline. They are never sent over the network.' },
        ].map(card => (
          <div key={card.title} style={{ padding: '16px 18px', background: 'var(--bg-canvas)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{card.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{card.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
