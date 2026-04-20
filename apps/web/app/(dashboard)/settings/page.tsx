'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useTheme, PRESET_THEMES, FONTS } from '@/lib/ThemeContext';
import type { FontFamily } from '@/lib/ThemeContext';
import { useUserSettings } from '@/lib/UserSettingsContext';
import { useTranslation } from '@/lib/i18n/context';
import { saveUserProfile, uploadAvatar, uploadSignatureImage } from '@/lib/userProfileService';
import { getUserTimezone, groupedTimezones } from '@/lib/timezones';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/lib/tenantMemberService';
import { Avatar } from '@/components/Avatar';
import { MailIntegrationSection } from '@/components/MailIntegrationSection';
import { MessagingIntegrationSection } from '@/components/MessagingIntegrationSection';

import { User, Palette, Mail, MessageSquare, Calendar, Bell, Database, RefreshCw } from 'lucide-react';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6,
};

function ProfileSection() {
  const { user, userProfile } = useAuth();
  const { language, setLanguage } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(userProfile?.displayName ?? user?.name ?? '');
  const [phone,       setPhone]       = useState((userProfile as any)?.phone ?? '');
  const [timezone,    setTimezone]    = useState((userProfile as any)?.timezone ?? getUserTimezone());
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  
  const [jobTitle, setJobTitle] = useState((userProfile as any)?.jobTitle ?? '');
  const [address, setAddress] = useState((userProfile as any)?.address ?? '');
  const [useCustomAddressForSignature, setUseCustomAddressForSignature] = useState((userProfile as any)?.useCustomAddressForSignature ?? false);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (userProfile) {
      setDisplayName((userProfile as any).displayName ?? user?.name ?? '');
      setPhone((userProfile as any).phone ?? '');
      setTimezone((userProfile as any).timezone ?? getUserTimezone());
      setJobTitle((userProfile as any).jobTitle ?? '');
      setAddress((userProfile as any).address ?? '');
      setUseCustomAddressForSignature((userProfile as any).useCustomAddressForSignature ?? false);
      if ((userProfile as any).language) {
        setLanguage((userProfile as any).language);
      }
    }
  }, [(userProfile as any)?.uid]);

  function handleAvatarPick(dataUrl: string) {
    setAvatarPreview(dataUrl);
    fetch(dataUrl).then(r => r.blob()).then(blob => setAvatarFile(new File([blob], 'avatar.jpg', { type: blob.type })));
  }

  function handleSignaturePick(dataUrl: string) {
    setSignaturePreview(dataUrl);
    fetch(dataUrl).then(r => r.blob()).then(blob => setSignatureFile(new File([blob], 'signature.png', { type: blob.type })));
  }

  async function handleSave() {
    if (!user?.uid) return;
    setSaving(true); setMsg(null);
    try {
      let photoURL: string | null = userProfile?.photoURL ?? null;
      let signatureImageURL: string | null = (userProfile as any)?.signatureImageURL ?? null;
      
      if (avatarFile) photoURL = await uploadAvatar(user.uid, avatarFile);
      if (signatureFile) signatureImageURL = await uploadSignatureImage(user.uid, signatureFile);

      await saveUserProfile(user.uid, { 
        displayName, phone, timezone, language, jobTitle, address, useCustomAddressForSignature,
        ...(photoURL !== undefined ? { photoURL } : {}),
        ...(signatureImageURL !== undefined ? { signatureImageURL } : {})
      });
      
      setMsg({ type: 'ok', text: '✅ Profile saved.' });
      setAvatarFile(null);
      setSignatureFile(null);
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg({ type: 'err', text: `❌ ${e.message}` });
    } finally { setSaving(false); }
  }

  const groups   = groupedTimezones();
  const currentSrc = avatarPreview ?? userProfile?.photoURL ?? user?.photoURL ?? null;
  const currentSigSrc = signaturePreview ?? (userProfile as any)?.signatureImageURL ?? null;
  const canEditAddress = ['saas_master_admin', 'tenant_admin', 'executive', 'wealth_manager'].includes(userProfile?.role ?? '');

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Avatar src={currentSrc} name={displayName || user?.name} size="xl" shape="circle" editable onUpload={handleAvatarPick} />
        <div>
          <div className="font-bold text-sm tracking-tight text-[var(--text-primary)]">{displayName || user?.name}</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">{user?.email}</div>
          <button className="text-xs font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary)]/80 mt-2 transition-colors" onClick={() => fileInputRef.current?.click()}>
            📷 Change Photo
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => handleAvatarPick(ev.target?.result as string); r.readAsDataURL(f); e.target.value = ''; }}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label style={labelStyle}>Display Name</label>
          <input className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm transition-colors focus:border-[var(--brand-primary)] focus:outline-none" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your full name" />
        </div>
        <div>
          <label style={labelStyle}>Email Address</label>
          <input className="w-full px-3 py-2 bg-[var(--bg-muted)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-secondary)] cursor-not-allowed" value={user?.email ?? ''} disabled />
          <div className="text-[10px] text-[var(--text-tertiary)] mt-1">Managed by your auth provider.</div>
        </div>
        <div>
          <label style={labelStyle}>Phone Number</label>
          <input className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm transition-colors focus:border-[var(--brand-primary)] focus:outline-none" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
        </div>
        <div>
          <label style={labelStyle}>Preferred Language</label>
          <select value={language} onChange={e => setLanguage(e.target.value as any)} className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm transition-colors focus:border-[var(--brand-primary)] focus:outline-none text-[var(--text-primary)]">
            <option value="en-US">English (US)</option>
            <option value="pt-BR">Português (BR)</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label style={labelStyle}>Time Zone</label>
          <select className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm transition-colors focus:border-[var(--brand-primary)] focus:outline-none text-[var(--text-primary)]" value={timezone} onChange={e => setTimezone(e.target.value)}>
            {Object.entries(groups).map(([region, zones]) => (
              <optgroup key={region} label={region}>
                {zones.map((tz: any) => <option key={tz.value} value={tz.value}>{tz.utcOffset} — {tz.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 mt-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 mb-4">Professional & Signature Identity</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label style={labelStyle}>Company Title / Job Role</label>
              <input className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm transition-colors focus:border-[var(--brand-primary)] focus:outline-none placeholder-gray-400" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Chief Financial Officer" />
            </div>
            <div>
              <label style={labelStyle} className="flex justify-between items-center">
                <span>Business Address</span>
                {canEditAddress && (
                  <label className="flex items-center gap-2 cursor-pointer lowercase text-[10px] text-[var(--text-secondary)] font-normal normal-case">
                    <input type="checkbox" checked={useCustomAddressForSignature} onChange={e => setUseCustomAddressForSignature(e.target.checked)} className="rounded border-gray-300" />
                    Override Firm Default
                  </label>
                )}
              </label>
              <textarea 
                className={`w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm transition-colors focus:border-[var(--brand-primary)] focus:outline-none min-h-[80px] ${!canEditAddress ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`}
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                placeholder="Full formatted address for legal documents..." 
                disabled={!canEditAddress && !useCustomAddressForSignature}
              />
              {!canEditAddress && <div className="text-[10px] text-orange-600 mt-1">Requires Tenant Admin, Wealth Manager, or Executive permissions to customize address.</div>}
            </div>
          </div>
          
          <div className="mt-6">
            <label style={labelStyle}>Digital Signature Image</label>
            <div className="flex items-end gap-4">
              <div 
                className="w-[280px] h-[100px] rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--bg-muted)] flex items-center justify-center overflow-hidden relative cursor-pointer hover:border-[var(--brand-primary)] transition-colors"
                onClick={() => signatureInputRef.current?.click()}
              >
                {currentSigSrc ? (
                  <img src={currentSigSrc} alt="Signature" className="h-full object-contain" />
                ) : (
                  <div className="text-xs text-[var(--text-tertiary)] flex flex-col items-center gap-1">
                    <span className="text-lg">✍️</span>
                    <span>Click to attach signature (PNG/JPG)</span>
                  </div>
                )}
              </div>
              <input ref={signatureInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => handleSignaturePick(ev.target?.result as string); r.readAsDataURL(f); e.target.value = ''; }}
              />
              {currentSigSrc && (
                 <button onClick={() => { setSignaturePreview(null); setSignatureFile(null); if (signatureInputRef.current) signatureInputRef.current.value = ''; }} className="text-xs text-red-500 hover:underline mb-2">Clear</button>
              )}
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)] mt-2 max-w-sm">For best results, upload a PNG image of your signature with a transparent background. This will be automatically scaled to fit within signature blocks on e-signed documents.</div>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}
      
      <div className="flex gap-3 mt-2">
        <button className="px-5 py-2 bg-[var(--brand-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Profile Changes'}</button>
      </div>

      {userProfile && (
        <div className="mt-8 pt-6 border-t border-[var(--border)]">
          <label style={labelStyle}>Role & Access</label>
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex gap-4 mt-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--bg-muted)] text-[var(--text-secondary)] text-xl shrink-0">🛡</div>
            <div>
              <div className="font-bold text-sm tracking-tight text-[var(--text-primary)] mb-1">
                {ROLE_LABELS[userProfile.role as keyof typeof ROLE_LABELS] ?? userProfile.role}
              </div>
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">
                {ROLE_DESCRIPTIONS[userProfile.role as keyof typeof ROLE_DESCRIPTIONS] ?? 'Custom role assignment.'}
              </div>
              {(userProfile.tenantIds ?? []).length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {(userProfile.tenantIds ?? []).map((tid: string) => (
                    <span key={tid} className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)]">
                      {tid}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppearanceSection() {
  const { theme, setThemeById, fontOverride, setFontOverride, resetCustom } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  
  const hasCustom = fontOverride !== null;
  const darkThemes  = PRESET_THEMES.filter(t => t.mode === 'dark');
  const lightThemes = PRESET_THEMES.filter(t => t.mode === 'light');

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center justify-between mb-3">
          <label style={labelStyle} className="!mb-0">Interface Font</label>
          {hasCustom && <button onClick={resetCustom} className="text-[11px] font-medium text-amber-500 hover:text-amber-600 transition-colors">↺ Reset Default</button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FONTS.map(f => {
            const active = (fontOverride ?? theme.font) === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFontOverride(active ? null : f.id as FontFamily)}
                className={`p-4 rounded-xl text-left border transition-all ${active ? 'bg-[var(--brand-faint)] border-[var(--brand-primary)] shadow-sm' : 'bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--brand-subtle)]'}`}
              >
                <div style={{ fontFamily: f.stack }} className={`text-sm ${active ? 'font-bold text-[var(--brand-primary)]' : 'font-medium text-[var(--text-primary)]'}`}>{f.label}</div>
                <div className={`text-[11px] mt-1 ${active ? 'text-[var(--brand-muted)] font-medium' : 'text-[var(--text-tertiary)]'}`}>{f.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Color Theme</label>
        <div className="mb-5">
          <div className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Dark</div>
          <div className="flex gap-3 flex-wrap">
            {darkThemes.map(t => (
              <button key={t.id} title={t.name} onClick={() => setThemeById(t.id)}
                className="w-8 h-8 rounded-full border-2 transition-all relative overflow-hidden"
                style={{ background: t.accent, borderColor: theme.id === t.id ? 'white' : 'transparent', boxShadow: theme.id === t.id ? `0 0 0 2px ${t.accent}` : 'none' }}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Light</div>
          <div className="flex gap-3 flex-wrap">
            {lightThemes.map(t => (
              <button key={t.id} title={t.name} onClick={() => setThemeById(t.id)}
                className="w-8 h-8 rounded-full border-2 transition-all relative overflow-hidden"
                style={{ background: t.accent, borderColor: theme.id === t.id ? 'rgba(0,0,0,0.8)' : 'transparent', boxShadow: theme.id === t.id ? `0 0 0 2px ${t.accent}` : 'none' }}
              />
            ))}
          </div>
        </div>
        <div className="mt-4 text-xs font-bold text-[var(--brand-primary)] bg-[var(--brand-faint)] inline-block px-3 py-1.5 rounded-md">
          {theme.emoji} Active: {theme.name} · {(fontOverride ?? theme.font)}
        </div>
      </div>
      
    </div>
  );
}

function Toggle({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] gap-4">
      <div>
        <div className="text-sm font-bold tracking-tight text-[var(--text-primary)]">{label}</div>
        <div className="text-xs text-[var(--text-secondary)] mt-1">{desc}</div>
      </div>
      <button onClick={() => setOn(v => !v)} className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${on ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)]' : 'bg-[var(--bg-elevated)] border-[var(--border)]'} border flex items-center`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
      </button>
    </div>
  );
}

type SettingsSection = 'profile' | 'workspace' | 'appearance' | 'mail' | 'messaging' | 'calendar' | 'notifications' | 'data_sources' | 'compliance';

function DataSourcesSection() {
  const { user } = useAuth();
  const [activeSource, setActiveSource] = useState<string | null>(null);
  
  const sources = [
    { id: 'odoo', name: 'Odoo ERP', icon: 'https://www.google.com/s2/favicons?domain=odoo.com&sz=128', color: '#714B67' },
    { id: 'salesforce', name: 'Salesforce', icon: 'https://www.google.com/s2/favicons?domain=salesforce.com&sz=128', color: '#00A1E0' },
    { id: 'hubspot', name: 'HubSpot', icon: 'https://www.google.com/s2/favicons?domain=hubspot.com&sz=128', color: '#FF7A59' },
    { id: 'servicenow', name: 'ServiceNow', icon: 'https://www.google.com/s2/favicons?domain=servicenow.com&sz=128', color: '#81B5A1' },
    { id: 'excel', name: 'Microsoft Excel', icon: 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=128', color: '#107C41' },
    { id: 'googlesheets', name: 'Google Sheets', icon: 'https://www.google.com/s2/favicons?domain=sheets.google.com&sz=128', color: '#0F9D58' },
  ];

  const [creds, setCreds] = useState<any>({ url: '', db: '', username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{type: 'ok' | 'err', text: string} | null>(null);

  useEffect(() => {
    if (!user?.uid || !activeSource) return;
    setLoading(true);
    getDoc(doc(getFirestore(), 'users', user.uid, 'settings', `data_sources_${activeSource}`))
      .then(snap => {
        if (snap.exists()) setCreds(snap.data());
        else setCreds({ url: '', db: '', username: '', password: '' });
      })
      .finally(() => setLoading(false));
  }, [user?.uid, activeSource]);

  const handleSave = async () => {
    if (!user?.uid || !activeSource) return;
    setLoading(true); setMsg(null);
    try {
      await setDoc(doc(getFirestore(), 'users', user.uid, 'settings', `data_sources_${activeSource}`), creds, { merge: true });
      setMsg({ type: 'ok', text: 'Credentials saved successfully.' });
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message || 'Error saving credentials.' });
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <label style={labelStyle}>External Data Sources</label>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Connect external systems to enable "on-the-fly" raw data imports directly within CRM objects.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {sources.map(s => (
            <button key={s.id} onClick={() => setActiveSource(s.id)}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${activeSource === s.id ? 'bg-[var(--brand-faint)] border-[var(--brand-primary)] shadow-sm' : 'bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--brand-subtle)]'}`}
            >
              <div className="w-8 h-8 rounded flex items-center justify-center p-0.5 bg-white shadow-sm border border-gray-100">
                 <img src={s.icon} className="w-full h-full object-contain rounded-sm" alt={s.name} />
              </div>
              <div className={`text-xs font-bold ${activeSource === s.id ? 'text-[var(--brand-primary)]' : 'text-[var(--text-primary)]'}`}>{s.name}</div>
            </button>
          ))}
        </div>
      </div>

      {activeSource && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center p-1 bg-white shadow-sm border border-gray-200">
              <img src={sources.find(s => s.id === activeSource)?.icon} alt="Icon" className="w-full h-full object-contain" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Configure {sources.find(s => s.id === activeSource)?.name} Access</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Host / API URL {activeSource === 'googlesheets' ? '(Spreadsheet ID)' : activeSource === 'excel' ? '(File ID)' : ''}</label>
              <input type="text" className="w-full px-3 py-2 bg-[var(--bg-background)] border border-[var(--border)] rounded-lg text-sm" 
                 value={creds.url} onChange={e => setCreds({...creds, url: e.target.value})} placeholder={activeSource === 'googlesheets' ? "1BxiMVs0XRA5..." : "https://..."} />
            </div>
            {activeSource !== 'googlesheets' && activeSource !== 'excel' && activeSource !== 'hubspot' && (
              <div>
                <label style={labelStyle}>Database / Environment</label>
                <input type="text" value={creds.db} onChange={(e) => setCreds({...creds, db: e.target.value})} placeholder="Database name, Sandbox, etc" className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--bg-default)] text-[var(--text-primary)]" />
              </div>
            )}
            {activeSource !== 'googlesheets' && activeSource !== 'excel' && activeSource !== 'hubspot' && (
              <div>
                <label style={labelStyle}>Username</label>
                <input type="text" className="w-full px-3 py-2 bg-[var(--bg-background)] border border-[var(--border)] rounded-lg text-sm" 
                   value={creds.username} onChange={e => setCreds({...creds, username: e.target.value})} placeholder="admin" />
              </div>
            )}
            <div>
              <label style={labelStyle}>Password / Token {activeSource==='hubspot'?'(Private App Token)':activeSource==='googlesheets'?'(API Key)':activeSource==='excel'?'(Bearer Token)':''}</label>
              <input type="password" className="w-full px-3 py-2 bg-[var(--bg-background)] border border-[var(--border)] rounded-lg text-sm" 
                 value={creds.password} onChange={e => setCreds({...creds, password: e.target.value})} placeholder="••••••••" />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4 flex-wrap">
             <button onClick={handleSave} disabled={loading} className="px-5 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-semibold rounded-lg hover:bg-[var(--bg-surface)] transition-colors">
               Save Credentials
             </button>
             
             {(activeSource === 'hubspot' || activeSource === 'googlesheets' || activeSource === 'excel') && creds.password && (
               <button onClick={async () => {
                   setLoading(true); setMsg(null);
                   try {
                     const tId = JSON.parse(localStorage.getItem('mfo_active_tenant') || '{}').id;
                     if (!tId) throw new Error("No active tenant selected.");
                     
                     const res = await fetch('/api/admin/integrations/sync', { 
                       method: 'POST', 
                       body: JSON.stringify({ tenantId: tId, source: activeSource, creds }) 
                     });
                     
                     const data = await res.json();
                     if (!res.ok) throw new Error(data.error || 'Sync failed');
                     setMsg({ type: 'ok', text: data.message });
                   } catch(e: any) {
                     setMsg({ type: 'err', text: e.message });
                   } finally {
                     setLoading(false);
                     setTimeout(() => setMsg(null), 5000);
                   }
               }} disabled={loading} className="flex gap-2 items-center px-5 py-2 bg-[var(--brand-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap">
                  {loading ? 'Syncing...' : 'Sync Data Now'}
               </button>
             )}
             
             {msg && (
               <span className={`text-sm font-medium ${msg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</span>
             )}
          </div>
        </div>
      )}
    </div>
  );
}


function ComplianceFrameworksSection() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <label style={labelStyle}>Regulatory Frameworks & Privacy</label>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Enable or disable compliance and privacy frameworks based on your operating vertical. These settings activate dedicated modules, required workflows, and compliance checks across the CRM.
        </p>
      </div>
      
      <Toggle 
        label="CVM & Asset Management" 
        desc="Enable modules for tracking Suitability, KYP (Know Your Product), and CVM regulatory queues." 
        defaultOn={false} 
      />
      
      <Toggle 
        label="AnBima & Wealth (MFO)" 
        desc="Enable extensive KYC, AML/PLD reporting, and risk assessment scoring tailored for family offices." 
        defaultOn={true} 
      />
      
      <Toggle 
        label="LGPD Privacy Framework" 
        desc="Activate Data Subject Requests (DSR), Consent Logs, and DPIA tracking." 
        defaultOn={true} 
      />
    </div>
  );
}

function WorkspaceSection() {
  const { tenant, user } = useAuth();
  const db = getFirestore();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<{ roleId: string; visible: boolean; order: number }[]>([]);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (tenant?.id && user?.uid) {
      getDoc(doc(db, 'tenants', tenant.id, 'members', user.uid))
        .then(snap => {
          if (snap.exists()) {
             const data = snap.data();
             setMember(data);
             let roles = Array.from(new Set([data.role, ...(data.additionalRoles || [])])).filter(Boolean) as string[];
             
             if (roles.includes('tenant_admin') || roles.includes('saas_master_admin')) {
               const allWidgets = ['tenant_admin', 'cio', 'relationship_manager', 'controller', 'compliance_officer', 'report_viewer'];
               roles = Array.from(new Set([...roles, ...allWidgets]));
             }

             let p = data.dashboardPreferences || [];
             const newPrefs = roles.map((r, i) => {
               const exist = p.find((x: any) => x.roleId === r);
               if (exist) return exist;
               return { roleId: r, visible: true, order: i };
             });
             newPrefs.sort((a,b) => a.order - b.order);
             setPrefs(newPrefs);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [tenant?.id, user?.uid]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPrefs = [...prefs];
    [newPrefs[index-1], newPrefs[index]] = [newPrefs[index], newPrefs[index-1]];
    newPrefs.forEach((p, i) => p.order = i);
    setPrefs(newPrefs);
  };

  const moveDown = (index: number) => {
    if (index === prefs.length - 1) return;
    const newPrefs = [...prefs];
    [newPrefs[index+1], newPrefs[index]] = [newPrefs[index], newPrefs[index+1]];
    newPrefs.forEach((p, i) => p.order = i);
    setPrefs(newPrefs);
  };

  const toggleVis = (index: number) => {
    const newPrefs = [...prefs];
    newPrefs[index].visible = !newPrefs[index].visible;
    setPrefs(newPrefs);
  };

  const handleSave = async () => {
    if (!tenant?.id || !user?.uid) return;
    try {
       await updateDoc(doc(db, 'tenants', tenant.id, 'members', user.uid), {
         dashboardPreferences: prefs,
         updatedAt: new Date().toISOString()
       });
       setMsg({ type: 'ok', text: '✅ Saved dashboard preferences' });
       setTimeout(() => setMsg(null), 3000);
    } catch(e:any) {
       setMsg({ type: 'err', text: `❌ ${e.message}` });
    }
  };

  if (loading) return <div className="animate-pulse">Loading Workspace...</div>;

  return (
    <div className="flex flex-col gap-6 max-w-2xl animate-fade-in">
       <div>
         <label style={labelStyle}>Command Center Dashboards</label>
         <p className="text-sm text-[var(--text-secondary)] mb-4">
            You have access to multiple role-specific dashboards. Customize which ones appear in your Command Center and their order.
         </p>
       </div>
       
       <div className="space-y-3">
         {prefs.length === 0 && <div className="text-sm text-slate-500">No dashboard tabs available.</div>}
         {prefs.map((p, index) => (
           <div key={p.roleId} className="flex items-center justify-between p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
              <div>
                 <div className="font-bold text-slate-800">{ROLE_LABELS[p.roleId as keyof typeof ROLE_LABELS] ?? p.roleId}</div>
                 <div className="text-xs text-slate-500 mt-0.5">Role Identifier: {p.roleId}</div>
              </div>
              <div className="flex items-center gap-4">
                 <button onClick={() => toggleVis(index)} className={`text-xs font-bold px-3 py-1 rounded-full ${p.visible ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                   {p.visible ? 'Visible' : 'Hidden'}
                 </button>
                 <div className="flex flex-col gap-1">
                    <button disabled={index === 0} onClick={() => moveUp(index)} className="text-slate-400 hover:text-[var(--brand-primary)] disabled:opacity-30 transition">▲</button>
                    <button disabled={index === prefs.length - 1} onClick={() => moveDown(index)} className="text-slate-400 hover:text-[var(--brand-primary)] disabled:opacity-30 transition">▼</button>
                 </div>
              </div>
           </div>
         ))}
       </div>

       {msg && (
         <div className={`px-4 py-3 rounded-lg text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
           {msg.text}
         </div>
       )}

       {prefs.length > 0 && (
         <div className="mt-2 border-t border-[var(--border)] pt-6">
           <button className="px-5 py-2 bg-[var(--brand-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap" onClick={handleSave}>Save Workspace</button>
         </div>
       )}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as SettingsSection | null;
  const [activeTab, setActiveTab] = useState<SettingsSection>(tabParam || 'profile');
  const { tickerSpeed, setTickerSpeed } = useUserSettings();

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const setParamTab = (tab: SettingsSection) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `?tab=${tab}`);
  };

  const navItems: { id: SettingsSection; icon: React.ReactNode; label: string }[] = [
    { id: 'profile',       icon: <User size={16} />, label: 'Profile Settings' },
    { id: 'workspace',     icon: <RefreshCw size={16} />, label: 'Workspace & Hub' },
    { id: 'appearance',    icon: <Palette size={16} />, label: 'Appearance & UI' },
    { id: 'data_sources',  icon: <Database size={16} />, label: 'External Sources' },
    { id: 'compliance',    icon: <span className="font-serif italic font-bold">C</span>, label: 'Compliance & Risk' },
    { id: 'mail',          icon: <Mail size={16} />, label: 'Mail Integration' },
    { id: 'messaging',     icon: <MessageSquare size={16} />, label: 'Messaging Sync' },
    { id: 'calendar',      icon: <Calendar size={16} />, label: 'Calendar Engine' },
    { id: 'notifications', icon: <Bell size={16} />, label: 'Notifications Hub' },
  ];

  return (
    <div className="absolute inset-0 flex flex-col animate-fade-in w-full bg-[var(--bg-background)] overflow-hidden">
      <div className="flex flex-col md:flex-row h-full relative text-left">
        {/* Left Side Navigation Pane */}
        <div className="w-full md:w-[260px] lg:w-[300px] bg-[var(--bg-canvas)] border-b md:border-b-0 md:border-r border-[var(--border)] flex flex-col shrink-0 py-6 px-4">
           <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)] mb-4 ml-1">Configuration</div>
           <nav className="flex flex-col gap-1">
             {navItems.map(item => (
               <button 
                 key={item.id} 
                 onClick={() => setParamTab(item.id)}
                 className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${activeTab === item.id ? 'bg-[var(--brand-faint)] text-[var(--brand-primary)] font-bold' : 'text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'}`}
               >
                 <span className={`shrink-0 ${activeTab === item.id ? 'text-[var(--brand-primary)]' : 'text-[var(--text-tertiary)]'}`}>{item.icon}</span>
                 {item.label}
               </button>
             ))}
           </nav>
        </div>

        {/* Right Content Pane */}
        <div className="flex-1 overflow-y-auto bg-[var(--bg-surface)] p-6 md:p-10 relative">
           <div className="max-w-5xl">
             <div className="mb-8">
               <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                 {navItems.find(n => n.id === activeTab)?.label}
               </h1>
               <p className="text-sm text-[var(--text-tertiary)] font-medium mt-1">
                 Manage your personal preferences, integrations, and workspace settings.
               </p>
             </div>

             {activeTab === 'profile'       && <ProfileSection />}
             {activeTab === 'workspace'     && <WorkspaceSection />}
             {activeTab === 'appearance'    && <AppearanceSection />}
             { activeTab === 'data_sources'  && <DataSourcesSection /> }
             { activeTab === 'compliance'    && <ComplianceFrameworksSection /> }
             { activeTab === 'mail'          && <MailIntegrationSection /> }
             {activeTab === 'messaging'     && <MessagingIntegrationSection />}
             {activeTab === 'calendar'      && (
                <div className="flex flex-col gap-6 max-w-2xl">
                  <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-canvas)] flex items-start gap-5">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 shrink-0">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Calendar sync is automatic via email integration</h3>
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                        Calendar sync uses the same OAuth connection as your Mail Integration. Events from connected Outlook or Google Calendar accounts will automatically appear in your centralized platform calendar.
                      </p>
                      <button onClick={() => setParamTab('mail')} className="text-xs font-semibold text-[var(--brand-primary)] hover:underline">
                        Configure Sync Window in Mail Settings →
                      </button>
                    </div>
                  </div>

                  <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Ticker Overlay Speed</h3>
                    <input type="range" min="20" max="400" step="10" value={420 - tickerSpeed} onChange={e => setTickerSpeed(420 - parseInt(e.target.value, 10))}
                      className="w-full accent-[var(--brand-primary)] cursor-pointer" />
                    <div className="flex justify-between items-center mt-2 text-xs font-semibold text-[var(--text-tertiary)]">
                      <span>Slow</span><span>Fast</span>
                    </div>
                  </div>
                </div>
             )}
             {activeTab === 'notifications' && (
                <div className="flex flex-col gap-3 max-w-2xl">
                  {[
                    { label: 'SLA breach alerts',    desc: 'Notify when a task SLA is about to expire',    defaultOn: true  },
                    { label: 'Unassigned task alert',desc: 'Alert when a task stays unassigned beyond SLA', defaultOn: true  },
                    { label: 'Capital call reminders',desc: 'Remind 48h before capital call due dates',     defaultOn: true  },
                    { label: 'KYC review due',       desc: 'Alert 7 days before KYC renewal is required',  defaultOn: false },
                    { label: 'Email digest',         desc: 'Daily summary email of open tasks',             defaultOn: false },
                  ].map(n => <Toggle key={n.label} {...n} />)}
                </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
