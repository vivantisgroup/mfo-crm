'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useTheme, PRESET_THEMES, FONTS } from '@/lib/ThemeContext';
import type { FontFamily } from '@/lib/ThemeContext';
import { useUserSettings } from '@/lib/UserSettingsContext';
import { useTranslation } from '@/lib/i18n/context';
import { saveUserProfile, uploadAvatar } from '@/lib/userProfileService';
import { getUserTimezone, groupedTimezones } from '@/lib/timezones';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/lib/tenantMemberService';
import { Avatar } from '@/components/Avatar';
import { MailIntegrationSection } from '@/components/MailIntegrationSection';
import { MessagingIntegrationSection } from '@/components/MessagingIntegrationSection';

import { User, Palette, Mail, MessageSquare, Calendar, Bell } from 'lucide-react';

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6,
};

function ProfileSection() {
  const { user, userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(userProfile?.displayName ?? user?.name ?? '');
  const [phone,       setPhone]       = useState((userProfile as any)?.phone ?? '');
  const [timezone,    setTimezone]    = useState((userProfile as any)?.timezone ?? getUserTimezone());
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (userProfile) {
      setDisplayName((userProfile as any).displayName ?? user?.name ?? '');
      setPhone((userProfile as any).phone ?? '');
      setTimezone((userProfile as any).timezone ?? getUserTimezone());
    }
  }, [(userProfile as any)?.uid]);

  function handleAvatarPick(dataUrl: string) {
    setAvatarPreview(dataUrl);
    fetch(dataUrl).then(r => r.blob()).then(blob => setAvatarFile(new File([blob], 'avatar.jpg', { type: blob.type })));
  }

  async function handleSave() {
    if (!user?.uid) return;
    setSaving(true); setMsg(null);
    try {
      let photoURL: string | null = userProfile?.photoURL ?? null;
      if (avatarFile) photoURL = await uploadAvatar(user.uid, avatarFile);
      await saveUserProfile(user.uid, { displayName, phone, timezone, ...(photoURL !== undefined ? { photoURL } : {}) });
      setMsg({ type: 'ok', text: '✅ Profile saved.' });
      setAvatarFile(null);
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setMsg({ type: 'err', text: `❌ ${e.message}` });
    } finally { setSaving(false); }
  }

  const groups   = groupedTimezones();
  const currentSrc = avatarPreview ?? userProfile?.photoURL ?? user?.photoURL ?? null;

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
          <label style={labelStyle}>Time Zone</label>
          <select className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm transition-colors focus:border-[var(--brand-primary)] focus:outline-none text-[var(--text-primary)]" value={timezone} onChange={e => setTimezone(e.target.value)}>
            {Object.entries(groups).map(([region, zones]) => (
              <optgroup key={region} label={region}>
                {zones.map((tz: any) => <option key={tz.value} value={tz.value}>{tz.utcOffset} — {tz.label}</option>)}
              </optgroup>
            ))}
          </select>
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
      
      <div className="pt-6 border-t border-[var(--border)]">
        <label style={labelStyle}>Regional Settings</label>
        <select value={language} onChange={e => setLanguage(e.target.value as any)}
          className="w-full md:w-[200px] px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none">
          <option value="en-US">English (US)</option>
          <option value="pt-BR">Português (BR)</option>
        </select>
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

type SettingsSection = 'profile' | 'appearance' | 'mail' | 'messaging' | 'calendar' | 'notifications';


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
    { id: 'appearance',    icon: <Palette size={16} />, label: 'Appearance & UI' },
    { id: 'mail',          icon: <Mail size={16} />, label: 'Mail Integration' },
    { id: 'messaging',     icon: <MessageSquare size={16} />, label: 'Messaging Sync' },
    { id: 'calendar',      icon: <Calendar size={16} />, label: 'Calendar Engine' },
    { id: 'notifications', icon: <Bell size={16} />, label: 'Notifications Hub' },
  ];

  return (
    <div className="flex-1 bg-[var(--bg-background)] relative flex flex-col h-full overflow-hidden">
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
           <div className="max-w-4xl mx-auto">
             <div className="mb-8">
               <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                 {navItems.find(n => n.id === activeTab)?.label}
               </h1>
               <p className="text-sm text-[var(--text-tertiary)] font-medium mt-1">
                 Manage your personal preferences, integrations, and workspace settings.
               </p>
             </div>

             {activeTab === 'profile'       && <ProfileSection />}
             {activeTab === 'appearance'    && <AppearanceSection />}
             {activeTab === 'mail'          && <MailIntegrationSection />}
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
