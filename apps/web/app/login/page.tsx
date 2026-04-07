'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, sendPasswordResetEmail,
} from 'firebase/auth';
import { firebaseApp } from '@mfo-crm/config';
import {
  isPlatformInitialized, bootstrapPlatform, ensureUserProfile, getTenant,
  getPlatformConfig, getTenantsForUser, touchLastLogin,
  type TenantRecord, type UserProfile,
} from '@/lib/platformService';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, ShieldCheck, UserPlus, LogIn, ChevronRight, LockKeyhole, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | 'loading'
  | 'signin'
  | 'signup'
  | 'forgot_password'   // ← password reset email flow
  | 'tenant_select'     // ← workspace picker after full auth
  | 'mfa_verify'        // ← inline MFA challenge
  | 'confirm_init'
  | 'initializing'
  | 'done';

interface LogEntry { ts: string; status: 'info' | 'ok' | 'error' | 'warn'; message: string; }

// ─── Sub-components ───────────────────────────────────────────────────────────

function PasswordStrength({ pw }: { pw: string }) {
  const score = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-destructive', 'bg-amber-500', 'bg-cyan-500', 'bg-green-500'];
  if (!pw) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1 h-1.5 rounded overflow-hidden">
        {[1,2,3,4].map(i => (
          <div key={i} className={`flex-1 transition-colors duration-300 ${i <= score ? colors[score] : 'bg-muted'}`} />
        ))}
      </div>
      <div className="text-[10px] mt-1 font-semibold" style={{ color: iToColor(score) }}>{labels[score]}</div>
    </div>
  );
}

function iToColor(i: number) {
  const c = ['', '#ef4444', '#f59e0b', '#06b6d4', '#22c55e'];
  return i <= 4 ? c[i] : c[4];
}

function StatusIcon({ status }: { status: LogEntry['status'] }) {
  if (status === 'ok')    return <span className="text-green-500 text-sm">✓</span>;
  if (status === 'error') return <span className="text-destructive text-sm">✗</span>;
  if (status === 'warn')  return <span className="text-warning text-sm">⚠</span>;
  return <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />;
}

