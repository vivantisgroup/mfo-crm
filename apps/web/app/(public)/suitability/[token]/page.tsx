import ClientPage from './ClientPage';

// Static export: pre-render a shell for the known demo token.
// All other real tokens are caught by the Firebase Hosting rewrite
// (/suitability/** → /suitability/demo/index.html) and the client
// reads the actual token from the URL via useParams() at runtime.
export function generateStaticParams() {
  return [{ token: 'demo' }];
}

export const dynamicParams = false;

export default function Page() {
  return <ClientPage />;
}
