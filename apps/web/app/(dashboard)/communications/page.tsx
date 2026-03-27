'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

// ─── UI Layout & Styling Constants ───────────────────────────────────────────
const BORDER = '1px solid var(--border)';
const BG_ELEVATED = 'var(--bg-elevated)';

// ─── Types (mirrored from schema) ────────────────────────────────────────────
interface EmailMessage {
  id: string;
  folder: string;
  subject: string;
  snippet: string;
  sender: { name: string; email: string };
  receivedAt: string;
  isRead: boolean;
  bodyHtml: string;
}

export default function CommunicationsPage() {
  const { user, tenant } = useAuth();
  
  // ─── State ────────────────────────────────────────────────────────────────
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'drafts'>('inbox');
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Composer Form
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  // ─── Data Fetching ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    fetchMessages();
  }, [user?.uid, activeFolder]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      // INFO: Real implementation fetches from Firebase based on the current user's connected account.
      // This query assumes a data structure laid out in lib/emailService.ts.
      const q = query(
        collection(db, 'email_messages'),
        where('tenantId', '==', (tenant as any)?.id || ''),
        where('folder', '==', activeFolder),
        orderBy('receivedAt', 'desc')
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as EmailMessage));
      
      setMessages(data);
    } catch (err) {
      console.error('Fetch emails error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/email/sync?accountId=${user?.uid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchMessages();
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setSyncing(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // NOTE: In production, sanitize HTML before submitting. Use libraries like DOMPurify.
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: user?.uid, // Using UID as proxy for account ID in demo
          to: composeTo,
          subject: composeSubject,
          htmlBody: composeBody
        }),
      });
      if (res.ok) {
        setIsComposing(false);
        setComposeTo(''); setComposeSubject(''); setComposeBody('');
        if (activeFolder === 'sent') fetchMessages();
      }
    } catch (err) {
      console.error('Send failed:', err);
    }
  };

  const activeMessage = messages.find(m => m.id === selectedMsgId);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', height: 'calc(100vh - 120px)', border: BORDER, borderRadius: 12, overflow: 'hidden', background: BG_ELEVATED }}>
      
      {/* ─── 1. SIDEBAR PANEL ────────────────────────────────────────────── */}
      <div style={{ width: 240, borderRight: BORDER, display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)' }}>
        <div style={{ padding: '20px', borderBottom: BORDER }}>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginBottom: 16 }}
            onClick={() => setIsComposing(true)}
          >
            ✏️ Compose
          </button>
          <button 
            className="btn btn-outline btn-sm" 
            style={{ width: '100%', fontSize: 11 }}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? '🔄 Syncing...' : '🔗 Connect / Sync Account'}
          </button>
        </div>
        
        <div style={{ flex: 1, padding: '16px 8px' }}>
          {(['inbox', 'sent', 'drafts'] as const).map(folder => (
            <button
              key={folder}
              onClick={() => { setActiveFolder(folder); setSelectedMsgId(null); setIsComposing(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeFolder === folder ? 'var(--brand-500)20' : 'transparent',
                color: activeFolder === folder ? 'var(--brand-400)' : 'var(--text-secondary)',
                fontWeight: activeFolder === folder ? 700 : 500,
                textTransform: 'capitalize', marginBottom: 4, display: 'flex', justifyContent: 'space-between'
              }}
              className="hover-bg"
            >
              {folder}
              {folder === 'inbox' && <span style={{ background: 'var(--brand-500)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>3</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 2. LIST VIEW PANEL ──────────────────────────────────────────── */}
      <div style={{ width: 350, borderRight: Object.keys(isComposing || activeMessage || {}).length ? BORDER : 'none', display: 'flex', flexDirection: 'column', background: BG_ELEVATED }}>
        <div style={{ padding: '16px 20px', borderBottom: BORDER, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ textTransform: 'capitalize', fontSize: 16, fontWeight: 800 }}>{activeFolder}</h2>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{messages.length} messages</span>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading messages...</div>
          ) : messages.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No messages found.<br/>Click "Sync Account" to fetch.
            </div>
          ) : (
            messages.map(msg => (
              <div 
                key={msg.id}
                onClick={() => { setSelectedMsgId(msg.id); setIsComposing(false); }}
                style={{
                  padding: '16px', borderBottom: BORDER, cursor: 'pointer',
                  background: selectedMsgId === msg.id ? 'var(--brand-500)10' : 'transparent',
                  borderLeft: msg.isRead ? '3px solid transparent' : '3px solid var(--brand-500)',
                }}
                className="hover-bg"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: msg.isRead ? 600 : 800, fontSize: 13, color: 'var(--text-primary)' }}>
                    {msg.sender.name || msg.sender.email}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {new Date(msg.receivedAt).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ fontWeight: msg.isRead ? 500 : 700, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {msg.subject}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {msg.snippet}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── 3. THREAD VIEW / COMPOSER PANEL ─────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)' }}>
        
        {isComposing ? (
          // Composer View
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '16px 24px', borderBottom: BORDER, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>New Message</h2>
              <button type="button" onClick={() => setIsComposing(false)} className="btn btn-ghost btn-sm">Discard</button>
            </div>
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12, borderBottom: BORDER }}>
              <input 
                type="email" placeholder="To:" required value={composeTo} onChange={e => setComposeTo(e.target.value)}
                style={{ width: '100%', padding: '8px 0', border: 'none', borderBottom: BORDER, background: 'transparent', fontSize: 14, outline: 'none', color: 'var(--text-primary)' }}
              />
              <input 
                type="text" placeholder="Subject:" required value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
                style={{ width: '100%', padding: '8px 0', border: 'none', borderBottom: BORDER, background: 'transparent', fontSize: 14, outline: 'none', fontWeight: 600, color: 'var(--text-primary)' }}
              />
            </div>
            <div style={{ flex: 1, padding: 24 }}>
              {/* NOTE: In production, integrate a Rich Text Editor (like Tiptap or Quill) here */}
              <textarea 
                placeholder="Write your beautiful email here..." required
                value={composeBody} onChange={e => setComposeBody(e.target.value)}
                style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', resize: 'none', fontSize: 14, outline: 'none', color: 'var(--text-secondary)', lineHeight: 1.6 }}
              />
            </div>
            <div style={{ padding: '16px 24px', borderTop: BORDER, display: 'flex', justifyContent: 'space-between', background: BG_ELEVATED }}>
              <button type="button" className="btn btn-outline btn-sm">📎 Attach</button>
              <button type="submit" className="btn btn-primary">📤 Send</button>
            </div>
          </form>

        ) : activeMessage ? (
          // Reading Thread View
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: BORDER }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>{activeMessage.subject}</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand-500)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                    {activeMessage.sender.name?.charAt(0) || activeMessage.sender.email.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{activeMessage.sender.name || activeMessage.sender.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{activeMessage.sender.email}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  {new Date(activeMessage.receivedAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{ padding: '32px 24px', flex: 1 }}>
              {/* NOTE: In production, heavily sanitize `bodyHtml` using DOMPurify before dangerouslySettingInnerHTML */}
              <div 
                className="email-body-renderer"
                style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: activeMessage.bodyHtml || '<p>No content</p>' }}
              />
            </div>
            <div style={{ padding: '16px 24px', borderTop: BORDER, background: BG_ELEVATED }}>
              <button className="btn btn-outline" onClick={() => { setIsComposing(true); setComposeTo(activeMessage.sender.email); setComposeSubject(`Re: ${activeMessage.subject}`); }}>
                ↩️ Reply
              </button>
            </div>
          </div>

        ) : (
          // Empty State
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 48 }}>✉️</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Select a message to read</div>
            <div style={{ fontSize: 13 }}>Or compose a new one</div>
          </div>
        )}

      </div>
    </div>
  );
}
