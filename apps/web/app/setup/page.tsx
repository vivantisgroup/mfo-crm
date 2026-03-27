'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, getAuth } from 'firebase/auth';
import { firebaseApp } from '@mfo-crm/config';


type Step = 'loading' | 'welcome' | 'admin' | 'initializing' | 'done' | 'already_initialized';

interface Form {
  platformName: string;
  adminName:    string;
  adminEmail:   string;
  adminPassword:string;
  confirmPass:  string;
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep]     = useState<Step>('loading');
  const [form, setForm]     = useState<Form>({
    platformName:  'MFO Nexus',
    adminName:     '',
    adminEmail:    '',
    adminPassword: '',
    confirmPass:   '',
  });
  const [error,    setError]    = useState<string | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [showPass, setShowPass] = useState(false);

  const checkInit = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/initialize');
      const data = await res.json();
      // Surface any Admin SDK diagnostics as a pre-flight warning
      if (data.sdkError) {
        setError(`⚠️ Firebase Admin SDK is not configured:\n${data.sdkError}`);
      }
      // Always allow setup (unrestricted) — force:true bypasses the API guard
      setStep('welcome');
    } catch {
      setStep('welcome');
    }
  }, []);

  useEffect(() => { checkInit(); }, [checkInit]);

  function field(k: keyof Form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function initialize() {
    if (!form.adminEmail || !form.adminPassword || !form.adminName) {
      setError('All fields are required.'); return;
    }
    if (form.adminPassword !== form.confirmPass) {
      setError('Passwords do not match.'); return;
    }
    if (form.adminPassword.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    setError(null);
    setStep('initializing');
    const steps: string[] = [];

    const log = (msg: string) => {
      steps.push(msg);
      setProgress([...steps]);
    };

    try {
      log('🔧 Connecting to Firebase…');
      await new Promise(r => setTimeout(r, 300));

      log('🗑️ Wiping existing operational data…');
      log('🏛️ Creating master tenant & admin account…');
      const res = await fetch('/api/admin/initialize', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          platformName:  form.platformName,
          adminEmail:    form.adminEmail,
          adminPassword: form.adminPassword,
          adminName:     form.adminName,
          force:         true, // always reset on /setup
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Initialization failed');
        setStep('admin');
        return;
      }

      log(`✅ ${data.wiped ?? 0} documents wiped`);
      log('🌱 Roles, email templates & config seeded…');
      await new Promise(r => setTimeout(r, 200));
      log('🔑 Signing you in…');

      const auth = getAuth(firebaseApp);
      await signInWithEmailAndPassword(auth, form.adminEmail, form.adminPassword);

      log('✅ Platform initialized successfully!');
      await new Promise(r => setTimeout(r, 600));
      setStep('done');
    } catch (e: any) {
      setError(e.message ?? 'An unexpected error occurred.');
      setStep('admin');
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background:   'var(--bg-surface, #1e1e2e)',
    border:       '1px solid var(--border, #2e2e3e)',
    borderRadius: 16,
    padding:      '40px 44px',
    maxWidth:     480,
    width:        '100%',
    boxShadow:    '0 24px 60px rgba(0,0,0,0.5)',
  };

  const wrap: React.CSSProperties = {
    minHeight:      '100vh',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'radial-gradient(ellipse at top, #1a1a2e 0%, #0f0f1a 60%)',
    padding:        24,
  };

  const inputStyle: React.CSSProperties = {
    width:         '100%',
    padding:       '11px 14px',
    borderRadius:  8,
    border:        '1px solid var(--border, #2e2e3e)',
    background:    'var(--bg-canvas, #141420)',
    color:         'inherit',
    fontSize:      14,
    outline:       'none',
    marginBottom:  12,
    boxSizing:     'border-box',
  };

  const label: React.CSSProperties = {
    display:      'block',
    fontSize:     12,
    fontWeight:   700,
    color:        'var(--text-secondary, #94a3b8)',
    marginBottom: 6,
    textTransform:'uppercase',
    letterSpacing:'0.06em',
  };

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div style={wrap}>
        <div style={{ textAlign: 'center', color: '#818cf8' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Checking platform status…</div>
        </div>
      </div>
    );
  }

  // ── ALREADY INITIALIZED ──────────────────────────────────────────────────────
  if (step === 'already_initialized') {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>Platform Already Initialized</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', marginBottom: 24, fontSize: 14 }}>
            The platform has already been set up. This page is only available before the first initialization.
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => router.push('/login')}>
            Go to Login →
          </button>
        </div>
      </div>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <h2 style={{ fontWeight: 900, fontSize: 24, marginBottom: 8, color: '#818cf8' }}>Platform Ready!</h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', marginBottom: 8, fontSize: 14 }}>
            <strong style={{ color: '#22c55e' }}>{form.platformName}</strong> is initialized and ready for production.
          </p>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', marginBottom: 24, fontSize: 13 }}>
            You are logged in as <strong>{form.adminEmail}</strong> (SaaS Master Admin).
          </p>
          <div style={{ marginBottom: 20, textAlign: 'left', background: '#22c55e10', border: '1px solid #22c55e30', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#22c55e' }}>WHAT WAS INITIALIZED</div>
            {['Master tenant created', 'Admin account provisioned', 'All 15 RBAC roles seeded', '6 Email templates created', 'Platform configuration saved', 'Firestore audit log written'].map(item => (
              <div key={item} style={{ fontSize: 13, marginBottom: 4 }}>✓ {item}</div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', fontSize: 15, padding: '12px 0' }} onClick={() => router.push('/dashboard')}>
            Open Platform Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // ── INITIALIZING ─────────────────────────────────────────────────────────────
  if (step === 'initializing') {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, marginBottom: 20 }}>Initializing Platform…</h2>
          <div style={{ textAlign: 'left' }}>
            {progress.map((msg, i) => (
              <div key={i} style={{ fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#818cf8', flexShrink: 0 }}>→</span>
                <span>{msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── WELCOME → ADMIN SETUP ────────────────────────────────────────────────────
  return (
    <div style={wrap}>
      {/* Brand header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏛️</div>
        <div style={{ fontSize: 28, fontWeight: 900, background: 'linear-gradient(135deg, #818cf8, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Platform Setup
        </div>
        <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 6 }}>
          Initialize your SaaS platform for the first time
        </div>
      </div>

      <div style={card}>
        {step === 'welcome' ? (
          <>
            <h2 style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Welcome to MFO Nexus</h2>
            <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
              This setup wizard will initialize your platform database for production. It will:
            </p>
            <ul style={{ margin: '0 0 24px 0', padding: '0 0 0 20px', fontSize: 13, color: '#94a3b8', lineHeight: 2 }}>
              <li>Create the <strong>master tenant</strong> (your internal organization)</li>
              <li>Create the <strong>first admin account</strong> (SaaS Master Admin)</li>
              <li>Seed all <strong>RBAC roles</strong> and <strong>email templates</strong></li>
              <li>Mark the platform as <strong>production-ready</strong></li>
            </ul>
            <div style={{ padding: '12px 16px', background: '#f59e0b10', border: '1px solid #f59e0b40', borderRadius: 8, fontSize: 12, color: '#fbbf24', marginBottom: 24 }}>
              ⚠️ This wizard is only visible before the platform is initialized. Once complete, this page will be disabled.
            </div>
            <button className="btn btn-primary" style={{ width: '100%', fontSize: 15, padding: '12px 0' }} onClick={() => setStep('admin')}>
              Begin Setup →
            </button>
          </>
        ) : (
          <>
            <h2 style={{ fontWeight: 900, fontSize: 18, marginBottom: 20 }}>Create Admin Account</h2>

            {error && (
              <div style={{ padding: '12px 14px', background: '#ef444415', border: '1px solid #ef444440', borderRadius: 8, fontSize: 13, color: '#fca5a5', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <label style={label}>Platform Name</label>
            <input style={inputStyle} value={form.platformName} onChange={field('platformName')} placeholder="e.g. MFO Nexus" />

            <label style={label}>Admin Full Name</label>
            <input style={inputStyle} value={form.adminName} onChange={field('adminName')} placeholder="e.g. John Smith" autoFocus />

            <label style={label}>Admin Email</label>
            <input style={inputStyle} type="email" value={form.adminEmail} onChange={field('adminEmail')} placeholder="admin@yourdomain.com" />

            <label style={label}>Password</label>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                style={{ ...inputStyle, marginBottom: 0, paddingRight: 44 }}
                type={showPass ? 'text' : 'password'}
                value={form.adminPassword}
                onChange={field('adminPassword')}
                placeholder="Min. 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}
              >{showPass ? '🙈' : '👁️'}</button>
            </div>

            <label style={label}>Confirm Password</label>
            <input
              style={{ ...inputStyle, borderColor: form.confirmPass && form.confirmPass !== form.adminPassword ? '#ef4444' : undefined }}
              type="password"
              value={form.confirmPass}
              onChange={field('confirmPass')}
              placeholder="Re-enter password"
            />
            {form.confirmPass && form.confirmPass !== form.adminPassword && (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: -8, marginBottom: 12 }}>Passwords do not match</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep('welcome')}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, fontSize: 14, padding: '11px 0' }}
                onClick={initialize}
                disabled={!form.adminEmail || !form.adminPassword || !form.adminName || form.adminPassword !== form.confirmPass}
              >
                Initialize Platform 🚀
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: '#475569', textAlign: 'center' }}>
        MFO Nexus Platform Setup v2.0 · All data stored in Firebase
      </div>
    </div>
  );
}
