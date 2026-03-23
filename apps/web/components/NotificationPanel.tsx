'use client';

import React, { useRef, useEffect } from 'react';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import type { AppNotification } from '@/lib/types';
import { formatDistanceToNow, parseISO } from 'date-fns';

function age(iso: string) {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); }
  catch { return ''; }
}

const SEVERITY_STYLE: Record<string, { bg: string; border: string; dot: string }> = {
  critical: { bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.25)',  dot: '#ef4444' },
  warning:  { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.25)', dot: '#f59e0b' },
  info:     { bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.2)',  dot: '#6366f1' },
};

const TYPE_ICON: Record<string, string> = {
  sla_assign_breach:     '⏱',
  sla_completion_breach: '🔴',
  task_assigned:         '✅',
  task_overdue:          '🔴',
  task_completed:        '✅',
};

interface Props {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: Props) {
  const { notifications, dismissNotification, openNotification, acceptNotification, clearAllNotifications } = useTaskQueue();
  const ref = useRef<HTMLDivElement>(null);

  const visible = notifications.filter(n => !n.dismissedAt);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 380,
        maxHeight: 520,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-overlay)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
          {visible.length > 0 && (
            <span style={{
              background: '#ef4444', color: 'white', borderRadius: 99,
              fontSize: 10, fontWeight: 700, padding: '1px 6px',
            }}>{visible.length}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {visible.length > 0 && (
            <button
              onClick={clearAllNotifications}
              style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 6 }}
            >
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {visible.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
            All caught up!
          </div>
        ) : (
          visible.map(n => <NotifItem key={n.id} n={n} onDismiss={dismissNotification} onOpen={openNotification} onAccept={acceptNotification} />)
        )}
      </div>
    </div>
  );
}

function NotifItem({
  n, onDismiss, onOpen, onAccept,
}: {
  n: AppNotification;
  onDismiss: (id: string) => void;
  onOpen:    (id: string) => void;
  onAccept:  (id: string) => void;
}) {
  const s = SEVERITY_STYLE[n.severity] ?? SEVERITY_STYLE.info;
  const isRead = !!n.readAt;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '10px 14px',
      background: isRead ? 'transparent' : s.bg,
      borderBottom: '1px solid var(--border)',
      borderLeft: `3px solid ${isRead ? 'transparent' : s.dot}`,
      transition: 'background 0.2s',
    }}>
      {/* Top row: icon + title + age */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>
          {TYPE_ICON[n.type] ?? '•'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: isRead ? 500 : 700,
            color: 'var(--text-primary)', lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{n.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
            {n.body}
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {age(n.createdAt)}
        </span>
      </div>

      {/* Action micro-buttons */}
      <div style={{ display: 'flex', gap: 4, paddingLeft: 22 }}>
        {n.taskId && (
          <MicroBtn
            label="Accept ✓"
            color="#22c55e"
            bg="rgba(34,197,94,0.12)"
            onClick={() => onAccept(n.id)}
            title="Accept task to your queue"
          />
        )}
        <MicroBtn
          label="Open →"
          color="var(--brand-400)"
          bg="rgba(99,102,241,0.1)"
          onClick={() => onOpen(n.id)}
          title="View task detail"
        />
        <MicroBtn
          label="✕"
          color="var(--text-tertiary)"
          bg="transparent"
          onClick={() => onDismiss(n.id)}
          title="Dismiss"
        />
      </div>
    </div>
  );
}

function MicroBtn({ label, color, bg, onClick, title }: {
  label: string; color: string; bg: string; onClick: () => void; title?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        fontSize: 10, fontWeight: 600, padding: '2px 7px',
        borderRadius: 5, border: `1px solid ${color}33`,
        background: bg, color, cursor: 'pointer',
        transition: 'all 0.15s', lineHeight: 1.5,
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {label}
    </button>
  );
}
