'use client';

/**
 * AuthContext — real Firebase Authentication
 *
 * Stage model (clean separation of concerns):
 *   loading        → Firebase Auth observer hasn't fired yet
 *   unauthenticated → Firebase has NO user — redirect to /login
 *   needs_setup     → Firebase has a user but platform is uninitialized
 *   profile_error   → Firebase user exists BUT Firestore profile failed to load
 *                     (DO NOT redirect to login — that causes a loop)
 *   authenticated   → Firebase user + Firestore profile loaded successfully
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  isPlatformInitialized,
  bootstrapPlatform,
  ensureUserProfile,
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

  signIn:       (email: string, password: string) => Promise<void>;
  signUp:       (email: string, password: string, displayName: string) => Promise<void>;
  logout:       () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  retryProfile: () => Promise<void>;
  clearError:   () => void;

  login: (tenant: ActiveTenant, user: UserSession) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = getAuth(firebaseApp);

  const [stage,        setStage]        = useState<AuthStage>('loading');
  const [fbUser,       setFbUser]       = useState<FirebaseUser | null>(null);
  const [userProfile,  setUserProfile]  = useState<UserProfile  | null>(null);
  const [tenantRecord, setTenantRecord] = useState<TenantRecord | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [isHydrated,   setIsHydrated]   = useState(false);

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

  // ── Load Firestore profile after Firebase auth resolves ───────────────────
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

      // Respect the tenant the user selected on the login screen
      const chosenTenantId =
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('activeTenantId'))
        ?? profile.tenantId;

      const tRecord = chosenTenantId ? await getTenant(chosenTenantId) : null;
      setTenantRecord(tRecord);
      setStage('authenticated');
    } catch (err: any) {
      console.error('[AuthContext] loadProfile error:', err);
      setError(err?.message ?? 'Failed to load your user profile.');
      setStage('profile_error');
    }
  }, []);

  // ── Firebase Auth observer (single subscription) ──────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbU) => {
      if (fbU) {
        setFbUser(fbU);
        await loadProfile(fbU);
      } else {
        // Truly no user — safe to redirect to login
        setFbUser(null);
        setUserProfile(null);
        setTenantRecord(null);
        setStage('unauthenticated');
      }
      setIsHydrated(true);
    });
    return unsub;
  }, [auth, loadProfile]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await loadProfile(cred.user);
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
    // Clear tenant selection so next session starts fresh
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('activeTenantId');
    }
    await firebaseSignOut(auth);
    setFbUser(null);
    setUserProfile(null);
    setTenantRecord(null);
    setError(null);
    setStage('unauthenticated');
  }, [auth]);

  const switchTenant = useCallback(async (tenantId: string) => {
    if (!userProfile) return;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('activeTenantId', tenantId);
    }
    const tRecord = await getTenant(tenantId);
    setTenantRecord(tRecord);
  }, [userProfile]);


  // Retry loading the profile (shown when stage === 'profile_error')
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
      signIn, signUp, logout, switchTenant, retryProfile, clearError, login,
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
