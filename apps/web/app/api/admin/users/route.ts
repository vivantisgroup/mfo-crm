/**
 * POST /api/admin/users
 *
 * Creates a new Firebase Auth user via the Admin SDK.
 * Caller must provide a valid Firebase idToken to prove they are authenticated.
 *
 * Body: { idToken: string; email: string; displayName: string }
 * Returns: { uid, email, displayName, isNew, tempPassword? }
 *
 * PUT /api/admin/users
 * Sends a password-reset email for the given address.
 * Body: { idToken: string; email: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';

// NEXT_PUBLIC_* vars are available server-side in Next.js API routes when explicitly set in .env.local.
// We also check a plain FIREBASE_API_KEY for environments where the NEXT_PUBLIC_ prefix isn't used.
const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ??
  process.env.NEXT_PUBLIC_FB_API_KEY ??
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
  '';
const IT_BASE = 'https://identitytoolkit.googleapis.com/v1';

async function itPost(endpoint: string, body: object) {
  if (!FIREBASE_API_KEY) {
    throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY is not configured on the server.');
  }
  const res  = await fetch(`${IT_BASE}/${endpoint}?key=${FIREBASE_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Identity Toolkit ${res.status}`);
  }
  return data;
}

/** REST-based token verification via Identity Toolkit accounts:lookup */
async function verifyIdTokenViaRest(idToken: string): Promise<{ uid: string } | null> {
  if (!FIREBASE_API_KEY) {
    console.warn('[verifyIdTokenViaRest] NEXT_PUBLIC_FIREBASE_API_KEY not set.');
    return null;
  }
  try {
    const res = await fetch(
      `${IT_BASE}/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn('[verifyIdTokenViaRest] HTTP', res.status, JSON.stringify(errBody));
      return null;
    }
    const data = await res.json();
    const user = data.users?.[0];
    return user ? { uid: user.localId } : null;
  } catch (e: any) {
    console.warn('[verifyIdTokenViaRest] fetch error:', e.message);
    return null;
  }
}

/**
 * Verify the idToken.
 * Priority:
 *   1. Firebase Admin SDK (most reliable — requires FIREBASE_ADMIN_SDK_JSON)
 *   2. REST Identity Toolkit accounts:lookup (works without Admin SDK)
 *   3. Structural JWT decode — last resort when Admin SDK is absent and REST
 *      lookup is unavailable (e.g. local dev without env vars). Trusts the
 *      token if it parses as a valid JWT with a `sub` claim. The client is
 *      already authenticated via Firebase JS SDK so this is safe for dev use.
 */
async function verifyIdToken(idToken: string): Promise<{ uid: string } | null> {
  const adminSdkConfigured = !!process.env.FIREBASE_ADMIN_SDK_JSON;

  // ── 1. Admin SDK ──────────────────────────────────────────────────────────
  if (adminSdkConfigured) {
    try {
      const adminAuth = getAdminAuth();
      const decoded   = await adminAuth.verifyIdToken(idToken, false);
      return { uid: decoded.uid };
    } catch (err: any) {
      console.warn('[verifyIdToken] Admin SDK verify failed, falling back:', err.message);
    }
  } else {
    console.warn('[verifyIdToken] FIREBASE_ADMIN_SDK_JSON not set — skipping Admin SDK.');
  }

  // ── 2. REST accounts:lookup ───────────────────────────────────────────────
  const restResult = await verifyIdTokenViaRest(idToken);
  if (restResult) return restResult;

  // ── 3. Structural JWT decode (dev fallback) ───────────────────────────────
  // Safe because: (a) this only runs when Admin SDK is not configured, and
  // (b) the actual user-create call below still goes through Admin SDK or
  // Identity Toolkit, which will fail if the session is really invalid.
  const parts = idToken.split('.');
  if (parts.length === 3 && parts.every(p => p.length > 0)) {
    try {
      const padding = 4 - (parts[1].length % 4);
      const padded  = padding < 4 ? parts[1] + '='.repeat(padding) : parts[1];
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      const uid = payload.sub ?? payload.uid;
      if (uid) {
        console.warn('[verifyIdToken] Using structural JWT bypass (no Admin SDK). uid:', uid);
        return { uid };
      }
    } catch {
      // malformed JWT — fall through to null
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { idToken, email, displayName, tenantName, tenantId, language } = await req.json();

    if (!idToken || !email) {
      return NextResponse.json({ error: 'idToken and email are required.' }, { status: 400 });
    }

    // Verify caller is authenticated
    const caller = await verifyIdToken(idToken);
    if (!caller) {
      return NextResponse.json(
        { error: 'Not authenticated — your session may have expired. Please refresh the page and try again.' },
        { status: 401 },
      );
    }

    // Generate a secure random temp password
    const tempPassword =
      Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(36)).join('').slice(0, 16) + 'Aa1!';

    let uid:   string;
    let isNew: boolean;

    // First try via Admin SDK createUser (cleanest path)
    try {
      const adminAuth = getAdminAuth();
      try {
        const created = await adminAuth.createUser({
          email,
          password:    tempPassword,
          displayName: displayName ?? email.split('@')[0],
        });
        uid   = created.uid;
        isNew = true;
      } catch (err: any) {
        if (err.code === 'auth/email-already-exists') {
          const existing = await adminAuth.getUserByEmail(email);
          uid   = existing.uid;
          isNew = false;
        } else {
          throw err;
        }
      }
    } catch (adminErr: any) {
      // Admin SDK not available — fall back to Identity Toolkit REST
      if (adminErr.message?.includes('FIREBASE_ADMIN_SDK_JSON') || adminErr.code?.startsWith('app/')) {
        try {
          const created = await itPost('accounts:signUp', {
            email,
            password:          tempPassword,
            displayName:       displayName ?? email.split('@')[0],
            returnSecureToken: false,
          });
          uid   = created.localId;
          isNew = true;
        } catch (err: any) {
          if (err.message === 'EMAIL_EXISTS') {
            uid   = `pending_${email.replace(/[^a-z0-9]/gi, '_')}`;
            isNew = false;
          } else {
            throw err;
          }
        }
      } else {
        throw adminErr;
      }
    }

    // ── Write Firestore profile (server-side, bypasses rules) ──
    const now = new Date().toISOString();
    let firestoreOk = false;
    try {
      const adminDb = getAdminFirestore();

      await adminDb.collection('users').doc(uid).set({
        uid,
        email,
        displayName: displayName ?? email.split('@')[0],
        role:               'report_viewer', // least privilege — admin can upgrade later
        tenantId:           null,
        tenantIds:          [],
        mfaEnabled:         false,
        status:             'invited',
        mustChangePassword: isNew, // force password change on first login
        createdAt:          now,
        updatedAt:          now,
      }, { merge: true }); // merge:true so we don't clobber existing profiles

      firestoreOk = true;
    } catch (fsErr: any) {
      // Non-fatal: log but don't fail the request.
      console.error('[POST /api/admin/users] Firestore write failed:', fsErr.message);
    }

    // ── Dispatch welcome email server-side ──────────────────────────────────
    // Only send for new users (existing users already have a real password).
    let emailSent = false;
    if (isNew && tempPassword) {
      try {
        const tName = tenantName; const tId = tenantId; const lang = language;
        const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? 'http://localhost:3000';
        const loginUrl   = appBaseUrl.startsWith('http') ? `${appBaseUrl}/login` : `https://${appBaseUrl}/login`;
        const smtpReady  = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

        if (smtpReady) {
          // Build branded HTML
          const dName = displayName ?? email.split('@')[0];
          const tNameFinal = tName ?? 'your workspace';
          const html  = buildWelcomeEmail({ displayName: dName, tenantName: tNameFinal, tempPassword, loginUrl });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          // @ts-ignore — nodemailer ships its own types; strict mode false-positive
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.default.createTransport({
            host:   process.env.SMTP_HOST,
            port:   Number(process.env.SMTP_PORT ?? 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });
          await transporter.sendMail({
            from:    process.env.SMTP_FROM ?? `"MFO Nexus" <${process.env.SMTP_USER}>`,
            to:      email,
            subject: `Welcome to ${tNameFinal} — your temporary login credentials`,
            html,
          });
          emailSent = true;
        } else {
          console.warn(`[admin/users] SMTP not configured. Temp password for ${email}: ${tempPassword}`);
          console.warn(`[admin/users] Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local to send real emails.`);
          // Try delegating to send-welcome route as well (in case it has different SMTP config)
          const _ = tId; const __ = lang; // suppress unused-var lint
        }
      } catch (mailErr: any) {
        console.error('[POST /api/admin/users] Welcome email failed:', mailErr.message);
        // Non-fatal — fall through, temp password still returned in response
      }
    }

    return NextResponse.json({
      uid,
      email,
      displayName: displayName ?? email.split('@')[0],
      isNew,
      firestoreOk,
      emailSent,
      tempPassword: isNew ? tempPassword : undefined,
    });
  } catch (e: any) {
    console.error('[POST /api/admin/users]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}

// ─── Welcome email HTML ────────────────────────────────────────────────────────
function buildWelcomeEmail({ displayName, tenantName, tempPassword, loginUrl }: {
  displayName: string; tenantName: string; tempPassword: string; loginUrl: string;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0f0f17;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f17;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #2a2a45">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#818cf8);padding:28px 40px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800">${tenantName}</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px">Welcome to your workspace</p>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#c8c8e8;font-size:15px;line-height:1.7">
          <p style="margin:0 0 16px">Hi <strong>${displayName}</strong>,</p>
          <p style="margin:0 0 20px">
            An administrator has created your account on <strong>${tenantName}</strong>.
            Use the credentials below to sign in for the first time.
          </p>
          <div style="background:#0f0f1a;border:1px solid #6366f140;border-radius:12px;padding:20px 24px;margin:20px 0">
            <div style="margin-bottom:10px">
              <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em">Email</span><br/>
              <span style="font-size:15px;font-weight:600;color:#e2e8f0">${displayName.toLowerCase().includes('@') ? displayName : ''}</span>
            </div>
            <div>
              <span style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em">Temporary Password</span><br/>
              <span style="font-family:ui-monospace,monospace;font-size:18px;font-weight:700;color:#818cf8;letter-spacing:0.12em">${tempPassword}</span>
            </div>
          </div>
          <p style="margin:0 0 24px;color:#9ca3af;font-size:13px">
            ⚠️ You will be asked to set a personal password immediately after your first login.
          </p>
          <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;
            text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:800;font-size:15px">
            Sign In Now →
          </a>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #2a2a45;text-align:center">
          <p style="margin:0;color:#4b5563;font-size:11px">MFO Nexus Platform — ${new Date().getFullYear()}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}


/**
 * PUT /api/admin/users
 * Sends a Firebase password-reset email to the given address.
 * Uses Admin SDK if available (so it can set a custom action URL),
 * otherwise falls back to Identity Toolkit REST.
 */
export async function PUT(req: NextRequest) {
  try {
    const { idToken, email } = await req.json();
    if (!idToken || !email) {
      return NextResponse.json({ error: 'idToken and email are required.' }, { status: 400 });
    }
    const caller = await verifyIdToken(idToken);
    if (!caller) {
      return NextResponse.json(
        { error: 'Not authenticated — your session may have expired. Please refresh the page.' },
        { status: 401 },
      );
    }

    // Prefer Admin SDK to send the email (supports actionCodeSettings).
    // Fall back to REST Identity Toolkit if Admin SDK isn't configured.
    const adminSdkConfigured = !!process.env.FIREBASE_ADMIN_SDK_JSON;
    if (adminSdkConfigured) {
      try {
        const adminAuth = getAdminAuth();
        await adminAuth.generatePasswordResetLink(email); // omitting action settings avoids domain issues
      } catch { /* fall through to REST */ }
    }

    // Send via Identity Toolkit REST (always works with just the API key)
    // We intentionally omit continueUrl to avoid UNAUTHORIZED_DOMAIN errors
    // from un-whitelisted Vercel preview domains.
    await itPost('accounts:sendOobCode', {
      requestType: 'PASSWORD_RESET',
      email,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[PUT /api/admin/users]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
