'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FontFamily = 'Inter' | 'IBM Plex Sans' | 'Geist' | 'Roboto' | 'Public Sans' | 'Playfair Display' | 'Outfit' | 'DM Sans' | 'Nunito' | 'Lato';

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
  logoFull: string | null;       // used in reports & invoices
  logoMark: string | null;       // used in sidebar / favicon
  logoSizeInReports: number;     // px width, default 120
  brandColor: string;
}

export interface ThemeVars {
  '--bg-canvas': string;
  '--bg-surface': string;
  '--bg-elevated': string;
  '--bg-overlay': string;
  '--bg-highlight': string;
  '--border': string;
  '--border-hover': string;
  '--text-primary': string;
  '--text-secondary': string;
  '--text-tertiary': string;
  '--brand-400': string;
  '--brand-500': string;
  '--brand-600': string;
  '--brand-900': string;
  '--brand-glow': string;
  '--sidebar-bg': string;
  '--sidebar-border': string;
  '--sidebar-text': string;
  '--sidebar-accent': string;
  '--sidebar-hover': string;
  '--sidebar-logo-bg': string;
}

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  mode: 'dark' | 'light';
  font: FontFamily;
  accent: string; // preview swatch colour
  vars: ThemeVars;
}

// ─── Pre-defined Themes ───────────────────────────────────────────────────────

