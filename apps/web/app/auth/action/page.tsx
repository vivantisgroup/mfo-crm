'use client';
/**
 * /auth/action — Custom Firebase Auth action handler
 *
 * Handles Firebase email action links (password reset, email verification, etc.)
 * instead of the default unstyled Firebase UI at mfo-crm.firebaseapp.com/__/auth/action
 *
 * To activate: Firebase Console → Authentication → Email templates →
 *   Action URL → change to: https://your-domain.com/auth/action
 *
 * Query params (from Firebase):
 *   mode     = resetPassword | verifyEmail | recoverEmail | signIn
 *   oobCode  = one-time action code
 *   apiKey   = Firebase API key (auto-populated)
 *   lang     = locale (optional)
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  getAuth,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
} from 'firebase/auth';
import { firebaseApp } from '@mfo-crm/config';
import { Eye, EyeOff, LockKeyhole, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

// ── Sub-components ──────────────────────────────────────────────────────────────

function PasswordStrength({ pw }: { pw: string }) {
  const score = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ef4444', '#f59e0b', '#38bdf8', '#22c55e'];
  if (!pw) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, height: 4, borderRadius: 99, overflow: 'hidden' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, borderRadius: 99, background: i <= score ? (colors[score] ?? '#6366f1') : 'var(--border)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors[score] ?? 'var(--text-tertiary)', marginTop: 4 }}>
        {labels[score]}
      </div>
    </div>
  );
}

// ── Reset Password Screen ───────────────────────────────────────────────────────

function ResetPasswordScreen({ oobCode }: { oobCode: string }) {
  const router     = useRouter();
  const auth       = getAuth(firebaseApp);

  const [email,     setEmail]     = useState('');
  const [pw,        setPw]        = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [status,    setStatus]    = useState<'verifying' | 'ready' | 'saving' | 'done' | 'error'>('verifying');
  const [error,     setError]     = useState('');

  useEffect(() => {
    verifyPasswordResetCode(auth, oobCode)
      .then(email => { setEmail(email); setStatus('ready'); })
      .catch(() => { setStatus('error'); setError('This password reset link has expired or already been used. Please request a new one.'); });
  }, [auth, oobCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (pw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (pw !== pwConfirm) { setError('Passwords do not match.'); return; }

    setStatus('saving');
    try {
      await confirmPasswordReset(auth, oobCode, pw);
      setStatus('done');
      // Auto-redirect to login after 3 seconds
      setTimeout(() => router.replace('/login'), 3000);
    } catch (err: any) {
      setStatus('error');
      setError(err.message ?? 'Failed to reset password. The link may have expired.');
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
          background: 'linear-gradient(135deg, var(--brand-500), #818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 30px var(--brand-500)44',
        }}>
          <LockKeyhole size={32} color="white" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
          {status === 'done' ? 'Password Updated!' : 'Set New Password'}
        </h1>
        {email && status !== 'done' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
            for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
          </p>
        )}
      </div>

      {/* Status: verifying */}
      {status === 'verifying' && (
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
          Verifying link…
        </div>
      )}

      {/* Status: error */}
      {status === 'error' && (
        <div style={{ padding: '16px 20px', background: '#ef444415', border: '1px solid #ef444430', borderRadius: 12, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 4, fontSize: 14 }}>Link Invalid</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{error}</div>
            </div>
          </div>
          <button
            onClick={() => router.push('/login?screen=forgot_password')}
            style={{ marginTop: 16, width: '100%', padding: '11px', borderRadius: 10, background: 'var(--bg-overlay)',
              border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
          >
            Request New Reset Link
          </button>
        </div>
      )}

      {/* Status: done */}
      {status === 'done' && (
        <div style={{ padding: '20px 24px', background: '#22c55e15', border: '1px solid #22c55e30', borderRadius: 12, textAlign: 'center' }}>
          <CheckCircle2 size={40} color="#22c55e" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 16, marginBottom: 6 }}>Password reset successfully!</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>You can now sign in with your new password. Redirecting in 3 seconds…</div>
          <button
            onClick={() => router.push('/login')}
            style={{ marginTop: 20, padding: '12px 28px', borderRadius: 10, background: 'var(--brand-500)',
              border: 'none', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
          >
            Sign In Now →
          </button>
        </div>
      )}

      {/* Status: ready or saving */}
      {(status === 'ready' || status === 'saving') && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{ padding: '12px 16px', background: '#ef444415', border: '1px solid #ef444430', borderRadius: 10,
              color: '#ef4444', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={e => setPw(e.target.value)}
                required
                autoFocus
                placeholder="Enter a strong password"
                style={{ width: '100%', padding: '13px 44px 13px 16px', fontSize: 14,
                  borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, lineHeight: 0 }}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <PasswordStrength pw={pw} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Confirm Password
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              value={pwConfirm}
              onChange={e => setPwConfirm(e.target.value)}
              required
              placeholder="Repeat your new password"
              style={{ width: '100%', padding: '13px 16px', fontSize: 14,
                borderRadius: 10, background: 'var(--bg-elevated)', border: `1px solid ${pwConfirm && pwConfirm !== pw ? '#ef4444' : 'var(--border)'}`,
                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
            />
            {pwConfirm && pwConfirm !== pw && (
              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Passwords don't match</div>
            )}
          </div>

          <button
            type="submit"
            disabled={status === 'saving' || !pw || !pwConfirm}
            style={{
              padding: '15px', fontSize: 15, fontWeight: 700, borderRadius: 12, border: 'none',
              background: 'var(--brand-500)', color: 'white', cursor: status === 'saving' ? 'not-allowed' : 'pointer',
              opacity: status === 'saving' || !pw || !pwConfirm ? 0.7 : 1,
              boxShadow: '0 4px 12px var(--brand-500)44',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {status === 'saving'
              ? <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</>
              : 'Set New Password'}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Email Verification Screen ───────────────────────────────────────────────────

function VerifyEmailScreen({ oobCode }: { oobCode: string }) {
  const router = useRouter();
  const auth   = getAuth(firebaseApp);
  const [status, setStatus] = useState<'verifying' | 'done' | 'error'>('verifying');
  const [error,  setError]  = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    applyActionCode(auth, oobCode)
      .then(() => setStatus('done'))
      .catch(err => { setStatus('error'); setError(err.message ?? 'Verification failed.'); });
  }, [auth, oobCode]);

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
        background: status === 'done' ? '#22c55e22' : 'var(--bg-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${status === 'done' ? '#22c55e44' : 'var(--border)'}`,
      }}>
        {status === 'verifying' ? <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--brand-500)' }} />
         : status === 'done'    ? <CheckCircle2 size={28} color="#22c55e" />
                                : <AlertCircle  size={28} color="#ef4444" />}
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 12px' }}>
        {status === 'verifying' ? 'Verifying your email…'
         : status === 'done'    ? 'Email Verified!'
                                : 'Verification Failed'}
      </h1>

      {status === 'done' && (
        <>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>Your email address has been verified successfully.</p>
          <button onClick={() => router.push('/login')} style={{ padding: '13px 32px', borderRadius: 10, background: 'var(--brand-500)', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            Go to Sign In →
          </button>
        </>
      )}
      {status === 'error' && (
        <>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>{error}</p>
          <button onClick={() => router.push('/login')} style={{ padding: '13px 32px', borderRadius: 10, background: 'var(--bg-overlay)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            Back to Sign In
          </button>
        </>
      )}
    </div>
  );
}

// ── Main Action Handler ─────────────────────────────────────────────────────────

function AuthActionContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const mode         = searchParams.get('mode') ?? '';
  const oobCode      = searchParams.get('oobCode') ?? '';

  if (!oobCode || !mode) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <AlertCircle size={40} style={{ margin: '0 auto 16px', color: '#f59e0b' }} />
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, marginBottom: 8 }}>Invalid Link</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>This link is invalid or incomplete.</p>
        <button onClick={() => router.push('/login')}
          style={{ marginTop: 20, padding: '12px 24px', borderRadius: 10, background: 'var(--brand-500)', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <>
      {mode === 'resetPassword' && <ResetPasswordScreen oobCode={oobCode} />}
      {mode === 'verifyEmail'   && <VerifyEmailScreen   oobCode={oobCode} />}
      {mode === 'recoverEmail'  && <VerifyEmailScreen   oobCode={oobCode} />}
      {!['resetPassword', 'verifyEmail', 'recoverEmail'].includes(mode) && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Unknown action: {mode}</p>
        </div>
      )}
    </>
  );
}

export default function AuthActionPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <header style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--brand-500), #818cf8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 900, fontSize: 16, boxShadow: '0 4px 12px var(--brand-500)44',
        }}>V</div>
        <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>VIVANTS</div>
      </header>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <Suspense fallback={
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto 12px', display: 'block' }} />
            Loading…
          </div>
        }>
          <AuthActionContent />
        </Suspense>
      </div>

      {/* Footer */}
      <footer style={{ padding: '16px 32px', borderTop: '1px solid var(--border)', textAlign: 'center',
        fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
        VIVANTS MFO NEXUS PLATFORM · SECURE SESSION
      </footer>
    </div>
  );
}
