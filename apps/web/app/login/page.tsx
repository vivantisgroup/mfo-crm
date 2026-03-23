'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

import { useRouter } from 'next/navigation';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { firebaseApp } from '@mfo-crm/config';
import {
  isPlatformInitialized, bootstrapPlatform, ensureUserProfile, getTenant,
  getPlatformConfig, getTenantsForUser, touchLastLogin,
  type TenantRecord, type UserProfile,
} from '@/lib/platformService';
import { verifyTotpLogin, totpSecondsRemaining } from '@/lib/mfaService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | 'loading'
  | 'signin'
  | 'signup'
  | 'mfa_challenge'     // ← TOTP OTP entry after password OK
  | 'tenant_select'     // ← workspace picker after full auth
  | 'confirm_init'
  | 'initializing'
  | 'done';

interface LogEntry { ts: string; status: 'info' | 'ok' | 'error' | 'warn'; message: string; }

// ─── Sub-components ───────────────────────────────────────────────────────────

function PasswordStrength({ pw }: { pw: string }) {
  const score = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ef4444', '#f59e0b', '#22d3ee', '#22c55e'];
  if (!pw) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? colors[score] : '#1e293b', transition: 'background 0.2s' }} />
        ))}
      </div>
      <div style={{ fontSize: 10, color: colors[score], marginTop: 3, fontWeight: 600 }}>{labels[score]}</div>
    </div>
  );
}

