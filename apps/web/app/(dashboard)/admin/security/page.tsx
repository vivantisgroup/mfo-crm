'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Shield } from 'lucide-react';
import { getVerticalNav, DEFAULT_VERTICAL } from '@/lib/verticalRegistry';

// Internal navigation definition duplicated from layout.tsx for RBAC indexing
const PLATFORM_NAV = [
  { section: 'Platform', items: [{ href: '/dashboard', label: 'Dashboard' }, { href: '/communications', label: 'Communications' }, { href: '/reports', label: 'Reports' }] },
  { section: 'Operations', items: [{ href: '/platform/tenants', label: 'Tenants' }, { href: '/platform/crm', label: 'CRM' }, { href: '/tarefas', label: 'Tarefas' }, { href: '/platform/support', label: 'Support Center' }, { href: '/platform/finance', label: 'Finance' }, { href: '/platform/hr', label: 'HR' }] },
  { section: 'Intelligence', items: [{ href: '/platform/analytics', label: 'Analytics' }, { href: '/copilot', label: 'Co-Pilot' }] },
  { section: 'Engineering', items: [{ href: '/admin', label: 'Settings' }, { href: '/admin/security', label: 'Security' }] },
];
function MfaSection() {
  const { tenant } = useAuth();
  const [mfaMode, setMfaMode] = useState<'totp' | 'disabled'>('disabled');
  const [totpIssuer, setTotpIssuer] = useState('MFO Nexus');
  const [totpWindow, setTotpWindow] = useState(1);
  const [backupCodes, setBackupCodes] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;
    const fetchConfig = async () => {
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch(`/api/admin/tenant-config?tenantId=${tenant.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.mfaConfig) {
          if (data.mfaConfig.mfaMode) setMfaMode(data.mfaConfig.mfaMode);
          if (data.mfaConfig.totpIssuer) setTotpIssuer(data.mfaConfig.totpIssuer);
          if (data.mfaConfig.totpWindow !== undefined) setTotpWindow(data.mfaConfig.totpWindow);
          if (data.mfaConfig.backupCodes !== undefined) setBackupCodes(data.mfaConfig.backupCodes);
        }
      } catch (e) {
        console.error('Failed to load tenant MFA config', e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [tenant?.id]);

  const handleSave = async () => {
    if (!tenant?.id) return;
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) return;
      await fetch('/api/admin/tenant-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          mfaConfig: { mfaMode, totpIssuer, totpWindow, backupCodes }
        })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('Failed to save MFA config to backend', e);
    }
  };

  return (
    <div className="animate-fade-in bg-white p-6 rounded-xl border border-gray-200 mt-6 shadow-sm">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Multi-Factor Authentication</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Zero-cost TOTP via RFC 6238 — compatible with Google Authenticator, Authy, and Microsoft Authenticator.
        </p>
      </div>

      <div style={{ marginBottom: 32 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Authentication Mode</label>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { id: 'totp', label: '🔐 TOTP (Recommended)', desc: 'Free, offline-capable, RFC 6238' },
            { id: 'disabled', label: '⚠️ Disabled', desc: 'Only for development environments' },
          ].map(opt => (
            <div
              key={opt.id}
              onClick={() => setMfaMode(opt.id as any)}
              style={{
                flex: 1, padding: '16px 20px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                border: `2px solid ${mfaMode === opt.id ? 'var(--brand-500)' : 'var(--border)'}`,
                background: mfaMode === opt.id ? 'var(--brand-500)0d' : 'var(--bg-elevated)',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {mfaMode === 'totp' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issuer Name</label>
            <input
              type="text"
              className="input w-full p-3 border rounded-md"
              value={totpIssuer}
              onChange={e => setTotpIssuer(e.target.value)}
              placeholder="Your Company Name"
            />
          </div>
          <div>
             <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Window Offset</label>
             <input
               type="number"
               min={0} max={2}
               className="input w-full p-3 border rounded-md"
               value={totpWindow}
               onChange={e => setTotpWindow(Number(e.target.value))}
             />
             <div className="text-xs mt-1 text-gray-500">Allowable clock drift in 30s steps (default 1).</div>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={backupCodes} onChange={e => setBackupCodes(e.target.checked)} />
              Enable backup codes for recovery
            </label>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow font-medium rounded-md text-sm px-6 py-2 transition-colors disabled:opacity-50" onClick={handleSave} disabled={loading}>
          Save MFA Configuration
        </button>
        {saved && <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>✓ Saved!</span>}
      </div>
    </div>
  );
}


function RbacSection() {
  const { tenant } = useAuth();
  const [restrictions, setRestrictions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const ALL_ROLES = ['admin', 'family_office_manager', 'wealth_manager', 'client', 'analyst', 'operations'];

  useEffect(() => {
    if (!tenant?.id) return;
    const fetchConfig = async () => {
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch(`/api/admin/tenant-config?tenantId=${tenant.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.navRestrictions) {
          setRestrictions(data.navRestrictions);
        }
      } catch (e) {
        console.error('Failed to load nav Restrictions config', e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [tenant?.id]);

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) return;
      await fetch('/api/admin/tenant-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          navRestrictions: restrictions
        })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('Failed to save nav restrictions', e);
    } finally {
      setSaving(false);
    }
  };

  const navItems = useMemo(() => {
    if (!tenant) return [];
    let sourceNav = tenant.isInternal ? PLATFORM_NAV : getVerticalNav((tenant as any).industryVertical ?? DEFAULT_VERTICAL);
    return sourceNav.flatMap(s => s.items).concat(sourceNav.flatMap(s => s.items.flatMap(i => (i as any).subItems ?? [])));
  }, [tenant]);

  const toggleRole = (href: string, role: string) => {
    setRestrictions(prev => {
      const currentRoles = prev[href] ?? [];
      const newRoles = currentRoles.includes(role) 
        ? currentRoles.filter(r => r !== role)
        : [...currentRoles, role];
        
      const next = { ...prev };
      if (newRoles.length === 0) {
        delete next[href];
      } else {
        next[href] = newRoles;
      }
      return next;
    });
  };

  return (
    <div className="animate-fade-in bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-6">
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Navigation Access Control</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Restrict which roles can access specific views within the workspace. By default, all roles have access to all visible menu items unless explicitly restricted here.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
               <th className="p-3 text-xs uppercase tracking-wider text-gray-500 font-semibold">Menu Item</th>
               {ALL_ROLES.map(role => (
                  <th key={role} className="p-3 text-xs uppercase tracking-wider text-gray-500 font-semibold text-center">
                    {role.replace(/_/g, ' ')}
                  </th>
               ))}
            </tr>
          </thead>
          <tbody>
             {navItems.map(item => (
                <tr key={item.href} className="border-b border-gray-100 hover:bg-gray-50">
                   <td className="p-3 text-sm font-medium text-gray-800">
                     <span className="font-mono text-xs text-gray-500 mr-2">{item.href}</span><br />
                     {item.label ?? (item as any).labelKey}
                   </td>
                   {ALL_ROLES.map(role => {
                      const isAllowed = restrictions[item.href] ? restrictions[item.href].includes(role) : true;
                      
                      return (
                        <td key={role} className="p-3 text-center">
                           <input 
                             type="checkbox" 
                             checked={isAllowed} 
                             onChange={() => toggleRole(item.href, role)} 
                             className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded cursor-pointer"
                           />
                        </td>
                      )
                   })}
                </tr>
             ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: '24px' }}>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow font-medium rounded-md text-sm px-6 py-2 transition-colors disabled:opacity-50" onClick={handleSave} disabled={saving || loading}>
          Save Access Policies
        </button>
        {saved && <span style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>✓ Policies applied globally!</span>}
      </div>
    </div>
  )
}


export default function SecurityPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security & Access Hub</h1>
          <p className="text-gray-500">Manage tenant multi-factor authentication policies and Role-Based Access Controls (RBAC).</p>
        </div>
      </div>
      
      <RbacSection />
      
      <MfaSection />
    </div>
  );
}
