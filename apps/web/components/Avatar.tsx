'use client';

import React, { useRef } from 'react';
import { useTheme } from '@/lib/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type AvatarShape = 'circle' | 'square' | 'rounded';

interface AvatarProps {
  /** Entity ID — used to look up (or store) a custom uploaded avatar */
  id?: string;
  /** Explicit image URL (overrides entity avatar lookup) */
  src?: string | null;
  /** Fallback initials (1-2 chars) */
  initials?: string;
  /** Display name — auto-derives initials if `initials` not provided */
  name?: string;
  size?: AvatarSize;
  shape?: AvatarShape;
  /** Seed colour for gradient fallback */
  colour?: string;
  /** Show upload button on hover */
  editable?: boolean;
  /** Called after user picks a file */
  onUpload?: (dataUrl: string, file: File) => void;
  className?: string;
  style?: React.CSSProperties;
}

// ─── Size map ─────────────────────────────────────────────────────────────────

const SIZE: Record<AvatarSize, { px: number; font: number }> = {
  xs:  { px: 20, font: 8  },
  sm:  { px: 28, font: 10 },
  md:  { px: 36, font: 13 },
  lg:  { px: 48, font: 17 },
  xl:  { px: 64, font: 22 },
  '2xl':{ px: 96, font: 32 },
};

// ─── Colour palette (deterministic from initials) ─────────────────────────────

const PALETTE = [
  ['#6366f1','#4f46e5'],['#0ea5e9','#0284c7'],['#22c55e','#16a34a'],
  ['#f59e0b','#d97706'],['#f43f5e','#e11d48'],['#a855f7','#9333ea'],
  ['#06b6d4','#0891b2'],['#ec4899','#db2777'],['#14b8a6','#0d9488'],
  ['#84cc16','#65a30d'],['#f97316','#ea580c'],['#8b5cf6','#7c3aed'],
];

function gradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  const [a, b] = PALETTE[Math.abs(h) % PALETTE.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function toInitials(name?: string, initials?: string): string {
  if (initials) return initials.slice(0, 2).toUpperCase();
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ─── Radius by shape ─────────────────────────────────────────────────────────

function radius(shape: AvatarShape, px: number): string {
  if (shape === 'circle')  return '50%';
  if (shape === 'rounded') return `${Math.round(px * 0.25)}px`;
  return `${Math.round(px * 0.18)}px`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

export function Avatar({
  id, src, initials, name, size = 'md', shape = 'circle',
  colour, editable = false, onUpload, className, style,
}: AvatarProps) {
  const { getEntityAvatar, setEntityAvatar } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  // Resolve image: explicit src > entity store > null
  const entitySrc = id ? getEntityAvatar(id) : null;
  const imgSrc = src ?? entitySrc;

  const { px, font } = SIZE[size];
  const abbr = toInitials(name, initials);
  const seed = colour ?? abbr ?? id ?? 'A';
  const bg = gradient(seed);
  const r = radius(shape, px);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (id)       setEntityAvatar(id, dataUrl);
      onUpload?.(dataUrl, file);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const containerStyle: React.CSSProperties = {
    width: px, height: px, borderRadius: r, flexShrink: 0, position: 'relative',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', cursor: editable ? 'pointer' : undefined,
    ...style,
  };

  return (
    <span className={className} style={containerStyle} title={name}
      onClick={editable ? () => inputRef.current?.click() : undefined}>
      {imgSrc ? (
        <img src={imgSrc} alt={name ?? abbr}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <span style={{
          width: '100%', height: '100%', background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: font, fontWeight: 700, color: 'white',
          letterSpacing: '-0.5px', userSelect: 'none',
        }}>
          {abbr}
        </span>
      )}

      {/* Hover overlay for editable avatars */}
      {editable && (
        <span style={{
          position: 'absolute', inset: 0, borderRadius: r,
          background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s',
          fontSize: font * 0.9, color: 'white',
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
        >📷</span>
      )}

      {editable && (
        <input ref={inputRef} type="file" accept="image/*"
          style={{ display: 'none' }} onChange={handleFile} />
      )}
    </span>
  );
}

// ─── AvatarGroup ──────────────────────────────────────────────────────────────

interface AvatarGroupProps {
  items: { id?: string; name?: string; src?: string }[];
  size?: AvatarSize;
  max?: number;
}

export function AvatarGroup({ items, size = 'sm', max = 4 }: AvatarGroupProps) {
  const visible = items.slice(0, max);
  const rest = items.length - max;
  const { px } = SIZE[size];
  const overlap = Math.round(px * 0.35);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {visible.map((item, i) => (
        <Avatar key={item.id ?? i} id={item.id} name={item.name} src={item.src}
          size={size} shape="circle"
          style={{ marginLeft: i > 0 ? -overlap : 0, border: '2px solid var(--bg-surface)', zIndex: visible.length - i }} />
      ))}
      {rest > 0 && (
        <span style={{
          width: px, height: px, borderRadius: '50%', background: 'var(--bg-overlay)',
          border: '2px solid var(--bg-surface)', marginLeft: -overlap,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: SIZE[size].font, fontWeight: 700, color: 'var(--text-secondary)',
        }}>+{rest}</span>
      )}
    </span>
  );
}
