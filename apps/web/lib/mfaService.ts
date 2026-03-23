/**
 * mfaService.ts — Application-level TOTP MFA
 *
 * Uses the `otpauth` library to generate and verify TOTP codes that work
 * with any standard authenticator app (Google Authenticator, Authy, 1Password, etc.)
 *
 * Architecture (no Firebase native MFA required):
 *   - TOTP secret is generated client-side using otpauth
 *   - Secret saved in `user_mfa_secrets/{uid}` — accessible ONLY by that user
 *   - `users/{uid}.mfaEnabled` bool is the gate checked during login
 *   - Login flow: Firebase auth → if mfaEnabled → fetch secret → verify OTP → proceed
 *
 * Security properties:
 *   - Secret stored in dedicated Firestore collection with strict "self-only" rule
 *   - TOTP codes expire every 30 seconds
 *   - Window of ±1 period (30s tolerance for clock drift)
 *   - All operations audited
 */

import * as OTPAuth from 'otpauth';
import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore,
  doc, getDoc, setDoc, deleteDoc, updateDoc, addDoc, collection,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';

const db = getFirestore(firebaseApp);

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MfaEnrollmentSession {
  /** Base32-encoded TOTP secret — pass to finalizeTotpEnrollment() */
  secret:    string;
  /** otpauth:// URI — pass to <QRCodeSVG value={qrCodeUrl} /> */
  qrCodeUrl: string;
  /** Human-readable Base32 key for manual entry in authenticator apps */
  secretKey: string;
}

// ─── TOTP generation & verification ───────────────────────────────────────────

/**
 * Build a TOTP object for the given Base32 secret.
 * Standard config compatible with all TOTP apps.
 */
function buildTotp(secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer:    'MFO Nexus',
    label,
    algorithm: 'SHA1',
    digits:    6,
    period:    30,
    secret:    OTPAuth.Secret.fromBase32(secret),
  });
}

/** Returns seconds remaining in the current 30-second TOTP window */
export function totpSecondsRemaining(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

/**
 * Verify a 6-digit TOTP code against a Base32 secret.
 * window: 1 = accepts ±30s for clock drift (standard for TOTP apps).
 */
export function verifyTotpCode(secret: string, otp: string): boolean {
  try {
    const totp = buildTotp(secret, 'mfo-nexus');
    return totp.validate({ token: otp.replace(/\s/g, ''), window: 1 }) !== null;
  } catch {
    return false;
  }
}

// ─── Enrollment ────────────────────────────────────────────────────────────────

/**
 * Phase 1: Generate a fresh TOTP secret + the QR code URL.
 * No Firebase interaction — just cryptographic key generation.
 */
export async function startTotpEnrollment(user: FirebaseUser): Promise<MfaEnrollmentSession> {
  const secret = new OTPAuth.Secret({ size: 20 }); // 160-bit secret (RFC 4226 standard)
  const totp   = buildTotp(secret.base32, user.email ?? user.uid);
  return {
    secret:    secret.base32,
    qrCodeUrl: totp.toString(),   // e.g.  otpauth://totp/MFO%20Nexus:user@firm.com?...
    secretKey: secret.base32,
  };
}

/**
 * Phase 2: Verify the OTP the user typed, then persist the secret.
 * Throws if the OTP is wrong — caller should NOT save on error.
 */
export async function finalizeTotpEnrollment(
  user:    FirebaseUser,
  session: MfaEnrollmentSession,
  otp:     string,
): Promise<void> {
  if (!verifyTotpCode(session.secret, otp)) {
    throw new Error('Incorrect verification code. Please check your authenticator app and try again.');
  }

  // Store secret in dedicated collection — accessible only by this user (Firestore rules)
  await setDoc(doc(db, 'user_mfa_secrets', user.uid), {
    secret:     session.secret,
    enrolledAt: new Date().toISOString(),
    uid:        user.uid,
  });

  // Mark user as MFA-enrolled in their profile
  await updateDoc(doc(db, 'users', user.uid), {
    mfaEnabled:    true,
    mfaEnrolledAt: new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  });

  // Audit
  await audit(user.uid, user.displayName ?? user.email ?? user.uid,
    'MFA_ENROLLED', user.uid, 'TOTP MFA enrolled via authenticator app');
}

// ─── Login verification ────────────────────────────────────────────────────────

/**
 * Fetch the stored TOTP secret and verify the sign-in OTP.
 * Call this after Firebase auth has succeeded and user's profile shows mfaEnabled = true.
 *
 * Returns true on success; throws on invalid code or missing secret.
 */
export async function verifyTotpLogin(uid: string, otp: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'user_mfa_secrets', uid));
  if (!snap.exists()) {
    throw new Error('MFA secret not found. Please contact your administrator.');
  }

  const { secret } = snap.data() as { secret: string };
  if (!verifyTotpCode(secret, otp)) {
    throw new Error('Incorrect or expired code. Check your authenticator app and try again.');
  }

  return true;
}

// ─── Unenroll ──────────────────────────────────────────────────────────────────

/**
 * Remove MFA from the account.
 * Deletes the secret and clears the mfaEnabled flag.
 */
export async function unenrollMfa(user: FirebaseUser): Promise<void> {
  await deleteDoc(doc(db, 'user_mfa_secrets', user.uid));
  await updateDoc(doc(db, 'users', user.uid), {
    mfaEnabled:    false,
    mfaEnrolledAt: null,
    updatedAt:     new Date().toISOString(),
  });
  await audit(user.uid, user.displayName ?? user.email ?? user.uid,
    'MFA_UNENROLLED', user.uid, 'TOTP MFA removed from account');
}

// ─── Audit ─────────────────────────────────────────────────────────────────────

async function audit(
  uid:    string,
  name:   string,
  action: string,
  resId:  string,
  desc:   string,
): Promise<void> {
  await addDoc(collection(db, 'audit_logs'), {
    tenantId: 'master', userId: uid, userName: name,
    action, resourceId: resId, resourceType: 'user',
    resourceName: desc, status: 'success', ipAddress: 'client',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    occurredAt: new Date().toISOString(),
  }).catch(() => {/* non-fatal */});
}