export const PRESET_THEMES: Theme[] = [
  // ── Institutional (Default) ─────────────────────────────────────────────────
  {
    id: 'institutional', name: 'Institutional', emoji: '🏛️', mode: 'light', font: 'Inter', accent: '#2563eb',
    vars: {
      // Premium Wealth Management light palette — clean, trustworthy, airy
      '--bg-canvas':    '#f8fafc',   // slate-50 — app body
      '--bg-surface':   '#ffffff',   // white — cards, panels
      '--bg-elevated':  '#f1f5f9',   // slate-100 — sub-elements, table headers
      '--bg-overlay':   '#e2e8f0',   // slate-200 — overlays
      '--bg-highlight': '#dde4ee',   // slate-200+ — hover
      '--border':       'rgba(15,23,42,0.08)',
      '--border-hover': 'rgba(15,23,42,0.16)',
      '--text-primary':   '#0f172a', // slate-900
      '--text-secondary': '#64748b', // slate-500
      '--text-tertiary':  '#94a3b8', // slate-400
      '--brand-400': '#60a5fa',   // blue-400
      '--brand-500': '#2563eb',   // blue-600 — institutional blue
      '--brand-600': '#1d4ed8',   // blue-700
      '--brand-900': 'rgba(37,99,235,0.08)',
      '--brand-glow': 'rgba(37,99,235,0.15)',
      // White sidebar — clean and bright for institutional use
      '--sidebar-bg':      '#ffffff',
      '--sidebar-border':  'rgba(15,23,42,0.08)',
      '--sidebar-text':    '#64748b',   // slate-500
      '--sidebar-accent':  '#2563eb',   // blue-600
      '--sidebar-hover':   '#f1f5f9',   // slate-100
      '--sidebar-logo-bg': '#2563eb',   // blue-600
    },
  },
  // ── Dark ──────────────────────────────────────────────────────────────────
  {
    id: 'midnight', name: 'Midnight', emoji: '🌑', mode: 'dark', font: 'Inter', accent: '#6366f1',
    vars: {
      '--bg-canvas': '#050507', '--bg-surface': '#0a0a0e', '--bg-elevated': '#121218',
      '--bg-overlay': '#1a1a24', '--bg-highlight': '#232332',
      '--border': 'rgba(255,255,255,0.06)', '--border-hover': 'rgba(255,255,255,0.12)',
      '--text-primary': '#ededf0', '--text-secondary': '#a1a1aa', '--text-tertiary': '#52525b',
      '--brand-400': '#a78bfa', '--brand-500': '#8b5cf6', '--brand-600': '#7c3aed',
      '--brand-900': 'rgba(139,92,246,0.15)', '--brand-glow': 'rgba(139,92,246,0.25)',
      '--sidebar-bg': '#060608', '--sidebar-border': 'rgba(255,255,255,0.05)',
      '--sidebar-text': '#a1a1aa', '--sidebar-accent': '#a78bfa',
      '--sidebar-hover': '#121218', '--sidebar-logo-bg': '#8b5cf6',
    },
  },
  {
    id: 'ocean', name: 'Ocean', emoji: '🌊', mode: 'dark', font: 'Inter', accent: '#0ea5e9',
    vars: {
      '--bg-canvas': '#030b14', '--bg-surface': '#061526', '--bg-elevated': '#0a2038',
      '--bg-overlay': '#0e2d4e', '--bg-highlight': '#133a60',
      '--border': 'rgba(14,165,233,0.12)', '--border-hover': 'rgba(14,165,233,0.25)',
      '--text-primary': '#e0f2fe', '--text-secondary': '#7dd3fc', '--text-tertiary': '#38bdf8',
      '--brand-400': '#38bdf8', '--brand-500': '#0ea5e9', '--brand-600': '#0284c7',
      '--brand-900': 'rgba(14,165,233,0.15)', '--brand-glow': 'rgba(14,165,233,0.25)',
      '--sidebar-bg': '#020a11', '--sidebar-border': 'rgba(14,165,233,0.08)',
      '--sidebar-text': '#7dd3fc', '--sidebar-accent': '#38bdf8',
      '--sidebar-hover': '#0a2038', '--sidebar-logo-bg': '#0284c7',
    },
  },
  {
    id: 'forest', name: 'Forest', emoji: '🌿', mode: 'dark', font: 'DM Sans', accent: '#22c55e',
    vars: {
      '--bg-canvas': '#030a05', '--bg-surface': '#071510', '--bg-elevated': '#0c2018',
      '--bg-overlay': '#112c22', '--bg-highlight': '#173b2d',
      '--border': 'rgba(34,197,94,0.1)', '--border-hover': 'rgba(34,197,94,0.22)',
      '--text-primary': '#dcfce7', '--text-secondary': '#86efac', '--text-tertiary': '#4ade80',
      '--brand-400': '#4ade80', '--brand-500': '#22c55e', '--brand-600': '#16a34a',
      '--brand-900': 'rgba(34,197,94,0.15)', '--brand-glow': 'rgba(34,197,94,0.22)',
      '--sidebar-bg': '#020806', '--sidebar-border': 'rgba(34,197,94,0.07)',
      '--sidebar-text': '#86efac', '--sidebar-accent': '#4ade80',
      '--sidebar-hover': '#0c2018', '--sidebar-logo-bg': '#16a34a',
    },
  },
  {
    id: 'aurora', name: 'Aurora', emoji: '🌌', mode: 'dark', font: 'Outfit', accent: '#a855f7',
    vars: {
      '--bg-canvas': '#05030e', '--bg-surface': '#0c081e', '--bg-elevated': '#140f2e',
      '--bg-overlay': '#1c163e', '--bg-highlight': '#261e50',
      '--border': 'rgba(168,85,247,0.12)', '--border-hover': 'rgba(168,85,247,0.25)',
      '--text-primary': '#fdf4ff', '--text-secondary': '#d8b4fe', '--text-tertiary': '#a855f7',
      '--brand-400': '#c084fc', '--brand-500': '#a855f7', '--brand-600': '#9333ea',
      '--brand-900': 'rgba(168,85,247,0.15)', '--brand-glow': 'rgba(168,85,247,0.28)',
      '--sidebar-bg': '#03020a', '--sidebar-border': 'rgba(168,85,247,0.08)',
      '--sidebar-text': '#d8b4fe', '--sidebar-accent': '#c084fc',
      '--sidebar-hover': '#140f2e', '--sidebar-logo-bg': '#9333ea',
    },
  },
  {
    id: 'ember', name: 'Ember', emoji: '🔥', mode: 'dark', font: 'Inter', accent: '#f59e0b',
    vars: {
      '--bg-canvas': '#0d0500', '--bg-surface': '#180900', '--bg-elevated': '#251100',
      '--bg-overlay': '#321800', '--bg-highlight': '#3f2000',
      '--border': 'rgba(245,158,11,0.1)', '--border-hover': 'rgba(245,158,11,0.22)',
      '--text-primary': '#fef3c7', '--text-secondary': '#fcd34d', '--text-tertiary': '#f59e0b',
      '--brand-400': '#fbbf24', '--brand-500': '#f59e0b', '--brand-600': '#d97706',
      '--brand-900': 'rgba(245,158,11,0.15)', '--brand-glow': 'rgba(245,158,11,0.25)',
      '--sidebar-bg': '#090300', '--sidebar-border': 'rgba(245,158,11,0.07)',
      '--sidebar-text': '#fcd34d', '--sidebar-accent': '#fbbf24',
      '--sidebar-hover': '#251100', '--sidebar-logo-bg': '#d97706',
    },
  },
  {
    id: 'obsidian', name: 'Obsidian', emoji: '🪨', mode: 'dark', font: 'Inter', accent: '#71717a',
    vars: {
      '--bg-canvas': '#080808', '--bg-surface': '#111111', '--bg-elevated': '#1a1a1a',
      '--bg-overlay': '#222222', '--bg-highlight': '#2e2e2e',
      '--border': 'rgba(255,255,255,0.07)', '--border-hover': 'rgba(255,255,255,0.14)',
      '--text-primary': '#fafafa', '--text-secondary': '#a1a1aa', '--text-tertiary': '#52525b',
      '--brand-400': '#d4d4d8', '--brand-500': '#71717a', '--brand-600': '#52525b',
      '--brand-900': 'rgba(113,113,122,0.15)', '--brand-glow': 'rgba(250,250,250,0.08)',
      '--sidebar-bg': '#050505', '--sidebar-border': 'rgba(255,255,255,0.05)',
      '--sidebar-text': '#a1a1aa', '--sidebar-accent': '#fafafa',
      '--sidebar-hover': '#1a1a1a', '--sidebar-logo-bg': '#3f3f46',
    },
  },
  {
    id: 'crimson', name: 'Crimson', emoji: '🩸', mode: 'dark', font: 'Outfit', accent: '#f43f5e',
    vars: {
      '--bg-canvas': '#0d0306', '--bg-surface': '#1a060e', '--bg-elevated': '#260918',
      '--bg-overlay': '#330c20', '--bg-highlight': '#40102a',
      '--border': 'rgba(244,63,94,0.1)', '--border-hover': 'rgba(244,63,94,0.22)',
      '--text-primary': '#ffe4e6', '--text-secondary': '#fda4af', '--text-tertiary': '#fb7185',
      '--brand-400': '#fb7185', '--brand-500': '#f43f5e', '--brand-600': '#e11d48',
      '--brand-900': 'rgba(244,63,94,0.15)', '--brand-glow': 'rgba(244,63,94,0.25)',
      '--sidebar-bg': '#080204', '--sidebar-border': 'rgba(244,63,94,0.07)',
      '--sidebar-text': '#fda4af', '--sidebar-accent': '#fb7185',
      '--sidebar-hover': '#260918', '--sidebar-logo-bg': '#e11d48',
    },
  },
  // ── Light ─────────────────────────────────────────────────────────────────
  {
    id: 'snow', name: 'Snow', emoji: '❄️', mode: 'light', font: 'Inter', accent: '#6366f1',
    vars: {
      // True white canvas — clean, clinical, professional
      '--bg-canvas':   '#f8fafc',
      '--bg-surface':  '#ffffff',
      '--bg-elevated': '#f1f5f9',
      '--bg-overlay':  '#e8edf4',
      '--bg-highlight':'#dde3ee',
      '--border':       'rgba(15,23,42,0.09)',
      '--border-hover': 'rgba(15,23,42,0.18)',
      '--text-primary':   '#0f172a',
      '--text-secondary': '#475569',
      '--text-tertiary':  '#94a3b8',
      '--brand-400': '#818cf8',
      '--brand-500': '#6366f1',
      '--brand-600': '#4f46e5',
      '--brand-900': 'rgba(99,102,241,0.08)',
      '--brand-glow': 'rgba(99,102,241,0.18)',
      // Deep indigo sidebar — high contrast, readable
      '--sidebar-bg':       '#1e1b4b',
      '--sidebar-border':   'rgba(255,255,255,0.07)',
      '--sidebar-text':     '#c7d2fe',
      '--sidebar-accent':   '#a5b4fc',
      '--sidebar-hover':    '#312e81',
      '--sidebar-logo-bg':  '#6366f1',
    },
  },
  {
    id: 'warm', name: 'Warm Sand', emoji: '🏖️', mode: 'light', font: 'Nunito', accent: '#d97706',
    vars: {
      // Warm off-white — NOT yellow — canvas is near neutral
      '--bg-canvas':   '#fafaf8',
      '--bg-surface':  '#ffffff',
      '--bg-elevated': '#f5f3ef',
      '--bg-overlay':  '#ede9e0',
      '--bg-highlight':'#e0d9cc',
      '--border':       'rgba(92,67,10,0.10)',
      '--border-hover': 'rgba(92,67,10,0.20)',
      '--text-primary':   '#1c1008',
      '--text-secondary': '#6b5c3e',
      '--text-tertiary':  '#9e8a68',
      '--brand-400': '#f59e0b',
      '--brand-500': '#d97706',
      '--brand-600': '#b45309',
      '--brand-900': 'rgba(217,119,6,0.08)',
      '--brand-glow': 'rgba(217,119,6,0.18)',
      // Rich espresso sidebar
      '--sidebar-bg':       '#3b2100',
      '--sidebar-border':   'rgba(255,255,255,0.06)',
      '--sidebar-text':     '#fde68a',
      '--sidebar-accent':   '#fbbf24',
      '--sidebar-hover':    '#5a3200',
      '--sidebar-logo-bg':  '#d97706',
    },
  },
  {
    id: 'sky', name: 'Horizon', emoji: '☁️', mode: 'light', font: 'DM Sans', accent: '#0284c7',
    vars: {
      // Very light gray-blue canvas — NOT saturated blue
      '--bg-canvas':   '#f7f9fc',
      '--bg-surface':  '#ffffff',
      '--bg-elevated': '#eef3f8',
      '--bg-overlay':  '#dde6f0',
      '--bg-highlight':'#ccd8e8',
      '--border':       'rgba(2,78,132,0.10)',
      '--border-hover': 'rgba(2,78,132,0.20)',
      '--text-primary':   '#0a1929',
      '--text-secondary': '#3a5a7c',
      '--text-tertiary':  '#6b90b0',
      '--brand-400': '#38bdf8',
      '--brand-500': '#0284c7',
      '--brand-600': '#0369a1',
      '--brand-900': 'rgba(2,132,199,0.08)',
      '--brand-glow': 'rgba(2,132,199,0.18)',
      // Deep navy sidebar
      '--sidebar-bg':       '#0a2744',
      '--sidebar-border':   'rgba(255,255,255,0.07)',
      '--sidebar-text':     '#bae6fd',
      '--sidebar-accent':   '#38bdf8',
      '--sidebar-hover':    '#163860',
      '--sidebar-logo-bg':  '#0284c7',
    },
  },
  {
    id: 'mint', name: 'Sage', emoji: '🌿', mode: 'light', font: 'Outfit', accent: '#059669',
    vars: {
      // Barely-there sage tint on canvas — NOT heavy green
      '--bg-canvas':   '#f7faf8',
      '--bg-surface':  '#ffffff',
      '--bg-elevated': '#eef4f0',
      '--bg-overlay':  '#dceee2',
      '--bg-highlight':'#cce4d4',
      '--border':       'rgba(5,80,50,0.09)',
      '--border-hover': 'rgba(5,80,50,0.18)',
      '--text-primary':   '#07200e',
      '--text-secondary': '#2d5a3a',
      '--text-tertiary':  '#5a8c6a',
      '--brand-400': '#34d399',
      '--brand-500': '#059669',
      '--brand-600': '#047857',
      '--brand-900': 'rgba(5,150,105,0.08)',
      '--brand-glow': 'rgba(5,150,105,0.18)',
      // Deep forest sidebar
      '--sidebar-bg':       '#052e16',
      '--sidebar-border':   'rgba(255,255,255,0.07)',
      '--sidebar-text':     '#a7f3d0',
      '--sidebar-accent':   '#34d399',
      '--sidebar-hover':    '#0d4a24',
      '--sidebar-logo-bg':  '#047857',
    },
  },
  {
    id: 'corporate', name: 'Corporate', emoji: '🏛️', mode: 'light', font: 'Inter', accent: '#1d4ed8',
    vars: {
      // Conservative neutral — highest professional look
      '--bg-canvas':   '#f4f6f8',
      '--bg-surface':  '#ffffff',
      '--bg-elevated': '#eaecf0',
      '--bg-overlay':  '#dde0e6',
      '--bg-highlight':'#cdd1da',
      '--border':       'rgba(10,20,50,0.10)',
      '--border-hover': 'rgba(10,20,50,0.20)',
      '--text-primary':   '#0d1117',
      '--text-secondary': '#4b5563',
      '--text-tertiary':  '#9ca3af',
      '--brand-400': '#3b82f6',
      '--brand-500': '#1d4ed8',
      '--brand-600': '#1e40af',
      '--brand-900': 'rgba(29,78,216,0.07)',
      '--brand-glow': 'rgba(29,78,216,0.15)',
      // Classic navy sidebar
      '--sidebar-bg':       '#0f172a',
      '--sidebar-border':   'rgba(255,255,255,0.07)',
      '--sidebar-text':     '#cbd5e1',
      '--sidebar-accent':   '#93c5fd',
      '--sidebar-hover':    '#1e293b',
      '--sidebar-logo-bg':  '#1d4ed8',
    },
  },
  {
    id: 'rose', name: 'Rose Gold', emoji: '🌸', mode: 'light', font: 'Outfit', accent: '#e11d48',
    vars: {
      // Creamy white — NOT pink — canvas is barely tinted
      '--bg-canvas':   '#fdf7f8',
      '--bg-surface':  '#ffffff',
      '--bg-elevated': '#f5eef0',
      '--bg-overlay':  '#eadee1',
      '--bg-highlight':'#ddced2',
      '--border':       'rgba(100,20,40,0.09)',
      '--border-hover': 'rgba(100,20,40,0.18)',
      '--text-primary':   '#1a0a0e',
      '--text-secondary': '#6b3040',
      '--text-tertiary':  '#a0687a',
      '--brand-400': '#fb7185',
      '--brand-500': '#e11d48',
      '--brand-600': '#be123c',
      '--brand-900': 'rgba(225,29,72,0.07)',
      '--brand-glow': 'rgba(225,29,72,0.16)',
      // Deep burgundy sidebar
      '--sidebar-bg':       '#4c0519',
      '--sidebar-border':   'rgba(255,255,255,0.07)',
      '--sidebar-text':     '#fecdd3',
      '--sidebar-accent':   '#fb7185',
      '--sidebar-hover':    '#7f1d2e',
      '--sidebar-logo-bg':  '#be123c',
    },
  },
];

