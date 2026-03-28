import { Suspense } from 'react';
import OrgClientPage from './ClientPage';

export default function OrgDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text-tertiary)' }}>Loading organization…</div>}>
      <OrgClientPage />
    </Suspense>
  );
}
