'use client';

import React, { useState } from 'react';
import { Star, Archive, Trash2, RotateCcw, Paperclip } from 'lucide-react';
import { COLOR_MAP } from '@/components/TagManager';

export interface ThreadSummary {
  id:              string;  // threadId (= first message id for Gmail)
  gmailThreadId?:  string;
  subject:         string;
  fromEmail:       string;
  fromName:        string;
  snippet:         string;
  receivedAt:      string;
  direction:       'inbound' | 'outbound';
  isUnread:        boolean;
  isStarred:       boolean;
  linkedFamilyId?:  string;
  linkedFamilyName?: string;
  crmLinks?:       any[];
  tags?:           any[];
  messageCount?:   number;
  hasAttachments?: boolean;
}

interface Props {
  threads:        ThreadSummary[];
  loading:        boolean;
  selected?:      string;
  globalTags?:    any[];
  onSelect:       (t: ThreadSummary) => void;
  onAction:       (ids: string[], action: string) => void;
  emptyMessage:   string;
}

function timeLabel(iso: string): string {
  if (!iso) return '';
  const d   = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Avatar({ name, email }: { name: string; email: string }) {
  const initials = (name || email).slice(0, 2).toUpperCase();
  const hue = (email.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 37) % 360;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue},50%,30%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, color: `hsl(${hue},60%,80%)`,
      border: `1.5px solid hsl(${hue},40%,25%)`,
    }}>
      {initials}
    </div>
  );
}

export function ThreadList({ threads, loading, selected, globalTags, onSelect, onAction, emptyMessage }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
        <div style={{ fontSize: 13 }}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', height: '100%' }}>
      {threads.map(t => {
        const isSelected = selected === t.id;
        const isHovered  = hoveredId === t.id;
        const displayName = t.direction === 'outbound' && t.fromEmail
          ? `To: ${t.fromName || t.fromEmail}`
          : t.fromName || t.fromEmail;

        return (
          <div
            key={t.id}
            onClick={() => onSelect(t)}
            onMouseEnter={() => setHoveredId(t.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:           12,
              padding:       '10px 16px',
              cursor:        'pointer',
              borderBottom:  '1px solid var(--border-subtle)',
              background:    isSelected
                ? 'var(--brand-faint)'
                : isHovered
                ? 'var(--bg-muted)'
                : 'transparent',
              borderLeft:    isSelected ? '3px solid var(--brand-primary)' : '3px solid transparent',
              transition:    'all 0.1s',
              position:      'relative',
            }}
          >
            {/* Unread dot */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: t.isUnread ? 'var(--brand-500)' : 'transparent',
            }} />

            {/* Avatar */}
            <Avatar name={t.fromName} email={t.fromEmail} />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <div style={{
                  fontSize: 13, fontWeight: t.isUnread ? 700 : 500,
                  color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, fontWeight: t.isUnread ? 600 : 400 }}>
                  {timeLabel(t.receivedAt)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <div style={{
                  fontSize: 12, fontWeight: t.isUnread ? 600 : 400,
                  color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {t.subject || '(no subject)'}
                </div>
                {t.hasAttachments && (
                  <div title="Has attachments"><Paperclip size={14} strokeWidth={2.5} color="#64748b" style={{ flexShrink: 0 }} /></div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                  {t.snippet}
                </div>
              </div>
              
              {/* Tagging Bay (newline beneath snippet) */}
              {(() => {
                 const tags = t.tags || [];
                 if (tags.length === 0) return null;

                 return (
                   <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                     {tags.map((tagName: string, idx: number) => {
                        const found = globalTags?.find((gt: any) => gt.name.toLowerCase() === tagName.toLowerCase());
                        const colorName = found ? found.color : 'slate';
                        const colorHex = COLOR_MAP[colorName] || COLOR_MAP['slate'];
                        
                        return (
                          <span key={`tag-${idx}`} style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 12,
                            background: `color-mix(in srgb, ${colorHex} 15%, transparent)`, 
                            color: `color-mix(in srgb, ${colorHex} 80%, var(--text-primary))`, 
                            border: `1px solid color-mix(in srgb, ${colorHex} 30%, transparent)`,
                            fontWeight: 800, whiteSpace: 'nowrap'
                          }}>
                            {tagName}
                          </span>
                        );
                     })}
                   </div>
                 );
              })()}
            </div>

            {/* Thread count badge */}
            {t.messageCount && t.messageCount > 1 && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                {t.messageCount}
              </div>
            )}

            {/* Hover quick-actions */}
            {isHovered && (
              <div
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}
                onClick={e => e.stopPropagation()}
              >
                <QuickAction
                  icon={<Star size={13} fill={t.isStarred ? '#f59e0b' : 'none'} strokeWidth={1.8} />}
                  title={t.isStarred ? 'Unstar' : 'Star'}
                  color={t.isStarred ? '#f59e0b' : undefined}
                  onClick={() => onAction([t.gmailThreadId ?? t.id], t.isStarred ? 'unstar' : 'star')}
                />
                <QuickAction
                  icon={<Archive size={13} strokeWidth={1.8} />}
                  title="Archive"
                  onClick={() => onAction([t.gmailThreadId ?? t.id], 'archive')}
                />
                <QuickAction
                  icon={<RotateCcw size={13} strokeWidth={1.8} />}
                  title={t.isUnread ? 'Mark read' : 'Mark unread'}
                  onClick={() => onAction([t.gmailThreadId ?? t.id], t.isUnread ? 'markRead' : 'markUnread')}
                />
                <QuickAction
                  icon={<Trash2 size={13} strokeWidth={1.8} />}
                  title="Trash"
                  color="#ef4444"
                  onClick={() => onAction([t.gmailThreadId ?? t.id], 'trash')}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuickAction({ icon, title, onClick, color }: { icon: React.ReactNode; title: string; onClick: () => void; color?: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border-subtle)', cursor: 'pointer',
        background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color ?? 'var(--text-secondary)', transition: 'background 0.1s',
      }}
    >
      {icon}
    </button>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bg-elevated)', flexShrink: 0 }} />
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elevated)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 12, borderRadius: 4, background: 'var(--bg-elevated)', width: '40%' }} />
        <div style={{ height: 11, borderRadius: 4, background: 'var(--bg-elevated)', width: '65%' }} />
        <div style={{ height: 10, borderRadius: 4, background: 'var(--bg-elevated)', width: '80%' }} />
      </div>
    </div>
  );
}