export const FONTS: { id: FontFamily; label: string; stack: string; description: string }[] = [
  { id: 'Inter',          label: 'Inter',          description: 'Clean',        stack: "'Inter', system-ui, sans-serif" },
  { id: 'IBM Plex Sans',  label: 'IBM Plex Sans',  description: 'Technical',    stack: "'IBM Plex Sans', system-ui, sans-serif" },
  { id: 'Geist',          label: 'Geist',          description: 'Sleek',        stack: "'Geist', 'Geist Sans', system-ui, sans-serif" },
  { id: 'Roboto',         label: 'Roboto',         description: 'Standard',     stack: "'Roboto', system-ui, sans-serif" },
  { id: 'Public Sans',    label: 'Public Sans',    description: 'Institutional', stack: "'Public Sans', system-ui, sans-serif" },
  { id: 'Playfair Display', label: 'Playfair Display', description: 'Editorial', stack: "'Playfair Display', Georgia, serif" },
  // Legacy options
  { id: 'Outfit',         label: 'Outfit',         description: 'Modern',       stack: "'Outfit', system-ui, sans-serif" },
  { id: 'DM Sans',        label: 'DM Sans',        description: 'Rounded',      stack: "'DM Sans', system-ui, sans-serif" },
  { id: 'Nunito',         label: 'Nunito',         description: 'Friendly',     stack: "'Nunito', system-ui, sans-serif" },
  { id: 'Lato',           label: 'Lato',           description: 'Classic',      stack: "'Lato', system-ui, sans-serif" },
];

