'use client';

import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { useAuth } from '@/lib/AuthContext';
import { X, ChevronDown, Paperclip, Trash2 } from 'lucide-react';

interface Props {
  initialTo?:      string;
  initialSubject?: string;
  initialCc?:      string;
  replyToId?:      string;
  threadId?:       string;
  onClose:         () => void;
  onSent:          () => void;
}

export function Composer({ initialTo, initialSubject, initialCc, replyToId, threadId, onClose, onSent }: Props) {
  const { user } = useAuth();
  const [to,      setTo]      = useState(initialTo ?? '');
  const [cc,      setCc]      = useState(initialCc ?? '');
  const [bcc,     setBcc]     = useState('');
  const [subject, setSubject] = useState(initialSubject?.startsWith('Re:') ? initialSubject : initialSubject ? `Re: ${initialSubject}` : '');
  const [body,    setBody]    = useState('');
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');
  const [showCcBcc, setShowCcBcc] = useState(!!(initialCc));
  const [minimized, setMinimized] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; type: string; data: string; size: number }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTo)      setTo(initialTo);
    if (initialCc)      setCc(initialCc);
    if (initialSubject) setSubject(initialSubject.startsWith('Re:') ? initialSubject : `Re: ${initialSubject}`);
  }, [initialTo, initialCc, initialSubject]);

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('To, Subject, and body are required.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const tenant  = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      const res = await fetch('/api/mail/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid:              user?.uid,
          idToken,
          to,
          subject,
          body,
          tenantId:         tenant?.id,
          replyToMessageId: replyToId,
          attachments:      attachments.map(a => ({ name: a.name, type: a.type, data: a.data })),
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? 'Send failed');
      }
      onSent();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    files.forEach(file => {
      // Don't allow massive files (> 20MB) to protect memory/API limits
      if (file.size > 20 * 1024 * 1024) {
        setError(`File ${file.name} is too large (max 20MB)`);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Url = event.target?.result as string;
        // Strip the data:mime/type;base64, prefix
        const base64Data = base64Url.split(',')[1];
        if (base64Data) {
          setAttachments(prev => [...prev, {
            name: file.name,
            type: file.type || 'application/octet-stream',
            data: base64Data,
            size: file.size,
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    // Clear input so same file can be selected again if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  const subjectPreview = subject || 'New Message';

  return (
    <div style={{
      position:     'fixed',
      bottom:       0,
      right:        24,
      width:        540,
      zIndex:       300,
      background:   'var(--bg-surface)',
      border:       '1px solid var(--border)',
      borderBottom: 'none',
      borderRadius: '16px 16px 0 0',
      boxShadow:    '0 -8px 40px rgba(0,0,0,0.35)',
      display:      'flex',
      flexDirection:'column',
      overflow:     'hidden',
    }}>
      {/* Titlebar */}
      <div
        onClick={() => setMinimized(m => !m)}
        style={{
          padding:        '11px 16px',
          background:     'var(--bg-elevated)',
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          cursor:         'pointer',
          borderBottom:   '1px solid var(--border)',
          userSelect:     'none',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
          ✉️ {subjectPreview.length > 42 ? subjectPreview.slice(0, 42) + '…' : subjectPreview}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            title="Minimize"
            onClick={e => { e.stopPropagation(); setMinimized(m => !m); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px 4px' }}
          >
            <ChevronDown size={15} style={{ transform: minimized ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          <button
            title="Discard"
            onClick={e => { e.stopPropagation(); onClose(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px 4px', fontSize: 15 }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* To */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 48, flexShrink: 0 }}>To</label>
            <input
              className="input"
              style={{ border: 'none', borderRadius: 0, flex: 1, fontSize: 13, padding: '10px 0', background: 'transparent' }}
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@example.com"
            />
            <button
              onClick={() => setShowCcBcc(s => !s)}
              style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
            >
              Cc/Bcc
            </button>
          </div>

          {/* Cc / Bcc */}
          {showCcBcc && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
                <label style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 48, flexShrink: 0 }}>Cc</label>
                <input className="input" style={{ border: 'none', borderRadius: 0, flex: 1, fontSize: 13, padding: '10px 0', background: 'transparent' }}
                  value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
                <label style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 48, flexShrink: 0 }}>Bcc</label>
                <input className="input" style={{ border: 'none', borderRadius: 0, flex: 1, fontSize: 13, padding: '10px 0', background: 'transparent' }}
                  value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@example.com" />
              </div>
            </>
          )}

          {/* Subject */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
            <label style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 48, flexShrink: 0 }}>Subject</label>
            <input
              className="input"
              style={{ border: 'none', borderRadius: 0, flex: 1, fontSize: 13, padding: '10px 0', background: 'transparent', fontWeight: 600 }}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>

          {/* Body */}
          <textarea
            style={{
              border: 'none', outline: 'none', resize: 'none',
              padding: '14px 16px', fontSize: 13, lineHeight: 1.7, fontFamily: 'inherit',
              background: 'var(--bg-surface)', color: 'var(--text-primary)', minHeight: 200,
            }}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your message…"
          />

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <div style={{ padding: '8px 16px', background: 'var(--bg-canvas)', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {attachments.map((att, i) => (
                <div key={i} style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', 
                  background: 'var(--bg-surface)', border: '1px solid var(--border)', 
                  borderRadius: 16, fontSize: 11, color: 'var(--text-secondary)' 
                }}>
                  <span style={{ maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{att.name}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>({Math.round(att.size / 1024)}kb)</span>
                  <button 
                    onClick={() => removeAttachment(i)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input 
            type="file" 
            multiple 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            style={{ display: 'none' }} 
          />

          {/* Error */}
          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', padding: '4px 16px' }}>{error}</div>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)',
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? '⏳ Sending…' : '📤 Send'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 13, gap: 4, display: 'flex', alignItems: 'center', padding: '0 8px', color: 'var(--text-secondary)' }}
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
              >
                <Paperclip size={15} />
              </button>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: '#ef4444' }}
              onClick={onClose}
              title="Discard draft"
            >
              🗑 Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
