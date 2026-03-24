/**
 * lib/firebaseAdmin.ts
 *
 * Lazy-initialised Firebase Admin SDK singleton.
 * Used only by API routes (server-side Node.js runtime).
 *
 * Required environment variable:
 *   FIREBASE_ADMIN_SDK_JSON – JSON string of the service account credentials
 *   (download from Firebase Console → Project Settings → Service Accounts → Generate new private key)
 *
 * Example .env.local entry (single-line minified JSON):
 *   FIREBASE_ADMIN_SDK_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"..."}
 */

/* eslint-disable @typescript-eslint/no-var-requires */

let _db: any = null;

function getAdminApp(): any {
  // Lazy require so this file can be imported without crashing in Edge runtime
  const admin = require('firebase-admin');

  if (admin.apps.length) return admin.apps[0];

  const credJson = process.env.FIREBASE_ADMIN_SDK_JSON;
  if (!credJson) {
    throw new Error(
      'FIREBASE_ADMIN_SDK_JSON environment variable is not set. ' +
      'Download a service account key from Firebase Console → Project Settings → Service Accounts.'
    );
  }

  let cred: any;

  // Attempt 1: parse directly
  try {
    cred = JSON.parse(credJson);
  } catch {
    // Attempt 2: might be base64-encoded (workaround for Vercel special chars)
    try {
      const decoded = Buffer.from(credJson, 'base64').toString('utf8');
      cred = JSON.parse(decoded);
    } catch {
      throw new Error(
        'FIREBASE_ADMIN_SDK_JSON is not valid JSON.\n' +
        'Common causes:\n' +
        '  1. The private_key contains literal newlines instead of \\n — edit the env var in Vercel and replace each real newline inside private_key with the two characters \\n.\n' +
        '  2. Quotes were stripped — paste the full JSON value as-is, no extra quoting.\n' +
        '  3. The JSON was truncated — paste the complete minified service account file.\n' +
        'Vercel → Project → Settings → Environment Variables → FIREBASE_ADMIN_SDK_JSON'
      );
    }
  }

  // ── Auto-repair: Vercel sometimes stores the value with real newlines in
  //    private_key (treated as literal chars) instead of the JSON escape \n.
  //    Detect and fix so firebase-admin doesn't reject the credential.
  if (cred && typeof cred.private_key === 'string') {
    if (!cred.private_key.includes('\n') && cred.private_key.includes('\\n')) {
      // Double-escaped — unescape once
      cred.private_key = cred.private_key.replace(/\\n/g, '\n');
    }
    // If there are real literal CR characters (Windows paste artefact), strip them
    cred.private_key = cred.private_key.replace(/\r/g, '');
  }

  return admin.initializeApp({ credential: admin.credential.cert(cred) });
}

/** Returns an Admin Firestore instance (lazy, singleton). */
export function getAdminFirestore(): any {
  if (_db) return _db;
  const admin = require('firebase-admin');
  getAdminApp(); // ensure app is initialised
  _db = admin.firestore();
  return _db;
}

/** Returns an Admin Auth instance (lazy). */
export function getAdminAuth(): any {
  const admin = require('firebase-admin');
  getAdminApp();
  return admin.auth();
}
