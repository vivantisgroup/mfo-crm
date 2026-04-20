'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getTenantsForUser, getUserProfile, type TenantRecord } from '@/lib/platformService';

export function TenantSwitcher() {
  const { userProfile, tenant, switchTenant } = useAuth();
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userProfile || !open) return;
    setLoading(true);
    getUserProfile(userProfile.uid)
      .then(p => getTenantsForUser(p ?? userProfile))
      .then(setTenants)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userProfile, open]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (!userProfile || !tenant) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-canvas)', border: '1px solid var(--border)',
          padding: '5px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
          transition: 'border-color var(--transition)',
        }}
        title="Switch Workspace"
      >
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: tenant.brandColor || 'var(--brand-500)', flexShrink: 0 }} />
        <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.name}</span>
        <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: 6, width: 280,
          boxShadow: 'var(--shadow-lg)', zIndex: 100,
        }}>
          {loading ? (
             <div style={{ padding: '10px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>Loading…</div>
          ) : tenants.length === 0 ? (
             <div style={{ padding: '10px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>No other tenants</div>
          ) : tenants.map(t => (
            <button
              key={t.id}
              onClick={() => { switchTenant(t.id); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 10px', background: 'transparent', border: 'none',
                cursor: 'pointer', borderRadius: 4, textAlign: 'left',
                backgroundColor: t.id === tenant.id ? 'var(--bg-muted)' : 'transparent',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.brandColor || 'var(--brand-500)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{(t as any).region || 'BR-1'}</div>
              </div>
              {t.id === tenant.id && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-600)' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
