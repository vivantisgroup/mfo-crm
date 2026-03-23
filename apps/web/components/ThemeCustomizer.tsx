'use client';

import React, { useRef, useState } from 'react';
import { useTheme, PRESET_THEMES, FONTS, type FontFamily, type ThemeVars } from '@/lib/ThemeContext';

// ─── Shared label style ───────────────────────────────────────────────────────
const LS: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
};

// ─── Custom colour row ────────────────────────────────────────────────────────
const COLOR_OVERRIDES: { key: keyof ThemeVars; label: string }[] = [
  { key: '--brand-500',      label: 'Accent / Primary' },
  { key: '--brand-400',      label: 'Accent Light' },
  { key: '--bg-canvas',      label: 'Page Background' },
  { key: '--bg-surface',     label: 'Surface' },
  { key: '--bg-elevated',    label: 'Elevated Panel' },
  { key: '--text-primary',   label: 'Text Primary' },
  { key: '--text-secondary', label: 'Text Secondary' },
  { key: '--sidebar-bg',     label: 'Sidebar Background' },
  { key: '--sidebar-accent', label: 'Sidebar Highlight' },
  { key: '--sidebar-text',   label: 'Sidebar Text' },
];

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
    <div>
      <label style={LS}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          onClick={() => ref.current?.click()}
          style={{
            width: size, height: size, borderRadius: r, cursor: 'pointer',
            background: value ? 'transparent' : 'var(--bg-elevated)',
            border: `2px dashed ${value ? 'var(--brand-500)' : 'var(--border-hover)'}`,
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
      border: `2px solid ${active ? t.accent : 'transparent'}`,
      boxShadow: active ? `0 0 0 2px ${t.accent}44` : '0 0 0 1px var(--border)',
      transition: 'all 0.15s', display: 'block',
    }}>
      {/* Mini UI preview */}
      <div style={{ background: t.vars['--bg-canvas'], display: 'flex', height: 56 }}>
        {/* Sidebar strip */}
        <div style={{ width: 14, background: t.vars['--sidebar-bg'], borderRight: `1px solid ${t.vars['--sidebar-border']}`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 5, gap: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: t.accent }} />
          {[1,2,3].map(i => (
            <div key={i} style={{ width: 8, height: 2, borderRadius: 1, background: t.vars['--sidebar-text'], opacity: 0.5 }} />
          ))}
        </div>
        {/* Content */}
        <div style={{ flex: 1, padding: '5px 6px', display:'flex', flexDirection:'column', gap: 3 }}>
          <div style={{ height: 6, width: '60%', borderRadius: 2, background: t.vars['--text-primary'], opacity: 0.8 }} />
          <div style={{ height: 4, width: '80%', borderRadius: 2, background: t.vars['--text-secondary'], opacity: 0.5 }} />
          <div style={{ marginTop: 2, display: 'flex', gap: 3 }}>
            <div style={{ height: 12, flex: 1, borderRadius: 3, background: t.vars['--bg-elevated'] }} />
            <div style={{ height: 12, flex: 1, borderRadius: 3, background: t.vars['--bg-elevated'] }} />
          </div>
          <div style={{ height: 10, width: 32, borderRadius: 3, background: t.accent, opacity: 0.85 }} />
        </div>
      </div>
      {/* Label */}
      <div style={{ background: dark ? '#0a0a0a' : '#f0f0f0', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10 }}>{t.emoji}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: dark ? '#ccc' : '#333' }}>{t.name}</span>
        {active && <span style={{ marginLeft: 'auto', fontSize: 9, color: t.accent }}>✓</span>}
      </div>
    </button>
  );
}

// ─── Main Customizer ──────────────────────────────────────────────────────────

