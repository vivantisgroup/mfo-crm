'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { Reply, Forward, Star, Archive, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { COLOR_MAP } from '@/components/TagManager';
import { InlineTagBay } from './InlineTagBay';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import type { ThreadSummary } from './ThreadList';
import { RecordLinkDropdown } from './RecordLinkDropdown';
import { SmartClassifier } from './SmartClassifier';
type CrmLinkTarget = any;

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
  attachments?: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    inlineData?: string;
  }[];
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
        const doc = iframe.contentDocument;
        if (!doc) return;
        const updateHeight = () => {
          const wrapper = doc.getElementById('email-wrapper');
          if (wrapper) {
            setIframeHeight(Math.max(wrapper.scrollHeight, wrapper.offsetHeight) + 32);
          } else {
            const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
            setIframeHeight(height + 32);
          }
        };
        updateHeight(); // Initial check
        
        // Observe mutations (e.g. content expanding)
        const observer = new MutationObserver(updateHeight);
        observer.observe(doc.body, { childList: true, subtree: true, attributes: true });
        
        // Ensure image loads adjust height
        doc.querySelectorAll('img').forEach(img => {
          if (!img.complete) {
            img.addEventListener('load', updateHeight);
            img.addEventListener('error', updateHeight);
          }
        });
      } catch { /* cross-origin fallback */ }
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [collapsed, msg.html]);

  const srcDoc = msg.html
    ? `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>
          :root { color-scheme: light; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; margin: 0; padding: 16px; line-height: 1.6; background: #ffffff !important; word-break: break-word; color: #000000 !important; }
          a { color: #4f46e5; text-decoration: underline; }
          img { max-width: 100%; height: auto; border-radius: 8px; }
          blockquote { border-left: 3px solid #cbd5e1; margin: 12px 0; padding: 4px 16px; opacity: 0.8; background: #f8fafc; border-radius: 0 8px 8px 0; color: #475569; }
          pre, code { background: #f1f5f9; padding: 3px 6px; border-radius: 6px; font-size: 13px; color: #0f172a; }
          .gmail_quote, .gmail_extra { display: block !important; visibility: visible !important; height: auto !important; overflow: visible !important; }
        </style>
      </head><body><div id="email-wrapper">${msg.html}</div></body></html>`
    : undefined;

  const replyTo    = msg.isSent ? msg.to : msg.from;
  const subjectLine = msg.subject || '(no subject)';

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
        background: collapsed ? 'var(--bg-background)' : 'var(--bg-surface)',
        borderBottom: collapsed ? 'none' : '1px solid var(--border-subtle)',
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
          {/* Attachments */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div style={{ marginBottom: 24, padding: '16px', background: 'var(--bg-background)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Attachments ({msg.attachments.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {msg.attachments.map((att: any) => {
                  const sizeKb = Math.round(att.size / 1024);
                  // Download handler
                  const handleDownload = async () => {
                    try {
                      const user = getAuth().currentUser;
                      if (!user) return;
                      const token = await user.getIdToken();
                      
                      // Handle small inline attachments
                      if (att.inlineData) {
                        try {
                           const base64 = att.inlineData.replace(/-/g, '+').replace(/_/g, '/');
                           const binStr = atob(base64);
                           const len = binStr.length;
                           const bytes = new Uint8Array(len);
                           for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
                           
                           const blob = new Blob([bytes], { type: att.mimeType });

                           if ('showSaveFilePicker' in window) {
                             try {
                               const handle = await (window as any).showSaveFilePicker({ suggestedName: att.name });
                               const writable = await handle.createWritable();
                               await writable.write(blob);
                               await writable.close();
                               return; // Done
                             } catch (err: any) {
                               if (err.name === 'AbortError') return;
                             }
                           }
                           
                           const blobUrl = URL.createObjectURL(blob);
                           const a = document.createElement('a');
                           a.href = blobUrl;
                           a.download = att.name;
                           document.body.appendChild(a);
                           a.click();
                           document.body.removeChild(a);
                           URL.revokeObjectURL(blobUrl);
                        } catch (e) {
                           console.error('Failed to parse inline attachment base64', e);
                        }
                        return;
                      }

                      // Handle regular file downloads via API
                      const url = `/api/mail/attachment/${msg.id}/${att.id}?uid=${user.uid}&idToken=${token}&name=${encodeURIComponent(att.name)}&mimeType=${encodeURIComponent(att.mimeType)}`;
                      
                      if ('showSaveFilePicker' in window) {
                        try {
                           const handle = await (window as any).showSaveFilePicker({ suggestedName: att.name });
                           const res = await fetch(url);
                           if (!res.ok) throw new Error('Download failed');
                           const blob = await res.blob();
                           const writable = await handle.createWritable();
                           await writable.write(blob);
                           await writable.close();
                           return; // Done
                        } catch (err: any) {
                           if (err.name === 'AbortError') return;
                        }
                      }
                      
                      // Fallback
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = att.name;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    } catch (e) {
                      console.error('Download failed', e);
                    }
                  };

                  return (
                    <button
                      key={att.id}
                      onClick={handleDownload}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                        cursor: 'pointer', textAlign: 'left', maxWidth: 220, transition: 'background 0.15s'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = 'var(--bg-background)'}
                      onMouseOut={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                    >
                      <div style={{ fontSize: 20 }}>📎</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {att.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {sizeKb} KB
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {msg.html
            ? <iframe ref={iframeRef} srcDoc={srcDoc} sandbox="allow-same-origin"
                style={{ width: '100%', border: 'none', height: iframeHeight, minHeight: 120, display: 'block' }} title="Email content" />
            : <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, inherit', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-primary)', margin: 0, background: 'transparent' }}>
                {msg.text || msg.snippet}
              </div>
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
      width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border-subtle)', cursor: 'pointer',
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
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [collapsed,   setCollapsed]   = useState<Set<string>>(new Set());
  const [links,       setLinks]       = useState<CrmLinkTarget[]>(initialLinks);

  // Sync links when the selected thread changes
  useEffect(() => {
    setLinks(initialLinks);
  }, [thread?.id]);

  useEffect(() => {
    if (!thread || !uid) { setMessages([]); setErrorMsg(null); return; }
    loadThread(thread.gmailThreadId ?? thread.id, thread.provider ?? 'google');
  }, [thread?.id, thread?.provider]);

  async function loadThread(threadId: string, provider: string = 'google') {
    setLoading(true);
    setErrorMsg(null);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const params  = new URLSearchParams({ uid, idToken: idToken ?? '', provider, tenantId });
      const res     = await fetch(`/api/mail/thread/${encodeURIComponent(threadId)}?${params}`);
      if (!res.ok) {
        let errText = await res.text();
        try {
          const json = JSON.parse(errText);
          errText = json.error || errText;
        } catch { /* ignore */ }
        console.warn(`Thread load warning [${provider}]:`, res.status, errText);
        throw new Error(`Failed to load from ${provider}: ${errText}`);
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
      const allIds = (data.messages as MessageDetail[]).map(m => m.id);
      const lastId = allIds[allIds.length - 1];
      setCollapsed(new Set(allIds.filter(id => id !== lastId)));
    } catch (e: any) { 
      console.error(e); 
      setErrorMsg(e.message);
      setMessages([]);
    }
    finally { setLoading(false); }
  }

  function toggleCollapse(id: string) {
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function handleLinksChange(newLinks: CrmLinkTarget[]) {
    setLinks(newLinks);
    if (emailLogId) onLinksChange?.(emailLogId, newLinks);
  }

  const handleTagsChange = async (newTags: string[]) => {
    if (!emailLogId || !uid) return;
    try {
      const db = getFirestore();
      await updateDoc(doc(db, 'communications', emailLogId), { tags: newTags });
    } catch (e) {
      console.error('Failed to update tags:', e);
    }
  };

  const handleAutoTag = async (newAutoTags: string[]) => {
    if (!emailLogId || !uid) return;
    try {
      const currentTags = thread?.tags || [];
      const updatedTags = Array.from(new Set([...currentTags, ...newAutoTags]));
      const db = getFirestore();
      await updateDoc(doc(db, 'communications', emailLogId), { tags: updatedTags });
    } catch (e) {
      console.error('Auto tag failed:', e);
    }
  };

  if (errorMsg) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Cannot load this conversation</p>
          <p style={{ fontSize: 13 }}>{errorMsg}</p>
        </div>
      </div>
    );
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
    <div style={{ flex: 1, display: 'flex', minWidth: 0, height: '100%', overflow: 'hidden', background: 'var(--bg-background)' }}>
      {/* ── Main reading area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Thread header */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface)', zIndex: 10 }}>
          {/* Top Actions Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginBottom: 16 }}>
              {emailLogId && uid && (
                 <>
                   <SmartClassifier 
                     uid={uid} 
                     tenantId={tenantId} 
                     thread={thread} 
                     currentLinks={links} 
                     onLinksUpdated={handleLinksChange} 
                   />
                   <div style={{ width: '100%', maxWidth: 280 }}>
                     <RecordLinkDropdown
                       emailLogId={emailLogId}
                       uid={uid}
                       tenantId={tenantId}
                       links={links}
                       onChange={handleLinksChange}
                       onAutoTag={handleAutoTag}
                     />
                   </div>
                 </>
              )}
          </div>

          {/* Subject Line & Tagging Bay */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <button 
                onClick={() => {
                   if (messages.length > 0) {
                      const msg = messages[messages.length - 1];
                      const replyTo = msg.isSent ? msg.to : msg.from;
                      onReply(replyTo, msg.subject || '(no subject)', msg.id, msg.threadId);
                   }
                }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, transition: 'all 0.1s' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              >
                 <Reply size={15} strokeWidth={2.5} /> Reply
              </button>
              <button 
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, transition: 'all 0.1s' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              >
                 <Forward size={15} strokeWidth={2.5} /> Forward
              </button>
              <button 
                onClick={() => { if (messages.length > 0) onAction([messages[0].id], 'trash') }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, transition: 'all 0.1s' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--brand-faint)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              >
                 <Trash2 size={15} strokeWidth={2.5} /> Delete
              </button>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px 0', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              {thread.subject || '(no subject)'}
            </h2>
            <div style={{ maxWidth: '100%' }}>
              <InlineTagBay tags={thread.tags || []} onChange={handleTagsChange} tenantId={tenantId} />
            </div>
          </div>

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
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
          {loading
            ? Array.from({ length: 2 }).map((_, i) => (
                <div key={i} style={{ height: 120, borderRadius: 12, background: 'var(--bg-elevated)', animation: 'pulse 1.5s infinite' }} />
              ))
            : errorMsg 
            ? (
               <div style={{ padding: 24, background: '#ef444415', border: '1px solid #ef444440', borderRadius: 12, color: '#ef4444', fontSize: 14 }}>
                 <strong>Cannot load thread:</strong> <br/>
                 {errorMsg}
               </div>
              )
            : messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} collapsed={collapsed.has(msg.id)}
                  onToggle={() => toggleCollapse(msg.id)} onReply={onReply} onAction={onAction} />
              ))
          }
        </div>
      </div>
    </div>
  );
}
