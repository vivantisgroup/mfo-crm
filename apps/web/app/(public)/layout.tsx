import React from 'react';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <header style={{ padding: '24px 40px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--brand-500)' }}>VIVANTS</div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.6 }}>Consultoria e Serviços</div>
        </div>
        <div className="badge badge-neutral">Client Portal</div>
      </header>
      <main style={{ padding: '40px 20px', maxWidth: 1000, margin: '0 auto' }}>
        {children}
      </main>
      <footer style={{ padding: '40px', textAlign: 'center', opacity: 0.4, fontSize: 12 }}>
        © 2026 Vivants Consultoria e Serviços · Confidential Client Service
      </footer>
    </div>
  );
}