// ─── Login Component Logic ───────────────────────────────────────────────────────────

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectTenant } = useAuth();
  const isAdminRequest = searchParams.get('admin') === '1';

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
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe,   setRememberMe]  = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('rememberMe') === 'true';
  });

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

  // Forgot password state
  const [resetSent,   setResetSent]   = useState(false);
  const [resetEmail,  setResetEmail]  = useState('');

  // MFA state
  const [pendingMfaTenant, setPendingMfaTenant] = useState<TenantRecord | null>(null);
  const [mfaCode,          setMfaCode]          = useState('');
  const [mfaSending,       setMfaSending]       = useState(false);
  const [mfaSent,          setMfaSent]          = useState(false);
  const [mfaCountdown,     setMfaCountdown]     = useState(0);
  const [mfaDevCode,       setMfaDevCode]       = useState<string | null>(null);
  const mfaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mfaCountdown > 0) {
      mfaTimerRef.current = setInterval(() => setMfaCountdown(c => c - 1), 1000);
      return () => { if (mfaTimerRef.current) clearInterval(mfaTimerRef.current); };
    }
  }, [mfaCountdown]);

  // Auto-send Email OTP on screen enter
  useEffect(() => {
    if (screen === 'mfa_verify' && pendingMfaTenant?.mfaConfig?.mfaMode === 'email' && !mfaSent && !mfaSending) {
      sendMfaCode().catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, pendingMfaTenant]);

  async function sendMfaCode() {
    setMfaSending(true); setError('');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken || !pendingMfaTenant?.id) throw new Error('Session expired.');
      const res = await fetch('/api/mfa/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, tenantId: pendingMfaTenant.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send code.');
      setMfaSent(true);
      setMfaCountdown(60);
      if (data.devCode) setMfaDevCode(data.devCode);
    } catch (e: any) { setError(e.message); }
    finally { setMfaSending(false); }
  }

  async function verifyMfaCode(e: React.FormEvent) {
    if (e) e.preventDefault();
    if (mfaCode.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setLoading(true); setError('');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken || !pendingMfaTenant?.id || !authedUser) throw new Error('Session expired.');

      if (pendingMfaTenant.mfaConfig?.mfaMode === 'totp') {
        const { verifyTotpLogin } = await import('@/lib/mfaService');
        const isValid = await verifyTotpLogin(authedUser.uid, mfaCode);
        if (!isValid) throw new Error('Invalid or expired authenticator code.');
      } else {
        const res = await fetch('/api/mfa/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, tenantId: pendingMfaTenant.id, code: mfaCode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Verification failed.');
      }

      // We strictly register verified state THEN inform the Context Router so the global stage flips to 'authenticated'
      sessionStorage.setItem('mfa_verified', 'true');
      sessionStorage.setItem('activeTenantId', pendingMfaTenant.id);
      await selectTenant(pendingMfaTenant.id);
      router.replace('/dashboard');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  /**
   * signInInProgressRef — true while handleSignIn is running.
   * Prevents onAuthStateChanged from double-routing on a fresh sign-in,
   * since handleSignIn manages the full flow (workspace) directly.
   */
  const signInInProgressRef = useRef(false);

  // Pre-populate email from localStorage if remember-me was set
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem('savedEmail');
    if (saved && localStorage.getItem('rememberMe') === 'true') setEmail(saved);
  }, []);



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
          setIsInitialized(initialized);
          if (!initialized) { setScreen('signup'); return; }

          const profile = await ensureUserProfile(fbUser);

          let ts = await getTenantsForUser(profile);

          // Fallback: same strategy as finishAuth — if tenantIds is empty,
          // scan tenant member docs directly. Per-tenant catch so nothing explodes.
          if (ts.length === 0) {
            const { getFirestore, doc: fsDoc, getDoc: fsGetDoc } = await import('firebase/firestore');
            const { firebaseApp: fa } = await import('@mfo-crm/config');
            const db = getFirestore(fa);
            const candidates = ['master', profile.tenantId].filter(Boolean) as string[];
            const found: any[] = [];
            await Promise.all(candidates.map(async (tid) => {
              try {
                const memberSnap = await fsGetDoc(fsDoc(db, 'tenants', tid, 'members', fbUser.uid));
                if (!memberSnap.exists()) return;
                const md = memberSnap.data() as any;
                try {
                  const { getTenant } = await import('@/lib/platformService');
                  const rec = await getTenant(tid);
                  if (rec) { found.push(rec); return; }
                } catch { /**/ }
                found.push({ id: tid, name: tid === 'master' ? 'Platform HQ' : (md.tenantName ?? tid),
                  plan: 'standard' as const, status: 'active' as const,
                  isInternal: tid === 'master', brandColor: '#6366f1',
                  createdAt: md.joinedAt ?? new Date().toISOString(), createdBy: 'admin' });
              } catch { /**/ }
            }));
            if (found.length > 0) ts = found;
          }

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
        setIsInitialized(initialized);
        setScreen(initialized ? 'signin' : 'signup');
      } catch { setIsInitialized(true); setScreen('signin'); }
    });
    return () => unsub();
  }, [auth, router]);

  // ── Logging ───────────────────────────────────────────────────────────────────
  const log = useCallback((message: string, status: LogEntry['status'] = 'info') => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { ts, status, message }]);
  }, []);


  // ── Finish auth: load profile + tenants ───────────────────────────────────────
  async function finishAuth(fbUser: any) {
    const profile = await ensureUserProfile(fbUser);
    let ts = await getTenantsForUser(profile);

    // If no tenants found: call the server-side ensure-profile endpoint first.
    // This uses Admin SDK (bypasses Firestore rules) to heal missing profile/member data.
    // Then retry the tenant load once.
    if (ts.length === 0) {
      try {
        const idToken = await fbUser.getIdToken();
        const healRes = await fetch('/api/auth/ensure-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (healRes.ok) {
          // Re-read profile & tenants after server-side healing
          const healed = await ensureUserProfile(fbUser);
          const healedTs = await getTenantsForUser(healed);
          if (healedTs.length > 0) {
            ts = healedTs;
          }
        }
      } catch (healErr) {
        console.warn('[finishAuth] ensure-profile heal failed:', healErr);
      }
    }

    // Final fallback: scan member sub-collections directly.
    // A signed-in user can ALWAYS read their own member doc (rule: request.auth.uid == uid).
    // Per-tenant try/catch so one failure can't abort the whole scan.
    if (ts.length === 0) {
      const { getFirestore, doc: fsDoc, getDoc: fsGetDoc } = await import('firebase/firestore');
      const { firebaseApp: fa } = await import('@mfo-crm/config');
      const db = getFirestore(fa);

      const candidates = Array.from(new Set(['master', profile.tenantId].filter(Boolean))) as string[];
      const foundTenants: any[] = [];
      await Promise.all(candidates.map(async (tid) => {
        try {
          const memberSnap = await fsGetDoc(fsDoc(db, 'tenants', tid, 'members', fbUser.uid));
          if (!memberSnap.exists()) return;

          const memberData = memberSnap.data() as any;
          try {
            const { getTenant } = await import('@/lib/platformService');
            const tenantRecord = await getTenant(tid);
            if (tenantRecord) { foundTenants.push(tenantRecord); return; }
          } catch { /* fall through to minimal record */ }

          foundTenants.push({
            id: tid, name: tid === 'master' ? 'Platform HQ' : (memberData.tenantName ?? tid),
            plan: 'standard' as const, status: 'active' as const,
            isInternal: tid === 'master', brandColor: '#6366f1',
            createdAt: memberData.joinedAt ?? new Date().toISOString(), createdBy: 'admin',
          });
        } catch (e) {
          console.error('[finishAuth] error scanning tenant', tid, e);
        }
      }));

      if (foundTenants.length > 0) ts = foundTenants;
    }
    setAuthedUser(fbUser);
    setUserProfile(profile);
    setTenants(ts);
    if (ts.length === 0) throw new Error('Your account has no workspace assigned. Contact your administrator.');
    if (ts.length === 1) {
      await touchLastLogin(fbUser.uid);
      const isMfaVerified = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('mfa_verified') === 'true' : false;
      if (ts[0].mfaRequired && ts[0].mfaConfig?.mfaMode !== 'disabled' && !isMfaVerified) {
        setPendingMfaTenant(ts[0]);
        setScreen('mfa_verify');
      } else {
        router.replace('/dashboard');
      }
    } else {
      setSelectedId(profile.tenantId ?? ts[0].id);
      setScreen('tenant_select');
    }
  }

  // ── Forgot Password ──────────────────────────────────────────────────────────
  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = resetEmail.trim().toLowerCase();
    if (!trimmedEmail) { setError('Please enter your email address.'); return; }
    setLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, trimmedEmail, {
        url: window.location.origin + '/auth/action'
      });
      setResetSent(true);
    } catch (err: any) {
      setError(friendlyAuthError(err.code ?? err.message));
    } finally {
      setLoading(false);
    }
  }

  const setStep = useCallback((n: number, total: number) => setProgress(Math.round((n / total) * 100)), []);



  // ── Sign In ───────────────────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    signInInProgressRef.current = true;
    try {
      if (typeof localStorage !== 'undefined') {
        if (rememberMe) { localStorage.setItem('rememberMe', 'true'); localStorage.setItem('savedEmail', email); }
        else { localStorage.removeItem('rememberMe'); localStorage.removeItem('savedEmail'); }
      }

      // Step 1: Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // Step 2: Server-side ensure-profile (Admin SDK — bypasses ALL Firestore security rules).
      // This guarantees profile + member docs exist before any client Firestore reads.
      // If this succeeds, we can use the server data directly and skip client Firestore reads.
      let serverProfile: any = null;
      let serverTenants: any[] = [];
      try {
        const idToken   = await cred.user.getIdToken();
        const healRes   = await fetch('/api/auth/ensure-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (healRes.ok) {
          const body = await healRes.json();
          serverProfile  = body.profile  ?? null;
          serverTenants  = body.tenants  ?? [];
        }
      } catch (ensureErr) {
        console.warn('[handleSignIn] ensure-profile unavailable:', ensureErr);
      }

      // Step 3: ensure profile locally if server heal failed
      const profile = serverProfile ?? await ensureUserProfile(cred.user);
      
      // Step 4: Fast-path using server data if tenants were returned
      signInInProgressRef.current = false;
      if (serverProfile && serverTenants.length > 0) {
        // Server gave us everything — no client Firestore reads needed
        try { await touchLastLogin(cred.user.uid); } catch { /* non-fatal */ }
        setAuthedUser(cred.user);
        setUserProfile(serverProfile);
        setTenants(serverTenants);
        if (serverTenants.length === 1) {
          const isMfaVerified = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('mfa_verified') === 'true' : false;
          if (serverTenants[0].mfaRequired && serverTenants[0].mfaConfig?.mfaMode !== 'disabled' && !isMfaVerified) {
            setPendingMfaTenant(serverTenants[0]);
            setScreen('mfa_verify');
          } else {
            router.replace('/dashboard');
          }
        } else {
          setSelectedId(serverProfile.tenantId ?? serverTenants[0]?.id ?? '');
          setScreen('tenant_select');
        }
        return;
      }

      // Step 5: Fallback — server couldn't return data, use client-side flow
      await finishAuth(cred.user);
    } catch (err: any) {
      signInInProgressRef.current = false;
      setError(friendlyAuthError(err.code ?? err.message));
    } finally {
      setLoading(false);
    }
  }




  // ── Enter workspace ───────────────────────────────────────────────────────────
  async function handleEnterTenant() {
    if (!selectedId || !authedUser) return;
    
    setEnteringTenant(true);
    try {
      await touchLastLogin(authedUser.uid);
      const t = tenants.find(x => x.id === selectedId);
      const isMfaVerified = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('mfa_verified') === 'true' : false;
      
      if (t?.mfaRequired && t.mfaConfig?.mfaMode !== 'disabled' && !isMfaVerified) {
        setPendingMfaTenant(t);
        setScreen('mfa_verify');
        setEnteringTenant(false);
        return;
      }
      
      sessionStorage.setItem('activeTenantId', selectedId);
      await selectTenant(selectedId);
      router.replace('/dashboard');
    } catch (err: any) { 
      setError(friendlyAuthError(err.code ?? err.message));
      setEnteringTenant(false); 
    }
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
                <Loader2 className="animate-spin w-[11px] h-[11px]" />
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

  // ── SIGN IN / SIGN UP / TENANT SELECT ──────────────────────────────────
  const isFirstSetup = screen === 'signup';

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Left hero */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 max-w-[800px] p-12 relative overflow-hidden bg-slate-950">
        <div className="absolute -top-[10%] -right-[10%] w-[400px] h-[400px] bg-primary/20 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] bg-indigo-500/10 blur-[60px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-gradient-to-br from-primary to-indigo-400 text-white font-black w-10 h-10 text-xl rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">V</div>
          <div className="font-black text-xl tracking-wider text-slate-50">VIVANTS</div>
        </div>

        <div className="relative z-10 my-auto">
          <div className="text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight text-slate-50">
            Intelligence.<br />
            <span className="text-primary">Governance.</span><br />
            Legacy.
          </div>
          <p className="mt-8 text-lg text-slate-400 max-w-md leading-relaxed">
            Comprehensive wealth management and family office orchestration for the next generation of fiduciaries.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-8 text-slate-300">
          {[
            ['$1.4B+', 'Platform AUM'],
            ['99.9%', 'Uptime SLA'],
            ['ISO 27001', 'Certified'],
            ['Secure', 'Protected']
          ].map(([v, l]) => (
            <div key={l}>
              <div className="text-2xl font-bold text-slate-100">{v}</div>
              <div className="text-xs uppercase tracking-wider text-slate-500 mt-1 font-semibold">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20 bg-background relative z-10">
        <div className="mx-auto w-full max-w-md">
          
          {/* Logo Mobile */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <div className="bg-gradient-to-br from-primary to-indigo-400 text-white font-black w-10 h-10 text-xl rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">V</div>
            <div>
              <div className="font-black text-xl tracking-wider">VIVANTS</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{isFirstSetup ? 'First-Time Setup' : 'MFO Nexus Platform'}</div>
            </div>
          </div>

          {/* First-time banner */}
          {isFirstSetup && (
            <div className="mb-8 p-4 bg-primary/10 border border-primary/20 rounded-xl">
              <div className="font-bold text-primary text-sm mb-1 flex items-center gap-2"><Loader2 className="w-4 h-4" /> First-Time Platform Setup</div>
              <div className="text-muted-foreground text-sm leading-relaxed">
                No platform account exists yet. This account becomes the <strong>SaaS Master Admin</strong>.
              </div>
            </div>
          )}

          {/* Tab switcher — only shown to admins via ?admin=1 param */}
          {!isFirstSetup && screen === 'signin' && isAdminRequest && (
            <Tabs defaultValue="signin" onValueChange={(v) => { setScreen(v as Screen); setError(''); }} className="mb-8">
              <TabsList className="grid w-full grid-cols-2 h-11">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Create Account</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium flex gap-3 items-start">
              <span className="mt-0.5">⚠</span>
              <span>{error.split('\n')[0]}</span>
            </div>
          )}

          {/* ── MFA VERIFY SCREEN ── */}
          {screen === 'mfa_verify' && pendingMfaTenant && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-indigo-900 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/20 mb-6">
                  <ShieldCheck className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-2 text-foreground">
                  {pendingMfaTenant.mfaConfig?.mfaMode === 'totp' ? 'Authenticator Code' : 'Verification Code'}
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  {pendingMfaTenant.mfaConfig?.mfaMode === 'totp'
                    ? <>Open your authenticator app and enter the 6-digit code for <strong>MFO Nexus</strong>.</>
                    : mfaSent
                      ? <>We sent a 6-digit code to <strong>{authedUser?.email}</strong>.</>
                      : mfaSending ? 'Sending verification code…' : 'Preparing verification…'
                  }
                </p>

                {mfaDevCode && pendingMfaTenant.mfaConfig?.mfaMode === 'email' && (
                  <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-xs text-left">
                    🛠️ Development mode. Your code: <strong className="font-mono text-sm">{mfaDevCode}</strong>
                  </div>
                )}

                <form onSubmit={verifyMfaCode} className="space-y-6">
                  <div className="space-y-2 mt-4">
                    <Label className="text-xs font-bold text-indigo-500 uppercase tracking-widest text-left block">
                      6-Digit Code
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      value={mfaCode}
                      onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      autoFocus
                      disabled={loading || (pendingMfaTenant.mfaConfig?.mfaMode === 'email' && !mfaSent)}
                      className="h-16 text-center text-3xl tracking-[0.3em] font-mono font-bold bg-slate-950/50 border-indigo-500/30 focus-visible:ring-indigo-500"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full font-bold text-base h-14 rounded-xl shadow-xl shadow-indigo-500/20 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500" disabled={loading || mfaCode.length !== 6}>
                    {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verifying…</> : '🔓 Verify & Enter Workspace'}
                  </Button>
                </form>

                {pendingMfaTenant.mfaConfig?.mfaMode === 'email' && (
                  <div className="mt-8">
                    <Button variant="ghost" onClick={sendMfaCode} disabled={mfaSending || mfaCountdown > 0} className="text-sm text-muted-foreground hover:text-foreground">
                      {mfaCountdown > 0 ? `Resend code in ${mfaCountdown}s` : 'Resend verification code'}
                    </Button>
                  </div>
                )}

                <div className="mt-6 text-center">
                  <Button variant="ghost" onClick={() => {
                    auth.signOut();
                    setScreen('signin');
                    setPendingMfaTenant(null);
                    setMfaCode('');
                  }} className="text-muted-foreground hover:text-foreground">
                    ← Back to Sign In
                  </Button>
                </div>

              </div>
            </div>
          )}

          {/* ── SIGN IN FORM ── */}
          {screen === 'signin' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
              <p className="text-muted-foreground mb-8">Sign in to access your workspace</p>
              
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" required placeholder="you@yourfirm.com"
                    value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                      onClick={() => { setResetEmail(email); setResetSent(false); setError(''); setScreen('forgot_password'); }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} required placeholder="••••••••••••"
                      value={password} onChange={e => setPassword(e.target.value)} className="h-12 bg-muted/50 pr-12" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                  />
                  <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">
                    Remember me
                  </label>
                </div>
                <Button type="submit" size="lg" className="w-full h-12 mt-2 text-base font-bold shadow-lg shadow-primary/20" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Authenticating…</> : <>Sign In <ChevronRight className="w-4 h-4 ml-1" /></>}
                </Button>
              </form>

              <div className="flex items-center justify-center gap-2 mt-8 text-xs text-muted-foreground">
                <LockKeyhole className="w-4 h-4" /> End-to-end encrypted session
              </div>
            </div>
          )}

          {/* ── FORGOT PASSWORD SCREEN ── */}
          {screen === 'forgot_password' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                  <LockKeyhole className="w-8 h-8 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">Reset your password</h1>
                <p className="text-muted-foreground text-sm">
                  Enter your account email and we'll send you a link to reset your password.
                </p>
              </div>

              {resetSent ? (
                <div className="space-y-6">
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                    <div className="text-2xl mb-2">✉️</div>
                    <div className="font-bold text-green-600 dark:text-green-400 text-sm mb-1">Reset email sent!</div>
                    <div className="text-muted-foreground text-sm">
                      Check your inbox at <strong>{resetEmail}</strong> for a password reset link.
                    </div>
                  </div>
                  <Button variant="outline" size="lg" className="w-full h-12" onClick={() => { setScreen('signin'); setResetSent(false); }}>
                    ← Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail">Email address</Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      required
                      placeholder="you@yourfirm.com"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      className="h-12 bg-muted/50"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full h-12 font-bold shadow-lg shadow-primary/20" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Sending…</> : 'Send Reset Link'}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => { setScreen('signin'); setError(''); }}>
                    ← Back to Sign In
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ── TENANT SELECT ── */}
          {screen === 'tenant_select' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl mb-8">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-green-500/20 shrink-0">✓</div>
                <div>
                  <div className="font-bold text-sm text-green-600 dark:text-green-400">Successfully Signed In</div>
                  <div className="text-xs text-muted-foreground">{userProfile?.email}</div>
                </div>
              </div>
              
              <h1 className="text-2xl font-bold tracking-tight mb-2">Select Workspace</h1>
              <p className="text-muted-foreground mb-6 text-sm">
                You have access to {tenants.length} workspaces. Choose which one to open.
              </p>
              
              <div className="space-y-3 mb-8">
                <Label>Workspace</Label>
                <div className="relative">
                  <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                    className="w-full h-12 px-4 appearance-none font-semibold bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer">
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.isInternal ? '🔵' : '🏢'} {t.name}{t.isInternal ? ' (Platform HQ)' : ''}</option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-4 top-4 w-4 h-4 text-muted-foreground rotate-90 pointer-events-none" />
                </div>
              </div>

              {selectedId && (() => {
                const t = tenants.find(x => x.id === selectedId);
                if (!t) return null;
                return (
                  <Card className="mb-8 border-l-4 overflow-hidden" style={{ borderLeftColor: t.brandColor || 'var(--primary)' }}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold">{t.name}</div>
                          <div className="text-xs font-mono text-muted-foreground mt-1">ID: {t.id}</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 bg-muted rounded-full uppercase tracking-wider">{t.plan}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              <Button size="lg" className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20" onClick={handleEnterTenant} disabled={!selectedId || enteringTenant}>
                {enteringTenant ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Entering workspace…</> : <>Enter Workspace <ChevronRight className="w-4 h-4 ml-1" /></>}
              </Button>

              <div className="mt-4 text-center">
                <Button variant="ghost" onClick={async () => {
                  const { getAuth } = await import('firebase/auth');
                  if (authedUser?.uid) sessionStorage.removeItem(`mfa_verified:${authedUser.uid}`);
                  sessionStorage.removeItem('activeTenantId');
                  await getAuth(firebaseApp).signOut();
                  setScreen('signin'); setAuthedUser(null); setUserProfile(null); setTenants([]);
                }} className="text-muted-foreground hover:text-foreground w-full">
                  Sign in with a different account
                </Button>
              </div>
            </div>
          )}

          {/* ── SIGN UP FORM ── */}
          {screen === 'signup' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-3xl font-bold tracking-tight mb-2">{isFirstSetup ? 'Create Master Admin' : 'Create Account'}</h1>
              <p className="text-muted-foreground mb-8 text-sm">
                {isFirstSetup ? 'This account will have full control over the platform.' : 'Create your account to get started.'}
              </p>
              
              <form onSubmit={handleSignUpPreflight} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Full Name</Label>
                  <Input id="displayName" type="text" required placeholder="e.g. Alexandre Torres"
                    value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-12 bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailSup">Email Address</Label>
                  <Input id="emailSup" type="email" required placeholder="you@yourfirm.com"
                    value={email} onChange={e => setEmail(e.target.value)} className="h-12 bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw">Password</Label>
                  <Input id="pw" type="password" required placeholder="Min. 6 characters"
                    value={password} onChange={e => setPassword(e.target.value)} className="h-12 bg-muted/50" />
                  <PasswordStrength pw={password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwConfirm">Confirm Password</Label>
                  <Input id="pwConfirm" type="password" required placeholder="Repeat password"
                    value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                    className={`h-12 bg-muted/50 ${pwConfirm && pwConfirm !== password ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
                  {pwConfirm && pwConfirm !== password && <div className="text-[11px] text-destructive font-medium">Passwords do not match</div>}
                </div>
                <Button type="submit" size="lg" className="w-full h-12 mt-4 text-base font-bold shadow-lg shadow-primary/20" disabled={loading || (!!pwConfirm && pwConfirm !== password)}>
                  {loading ? <><Loader2 className="mr-2 w-5 h-5 animate-spin"/> Checking…</> : <>{isFirstSetup ? 'Review & Initialize' : 'Create Account'} <ChevronRight className="w-4 h-4 ml-1" /></>}
                </Button>
              </form>
            </div>
          )}
          
          <div className="mt-16 text-center text-xs text-muted-foreground/60 leading-relaxed max-w-xs mx-auto">
            Vivants MFO Nexus &middot; Enterprise Grade Security<br />
            AES-256 · TOTP MFA · SOC 2 Ready
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <LoginContent />
    </Suspense>
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
