import ClientPage from './ClientPage';
import { FAMILIES } from '@/lib/mockData';

export function generateStaticParams() {
  return FAMILIES.map(family => ({
    id: family.id
  }));
}

export default function Page() {
  return <ClientPage />;
}
