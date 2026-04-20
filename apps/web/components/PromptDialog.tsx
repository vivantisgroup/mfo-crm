'use client';

/**
 * PromptDialog — a styled, animated prompt modal that replaces
 * the native browser window.prompt() popup.
 *
 * Usage:
 *   const [prompt, setPrompt] = useState<PromptOptions | null>(null);
 *
 *   // Trigger:
 *   setPrompt({ title: 'New folder', placeholder: 'Name...', onConfirm: (val) => createFolder(val) });
 *
 *   // Render:
 *   {prompt && <PromptDialog {...prompt} onCancel={() => setPrompt(null)} />}
 */

import React, { useState, useEffect, useRef } from 'react';

export interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  title,
  message,
  defaultValue = '',
  placeholder = '',
  confirmLabel = 'Submit',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: PromptOptions) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input and select text on mount
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

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
        <div style={{ height: 3, background: 'var(--brand-primary)', opacity: 0.8 }} />

        <div style={{ padding: '28px 28px 24px' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: message ? 10 : 20 }}>
            {title}
          </div>

          {message && (
            <p style={{
              fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6,
              marginBottom: 16,
            }}>
              {message}
            </p>
          )}

          <div style={{ marginBottom: 24 }}>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  onConfirm(value);
                  onCancel();
                } else if (e.key === 'Escape') {
                  onCancel();
                }
              }}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 14,
                borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg-canvas)', color: 'var(--text-primary)',
                outline: 'none', transition: 'border-color 0.15s'
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

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
              onClick={() => { onConfirm(value); onCancel(); }}
              style={{
                padding: '9px 22px', fontSize: 13, fontWeight: 700,
                borderRadius: 10, border: 'none',
                background: 'var(--brand-primary)', color: '#fff',
                cursor: 'pointer', transition: 'opacity 0.15s',
                boxShadow: `0 4px 12px rgba(10, 110, 209, 0.4)`,
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
