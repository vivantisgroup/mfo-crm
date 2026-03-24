'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getAuth } from 'firebase/auth';
import { MailIntegrationSection } from '@/components/MailIntegrationSection';

function SettingsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const oauthSuccess = searchParams?.get('oauth_success');

  // Auto-trigger Gmail sync immediately after successful connection
  useEffect(() => {
    if (oauthSuccess === 'google' && user?.uid) {
      (async () => {
        try {
          const idToken = await getAuth().currentUser?.getIdToken();
          const tenant  = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
          await fetch('/api/mail/sync', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              uid:      user.uid,
              idToken,
              tenantId: tenant?.id,
              maxResults: 50,
            }),
          });
        } catch (e) {
          console.warn('[settings] auto-sync after connect failed:', e);
        }
      })();
    }
  }, [oauthSuccess, user?.uid]);

  return <MailIntegrationSection />;
}

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
          Integrations &amp; Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Connect Gmail, Outlook, and Google Calendar to sync communications with the CRM.
        </p>
      </div>

      <Suspense fallback={
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: 24 }}>Loading…</div>
      }>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
