/**
 * useLiveMode
 * -----------
 * Returns true when the user is authenticated with real Firebase.
 * In live mode: components show real Firestore data (or empty states).
 * In demo / unauthenticated mode: components may fall back to mockData.
 */

import { useAuth } from './AuthContext';

export function useLiveMode(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

/** Shorthand: returns mockData only when NOT in live mode */
export function useMockOrEmpty<T>(mockData: T[], liveData: T[] = []): T[] {
  const live = useLiveMode();
  return live ? liveData : mockData;
}
