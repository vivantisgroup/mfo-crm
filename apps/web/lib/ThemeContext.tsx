'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FontFamily = 'Inter';

export interface TenantBranding {
  firmName: string;
  legalName: string;
  cnpjCvm: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  logoFull: string | null;
  logoMark: string | null;
  logoSizeInReports: number;
  brandColor: string;
}

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  mode: 'dark' | 'light';
  font: FontFamily;
  accent: string;
}

// ─── Pre-defined Themes ───────────────────────────────────────────────────────
// Note: All actual CSS properties are now defined purely in styles/globals.css 
// using standard HTML [data-theme="id"] selectors.

export const PRESET_THEMES: Theme[] = [
  { id: 'boxed-light', name: 'Boxed Light', emoji: '☀️', mode: 'light', font: 'Inter', accent: '#004b44' },
  { id: 'boxed-dark', name: 'Boxed Dark', emoji: '🌙', mode: 'dark', font: 'Inter', accent: '#10b981' },
];

export const FONTS: { id: FontFamily; label: string; stack: string; description: string }[] = [
  { id: 'Inter',          label: 'Inter',          description: 'Terminal Precision',        stack: "'Inter', system-ui, sans-serif" },
];

// ─── Context ──────────────────────────────────────────────────────────────────

export interface ThemeContextValue {
  theme: Theme;
  fontOverride: FontFamily | null;
  setThemeById: (id: string) => void;
  setFontOverride: (font: FontFamily | null) => void;
  resetCustom: () => void;
  companyLogo: string | null;
  companyLogoSmall: string | null;
  setCompanyLogo: (url: string | null) => void;
  setCompanyLogoSmall: (url: string | null) => void;
  tenantBranding: TenantBranding;
  setTenantBranding: (b: Partial<TenantBranding>) => void;
  getEntityAvatar: (id: string) => string | null;
  setEntityAvatar: (id: string, dataUrl: string | null) => void;
  customizerOpen: boolean;
  setCustomizerOpen: (v: boolean) => void;
}

const Ctx = createContext<ThemeContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY   = 'mfo-theme-v4';  // Bumped key to force new CSS variable system
const AVATAR_KEY    = 'mfo-avatars';
const BRANDING_KEY  = 'mfo-tenant-branding';

const DEFAULT_BRANDING: TenantBranding = {
  firmName: 'Vivants Consultoria e Serviços',
  legalName: 'Vivants Consultoria e Serviços Ltda.',
  cnpjCvm: '',
  addressLine1: 'Av. Brigadeiro Faria Lima, 4440',
  addressLine2: 'Conjunto 101',
  city: 'São Paulo',
  state: 'SP',
  country: 'Brasil',
  postalCode: '04538-132',
  phone: '+55 (11) 3000-0000',
  email: 'contato@vivants.com.br',
  website: 'https://nexus.vivants.com.br',
  logoFull: null,
  logoMark: null,
  logoSizeInReports: 120,
  brandColor: '#1d4ed8',
};

function loadGoogleFont(font: FontFamily) {
  if ((font as string) === 'Geist') return;
  const id = `gf-${font.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const el = document.createElement('link');
  el.id   = id;
  el.rel  = 'stylesheet';
  el.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(el);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId,        setThemeId]        = useState<string>('boxed-light');
  const [fontOverride,   setFontOverrideS]  = useState<FontFamily | null>(null);
  const [companyLogo,    setCompanyLogoS]   = useState<string | null>(null);
  const [companyLogoSm,  setCompanyLogoSm]  = useState<string | null>(null);
  const [tenantBranding, setTenantBrandingS] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [avatars,        setAvatars]        = useState<Record<string, string>>({});
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [hydrated,       setHydrated]       = useState(false);

  const baseTheme = PRESET_THEMES.find(t => t.id === themeId) ?? PRESET_THEMES[0];
  const activeFont = fontOverride ?? baseTheme.font;
  const theme: Theme = { ...baseTheme, font: activeFont };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.themeId && PRESET_THEMES.find(t => t.id === s.themeId)) setThemeId(s.themeId);
        if (s.fontOverride) setFontOverrideS(s.fontOverride as FontFamily);
        if (typeof s.companyLogo === 'string' || s.companyLogo === null) setCompanyLogoS(s.companyLogo);
        if (typeof s.companyLogoSm === 'string' || s.companyLogoSm === null) setCompanyLogoSm(s.companyLogoSm);
      }
      const rawAv = localStorage.getItem(AVATAR_KEY);
      if (rawAv) setAvatars(JSON.parse(rawAv));
      const rawBr = localStorage.getItem(BRANDING_KEY);
      if (rawBr) setTenantBrandingS(prev => ({ ...prev, ...JSON.parse(rawBr) }));
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    loadGoogleFont(activeFont);
    const fontObj = FONTS.find(f => f.id === activeFont);
    const root = document.documentElement;
    if (fontObj) {
        root.style.setProperty('--font-sans', fontObj.stack);
        root.style.setProperty('--font-body', fontObj.stack);
    }
    
    // Set standard data attributes
    root.setAttribute('data-theme', themeId);
    root.setAttribute('data-mode', baseTheme.mode);
    
    // Force a CSS update for Tremor rendering engine natively
    if (baseTheme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeId, fontOverride, companyLogo, companyLogoSm }));
    } catch { /* ignore */ }
  }, [themeId, activeFont, companyLogo, companyLogoSm, hydrated, baseTheme.mode]);

  const setThemeById = useCallback((id: string) => { setThemeId(id); }, []);
  const setFontOverride = useCallback((font: FontFamily | null) => { setFontOverrideS(font); }, []);
  const resetCustom = useCallback(() => { setFontOverrideS(null); }, []);
  const setCompanyLogo = useCallback((url: string | null) => setCompanyLogoS(url), []);
  const setCompanyLogoSmall = useCallback((url: string | null) => setCompanyLogoSm(url), []);

  const setTenantBranding = useCallback((patch: Partial<TenantBranding>) => {
    setTenantBrandingS(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(BRANDING_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const getEntityAvatar = useCallback((id: string) => avatars[id] ?? null, [avatars]);
  const setEntityAvatar = useCallback((id: string, dataUrl: string | null) => {
    setAvatars(prev => {
      const next = { ...prev };
      if (dataUrl === null) delete next[id]; else next[id] = dataUrl;
      try { localStorage.setItem(AVATAR_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{
      theme, fontOverride, setThemeById, setFontOverride, resetCustom,
      companyLogo, companyLogoSmall: companyLogoSm, setCompanyLogo, setCompanyLogoSmall,
      tenantBranding, setTenantBranding, getEntityAvatar, setEntityAvatar,
      customizerOpen, setCustomizerOpen,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be within <ThemeProvider>');
  return ctx;
}
