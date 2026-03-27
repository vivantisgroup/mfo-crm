'use client';

/**
 * /change-password — Shown automatically after first login when mustChangePassword === true.
 *
 * On submit:
 *   1. Re-authenticates the user with their current (temp) password
 *   2. Updates their Firebase Auth password
 *   3. Clears the mustChangePassword flag in Firestore
 *   4. Redirects to /dashboard
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { firebaseApp } from '@mfo-crm/config';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';

const db = getFirestore(firebaseApp);

function strength(p: string) {
  let s = 0;
  if (p.length >= 8)  s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s; // 0-5
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
const STRENGTH_COLORS = ['', '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#10b981'];

export default function ChangePasswordPage() {
  const router   = useRouter();
  const { firebaseUser, userProfile } = useAuth();
  const auth     = getAuth(firebaseApp);

  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);

  const str = strength(next);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (next.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    if (!firebaseUser) {
      setError('Not authenticated. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      // 1. Re-authenticate with the temp password
      const credential = EmailAuthProvider.credential(firebaseUser.email!, current);
      await reauthenticateWithCredential(firebaseUser, credential);

      // 2. Update to the new password
      await updatePassword(firebaseUser, next);

      // 3. Clear the mustChangePassword flag
      if (userProfile?.uid) {
        await updateDoc(doc(db, 'users', userProfile.uid), {
          mustChangePassword: false,
          status:             'active',
        });
      }

      // 4. Navigate to MFA enrollment if required, otherwise go to dashboard
      const nextPath = userProfile?.mfaEnrollRequired ? '/mfa-enroll' : '/dashboard';
      router.push(nextPath);
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Incorrect current password. Please enter the temporary password you received by email.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Choose at least 8 characters with a mix of letters and numbers.');
      } else if (code === 'auth/requires-recent-login') {
        setError('Session has expired. Please sign out and sign in again with your temporary password.');
      } else {
        setError(err.message ?? 'Something went wrong. Please try again.');
      }
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#0f0f17',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>

      {/* ── Left branding panel ─────────────────────────────────────────────── */}
      <div style={{
        width: '38%',
        minHeight: '100vh',
        background: 'linear-gradient(155deg, #6366f1 0%, #4f46e5 45%, #1e1b4b 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background texture circles */}
        <div style={{
          position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', top: '-20%', right: '-20%', width: 400, height: 400,
            borderRadius: '50%', background: 'rgba(255,255,255,0.04)',
          }} />
          <div style={{
            position: 'absolute', bottom: '-15%', left: '-15%', width: 300, height: 300,
            borderRadius: '50%', background: 'rgba(255,255,255,0.04)',
          }} />
          <div style={{
            position: 'absolute', top: '40%', left: '10%', width: 200, height: 200,
            borderRadius: '50%', background: 'rgba(255,255,255,0.03)',
          }} />
        </div>

        {/* Logo mark */}
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.25)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, marginBottom: 48, flexShrink: 0,
        }}>
          🔐
        </div>

        <div style={{ color: 'white' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 12 }}>
            Secure Access
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: '0 0 16px', lineHeight: 1.15 }}>
            Set Your<br />Password
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8, margin: '0 0 40px' }}>
            Your account was created by an administrator with a temporary password. Set a personal password to secure your access.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '📧', text: 'Enter the password from your welcome email' },
              { icon: '🔒', text: 'Choose a strong personal password' },
              { icon: '✅', text: 'Access your workspace immediately' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                }}>
                  {icon}
                </div>
                <span style={{ fontSize: 13, opacity: 0.85 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: 32, left: 48, right: 48, opacity: 0.4, fontSize: 11 }}>
          <div style={{ color: 'white' }}>MFO Nexus Platform · Secure Onboarding</div>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: 460 }}>

          {/* Card */}
          <div style={{
            background: '#1a1a2e',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
          }}>
            {/* Top accent bar */}
            <div style={{ height: 3, background: 'linear-gradient(90deg,#6366f1,#818cf8,#a5b4fc)' }} />

            <div style={{ padding: '36px 36px 32px' }}>

              {/* Title */}
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>
                  Create Your Password
                </h2>
                <p style={{ fontSize: 13, color: '#8892b0', margin: 0, lineHeight: 1.5 }}>
                  Use the temporary password from your welcome email, then choose a new one.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* Current (temp) password */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700,
                    color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
                  }}>
                    Temporary Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCur ? 'text' : 'password'}
                      value={current}
                      onChange={e => setCurrent(e.target.value)}
                      placeholder="From your welcome email"
                      required
                      autoFocus
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#0f0f1a',
                        border: '1px solid rgba(99,102,241,0.3)',
                        borderRadius: 10, padding: '12px 44px 12px 16px',
                        fontSize: 14, color: '#e2e8f0',
                        outline: 'none', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={e => (e.target.style.borderColor = '#6366f1')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(99,102,241,0.3)')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCur(v => !v)}
                      style={{
                        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#6b7280', fontSize: 14, padding: 0, lineHeight: 1,
                      }}
                    >
                      {showCur ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700,
                    color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
                  }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={next}
                      onChange={e => setNext(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#0f0f1a',
                        border: `1px solid ${next.length > 0 ? STRENGTH_COLORS[str] + '60' : 'rgba(99,102,241,0.3)'}`,
                        borderRadius: 10, padding: '12px 44px 12px 16px',
                        fontSize: 14, color: '#e2e8f0',
                        outline: 'none', transition: 'border-color 0.2s',
                      }}
                      onFocus={e => (e.target.style.borderColor = '#6366f1')}
                      onBlur={e => (e.target.style.borderColor = next.length > 0 ? (STRENGTH_COLORS[str] + '60') : 'rgba(99,102,241,0.3)')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(v => !v)}
                      style={{
                        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#6b7280', fontSize: 14, padding: 0, lineHeight: 1,
                      }}
                    >
                      {showNew ? '🙈' : '👁'}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {next.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1,2,3,4,5].map(i => (
                          <div key={i} style={{
                            flex: 1, height: 3, borderRadius: 4,
                            background: i <= str ? STRENGTH_COLORS[str] : 'rgba(255,255,255,0.1)',
                            transition: 'background 0.2s',
                          }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: STRENGTH_COLORS[str], fontWeight: 600 }}>
                        {STRENGTH_LABELS[str]}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700,
                    color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
                  }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: '#0f0f1a',
                      border: `1px solid ${confirm && next !== confirm ? '#ef4444' : confirm && next === confirm ? '#22c55e60' : 'rgba(99,102,241,0.3)'}`,
                      borderRadius: 10, padding: '12px 16px',
                      fontSize: 14, color: '#e2e8f0',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                  />
                  {confirm && next !== confirm && (
                    <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Passwords don't match</div>
                  )}
                  {confirm && next === confirm && next.length >= 8 && (
                    <div style={{ fontSize: 12, color: '#22c55e', marginTop: 4 }}>✓ Passwords match</div>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div style={{
                    padding: '12px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5',
                  }}>
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !current || next.length < 8 || next !== confirm}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: (loading || !current || next.length < 8 || next !== confirm)
                      ? 'rgba(99,102,241,0.4)'
                      : 'linear-gradient(135deg, #6366f1, #818cf8)',
                    color: 'white', fontSize: 15, fontWeight: 800,
                    cursor: (loading || !current || next.length < 8 || next !== confirm) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: (loading || !current || next.length < 8 || next !== confirm)
                      ? 'none'
                      : '0 8px 24px rgba(99,102,241,0.4)',
                  }}
                >
                  {loading ? '⏳ Setting password…' : '🔐 Set Password & Continue →'}
                </button>

              </form>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#4b5563', marginTop: 20 }}>
            Having trouble? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
