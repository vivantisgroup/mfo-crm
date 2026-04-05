/**
 * lib/firebaseAdmin.ts
 *
 * Lazy-initialised Firebase Admin SDK singleton for use in API routes only.
 *
 * Credential resolution order:
 *   1. FIREBASE_ADMIN_SDK_JSON (JSON string, optionally base64-encoded)
 *   2. Application Default Credentials (ADC)
 *      — run `gcloud auth application-default login` for local development,
 *      — or set GOOGLE_APPLICATION_CREDENTIALS to a service-account key path.
 *
 * For local development without a service account JSON, ADC is the simplest
 * approach. ADC is also the recommended method when running on Cloud Run / GCE.
 */

/* eslint-disable @typescript-eslint/no-var-requires */

let _app: any = null;
let _db:  any = null;
let _auth: any = null;
let _initError: Error | null = null;
let _hasCredentials = false;  // true only when real credentials were resolved

function getAdminApp(): any {
  // Return cached app or re-throw cached error
  if (_app)        return _app;
  if (_initError)  throw _initError;

  const admin = require('firebase-admin');
  if (admin.apps.length > 0) {
    _app = admin.apps[0];
    return _app;
  }

  const projectId =
    process.env.NEXT_PUBLIC_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT_ID ??
    'mfo-crm';

  const credJson = process.env.FIREBASE_ADMIN_SDK_JSON;

  // ── Attempt 1: FIREBASE_ADMIN_SDK_JSON is set ─────────────────────────────
  if (credJson) {
    // ── Detect the common mistake: someone pasted the JS code snippet instead of JSON ──
    const trimmed = credJson.trim();
    const looksLikeJsCode = trimmed.startsWith('var ') || trimmed.startsWith('const ') ||
      trimmed.startsWith('let ') || trimmed.includes('require(') || trimmed.includes('initializeApp(');
    if (looksLikeJsCode) {
      console.error(
        '[firebaseAdmin] ❌ FIREBASE_ADMIN_SDK_JSON contains JavaScript code, not a JSON service account key.\n' +
        'FIX: Go to https://console.firebase.google.com → Project Settings → Service Accounts\n' +
        '     → "Generate new private key" → download the JSON file.\n' +
        '     In Vercel: Project Settings → Environment Variables → FIREBASE_ADMIN_SDK_JSON\n' +
        '     → paste the ENTIRE contents of the downloaded JSON file as the value (no quotes around it).'
      );
      // Fall through to ADC (will also fail locally, but the error message above is shown)
    } else {
      let cred: any;

      // Try direct JSON parse
      try { cred = JSON.parse(credJson); } catch { /* fall through */ }

      // Try base64-decode then parse (Vercel sometimes base64-encodes special chars)
      if (!cred) {
        try {
          const decoded = Buffer.from(credJson, 'base64').toString('utf8');
          cred = JSON.parse(decoded);
        } catch { /* fall through */ }
      }

      // Try fixing escaped newlines common in Windows/Vercel copy-paste artifacts
      if (!cred) {
        try {
          const fixed = credJson
            .replace(/\\\\n/g, '\\n')  // double-escaped → single-escaped
            .replace(/\r/g, '');        // strip CR
          cred = JSON.parse(fixed);
        } catch { /* fall through */ }
      }

      if (cred) {
        // Auto-repair private_key newlines
        if (typeof cred.private_key === 'string') {
          cred.private_key = cred.private_key
            .replace(/\\n/g, '\n')  // literal \n escape → real newline
            .replace(/\r/g, '');    // strip CR
        }
        try {
          _app = admin.initializeApp({ credential: admin.credential.cert(cred), projectId });
          _hasCredentials = true;
          return _app;
        } catch (e: any) {
          // cert init failed — fall through to ADC
          console.warn('[firebaseAdmin] cert credential failed, trying ADC:', e.message);
        }
      } else {
        console.warn('[firebaseAdmin] FIREBASE_ADMIN_SDK_JSON could not be parsed; trying ADC.');
      }
    }
  }

  // ── Attempt 2: Application Default Credentials ─────────────────────────────
  try {
    _app = admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
    _hasCredentials = true;
    console.log('[firebaseAdmin] Initialised with Application Default Credentials.');
    return _app;
  } catch {
    // ADC not set up (common on Windows dev without gcloud) — fall through to projectId-only mode
  }

  // ── Attempt 3: projectId-only (no credentials) ──────────────────────────────
  // Prevents the "Unable to detect Project Id" crash. Routes already catch
  // the resulting auth errors gracefully and return helpful UI messages.
  try {
    _app = admin.initializeApp({ projectId });
    console.warn(
      `[firebaseAdmin] ⚠️  No credentials — running in projectId-only mode (project="${projectId}").` +
      '\n  To fix: Firebase Console → Project Settings → Service Accounts → Generate new private key.' +
      '\n  Paste the JSON into FIREBASE_ADMIN_SDK_JSON in .env.local and restart the dev server.'
    );
    return _app;
  } catch (e: any) {
    _initError = new Error(
      `Firebase Admin SDK could not be initialised (project="${projectId}"): ${e.message}\n\n` +
      'Set FIREBASE_ADMIN_SDK_JSON in .env.local to the full contents of a Firebase service account JSON key.\n' +
      'Firebase Console → Project Settings → Service Accounts → Generate new private key.'
    );
    throw _initError;
  }
}


/** Returns an Admin Firestore instance (lazy singleton). */
export function getAdminFirestore(): any {
  if (_db) return _db;
  const admin = require('firebase-admin');
  getAdminApp();
  _db = admin.firestore();
  return _db;
}

/** Returns an Admin Auth instance (lazy singleton). */
export function getAdminAuth(): any {
  if (_auth) return _auth;
  const admin = require('firebase-admin');
  getAdminApp();
  _auth = admin.auth();
  return _auth;
}

/**
 * Returns true when the Admin SDK is available.
 * Use this to gracefully degrade rather than crash.
 */
export function isAdminAvailable(): boolean {
  try { getAdminApp(); return true; } catch { return false; }
}

/**
 * Returns true when the Admin SDK was initialised with real credentials
 * (service account JSON or ADC) and can actually WRITE to Firestore.
 * Returns false in projectId-only mode (no credentials).
 * Use this in the initialize route to decide MODE A vs MODE B.
 */
export function hasAdminWriteAccess(): boolean {
  try { getAdminApp(); return _hasCredentials; } catch { return false; }
}

/**
 * Drops the currently loaded SDK instances. Extremely useful for gracefully
 * recovering from Session Revocations and invalid_grant/invalid_rapt errors
 * when Google Cloud forces an ADC rotation but Node keeps the old instance cached.
 */
export async function forceReinitializeAdmin() {
  if (_app) {
    try { await _app.delete(); } catch { /* ignore */ }
  }
  _app = null;
  _db = null;
  _auth = null;
  _hasCredentials = false;
  _initError = null;
}
