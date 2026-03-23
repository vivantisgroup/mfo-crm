import { getApp, getApps, initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getFirestore } from "firebase/firestore";

const cfg = {
  apiKey:            process.env.NEXT_PUBLIC_FB_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_MEASUREMENT_ID,
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(cfg);
export const auth = initializeAuth(firebaseApp, { persistence: indexedDBLocalPersistence });
export const db = getFirestore(firebaseApp);

// ✅ Set tenant from env (Identity Platform multi-tenant)
export function applyTenantFromEnv() {
  const t = process.env.NEXT_PUBLIC_TENANT_ID;
  if (t) (auth as any).tenantId = t; // universal, no extra typings needed
}

export function initAppCheck() {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!),
      isTokenAutoRefreshEnabled: true,
    });
  }
}
