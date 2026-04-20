import { redirect } from 'next/navigation';

export default function PlatformFallbackPage() {
  redirect('/platform/tenants');
}