// ─── Context ──────────────────────────────────────────────────────────────────

export interface ThemeContextValue {
  theme: Theme;
  fontOverride: FontFamily | null;
  customVars: Partial<ThemeVars>;
  setThemeById: (id: string) => void;
  setCustomVar: (key: keyof ThemeVars, value: string) => void;
  setFontOverride: (font: FontFamily | null) => void;
  resetCustom: () => void;
  companyLogo: string | null;
  companyLogoSmall: string | null;
  setCompanyLogo: (url: string | null) => void;
  setCompanyLogoSmall: (url: string | null) => void;
  /* Tenant branding (admin-level) */
  tenantBranding: TenantBranding;
  setTenantBranding: (b: Partial<TenantBranding>) => void;
  /* Per-entity avatar store */
  getEntityAvatar: (id: string) => string | null;
  setEntityAvatar: (id: string, dataUrl: string | null) => void;
  /* Customizer panel visibility */
  customizerOpen: boolean;
  setCustomizerOpen: (v: boolean) => void;
}

const Ctx = createContext<ThemeContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY   = 'mfo-theme-v3';  // v3 — institutional light default
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
  brandColor: '#6366f1',
};

function loadGoogleFont(font: FontFamily) {
  if (font === 'Geist') return;
  const id = `gf-${font.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const el = document.createElement('link');
  el.id   = id;
  el.rel  = 'stylesheet';
  el.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(el);
}

function applyVars(vars: Partial<ThemeVars>, fontStack: string) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v as string);
  }
  root.style.setProperty('--font-sans', fontStack);
  root.style.setProperty('--font-body', fontStack);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId,        setThemeId]        = useState<string>('institutional');
  const [fontOverride,   setFontOverrideS]  = useState<FontFamily | null>(null);
  const [customVars,     setCustomVarsS]    = useState<Partial<ThemeVars>>({});
  const [companyLogo,    setCompanyLogoS]   = useState<string | null>(null);
  const [companyLogoSm,  setCompanyLogoSm]  = useState<string | null>(null);
  const [tenantBranding, setTenantBrandingS] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [avatars,        setAvatars]        = useState<Record<string, string>>({});
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [hydrated,       setHydrated]       = useState(false);

  // Compute effective theme
  const baseTheme = PRESET_THEMES.find(t => t.id === themeId) ?? PRESET_THEMES[0];
  const activeFont = fontOverride ?? baseTheme.font;
  const activeVars: ThemeVars = { ...baseTheme.vars, ...customVars } as ThemeVars;
  const theme: Theme = { ...baseTheme, font: activeFont, vars: activeVars };

  // Load from localStorage once — migrate from v2 (dark themes) to v3 (institutional light default)
  useEffect(() => {
    try {
      // ── Migrate: remove old v2 key so new institutional default activates ──
      if (localStorage.getItem('mfo-theme-v2')) {
        localStorage.removeItem('mfo-theme-v2');
        // Do NOT load from v3 if migrating — let the institutional default stand
        setHydrated(true);
        return;
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.themeId && PRESET_THEMES.find(t => t.id === s.themeId)) setThemeId(s.themeId);
        if (s.fontOverride) setFontOverrideS(s.fontOverride as FontFamily);
        if (s.customVars && typeof s.customVars === 'object') setCustomVarsS(s.customVars);
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

  // Apply theme to DOM whenever anything changes
  useEffect(() => {
    if (!hydrated) return;
    loadGoogleFont(activeFont);
    const fontObj = FONTS.find(f => f.id === activeFont);
    applyVars(activeVars, fontObj?.stack ?? "'Inter', system-ui, sans-serif");
    document.documentElement.setAttribute('data-theme', themeId);
    document.documentElement.setAttribute('data-mode', baseTheme.mode);
    // persist
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeId, fontOverride, customVars, companyLogo, companyLogoSm }));
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId, activeFont, JSON.stringify(customVars), companyLogo, companyLogoSm, hydrated]);

  const setThemeById = useCallback((id: string) => {
    setThemeId(id);
    setCustomVarsS({});
  }, []);

  const setCustomVar = useCallback((key: keyof ThemeVars, value: string) => {
    setCustomVarsS(prev => ({ ...prev, [key]: value }));
  }, []);

  const setFontOverride = useCallback((font: FontFamily | null) => {
    setFontOverrideS(font);
  }, []);

  const resetCustom = useCallback(() => {
    setCustomVarsS({});
    setFontOverrideS(null);
  }, []);

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
      theme, fontOverride, customVars,
      setThemeById, setCustomVar, setFontOverride, resetCustom,
      companyLogo, companyLogoSmall: companyLogoSm, setCompanyLogo, setCompanyLogoSmall,
      tenantBranding, setTenantBranding,
      getEntityAvatar, setEntityAvatar,
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
