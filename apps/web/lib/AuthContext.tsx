'use client';

/**
 * AuthContext — real Firebase Authentication
 *
 * Stage model:
 *   loading         → Firebase Auth observer hasn't fired yet
 *   unauthenticated → No Firebase user — redirect to /login
 *   needs_setup     → Platform uninitialized
 *   profile_error   → Profile load failed (don't redirect to login)
 *   select_tenant   → Authenticated but needs to pick an active tenant
 *   mfa_required    → Tenant selected, MFA OTP challenge pending
 *   authenticated   → Fully authorized, dashboard ready
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore, doc, onSnapshot,
} from 'firebase/firestore';
import {
  isPlatformInitialized,
  bootstrapPlatform,
  ensureUserProfile,
  updateUserProfile,
  getTenant,
  getTenantsForUser,
  type UserProfile,
  type TenantRecord,
  type PlatformRole,
} from './platformService';

// ─── Public shape ─────────────────────────────────────────────────────────────

export interface UserSession {
  uid:      string;
  id:       string;
  name:     string;
  email:    string;
  role:     PlatformRole;
  photoURL?: string;
}

export interface ActiveTenant {
  id:           string;
  name:         string;
  role:         string;
  isInternal?:  boolean;
  isSuperadmin?: boolean;
  brandColor?:  string;
}

export type AuthStage =
  | 'loading'
  | 'unauthenticated'
  | 'needs_setup'
  | 'profile_error'
  | 'select_tenant'
  | 'mfa_required'
  | 'mfa_enroll'
  | 'authenticated';

interface AuthContextType {
  stage:             AuthStage;
  firebaseUser:      FirebaseUser | null;
  user:              UserSession  | null;
  userProfile:       UserProfile  | null;
  tenant:            ActiveTenant | null;
  tenantRecord:      TenantRecord | null;
  isAuthenticated:   boolean;
  isHydrated:        boolean;
  isSaasMasterAdmin: boolean;
  error:             string | null;
  /** Tenants available for selection (populated when stage === 'select_tenant') */
  availableTenants:  TenantRecord[];
  /** Tenant the user has chosen but not yet MFA-verified */
  pendingTenantId:   string | null;

  signIn:            (email: string, password: string) => Promise<void>;
  signUp:            (email: string, password: string, displayName: string) => Promise<void>;
  logout:            () => Promise<void>;
  switchTenant:      (tenantId: string) => Promise<void>;
  selectTenant:      (tenantId: string) => Promise<void>;
  completeMfa:       () => Promise<void>;
  completeMfaEnroll: () => Promise<void>;
  retryProfile:      () => Promise<void>;
  clearError:        () => void;

  login: (tenant: ActiveTenant, user: UserSession) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = getAuth(firebaseApp);

  const [stage,            setStage]            = useState<AuthStage>('loading');
  const [fbUser,           setFbUser]           = useState<FirebaseUser | null>(null);
  const [userProfile,      setUserProfile]      = useState<UserProfile  | null>(null);
  const [tenantRecord,     setTenantRecord]     = useState<TenantRecord | null>(null);
  const [availableTenants, setAvailableTenants] = useState<TenantRecord[]>([]);
  const [pendingTenantId,  setPendingTenantId]  = useState<string | null>(null);
  const [error,            setError]            = useState<string | null>(null);
  const [isHydrated,       setIsHydrated]       = useState(false);
  // Ref holds the cleanup function for the live profile listener
  const profileListenerRef = useRef<(() => void) | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const user: UserSession | null = userProfile ? {
    uid:      userProfile.uid,
    id:       userProfile.uid,
    name:     userProfile.displayName,
    email:    userProfile.email,
    role:     userProfile.role,
    photoURL: userProfile.photoURL,
  } : null;

  const tenant: ActiveTenant | null = tenantRecord ? {
    id:          tenantRecord.id,
    name:        tenantRecord.name,
    role:        userProfile?.role ?? '',
    isInternal:  tenantRecord.isInternal,
    isSuperadmin: userProfile?.role === 'saas_master_admin',
    brandColor:  tenantRecord.brandColor,
  } : null;

  const isSaasMasterAdmin = userProfile?.role === 'saas_master_admin';

  // ── load tenants and decide next stage ────────────────────────────────────
  const loadProfile = useCallback(async (fbU: FirebaseUser) => {
    try {
      setError(null);
      const initialized = await isPlatformInitialized();
      if (!initialized) {
        setStage('needs_setup');
        return;
      }

      const profile = await ensureUserProfile(fbU);
      setUserProfile(profile);

      // ── Real-time listener on users/{uid} ─────────────────────────────────
      // Clean up any previous listener first
      if (profileListenerRef.current) {
        profileListenerRef.current();
        profileListenerRef.current = null;
      }
      const db = getFirestore(firebaseApp);
      const unsub = onSnapshot(doc(db, 'users', fbU.uid), snap => {
        if (snap.exists()) {
          setUserProfile(prev => prev ? { ...prev, ...(snap.data() as Partial<UserProfile>) } : prev);
        }
      }, () => {}); // silently ignore snapshot errors
      profileListenerRef.current = unsub;
      // ─────────────────────────────────────────────────────────────────────

      // Collect all tenants this user belongs to
      const allTenantIds = Array.from(new Set([
        ...(profile.tenantIds ?? []),
        ...(profile.tenantId ? [profile.tenantId] : []),
      ])).filter(Boolean);

      if (profile.role === 'saas_master_admin' && !allTenantIds.includes('master')) {
        allTenantIds.push('master');
      }

      // Retrieve previously selected tenant from storage
      const localLast   = typeof localStorage   !== 'undefined' ? localStorage.getItem(`lastTenantId_${profile.uid}`)   : null;
      const sessionLast = typeof sessionStorage  !== 'undefined' ? sessionStorage.getItem('activeTenantId')               : null;
      const storedId    = localLast || sessionLast || profile.tenantId || null;

      // ── Single tenant (or no tenants yet) — go straight to authenticated ──
      // Users with 0 tenants are newly created; we don't block them.
      if (allTenantIds.length <= 1) {
        const tenantId = allTenantIds[0] ?? storedId ?? profile.tenantId ?? null;
        const tRecord  = tenantId ? await getTenant(tenantId).catch(() => null) : null;
        setTenantRecord(tRecord);

        // mustChangePassword takes priority — set stage to authenticated so the
        // dashboard layout's guard fires and sends the user to /change-password first.
        // After they set their real password, mfaEnrollRequired will gate the next login.
        if (profile.mustChangePassword) {
          setStage('authenticated');
        } else if (profile.mfaEnrollRequired) {
          setStage('mfa_enroll');
        } else if (tRecord?.mfaRequired) {
          setPendingTenantId(tenantId!);
          setStage('mfa_required');
        } else {
          setStage('authenticated');
        }
        return;
      }

      // ── Multiple tenants — offer a picker ────────────────────────────────
      const tenantDocs = await getTenantsForUser(profile);
      setAvailableTenants(tenantDocs);

      // If the previously selected tenant is still valid, skip the picker
      if (storedId && tenantDocs.find(t => t.id === storedId)) {
        const stored = tenantDocs.find(t => t.id === storedId)!;
        setTenantRecord(stored);
        if (profile.mustChangePassword) {
          setStage('authenticated');
        } else if (profile.mfaEnrollRequired) {
          setStage('mfa_enroll');
        } else if (stored.mfaRequired) {
          setPendingTenantId(storedId);
          setStage('mfa_required');
        } else {
          setStage('authenticated');
        }
      } else {
        // Force the user to pick a tenant
        setStage('select_tenant');
      }
    } catch (err: any) {
      console.error('[AuthContext] loadProfile error:', err);
      setError(err?.message ?? 'Failed to load your user profile.');
      setStage('profile_error');
    }
  }, []);

  // ── Firebase Auth observer ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbU) => {
      if (fbU) {
        setFbUser(fbU);
        await loadProfile(fbU);
      } else {
        // Clean up live profile listener on sign-out
        if (profileListenerRef.current) {
          profileListenerRef.current();
          profileListenerRef.current = null;
        }
        setFbUser(null);
        setUserProfile(null);
        setTenantRecord(null);
        setAvailableTenants([]);
        setPendingTenantId(null);
        setStage('unauthenticated');
      }
      setIsHydrated(true);
    });
    return unsub;
  }, [auth, loadProfile]);

  // Sync tenant changes to legacy local storage key used by some components
  useEffect(() => {
    if (tenantRecord && typeof localStorage !== 'undefined') {
      localStorage.setItem('mfo_active_tenant', JSON.stringify({
        id: tenantRecord.id,
        name: tenantRecord.name,
      }));
    }
  }, [tenantRecord]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      loadProfile(cred.user).catch(err => {
        console.error('[signIn] loadProfile error:', err);
        setError('Your account was authenticated but your profile could not be loaded. Please contact support.');
        setStage('profile_error');
      });
    } catch (err: any) {
      const msg = friendlyAuthError(err.code);
      setError(msg);
      throw new Error(msg);
    }
  }, [auth, loadProfile]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      const initialized = await isPlatformInitialized();
      if (!initialized) {
        const profile = await bootstrapPlatform(cred.user, displayName);
        setUserProfile(profile);
        const tRecord = await getTenant('master');
        setTenantRecord(tRecord);
        setStage('authenticated');
      } else {
        await loadProfile(cred.user);
      }
    } catch (err: any) {
      const msg = friendlyAuthError(err.code);
      setError(msg);
      throw new Error(msg);
    }
  }, [auth, loadProfile]);

  const logout = useCallback(async () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('activeTenantId');
    setFbUser(null);
    setUserProfile(null);
    setTenantRecord(null);
    setAvailableTenants([]);
    setPendingTenantId(null);
    setError(null);
    setStage('unauthenticated');
    await new Promise(r => setTimeout(r, 50));
    await firebaseSignOut(auth);
  }, [auth]);

  /** Called from the select-tenant page when the user picks a workspace. */
  const selectTenant = useCallback(async (tenantId: string) => {
    const tRecord = await getTenant(tenantId);
    if (!tRecord) {
      setError('Tenant not found.');
      return;
    }
    setTenantRecord(tRecord);
    if (typeof localStorage !== 'undefined' && userProfile?.uid) {
      localStorage.setItem(`lastTenantId_${userProfile.uid}`, tenantId);
    }
    if (tRecord.mfaRequired) {
      setPendingTenantId(tenantId);
      setStage('mfa_required');
    } else {
      if (userProfile?.uid) {
        updateUserProfile(userProfile.uid, { tenantId }).catch(console.error);
      }
      setUserProfile(prev => prev ? { ...prev, tenantId } : prev);
      setStage('authenticated');
    }
  }, [userProfile]);

  /** Called from the mfa-verify page after a successful OTP verification. */
  const completeMfa = useCallback(async () => {
    if (!pendingTenantId || !userProfile) return;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`lastTenantId_${userProfile.uid}`, pendingTenantId);
    }
    updateUserProfile(userProfile.uid, { tenantId: pendingTenantId }).catch(console.error);
    setUserProfile(prev => prev ? { ...prev, tenantId: pendingTenantId } : prev);
    setPendingTenantId(null);
    setStage('authenticated');
  }, [pendingTenantId, userProfile]);

  /** Called from /mfa-enroll after successful TOTP enrollment. Clears the enroll gate. */
  const completeMfaEnroll = useCallback(async () => {
    if (!userProfile) return;
    await updateUserProfile(userProfile.uid, { mfaEnrollRequired: false, mfaEnabled: true, mfaEnrolledAt: new Date().toISOString() }).catch(console.error);
    setUserProfile(prev => prev ? { ...prev, mfaEnrollRequired: false, mfaEnabled: true } : prev);
    // Now check if tenant also needs email OTP
    if (tenantRecord?.mfaRequired && pendingTenantId) {
      setStage('mfa_required');
    } else {
      setStage('authenticated');
    }
  }, [userProfile, tenantRecord, pendingTenantId]);

  const switchTenant = useCallback(async (tenantId: string) => {
    if (!userProfile) return;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`lastTenantId_${userProfile.uid}`, tenantId);
    }
    try {
      await updateUserProfile(userProfile.uid, { tenantId });
    } catch (err) {
      console.error('[switchTenant] Failed to update profile:', err);
    }
    setUserProfile(prev => prev ? { ...prev, tenantId } : prev);
    const tRecord = await getTenant(tenantId);
    setTenantRecord(tRecord);
  }, [userProfile]);

  const retryProfile = useCallback(async () => {
    if (!fbUser) return;
    setStage('loading');
    await loadProfile(fbUser);
  }, [fbUser, loadProfile]);

  const clearError = useCallback(() => setError(null), []);
  const login = useCallback((_t: ActiveTenant, _u: UserSession) => {
    console.warn('[AuthContext] login() shim called — use signIn() instead');
  }, []);

  return (
    <AuthContext.Provider value={{
      stage, firebaseUser: fbUser, user, userProfile, tenant, tenantRecord,
      isAuthenticated: stage === 'authenticated',
      isHydrated,
      isSaasMasterAdmin,
      error,
      availableTenants,
      pendingTenantId,
      signIn, signUp, logout, switchTenant, selectTenant, completeMfa, completeMfaEnroll,
      retryProfile, clearError, login,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// ─── Friendly error messages ──────────────────────────────────────────────────

function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    case 'auth/user-disabled':
      return 'This account has been suspended.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled.\n→ Firebase Console → Authentication → Sign-in method → Email/Password → Enable';
    default:
      return `Authentication error (${code || 'unknown'}).`;
  }
}