export function ThemeCustomizer() {
  const {
    theme, fontOverride, customVars,
    setThemeById, setCustomVar, setFontOverride, resetCustom,
    companyLogo, companyLogoSmall, setCompanyLogo, setCompanyLogoSmall,
    customizerOpen, setCustomizerOpen,
  } = useTheme();

  const [tab, setTab] = useState<'themes' | 'fonts' | 'custom' | 'brand'>('themes');
  const darkThemes  = PRESET_THEMES.filter(t => t.mode === 'dark');
  const lightThemes = PRESET_THEMES.filter(t => t.mode === 'light');
  const hasCustom   = Object.keys(customVars).length > 0 || fontOverride !== null;

  if (!customizerOpen) return null;

  const TAB_BTN = (id: typeof tab, label: string) => (
    <button key={id} onClick={() => setTab(id)}
      style={{
        flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: tab === id ? 700 : 500,
        background: 'none', border: 'none', cursor: 'pointer',
        color: tab === id ? 'var(--brand-400)' : 'var(--text-secondary)',
        borderBottom: `2px solid ${tab === id ? 'var(--brand-500)' : 'transparent'}`,
        transition: 'all 0.15s',
      }}>
      {label}
    </button>
  );

  return (
    <>
      {/* Backdrop */}
      <div onClick={() => setCustomizerOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(0,0,0,0.35)' }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 300,
        width: 340, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border)',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-overlay)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>🎨 Appearance</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Theme · Fonts · Branding
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {hasCustom && (
              <button className="btn btn-ghost btn-sm" onClick={resetCustom}
                style={{ fontSize: 11, color: '#f59e0b' }}>↺ Reset</button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setCustomizerOpen(false)}
              style={{ fontSize: 18, padding: '2px 8px' }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {TAB_BTN('themes', '🎨 Themes')}
          {TAB_BTN('fonts',  '🔤 Fonts')}
          {TAB_BTN('custom', '🎛 Custom')}
          {TAB_BTN('brand',  '🏢 Brand')}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Themes ── */}
          {tab === 'themes' && (
            <>
              <div>
                <label style={LS}>Dark Themes</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {darkThemes.map(t => (
                    <ThemeCard key={t.id} t={t} active={theme.id === t.id} onClick={() => setThemeById(t.id)} />
                  ))}
                </div>
              </div>
              <div>
                <label style={LS}>Light Themes</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {lightThemes.map(t => (
                    <ThemeCard key={t.id} t={t} active={theme.id === t.id} onClick={() => setThemeById(t.id)} />
                  ))}
                </div>
              </div>
              {/* Current Preview */}
              <div style={{ padding: '14px 16px', background: 'var(--bg-overlay)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                  {theme.emoji} {theme.name} <span style={{ fontWeight: 400, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>· {theme.mode}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['--brand-400','--brand-500','--bg-canvas','--bg-surface','--bg-elevated','--sidebar-bg'] as (keyof ThemeVars)[]).map(k => (
                    <div key={k} title={k}
                      style={{ width: 22, height: 22, borderRadius: 5, background: theme.vars[k], border: '1.5px solid var(--border)', flexShrink: 0 }} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Fonts ── */}
          {tab === 'fonts' && (
            <>
              <div>
                <label style={LS}>Typeface <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(Google Fonts)</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {FONTS.map(f => {
                    const active = (fontOverride ?? theme.font) === f.id;
                    return (
                      <button key={f.id} onClick={() => setFontOverride(active ? null : f.id as FontFamily)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                          background: active ? 'var(--brand-900)' : 'var(--bg-canvas)',
                          border: `1.5px solid ${active ? 'var(--brand-500)' : 'var(--border)'}`,
                          color: active ? 'var(--brand-400)' : 'var(--text-primary)',
                          transition: 'all 0.15s',
                        }}>
                        <div>
                          <span style={{ fontFamily: f.stack, fontSize: 15, fontWeight: 600 }}>{f.label}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8, fontFamily: f.stack }}>
                            Aa Bb 123
                          </span>
                        </div>
                        {active && <span style={{ fontSize: 14 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: 'var(--bg-canvas)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  The quick brown fox jumps over the lazy dog. <strong>0123456789</strong>
                </p>
              </div>
            </>
          )}

          {/* ── Custom Colors ── */}
          {tab === 'custom' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Override individual colors. Changes stack on top of the selected theme.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {COLOR_OVERRIDES.map(({ key, label }) => {
                  const current = (customVars[key] ?? theme.vars[key]) || '#000000';
                  const overridden = key in customVars;
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="color" value={current.startsWith('#') ? current : '#000000'}
                        onChange={e => setCustomVar(key, e.target.value)}
                        style={{ width: 34, height: 34, border: '2px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2, background: 'none' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{key}</div>
                      </div>
                      {overridden && (
                        <button onClick={() => {
                          const next = { ...customVars };
                          delete (next as Record<string, string>)[key];
                          // trigger re-apply by calling setCustomVar with original
                          setCustomVar(key, theme.vars[key]);
                          // then remove override
                          setTimeout(() => {
                            const n2 = { ...customVars };
                            delete (n2 as Record<string, string>)[key];
                          }, 0);
                        }}
                          style={{ fontSize: 10, color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer' }}>↺</button>
                      )}
                    </div>
                  );
                })}
              </div>
              {hasCustom && (
                <button className="btn btn-ghost btn-sm" onClick={resetCustom}
                  style={{ color: '#f59e0b', alignSelf: 'flex-start' }}>↺ Reset all custom overrides</button>
              )}
            </>
          )}

          {/* ── Brand & Avatars ── */}
          {tab === 'brand' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Upload your company logos. They appear in the sidebar and throughout the platform.
              </div>

              <LogoUploader label="Full Company Logo" value={companyLogo} onChange={setCompanyLogo} size={72} />
              <LogoUploader label="Logo Mark (icon / favicon)" value={companyLogoSmall} onChange={setCompanyLogoSmall} size={48} round />

              {/* Preview */}
              {(companyLogo || companyLogoSmall) && (
                <div style={{ padding: '14px 16px', background: 'var(--sidebar-bg)', borderRadius: 10, border: '1px solid var(--sidebar-border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--sidebar-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Sidebar Preview</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {companyLogoSmall
                      ? <img src={companyLogoSmall} alt="logo" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }} />
                      : <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--sidebar-logo-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'white' }}>M</div>
                    }
                    {companyLogo
                      ? <img src={companyLogo} alt="logo-full" style={{ height: 28, maxWidth: 140, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                      : <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sidebar-text)' }}>MFO Nexus</span>
                    }
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <label style={LS}>Contact &amp; Organization Avatars</label>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
                  Avatars for contacts and organizations can be uploaded directly from their profile cards. 
                  Click the avatar anywhere in the app to replace it.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { name: 'James Harrington', id: 'ex-jh' },
                    { name: 'Meridian Group', id: 'ex-mg' },
                    { name: 'Sofia Chen', id: 'ex-sc' },
                  ].map(ex => (
                    <div key={ex.id} style={{ textAlign: 'center' }}>
                      <ExampleEntityAvatar id={ex.id} name={ex.name} />
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4, maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-overlay)', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Preferences saved locally · Reset clears customizations only
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Inline example avatar (editable) ─────────────────────────────────────────
function ExampleEntityAvatar({ id, name }: { id: string; name: string }) {
  const { getEntityAvatar, setEntityAvatar } = useTheme();
  const ref = useRef<HTMLInputElement>(null);
  const src = getEntityAvatar(id);

  const abbr = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => ref.current?.click()} style={{
        width: 48, height: 48, borderRadius: '50%', cursor: 'pointer',
        background: src ? 'transparent' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', border: '2px solid var(--border)',
      }}>
        {src
          ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{abbr}</span>
        }
      </div>
      <div onClick={() => ref.current?.click()} style={{
        position: 'absolute', bottom: 0, right: 0, fontSize: 10, background: 'var(--brand-500)',
        color: 'white', borderRadius: '50%', width: 16, height: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>+</div>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={async e => {
          const f = e.target.files?.[0];
          if (f) { const r = new FileReader(); r.onload = ev => setEntityAvatar(id, ev.target!.result as string); r.readAsDataURL(f); e.target.value = ''; }
        }} />
    </div>
  );
}

// ─── Trigger button (add to header/sidebar) ───────────────────────────────────
export function ThemeTrigger() {
  const { setCustomizerOpen, theme } = useTheme();
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
