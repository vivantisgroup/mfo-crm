'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getInvitationByToken, acceptInvitation } from '@/lib/tenantMemberService';
import { ensureUserProfile } from '@/lib/platformService';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseApp } from '@mfo-crm/config';
import type { TenantInvitation } from '@/lib/tenantMemberService';

const auth = getAuth(firebaseApp);

function JoinForm() {
  const router = useSearchParams();
  const pushRouter = useRouter();
  const { user } = useAuth();
  
  const inviteId = router?.get('id');
  const token = router?.get('token');

  const [inv, setInv] = useState<TenantInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  
  // Form mode: 'signup' (new user), 'signin' (existing user prompted to login)
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!inviteId || !token) {
      setError('Invalid invite link (missing ID or token).');
      setLoading(false);
      return;
    }

    getInvitationByToken(inviteId, token).then(res => {
      if (!res) {
        setError('Invitation not found or invalid token.');
      } else if (res.status !== 'pending') {
        setError(`This invitation has already been ${res.status}.`);
      } else if (new Date(res.expiresAt) < new Date()) {
        setError('This invitation has expired.');
      } else {
        setInv(res);
      }
      setLoading(false);
    }).catch(err => {
      setError(err.message);
      setLoading(false);
    });
  }, [inviteId, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inv || !auth) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      if (user && user.email === inv.email) {
        // Already logged in as the invited user!
        if (!auth.currentUser) throw new Error("No current user");
        const profile = await ensureUserProfile(auth.currentUser);
        await acceptInvitation(inv, profile);
        pushRouter.push('/');
        return;
      }

      if (mode === 'signup') {
        try {
          // Create new user
          const cred = await createUserWithEmailAndPassword(auth, inv.email, password);
          const profile = await ensureUserProfile(cred.user, name);
          await acceptInvitation(inv, profile);
          pushRouter.push('/');
        } catch (err: any) {
          if (err.code === 'auth/email-already-in-use') {
            setMode('signin');
            setSubmitError('An account with this email already exists. Please sign in to accept the invitation.');
          } else {
            throw err;
          }
        }
      } else {
        // Sign in existing user
        const cred = await signInWithEmailAndPassword(auth, inv.email, password);
        const profile = await ensureUserProfile(cred.user);
        await acceptInvitation(inv, profile);
        pushRouter.push('/');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading invitation...</div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-canvas)' }}>
      <div style={{ width: 400, maxWidth: '90%', background: 'var(--bg-surface)', padding: 32, borderRadius: 16, boxShadow: 'var(--shadow-lg)' }}>
        
        {error ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🚫</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Invitation Unavailable</h1>
            <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          </div>
        ) : inv ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
              <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Join {inv.tenantName}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                You have been invited by <strong>{inv.invitedByName}</strong> to join as a team member.
              </p>
            </div>

            {submitError && (
              <div style={{ background: '#ef44441a', color: '#ef4444', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
                {submitError}
              </div>
            )}

            {user && user.email === inv.email ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: 20, fontSize: 14 }}>
                  You are already logged in as <strong>{user.email}</strong>.
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ width: '100%', height: 44 }}
                >
                  {submitting ? 'Accepting...' : 'Accept Invitation'}
                </button>
              </div>
            ) : user && user.email !== inv.email ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  You are logged in as <strong>{user.email}</strong>, but this invitation is for <strong>{inv.email}</strong>.
                  <br /><br />
                  Please sign out and open this link again.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Email</label>
                  <input className="input" style={{ width: '100%' }} value={inv.email} disabled />
                </div>
                
                {mode === 'signup' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Your Name</label>
                    <input className="input" style={{ width: '100%' }} value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Password</label>
                  <input className="input" style={{ width: '100%' }} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6} />
                </div>

                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', height: 44, marginTop: 8 }}>
                  {submitting ? 'Please wait...' : mode === 'signup' ? 'Create Account & Join' : 'Sign In & Join'}
                </button>

                {mode === 'signin' && (
                  <button type="button" onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: 'var(--brand-400)', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
                    Need to create a new account? Click here.
                  </button>
                )}
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <JoinForm />
    </Suspense>
  );
}
