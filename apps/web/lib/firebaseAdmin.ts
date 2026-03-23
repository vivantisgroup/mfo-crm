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

  let cred: object;
  try {
    cred = JSON.parse(credJson);
  } catch {
    throw new Error('FIREBASE_ADMIN_SDK_JSON is not valid JSON.');
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
