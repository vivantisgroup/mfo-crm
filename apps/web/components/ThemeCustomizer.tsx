'use client';

import React, { useRef, useState } from 'react';
import { useTheme, PRESET_THEMES, FONTS, type FontFamily } from '@/lib/ThemeContext';

// ─── Shared label style ───────────────────────────────────────────────────────
const LS: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
};

// ─── File → DataURL helper ────────────────────────────────────────────────────
function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target!.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ─── Logo uploader ─────────────────────────────────────────────────────────────
function LogoUploader({ label, value, onChange, size, round }: {
  label: string; value: string | null; onChange: (v: string | null) => void;
  size: number; round?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const r = round ? '50%' : '10px';

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={LS}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          onClick={() => ref.current?.click()}
          style={{
            width: size, height: size, borderRadius: r, cursor: 'pointer',
            background: value ? 'transparent' : 'var(--bg-elevated)',
            border: `2px dashed ${value ? 'var(--brand-primary)' : 'var(--border-strong)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0, transition: 'border-color 0.15s',
          }}
          title={`Upload ${label}`}
        >
          {value
            ? <img src={value} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <span style={{ fontSize: size * 0.35, color: 'var(--text-tertiary)' }}>+</span>
          }
        </div>
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => ref.current?.click()} style={{ marginBottom: 4 }}>
            {value ? '↺ Replace' : '↑ Upload'}
          </button>
          {value && (
            <button className="btn btn-ghost btn-sm" onClick={() => onChange(null)}
              style={{ color: '#ef4444', display: 'block' }}>✕ Remove</button>
          )}
        </div>
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={async e => {
            const f = e.target.files?.[0];
            if (f) { onChange(await readFile(f)); e.target.value = ''; }
          }} />
      </div>
    </div>
  );
}

// ─── Theme Card ───────────────────────────────────────────────────────────────
function ThemeCard({ t, active, onClick }: { t: typeof PRESET_THEMES[0]; active: boolean; onClick: () => void }) {
  const dark = t.mode === 'dark';
  return (
    <button onClick={onClick} title={t.name} style={{
      all: 'unset', cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
      border: `2px solid ${active ? t.accent : 'var(--border-subtle)'}`,
      boxShadow: active ? `0 0 0 2px ${t.accent}44` : 'none',
      transition: 'all 0.15s', display: 'flex', flexDirection: 'column',
      background: dark ? '#111' : '#fff',
      color: dark ? '#fff' : '#000',
    }}>
      <div style={{ flex: 1, padding: '16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
         <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.accent }} />
         <span style={{ fontSize: 24 }}>{t.emoji}</span>
      </div>
      <div style={{ background: dark ? '#0a0a0a' : '#f8fafc', padding: '6px 8px', borderTop: `1px solid ${dark ? '#333' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>{t.name}</span>
        {active && <span style={{ marginLeft: 'auto', fontSize: 10, color: t.accent }}>✓</span>}
      </div>
    </button>
  );
}

// ─── Main Customizer ──────────────────────────────────────────────────────────

export function ThemeCustomizer() {
  const {
    theme, fontOverride,
    setThemeById, setFontOverride, resetCustom,
    companyLogo, companyLogoSmall, setCompanyLogo, setCompanyLogoSmall,
    customizerOpen, setCustomizerOpen, setTenantBranding, getEntityAvatar, setEntityAvatar
  } = useTheme();

  const [tab, setTab] = useState<'themes' | 'fonts' | 'brand'>('themes');
  const darkThemes  = PRESET_THEMES.filter(t => t.mode === 'dark');
  const lightThemes = PRESET_THEMES.filter(t => t.mode === 'light');
  const hasCustom   = fontOverride !== null;

  if (!customizerOpen) return null;

  const TAB_BTN = (id: typeof tab, label: string) => (
    <button key={id} onClick={() => setTab(id)}
      style={{
        flex: 1, padding: '10px 4px', fontSize: 12, fontWeight: tab === id ? 700 : 500,
        background: 'none', border: 'none', cursor: 'pointer',
        color: tab === id ? 'var(--brand-primary)' : 'var(--text-secondary)',
        borderBottom: `2px solid ${tab === id ? 'var(--brand-primary)' : 'transparent'}`,
        transition: 'all 0.15s',
      }}>
      {label}
    </button>
  );

  return (
    <>
      <div onClick={() => setCustomizerOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(0,0,0,0.35)' }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 300,
        width: 380, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-strong)',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-elevated)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>🎨 Appearance</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Theme · Fonts · Branding
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {hasCustom && (
              <button className="btn btn-ghost btn-sm" onClick={resetCustom}
                style={{ fontSize: 12, color: '#f59e0b' }}>↺ Reset</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setCustomizerOpen(false)}
              style={{ fontSize: 18, padding: '2px 8px' }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          {TAB_BTN('themes', '🎨 Themes')}
          {TAB_BTN('fonts',  '🔤 Fonts')}
          {TAB_BTN('brand',  '🏢 Brand')}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Themes ── */}
          {tab === 'themes' && (
            <>
              <div>
                <label style={LS}>Light Themes</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {lightThemes.map(t => (
                    <ThemeCard key={t.id} t={t} active={theme.id === t.id} onClick={() => setThemeById(t.id)} />
                  ))}
                </div>
              </div>
              <div>
                <label style={LS}>Dark Themes</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {darkThemes.map(t => (
                    <ThemeCard key={t.id} t={t} active={theme.id === t.id} onClick={() => setThemeById(t.id)} />
                  ))}
                </div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                  {theme.emoji} {theme.name} 
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)'}}>Mode: {theme.mode.toUpperCase()}</div>
                <div style={{ height: 16, marginTop: 12, borderRadius: 6, background: theme.accent, width: '100%' }} />
              </div>
            </>
          )}

          {/* ── Fonts ── */}
          {tab === 'fonts' && (
            <>
              <div>
                <label style={LS}>Typeface <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(Google Fonts)</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FONTS.map(f => {
                    const active = (fontOverride ?? theme.font) === f.id;
                    return (
                      <button key={f.id} onClick={() => setFontOverride(active ? null : f.id as FontFamily)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                          background: active ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                          border: `1.5px solid ${active ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                          color: active ? 'var(--brand-primary)' : 'var(--text-primary)',
                          transition: 'all 0.15s',
                        }}>
                        <div>
                          <span style={{ fontFamily: f.stack, fontSize: 15, fontWeight: 600 }}>{f.label}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8, fontFamily: f.stack }}>
                            Aa 123
                          </span>
                        </div>
                        {active && <span style={{ fontSize: 14 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Brand & Avatars ── */}
          {tab === 'brand' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Upload your company logos. They appear in the sidebar and throughout the platform.
              </div>

              <LogoUploader label="Full Company Logo" value={companyLogo} onChange={setCompanyLogo} size={72} />
              <LogoUploader label="Logo Mark (icon / favicon)" value={companyLogoSmall} onChange={setCompanyLogoSmall} size={48} round />

              {/* Preview */}
              {(companyLogo || companyLogoSmall) && (
                <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border-strong)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Sidebar Preview</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {companyLogoSmall
                      ? <img src={companyLogoSmall} alt="logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} />
                      : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--brand-emphasis)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'white' }}>M</div>
                    }
                    {companyLogo
                      ? <img src={companyLogo} alt="logo-full" style={{ height: 32, maxWidth: 160, objectFit: 'contain' }} />
                      : <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>MFO Nexus</span>
                    }
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Preferences saved locally
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Trigger button (add to header/sidebar) ───────────────────────────────────
export function ThemeTrigger() {
  const { setCustomizerOpen } = useTheme();
  return (
    <button
      onClick={() => setCustomizerOpen(true)}
      title="Appearance Settings"
      className="icon-btn"
      style={{ position: 'relative' }}
      id="theme-customizer-trigger"
    >
      <span style={{ fontSize: 15 }}>🎨</span>
    </button>
  );
}
