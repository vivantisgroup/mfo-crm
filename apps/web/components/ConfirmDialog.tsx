'use client';

/**
 * ConfirmDialog — a styled, animated confirmation modal that replaces
 * the native browser window.confirm() popup.
 *
 * Usage:
 *   const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
 *
 *   // Trigger:
 *   setConfirm({ title: 'Remove User', message: 'They will lose access.', variant: 'danger',
 *     onConfirm: () => doRemove() });
 *
 *   // Render:
 *   {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
 */

import React from 'react';

export interface ConfirmOptions {
  title:      string;
  message:    string;
  confirmLabel?: string;
  cancelLabel?:  string;
  /** 'danger' = red confirm button (default), 'warning' = amber, 'info' = brand */
  variant?:   'danger' | 'warning' | 'info';
  onConfirm:  () => void;
  onCancel:   () => void;
}

const VARIANT_STYLES = {
  danger:  { color: '#ef4444', bg: '#ef444415', border: '#ef444440', icon: '🗑' },
  warning: { color: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b40', icon: '⚠️' },
  info:    { color: '#6366f1', bg: '#6366f115', border: '#6366f140', icon: 'ℹ️' },
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'danger',
  onConfirm,
  onCancel,
}: ConfirmOptions) {
  const v = VARIANT_STYLES[variant];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        style={{
          width: 440, maxWidth: '92vw',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease',
        }}
      >
        {/* Accent top bar */}
        <div style={{ height: 3, background: v.color, opacity: 0.8 }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Icon + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: v.bg, border: `1px solid ${v.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>
              {v.icon}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {title}
            </div>
          </div>

          {/* Message */}
          <p style={{
            fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6,
            margin: '0 0 24px', paddingLeft: 54,
          }}>
            {message}
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '9px 20px', fontSize: 13, fontWeight: 600,
                borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg-canvas)', color: 'var(--text-secondary)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-overlay)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-canvas)')}
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => { onConfirm(); onCancel(); }}
              style={{
                padding: '9px 22px', fontSize: 13, fontWeight: 700,
                borderRadius: 10, border: 'none',
                background: v.color, color: '#fff',
                cursor: 'pointer', transition: 'opacity 0.15s',
                boxShadow: `0 4px 12px ${v.color}44`,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}
