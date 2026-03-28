import { Suspense } from 'react';
import ContactClientPage from './ClientPage';

export default function ContactDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text-tertiary)' }}>Loading contact…</div>}>
      <ContactClientPage />
    </Suspense>
  );
}
