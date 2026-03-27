'use client';

import React, { useState } from 'react';
import {
  Inbox, Send, Star, Archive, Trash2, Tag, RefreshCw, PenSquare,
  FileWarning, AlertCircle, ChevronDown, ChevronRight, FolderOpen,
  type LucideIcon,
} from 'lucide-react';
import type { GmailLabel } from '@/app/api/mail/labels/route';

export type FolderKey = string; // label ID or synthetic key like 'unlinked', 'all'

// ─── System label config ───────────────────────────────────────────────────────

interface SystemConfig { icon: LucideIcon; color: string; order: number }

const SYSTEM_CONFIG: Record<string, SystemConfig> = {
  INBOX:     { icon: Inbox,       color: '#6366f1', order: 0 },
  SENT:      { icon: Send,        color: '#22c55e', order: 1 },
  STARRED:   { icon: Star,        color: '#f59e0b', order: 2 },
  IMPORTANT: { icon: AlertCircle, color: '#f97316', order: 3 },
  DRAFT:     { icon: FileWarning, color: '#94a3b8', order: 4 },
  SPAM:      { icon: AlertCircle, color: '#ef4444', order: 5 },
  TRASH:     { icon: Trash2,      color: '#64748b', order: 6 },
};

const CRM_LABELS: { key: FolderKey; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'unlinked', label: 'Needs Linking', icon: Tag,     color: '#f97316' },
  { key: 'all',      label: 'All Mail',      icon: Inbox,   color: '#64748b' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  active:             FolderKey;
  counts:             Partial<Record<FolderKey, number>>;
  syncing:            boolean;
  labels:             GmailLabel[];
  labelsLoading:      boolean;
  syncCount:          number;
  onSyncCountChange:  (n: number) => void;
  onSelect:           (f: FolderKey) => void;
  onSync:             () => void;
  onLoadMore:         () => void;
  onCompose:          () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FolderNav({ active, counts, syncing, labels, labelsLoading, syncCount, onSyncCountChange, onSelect, onSync, onLoadMore, onCompose }: Props) {
  const [userLabelsOpen, setUserLabelsOpen] = useState(true);

  const systemLabels  = labels.filter(l => l.type === 'system' && SYSTEM_CONFIG[l.id]);
  const userLabels    = labels.filter(l => l.type === 'user');

  return (
    <aside style={{
      width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column',
      gap: 2, padding: '0 8px', borderRight: '1px solid var(--border)',
      height: '100%', overflowY: 'auto',
    }}>
      {/* Compose */}
      <button
        className="btn btn-primary"
        onClick={onCompose}
        style={{ margin: '0 0 10px 0', fontSize: 13, gap: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <PenSquare size={14} />
        Compose
      </button>

      {/* ── System folders ─────────────────────────────────────────────────── */}
      <SectionHeader>Folders</SectionHeader>

      {labelsLoading ? (
        // Skeleton
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ height: 32, borderRadius: 8, background: 'var(--bg-elevated)', margin: '1px 0', opacity: 0.5 }} />
        ))
      ) : systemLabels.length > 0 ? (
        systemLabels.map(label => {
          const cfg = SYSTEM_CONFIG[label.id];
          const Icon = cfg.icon;
          return (
            <FolderRow
              key={label.id}
              id={label.id}
              label={label.displayName}
              icon={<Icon size={14} />}
              color={cfg.color}
              active={active}
              count={label.messagesUnread > 0 ? label.messagesUnread : counts[label.id]}
              onSelect={onSelect}
            />
          );
        })
      ) : (
        // Fallback static folders when Gmail not connected
        [
          { id: 'INBOX',   label: 'Inbox',   icon: <Inbox size={14} />,   color: '#6366f1' },
          { id: 'SENT',    label: 'Sent',    icon: <Send size={14} />,    color: '#22c55e' },
          { id: 'STARRED', label: 'Starred', icon: <Star size={14} />,    color: '#f59e0b' },
          { id: 'TRASH',   label: 'Trash',   icon: <Trash2 size={14} />,  color: '#64748b' },
        ].map(f => (
          <FolderRow key={f.id} id={f.id} label={f.label} icon={f.icon} color={f.color}
            active={active} count={counts[f.id]} onSelect={onSelect} />
        ))
      )}

      {/* ── User labels / custom folders ───────────────────────────────────── */}
      {userLabels.length > 0 && (
        <>
          <button
            onClick={() => setUserLabelsOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px 2px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.08em', width: '100%',
            }}
          >
            {userLabelsOpen
              ? <ChevronDown size={10} />
              : <ChevronRight size={10} />}
            Labels
          </button>

          {userLabelsOpen && userLabels.map(label => (
            <FolderRow
              key={label.id}
              id={label.id}
              label={label.displayName}
              icon={<FolderOpen size={14} />}
              color="#818cf8"
              active={active}
              count={label.messagesUnread > 0 ? label.messagesUnread : undefined}
              onSelect={onSelect}
              indent={label.depth}
            />
          ))}
        </>
      )}

      {/* ── CRM smart labels ───────────────────────────────────────────────── */}
      <SectionHeader style={{ marginTop: 8 }}>CRM Labels</SectionHeader>
      {CRM_LABELS.map(f => (
        <FolderRow
          key={f.key} id={f.key} label={f.label}
          icon={<f.icon size={14} />} color={f.color}
          active={active} count={counts[f.key]} onSelect={onSelect}
        />
      ))}

      {/* ── Sync controls ───────────────────────────────────────── */}
      <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Count selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px' }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flex: 1 }}>Sync last</span>
          <select
            value={syncCount}
            onChange={e => onSyncCountChange(Number(e.target.value))}
            disabled={syncing}
            style={{
              fontSize: 11, borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg-canvas)', color: 'var(--text-primary)',
              padding: '3px 6px', cursor: 'pointer', outline: 'none',
            }}
          >
            {[25, 50, 100, 250, 500].map(n => (
              <option key={n} value={n}>{n} messages</option>
            ))}
          </select>
        </div>
        {/* Sync button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onSync}
          disabled={syncing}
          style={{ width: '100%', fontSize: 12, gap: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <RefreshCw size={12} style={{ animation: syncing ? 'spin 0.8s linear infinite' : 'none' }} />
          {syncing ? 'Syncing…' : 'Sync Gmail'}
        </button>
        {/* Load more button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onLoadMore}
          disabled={syncing}
          style={{ width: '100%', fontSize: 11, gap: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.75 }}
        >
          ↓ Load more ({syncCount * 2})
        </button>
      </div>
    </aside>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      padding: '4px 8px 2px', ...style,
    }}>
      {children}
    </div>
  );
}

function FolderRow({
  id, label, icon, color, active, count, onSelect, indent = 0,
}: {
  id: string; label: string; icon: React.ReactNode; color: string;
  active: FolderKey; count?: number; onSelect: (id: FolderKey) => void; indent?: number;
}) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onSelect(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: `7px 10px 7px ${10 + indent * 14}px`,
        borderRadius: 8, border: 'none', cursor: 'pointer', width: '100%',
        textAlign: 'left', fontSize: 13, fontWeight: isActive ? 700 : 400,
        color: isActive ? color : 'var(--text-secondary)',
        background: isActive ? `${color}18` : 'transparent',
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      <span style={{ color: isActive ? color : 'var(--text-tertiary)', flexShrink: 0, display: 'flex' }}>
        {icon}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
          borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isActive ? color : 'var(--bg-elevated)',
          color: isActive ? '#fff' : 'var(--text-secondary)',
          padding: '0 5px', flexShrink: 0,
        }}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
