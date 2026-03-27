'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { Reply, Star, Archive, Trash2, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import type { ThreadSummary } from './ThreadList';
import { CrmLinkPanel } from './CrmLinkPanel';
import type { CrmLinkTarget } from '@/app/api/mail/link/route';

interface MessageDetail {
  id:           string;
  threadId:     string;
  subject:      string;
  from:         string;
  to:           string;
  cc:           string;
  date:         string;
  isUnread:     boolean;
  isStarred:    boolean;
  isSent:       boolean;
  fromEmails:   string[];
  toEmails:     string[];
  html:         string;
  text:         string;
  snippet:      string;
  internalDate: string;
}

interface Props {
  thread?:      ThreadSummary;
  uid:          string;
  tenantId?:    string;
  emailLogId?:  string;         // Firestore email_log doc ID
  initialLinks?: CrmLinkTarget[];
  onReply:      (to: string, subject: string, messageId: string, threadId: string) => void;
  onAction:     (ids: string[], action: string) => void;
  onLinksChange?: (emailLogId: string, links: CrmLinkTarget[]) => void;
}

function formatDate(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ msg, collapsed, onToggle, onReply, onAction }: {
  msg: MessageDetail; collapsed: boolean; onToggle: () => void;
  onReply: (to: string, subject: string, messageId: string, threadId: string) => void;
  onAction: (ids: string[], action: string) => void;
}) {
  const iframeRef   = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(300);

  useEffect(() => {
    if (collapsed || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const onLoad = () => {
      try {
        const body = iframe.contentDocument?.body;
        if (body) setIframeHeight(body.scrollHeight + 24);
      } catch { /* cross-origin fallback */ }
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [collapsed, msg.html]);

  const srcDoc = msg.html
    ? `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #e2e8f0; margin: 12px; line-height: 1.6; background: transparent; word-break: break-word; }
          a { color: #818cf8; }
          img { max-width: 100%; }
          blockquote { border-left: 3px solid #334155; margin: 8px 0; padding: 4px 12px; color: #94a3b8; }
          pre, code { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
        </style>
      </head><body>${msg.html}</body></html>`
    : undefined;

  const replyTo    = msg.isSent ? msg.to : msg.from;
  const subjectLine = msg.subject || '(no subject)';

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-surface)' }}>
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
        background: collapsed ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        borderBottom: collapsed ? 'none' : '1px solid var(--border)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{msg.from || msg.to}</div>
          {collapsed
            ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.snippet}</div>
            : <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>To: {msg.to}{msg.cc ? ` · CC: ${msg.cc}` : ''} &nbsp;·&nbsp; {formatDate(msg.date)}</div>
          }
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!collapsed && (
            <>
              <ActionBtn icon={<Star size={13} fill={msg.isStarred ? '#f59e0b' : 'none'} />} title={msg.isStarred ? 'Unstar' : 'Star'}
                onClick={e => { e.stopPropagation(); onAction([msg.id], msg.isStarred ? 'unstar' : 'star'); }} />
              <ActionBtn icon={<Archive size={13} />} title="Archive"
                onClick={e => { e.stopPropagation(); onAction([msg.id], 'archive'); }} />
              <ActionBtn icon={<Trash2 size={13} />} title="Trash" color="#ef4444"
                onClick={e => { e.stopPropagation(); onAction([msg.id], 'trash'); }} />
            </>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(msg.date)}</div>
          {collapsed ? <ChevronDown size={14} color="var(--text-tertiary)" /> : <ChevronUp size={14} color="var(--text-tertiary)" />}
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: '16px 20px' }}>
          {msg.html
            ? <iframe ref={iframeRef} srcDoc={srcDoc} sandbox="allow-same-origin"
                style={{ width: '100%', border: 'none', height: iframeHeight, minHeight: 120 }} title="Email content" />
            : <pre style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)', margin: 0 }}>{msg.text || msg.snippet}</pre>
          }
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 12, gap: 6, display: 'flex', alignItems: 'center' }}
              onClick={() => onReply(replyTo, subjectLine, msg.id, msg.threadId)}>
              <Reply size={13} /> Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon, title, onClick, color }: { icon: React.ReactNode; title: string; onClick: (e: React.MouseEvent) => void; color?: string }) {
  return (
    <button title={title} onClick={onClick} style={{
      width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
      background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: color ?? 'var(--text-secondary)',
    }}>
      {icon}
    </button>
  );
}

