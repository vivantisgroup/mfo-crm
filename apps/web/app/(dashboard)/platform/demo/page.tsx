'use client';

/**
 * /platform/demo — Demo provisioning has moved.
 * It is now an admin option within each tenant's detail in Tenant Management.
 * Redirect anyone who navigates here directly.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DemoProvisionerRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/platform/tenants');
  }, [router]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 36 }}>🌱</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Demo provisioner has moved to Tenant Management…</div>
    </div>
  );
}