function Spinner({ size = 14 }: { size?: number }) {
  return <div style={{ width: size, height: size, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />;
}

function StatusIcon({ status }: { status: LogEntry['status'] }) {
  if (status === 'ok')    return <span style={{ color: '#22c55e', fontSize: 13 }}>✓</span>;
  if (status === 'error') return <span style={{ color: '#ef4444', fontSize: 13 }}>✗</span>;
  if (status === 'warn')  return <span style={{ color: '#f59e0b', fontSize: 13 }}>⚠</span>;
  return <Spinner size={12} />;
}

// ─── OTP Input — 6 individual digit boxes ────────────────────────────────────

function OtpInput({ value, onChange, disabled, firstRef }: {
  value:     string;
  onChange:  (v: string) => void;
  disabled?: boolean;
  firstRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

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
    const nextFocus = Math.min(pasted.length, 5);
    refs.current[nextFocus]?.focus();
  }

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {[0,1,2,3,4,5].map(i => (
        <input
          key={i}
          ref={el => {
            refs.current[i] = el;
            if (i === 0 && firstRef) (firstRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoComplete="one-time-code"
          style={{
            width: 52, height: 64, textAlign: 'center', fontSize: 26, fontWeight: 800,
            fontFamily: 'ui-monospace, monospace',
            background: value[i] ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.07)',
            border: `2px solid ${value[i] ? '#818cf8' : 'rgba(255,255,255,0.28)'}`,
            borderRadius: 14,
            color: value[i] ? '#ffffff' : 'rgba(255,255,255,0.9)',
            outline: 'none',
            boxShadow: value[i] ? '0 0 0 3px rgba(99,102,241,0.25), inset 0 0 6px rgba(99,102,241,0.15)' : '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'all 0.18s',
            caretColor: 'transparent',
          }}
        />
      ))}
    </div>
  );
}

// ─── TOTP countdown ring ──────────────────────────────────────────────────────

function TotpTimer() {
  const [secs, setSecs] = useState(totpSecondsRemaining());
  useEffect(() => {
    const id = setInterval(() => setSecs(totpSecondsRemaining()), 1000);
    return () => clearInterval(id);
  }, []);
  const pct = secs / 30;
  const r = 12, circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = secs <= 5 ? '#ef4444' : secs <= 10 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 16 }}>
      <svg width={32} height={32} viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={16} cy={16} r={r} fill="none" stroke="var(--border)" strokeWidth={2.5} />
        <circle cx={16} cy={16} r={r} fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s' }} />
      </svg>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        Code refreshes in <strong style={{ color }}>{secs}s</strong>
      </span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const auth   = getAuth(firebaseApp);
  const logRef = useRef<HTMLDivElement>(null);

  // Form state
  const [screen,      setScreen]      = useState<Screen>('loading');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pwConfirm,   setPwConfirm]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // Init flow
  const [logs,        setLogs]        = useState<LogEntry[]>([]);
  const [progress,    setProgress]    = useState(0);
  const [hasExisting, setHasExisting] = useState(false);
  const [exported,    setExported]    = useState(false);
  const [initDone,    setInitDone]    = useState(false);
  const [initError,   setInitError]   = useState('');

  // Tenant select
  const [authedUser,      setAuthedUser]      = useState<any>(null);
  const [userProfile,     setUserProfile]     = useState<UserProfile | null>(null);
  const [tenants,         setTenants]         = useState<TenantRecord[]>([]);
  const [selectedId,      setSelectedId]      = useState('');
  const [enteringTenant,  setEnteringTenant]  = useState(false);

  // MFA challenge state
  const [mfaUid,      setMfaUid]      = useState<string>('');
  const [mfaFbUser,   setMfaFbUser]   = useState<any>(null);
  const [otpCode,     setOtpCode]     = useState('');
  const [mfaError,    setMfaError]    = useState('');
  const [mfaLoading,  setMfaLoading]  = useState(false);
  const [mfaShake,    setMfaShake]    = useState(false);
  const firstOtpRef  = useRef<HTMLInputElement | null>(null);

  /**
   * mfaPassedRef — true after successful TOTP verification.
   * Used by onAuthStateChanged (existing-session case) to avoid re-challenging.
   */
  const mfaPassedRef       = useRef(false);

  /**
   * signInInProgressRef — true while handleSignIn is running.
   * Prevents onAuthStateChanged from double-routing on a fresh sign-in,
   * since handleSignIn manages the full flow (MFA + workspace) directly.
   */
  const signInInProgressRef = useRef(false);

  useEffect(() => { logRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }); }, [logs]);

  // ── Bootstrap: onAuthStateChanged ───────────────────────────────────────────────────────────
  // Handles TWO cases only:
  //  A) Page load with an existing Firebase session (user was already signed in)
  //  B) No user — set screen to signin/signup
  //
  // Does NOT handle fresh sign-ins (case C) — handleSignIn does that directly
  // to avoid async races. signInInProgressRef.current = true while handleSignIn
  // is running, so this observer returns early and stays out of the way.
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async fbUser => {
      if (fbUser) {
        // Case C guard: fresh sign-in is being handled by handleSignIn
        if (signInInProgressRef.current) return;

        // Case A: existing session (page reload / navigating to /login while logged in)
        try {
          const initialized = await isPlatformInitialized();
          if (!initialized) { setScreen('signup'); return; }

          const profile = await ensureUserProfile(fbUser);

          if (profile.mfaEnabled && !mfaPassedRef.current) {
            // MFA not yet verified this mount → show challenge
            setMfaUid(fbUser.uid);
            setMfaFbUser(fbUser);
            setOtpCode('');
            setMfaError('');
            setScreen('mfa_challenge');
            setTimeout(() => firstOtpRef.current?.focus(), 80);
            return;
          }

          // MFA passed or not required — route to workspace
          const ts = await getTenantsForUser(profile);
          setAuthedUser(fbUser);
          setUserProfile(profile);
          setTenants(ts);
          if (ts.length === 0) {
            setScreen('signin');
            setError('Your account has no workspace assigned. Contact your administrator.');
          } else if (ts.length === 1) {
            await touchLastLogin(fbUser.uid);
            router.replace('/dashboard');
          } else {
            setSelectedId(profile.tenantId ?? ts[0]?.id ?? '');
            setScreen('tenant_select');
          }
        } catch { setScreen('signin'); }
        return;
      }

      // Case B: not signed in
      try {
        const initialized = await isPlatformInitialized();
        setScreen(initialized ? 'signin' : 'signup');
      } catch { setScreen('signin'); }
    });
    return () => unsub();
  }, [auth, router]);

  // ── Logging ───────────────────────────────────────────────────────────────────
  const log = useCallback((message: string, status: LogEntry['status'] = 'info') => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { ts, status, message }]);
  }, []);
  const setStep = useCallback((n: number, total: number) => setProgress(Math.round((n / total) * 100)), []);

  // ── Finish auth: load profile + tenants ───────────────────────────────────────
  async function finishAuth(fbUser: any) {
    const profile = await ensureUserProfile(fbUser);
    const ts      = await getTenantsForUser(profile);
    setAuthedUser(fbUser);
    setUserProfile(profile);
    setTenants(ts);
    if (ts.length === 0) throw new Error('Your account has no workspace assigned. Contact your administrator.');
    if (ts.length === 1) {
      await touchLastLogin(fbUser.uid);
      router.replace('/dashboard');
    } else {
      setSelectedId(profile.tenantId ?? ts[0].id);
      setScreen('tenant_select');
    }
  }

  // ── Sign In ───────────────────────────────────────────────────────────────────
  // Handles the COMPLETE fresh sign-in flow:
  // 1. Firebase password auth
  // 2. Profile fetch
  // 3. MFA gate (if enabled) → show challenge screen
  // 4. No MFA → finishAuth → dashboard
  //
  // signInInProgressRef is set to true for the entire duration so
  // onAuthStateChanged returns early and doesn't double-handle.
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    signInInProgressRef.current = true;
    try {
      // Step 1: Firebase auth
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // Step 2: Load profile (onAuthStateChanged is blocked by signInInProgressRef)
      const profile = await ensureUserProfile(cred.user);

      // Step 3: MFA gate
      if (profile.mfaEnabled) {
        setMfaUid(cred.user.uid);
        setMfaFbUser(cred.user);
        setOtpCode('');
        setMfaError('');
        setScreen('mfa_challenge');
        setTimeout(() => firstOtpRef.current?.focus(), 80);
        // signInInProgressRef stays true — cleared by handleMfaVerify or Back button
        return;
      }

      // Step 4: No MFA — proceed
      signInInProgressRef.current = false;
      await finishAuth(cred.user);
    } catch (err: any) {
      signInInProgressRef.current = false;
      setError(friendlyAuthError(err.code ?? err.message));
    } finally {
      setLoading(false);
    }
  }

  // ── MFA: verify TOTP code ─────────────────────────────────────────────────────
  async function handleMfaVerify() {
    if (!mfaUid || otpCode.length < 6 || mfaLoading) return;
    setMfaLoading(true);
    setMfaError('');
    try {
      await verifyTotpLogin(mfaUid, otpCode);
      // Unlock both gates
      mfaPassedRef.current       = true;
      signInInProgressRef.current = false;
      await finishAuth(mfaFbUser);
    } catch (err: any) {
      // Wrong code: show error, shake, clear, refocus
      setMfaError(err.message ?? 'Incorrect code. Try again.');
      setOtpCode('');
      setMfaShake(true);
      setTimeout(() => setMfaShake(false), 600);
      setTimeout(() => firstOtpRef.current?.focus(), 30);
    } finally {
      setMfaLoading(false);
    }
  }

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (screen === 'mfa_challenge' && otpCode.length === 6 && !mfaLoading) {
      handleMfaVerify();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpCode, screen]);

  // ── Enter workspace ───────────────────────────────────────────────────────────
  async function handleEnterTenant() {
    if (!selectedId || !authedUser) return;
    setEnteringTenant(true);
    try {
      await touchLastLogin(authedUser.uid);
      sessionStorage.setItem('activeTenantId', selectedId);
      router.replace('/dashboard');
    } catch { setError('Failed to enter workspace.'); setEnteringTenant(false); }
  }

  // ── Sign Up preflight ─────────────────────────────────────────────────────────
  async function handleSignUpPreflight(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!displayName.trim()) { setError('Please enter your name.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== pwConfirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const cfg = await getPlatformConfig().catch(() => null);
      setHasExisting(!!cfg?.initialized);
      setScreen('confirm_init');
    } catch (err: any) {
      setError(friendlyAuthError(err.code));
    } finally { setLoading(false); }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), note: 'Pre-init export' }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `mfo-platform-meta-${Date.now()}.json`; a.click();
    setExported(true);
  }

  // ── Platform initialization ───────────────────────────────────────────────────
  async function runInitialization() {
    setScreen('initializing'); setLogs([]); setProgress(0); setInitError('');
    const STEPS = 8; let fbUser: any = null;
    try {
      log('Checking Firebase connectivity…'); await new Promise(r => setTimeout(r, 300));
      log('Firebase connection established.', 'ok'); setStep(1, STEPS);
      log('Verifying platform is uninitialized…');
      const alreadyInit = await isPlatformInitialized();
      if (alreadyInit) log('Platform already initialized — overwrite pending.', 'warn');
      else log('Platform is uninitialized. Safe to proceed.', 'ok');
      setStep(2, STEPS);
      log(`Creating Firebase Auth account for ${email}…`);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        fbUser = cred.user;
        await updateProfile(fbUser, { displayName: displayName.trim() });
        log(`Firebase Auth user created — UID: ${fbUser.uid}`, 'ok');
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          log('Email already exists — re-using.', 'warn');
          const cred = await signInWithEmailAndPassword(auth, email, password);
          fbUser = cred.user; log(`Signed in as existing user: ${fbUser.uid}`, 'ok');
        } else throw err;
      }
      setStep(3, STEPS);
      log('Writing Master Tenant record (tenants/master)…'); await new Promise(r => setTimeout(r, 200)); setStep(4, STEPS);
      log('Writing User Profile and Platform Config…');
      log('Committing atomic batch write to Firestore…');
      const profile = await bootstrapPlatform(fbUser, displayName.trim());
      log(`Batch committed. Master Admin: ${profile.displayName} (${profile.role})`, 'ok'); setStep(6, STEPS);
      log('Verifying written documents…');
      const tenant = await getTenant('master');
      if (!tenant) throw new Error('Verification failed: tenants/master not found');
      log(`tenants/master → "${tenant.name}" verified`, 'ok');
      const cfg = await getPlatformConfig();
      if (!cfg?.initialized) throw new Error('platform/config.initialized is false');
      log(`platform/config → initialized: true, version: ${cfg.version}`, 'ok'); setStep(7, STEPS);
      log('Establishing user session…'); await new Promise(r => setTimeout(r, 500)); setStep(8, STEPS);
      log('─────────────────────────────────────────', 'ok');
      log('PLATFORM INITIALIZATION COMPLETE', 'ok');
      log(`SaaS Master Admin: ${profile.displayName} <${profile.email}>`, 'ok');
      log('Redirecting to dashboard…', 'ok');
      setInitDone(true);
      await new Promise(r => setTimeout(r, 2500));
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.message ?? String(err); const code = err?.code ?? '';
      log('─────────────────────────────────────────', 'error');
      log(`INITIALIZATION FAILED: ${msg}`, 'error');
      if (code === 'auth/operation-not-allowed') log('→ Enable Email/Password in Firebase Console → Authentication', 'error');
      else if (code?.includes('permission')) log('→ Firestore rules blocked write. Run: firebase deploy --only firestore', 'warn');
      setInitError(msg);
    }
  }

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 16px', fontSize: 14, borderRadius: 10,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.15s',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
    marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em',
  };
  const btnPrimary = (disabled = false): React.CSSProperties => ({
    background: disabled ? '#4338ca' : 'var(--brand-500)', color: 'white',
    padding: '15px', fontSize: 15, fontWeight: 700, borderRadius: 12, border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer', width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 4px 12px #6366f144', transition: 'background 0.15s', opacity: disabled ? 0.7 : 1,
  });

  // ── LOADING ───────────────────────────────────────────────────────────────────
  if (screen === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center', gap: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #6366f144', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Connecting to platform…</div>
        </div>
      </div>
    );
  }

  // ── INITIALIZING ──────────────────────────────────────────────────────────────
  if (screen === 'initializing') {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 680 }}>
          <div style={{ marginBottom: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏗</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: 0 }}>Platform Initialization</h1>
            <p style={{ color: '#64748b', marginTop: 8, fontSize: 14 }}>Bootstrapping the MFO Nexus platform. Do not close this window.</p>
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Progress</span>
              <span style={{ fontSize: 12, color: progress === 100 ? '#22c55e' : '#6366f1', fontWeight: 700 }}>{progress}%</span>
            </div>
            <div style={{ height: 8, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, transition: 'width 0.5s ease', width: `${progress}%`,
                background: initError ? '#ef4444' : initDone ? '#22c55e' : 'linear-gradient(90deg,#6366f1,#818cf8)' }} />
            </div>
          </div>
          <div ref={logRef} style={{ background: '#080d18', border: '1px solid #1e293b', borderRadius: 12, padding: '16px 20px', height: 320, overflowY: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.8 }}>
            {logs.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#334155', flexShrink: 0 }}>{l.ts}</span>
                <StatusIcon status={l.status} />
                <span style={{ color: l.status === 'ok' ? '#22c55e' : l.status === 'error' ? '#fca5a5' : l.status === 'warn' ? '#fcd34d' : '#94a3b8' }}>{l.message}</span>
              </div>
            ))}
            {!initDone && !initError && logs.length > 0 && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                <span style={{ color: '#334155' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                <Spinner size={11} />
                <span style={{ color: '#475569' }}>Processing…</span>
              </div>
            )}
          </div>
          {initDone && (
            <div style={{ marginTop: 20, padding: '14px 18px', background: '#22c55e11', border: '1px solid #22c55e44', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>✅</div>
              <div style={{ fontWeight: 700, color: '#22c55e', fontSize: 15 }}>Platform initialized successfully!</div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Redirecting to dashboard…</div>
            </div>
          )}
          {initError && (
            <div style={{ marginTop: 20, padding: '14px 18px', background: '#ef444411', border: '1px solid #ef444444', borderRadius: 10 }}>
              <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>❌ Initialization failed</div>
              <div style={{ color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>{initError}</div>
              <button onClick={() => setScreen('signup')} style={{ padding: '8px 20px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>← Back to Setup</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── CONFIRM INIT ──────────────────────────────────────────────────────────────
  if (screen === 'confirm_init') {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: 0 }}>Confirm Platform Initialization</h1>
            <p style={{ color: '#64748b', marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>
              This will create the <strong style={{ color: '#818cf8' }}>SaaS Master Admin</strong> account and initialize the platform database. This is an irreversible event.
            </p>
          </div>
          <div style={{ background: '#080d18', border: '1px solid #1e293b', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#94a3b8', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>What will happen</div>
            {[
              ['Firebase Auth account created', email],
              ['Platform config written', 'platform/config → initialized: true'],
              ['Master tenant created', 'tenants/master → Platform HQ'],
              ['User profile created', 'users/{uid} → role: saas_master_admin'],
              ['MFA setup prompted', 'You will be asked to enable TOTP 2FA after login'],
              ['Session established', 'Redirect to dashboard'],
            ].map(([step, detail]) => (
              <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <span style={{ color: '#6366f1', flexShrink: 0, marginTop: 1 }}>→</span>
                <div>
                  <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{step}</div>
                  <div style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace' }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
          {hasExisting && (
            <div style={{ background: '#f59e0b11', border: '1px solid #f59e0b44', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>⚠ Existing Platform Data Detected</div>
              <div style={{ color: '#fcd34d', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>Export recommended before overwriting.</div>
              <button onClick={handleExport} style={{ padding: '8px 18px', borderRadius: 8, background: '#f59e0b', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {exported ? '✓ Exported' : '⬇ Export Existing Metadata'}
              </button>
            </div>
          )}
          <div style={{ background: '#6366f111', border: '1px solid #6366f144', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
              {displayName.trim()[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 14 }}>{displayName.trim()}</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>{email} · <span style={{ color: '#818cf8' }}>SaaS Master Admin</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setScreen('signup')} style={{ flex: 1, padding: '13px', borderRadius: 10, background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>← Cancel</button>
            <button onClick={runInitialization} disabled={hasExisting && !exported}
              style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', cursor: (hasExisting && !exported) ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, color: 'white', opacity: (hasExisting && !exported) ? 0.5 : 1, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 4px 12px #6366f144' }}>
              🚀 Initialize Platform
            </button>
          </div>
          {hasExisting && !exported && <div style={{ textAlign: 'center', color: '#f59e0b', fontSize: 12, marginTop: 10 }}>Please export the existing metadata before proceeding.</div>}
        </div>
      </div>
    );
  }

  // ── SIGN IN / SIGN UP / MFA / TENANT SELECT ──────────────────────────────────
  const isFirstSetup = screen === 'signup';

  return (
    <div className="login-page">
      {/* Left hero */}
      <div className="login-art" style={{ background: 'linear-gradient(225deg,#0f172a 0%,#020617 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: 400, height: 400, background: 'radial-gradient(circle,var(--brand-500) 0%,transparent 70%)', opacity: 0.1, filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: 300, height: 300, background: 'radial-gradient(circle,#818cf8 0%,transparent 70%)', opacity: 0.05, filter: 'blur(60px)' }} />
        <div className="login-art-title" style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.04em' }}>
          Intelligence.<br /><span style={{ color: 'var(--brand-400)' }}>Governance.</span><br />Legacy.
        </div>
        <p className="login-art-sub" style={{ opacity: 0.6, fontSize: 16, maxWidth: 440, marginTop: 24, lineHeight: 1.6 }}>
          Comprehensive wealth management and family office orchestration for the next generation of fiduciaries.
        </p>
        <div className="login-art-stats" style={{ marginTop: 60, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          {[['$1.4B+','Platform AUM'],['99.9%','Uptime SLA'],['ISO 27001','Certified'],['TOTP MFA','Protected']].map(([v, l]) => (
            <div key={l} className="login-art-stat">
              <div className="login-art-stat-val" style={{ fontSize: 24, fontWeight: 800 }}>{v}</div>
              <div className="login-art-stat-label" style={{ fontSize: 11 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="login-form-col" style={{ background: 'var(--bg-base)' }}>
        <div className="login-form-inner" style={{ minWidth: 420, maxWidth: 480 }}>

          {/* Logo */}
          <div className="login-logo" style={{ marginBottom: 36 }}>
            <div className="login-logo-mark" style={{ background: 'linear-gradient(135deg,var(--brand-500),#818cf8)', color: 'white', fontWeight: 900, width: 48, height: 48, fontSize: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>V</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: '0.05em' }}>VIVANTS</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                {isFirstSetup ? 'First-Time Setup' : screen === 'mfa_challenge' ? 'Two-Factor Auth' : 'MFO NEXUS PLATFORM'}
              </div>
            </div>
          </div>

          {/* First-time banner */}
          {isFirstSetup && (
            <div style={{ padding: '12px 16px', background: '#6366f111', border: '1px solid #6366f144', borderRadius: 10, marginBottom: 24 }}>
              <div style={{ fontWeight: 700, color: 'var(--brand-400)', marginBottom: 4, fontSize: 13 }}>🏗 First-Time Platform Setup</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
                No platform account exists yet. This account becomes the <strong>SaaS Master Admin</strong>.
              </div>
            </div>
          )}

          {/* Tab switcher */}
          {!isFirstSetup && screen === 'signin' && (
            <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, marginBottom: 28, gap: 3 }}>
              {(['signin', 'signup'] as const).map(m => (
                <button key={m} onClick={() => { setScreen(m); setError(''); }}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
                    fontWeight: screen === m ? 700 : 500,
                    background: screen === m ? 'var(--bg-surface)' : 'transparent',
                    color: screen === m ? 'var(--brand-400)' : 'var(--text-secondary)',
                    boxShadow: screen === m ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s' }}>
                  {m === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: '#ef444411', border: '1px solid #ef444466', color: '#fca5a5', padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
              <strong style={{ color: '#ef4444' }}>⚠ {error.split('\n')[0]}</strong>
            </div>
          )}

          {/* ── MFA CHALLENGE SCREEN ── */}
          {screen === 'mfa_challenge' && (
            <div className="animate-fade-in">
              {/* Shield icon */}
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
                  boxShadow: '0 8px 32px #6366f144',
                }}>🔐</div>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Verification Required</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                  Open your authenticator app and enter the 6-digit<br />
                  code for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                </p>
              </div>

              {/* OTP input — shake on wrong code */}
              <div style={{
                animation: mfaShake ? 'mfa-shake 0.5s ease' : 'none',
              }}>
                <OtpInput value={otpCode} onChange={v => { setMfaError(''); setOtpCode(v); }} disabled={mfaLoading} firstRef={firstOtpRef} />
              </div>

              {/* TOTP timer */}
              <TotpTimer />

              {/* Error */}
              {mfaError && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: '#ef444411', border: '1px solid #ef444433', borderRadius: 10, fontSize: 13, color: '#fca5a5', textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span>❌</span> {mfaError}
                </div>
              )}

              {/* Verify button */}
              <button
                id="mfa-verify-btn"
                onClick={handleMfaVerify}
                disabled={otpCode.length < 6 || mfaLoading}
                style={{ ...btnPrimary(otpCode.length < 6 || mfaLoading), marginTop: 24 }}
              >
                {mfaLoading ? <><Spinner /> Verifying…</> : '✓ Verify Code'}
              </button>


              {/* Back to Sign In — signs out Firebase so password must be re-entered */}
              <button
                onClick={async () => {
                  signInInProgressRef.current = false;
                  setOtpCode('');
                  setMfaError('');
                  setMfaUid('');
                  setMfaFbUser(null);
                  mfaPassedRef.current = false;
                  // Sign out Firebase so onAuthStateChanged fires with null user
                  // and the sign-in form is shown cleanly
                  await auth.signOut();
                }}
                style={{ width: '100%', marginTop: 12, padding: '11px', background: 'none', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                ← Back to Sign In
              </button>

              <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--bg-canvas)', borderRadius: 10, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Supported apps:</strong><br />
                Google Authenticator · Authy · 1Password · Bitwarden · Microsoft Authenticator
              </div>
            </div>
          )}

          {/* ── SIGN IN FORM ── */}
          {screen === 'signin' && (
            <div className="animate-fade-in">
              <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Welcome back</h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 28, fontSize: 14 }}>Sign in to access your workspace</p>
              <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={labelStyle}>Email address</label>
                  <input type="email" autoComplete="email" required placeholder="you@yourfirm.com"
                    value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <label style={{ ...labelStyle, margin: 0 }}>Password</label>
                    <a href="#" style={{ fontSize: 12, color: 'var(--brand-400)' }}>Forgot password?</a>
                  </div>
                  <input type="password" autoComplete="current-password" required placeholder="••••••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
                </div>
                <button type="submit" id="sign-in-btn" disabled={loading} style={btnPrimary(loading)}>
                  {loading ? <><Spinner /> Authenticating…</> : 'Sign In →'}
                </button>
              </form>
              {/* MFA hint */}
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-canvas)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 16 }}>🔐</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  If MFA is enabled, you'll be prompted for your authenticator code after sign-in.
                </span>
              </div>
            </div>
          )}

          {/* ── TENANT SELECT ── */}
          {screen === 'tenant_select' && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#22c55e0f', border: '1px solid #22c55e33', borderRadius: 10, marginBottom: 24 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>✓</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#22c55e' }}>Signed In</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{userProfile?.email}</div>
                </div>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Select Workspace</h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
                You have access to {tenants.length} workspaces. Choose which one to open.
              </p>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Workspace</label>
                <select id="tenant-select" value={selectedId} onChange={e => setSelectedId(e.target.value)}
                  style={{ ...inputStyle, fontWeight: 600, cursor: 'pointer', appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236366f1' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 40 }}>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.isInternal ? '🔵' : '🏢'} {t.name}{t.isInternal ? ' (Platform HQ)' : ''}{t.status === 'trial' ? ' — Trial' : ''}</option>
                  ))}
                </select>
              </div>
              {selectedId && (() => {
                const t = tenants.find(x => x.id === selectedId);
                if (!t) return null;
                const statusColors: Record<string, string> = { active: '#22c55e', trial: '#f59e0b', suspended: '#94a3b8' };
                return (
                  <div style={{ padding: '14px 16px', background: 'var(--bg-elevated)', border: `1px solid ${t.brandColor ?? '#6366f1'}44`, borderLeft: `3px solid ${t.brandColor ?? '#6366f1'}`, borderRadius: 10, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>ID: <code style={{ fontSize: 11 }}>{t.id}</code></div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: `${statusColors[t.status] ?? '#6366f1'}18`, color: statusColors[t.status] ?? '#6366f1' }}>{t.status}</span>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 16 }}>
                      <span>📋 {t.plan}</span>
                      <span>{t.isInternal ? '🔐 Internal Platform' : '🏢 Client Workspace'}</span>
                    </div>
                  </div>
                );
              })()}
              <button id="enter-workspace-btn" onClick={handleEnterTenant} disabled={!selectedId || enteringTenant} style={btnPrimary(!selectedId || enteringTenant)}>
                {enteringTenant ? <><Spinner /> Entering workspace…</> : 'Enter Workspace →'}
              </button>
              <button onClick={async () => {
                  const { getAuth } = await import('firebase/auth');
                  const fb = getAuth(firebaseApp);
                  // Clear MFA session so next user is properly challenged
                  if (authedUser?.uid) sessionStorage.removeItem(`mfa_verified:${authedUser.uid}`);
                  sessionStorage.removeItem('activeTenantId');
                  fb.signOut();
                  setScreen('signin'); setAuthedUser(null); setUserProfile(null); setTenants([]);
                }}
                style={{ width: '100%', marginTop: 10, padding: '11px', background: 'none', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                ← Sign in with a different account
              </button>
            </div>
          )}

          {/* ── SIGN UP FORM ── */}
          {screen === 'signup' && (
            <div className="animate-fade-in">
              <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{isFirstSetup ? 'Create Master Admin' : 'Create Account'}</h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 28, fontSize: 14 }}>
                {isFirstSetup ? 'This account will have full control over the platform.' : 'Create your account to get started.'}
              </p>
              <form onSubmit={handleSignUpPreflight} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input type="text" autoComplete="name" required placeholder="e.g. Alexandre Torres"
                    value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" autoComplete="email" required placeholder="you@yourfirm.com"
                    value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" autoComplete="new-password" required placeholder="Min. 6 characters"
                    value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
                  <PasswordStrength pw={password} />
                </div>
                <div>
                  <label style={labelStyle}>Confirm Password</label>
                  <input type="password" autoComplete="new-password" required placeholder="Repeat password"
                    value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                    style={{ ...inputStyle, borderColor: pwConfirm && pwConfirm !== password ? '#ef4444' : undefined }} />
                  {pwConfirm && pwConfirm !== password && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Passwords do not match</div>}
                </div>
                <button type="submit" disabled={loading || (!!pwConfirm && pwConfirm !== password)} style={btnPrimary(loading)}>
                  {loading ? <><Spinner /> Checking…</> : isFirstSetup ? 'Review & Initialize →' : 'Create Account →'}
                </button>
              </form>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 40, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', opacity: 0.5, lineHeight: 1.8 }}>
            Vivants MFO Nexus · Firebase Auth · TOTP MFA · AES-256 Encrypted
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Auth error mapper ────────────────────────────────────────────────────────

function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/user-not-found': case 'auth/wrong-password': case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/weak-password':        return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':        return 'Please enter a valid email address.';
    case 'auth/too-many-requests':    return 'Too many failed attempts. Please wait a few minutes.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    case 'auth/user-disabled':        return 'This account has been suspended.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled.\n→ Firebase Console → Authentication → Sign-in method → Email/Password → Enable';
    default: return `Authentication error (${code || 'unknown'}).`;
  }
}