// ─── Main ReadingPane ─────────────────────────────────────────────────────────

export function ReadingPane({ thread, uid, tenantId = '', emailLogId, initialLinks = [], onReply, onAction, onLinksChange }: Props) {
  const [messages,    setMessages]    = useState<MessageDetail[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [collapsed,   setCollapsed]   = useState<Set<string>>(new Set());
  const [showLink,    setShowLink]    = useState(false);
  const [links,       setLinks]       = useState<CrmLinkTarget[]>(initialLinks);

  // Sync links when the selected thread changes
  useEffect(() => {
    setLinks(initialLinks);
    setShowLink(false);
  }, [thread?.id]);

  useEffect(() => {
    if (!thread || !uid) { setMessages([]); return; }
    loadThread(thread.gmailThreadId ?? thread.id);
  }, [thread?.id]);

  async function loadThread(threadId: string) {
    setLoading(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const params  = new URLSearchParams({ uid, idToken: idToken ?? '' });
      const res     = await fetch(`/api/mail/thread/${threadId}?${params}`);
      if (!res.ok) throw new Error('Failed to load thread');
      const data = await res.json();
      setMessages(data.messages ?? []);
      const allIds = (data.messages as MessageDetail[]).map(m => m.id);
      const lastId = allIds[allIds.length - 1];
      setCollapsed(new Set(allIds.filter(id => id !== lastId)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function toggleCollapse(id: string) {
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function handleLinksChange(newLinks: CrmLinkTarget[]) {
    setLinks(newLinks);
    if (emailLogId) onLinksChange?.(emailLogId, newLinks);
  }

  if (!thread) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-tertiary)' }}>
        <div style={{ fontSize: 48 }}>✉️</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Select an email to read</div>
        <div style={{ fontSize: 12 }}>Choose a thread from the list</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', minWidth: 0, height: '100%', overflow: 'hidden' }}>
      {/* ── Main reading area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        {/* Thread header */}
        <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
              {thread.subject || '(no subject)'}
            </h2>
            {/* Link to CRM button */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowLink(v => !v)}
              style={{ fontSize: 12, gap: 6, display: 'flex', alignItems: 'center', flexShrink: 0,
                color: showLink ? 'var(--brand-400)' : undefined,
                borderColor: showLink ? 'var(--brand-400)' : undefined,
              }}
            >
              <Link2 size={13} />
              {links.length > 0 ? `Linked (${links.length})` : 'Link to CRM'}
            </button>
          </div>

          {/* CRM link chips */}
          {links.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {links.map(l => (
                <span key={`${l.type}-${l.id}`} style={{
                  fontSize: 11, padding: '2px 10px', borderRadius: 10, fontWeight: 700,
                  background: 'var(--brand-500)22', color: 'var(--brand-400)',
                }}>
                  🔗 {l.name}
                </span>
              ))}
            </div>
          )}

          {messages.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {messages.length} message{messages.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
              <button onClick={() => setCollapsed(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--brand-400)', padding: 0 }}>
                Expand all
              </button>
              {' · '}
              <button onClick={() => setCollapsed(new Set(messages.map(m => m.id)))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--brand-400)', padding: 0 }}>
                Collapse all
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {loading
            ? Array.from({ length: 2 }).map((_, i) => (
                <div key={i} style={{ height: 120, borderRadius: 12, background: 'var(--bg-elevated)', animation: 'pulse 1.5s infinite' }} />
              ))
            : messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} collapsed={collapsed.has(msg.id)}
                  onToggle={() => toggleCollapse(msg.id)} onReply={onReply} onAction={onAction} />
              ))
          }
        </div>
      </div>

      {/* ── CRM Link Panel ──────────────────────────────────────────────────── */}
      {showLink && emailLogId && (
        <CrmLinkPanel
          emailLogId={emailLogId}
          uid={uid}
          tenantId={tenantId}
          initialLinks={links}
          onLinksChange={handleLinksChange}
          onClose={() => setShowLink(false)}
        />
      )}
    </div>
  );
}
