'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@tremor/react';
import { MessageSquare, Mail, AlertCircle, RefreshCcw, ArrowRight, Settings, Minimize2, Maximize2, Send, PhoneCall } from 'lucide-react';
import { getFirestore, collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { ReadingPane } from '@/app/(dashboard)/inbox/components/ReadingPane';
import { Composer } from '@/app/(dashboard)/inbox/components/Composer';
import { getAllMailConnections } from '@/lib/emailIntegrationService';

const db = getFirestore(firebaseApp);

type FilterType = 'all' | 'email' | 'teams' | 'whatsapp';

export function CommunicationsHub() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [detached, setDetached] = useState(false);
  const [queryText, setQueryText] = useState('');
  
  // Unified Feed state
  const [feed, setFeed] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [outboundMessage, setOutboundMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [composerState, setComposerState] = useState<{ to?: string; subject?: string; replyId?: string; threadId?: string; crmLinks?: any[] } | null>(null);

  const { user, firebaseUser, tenant } = useAuth();

  const handleSync = async () => {
    if (!user || !firebaseUser) return;
    setSyncing(true);
    try {
      if (!tenant?.id) throw new Error('No active tenant context.');
      const conns = await getAllMailConnections(tenant.id, user.uid);
      const provider = conns.microsoft ? 'microsoft' : (conns.google ? 'google' : null);
      if (!provider) {
         throw new Error('No active email provider integration found (Google or Microsoft). Please connect an account in settings.');
      }
      
      const res = await fetch('/api/mail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, idToken: await firebaseUser.getIdToken(), tenantId: tenant.id, provider })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Sync failed (${res.status}): ${errText}`);
      }
    } catch (e: any) {
      console.error('[CommunicationsHub] Sync error:', e.message || e);
      alert(`Sync failed: ${e.message || 'NetworkError'}`);
    } finally {
      setSyncing(false);
    }
  };

  // Unified Subscription
  useEffect(() => {
    if (!user) return;
    // Assuming single-tenant sandbox / user resolves tenant on backend
    // In production, we'd query by tenant_id. For UI we query root 'communications' collection.
    // Ensure you have an index for this if you start filtering server-side.
    
    // For sandbox simplicity, subscribing to last 100 global communications
    // and filtering securely client side (since sandbox often drops strict user matching).
    // Bypass missing Firestore index by sorting client-side
    const q = query(
      collection(db, 'communications'), 
      where('tenant_id', '==', tenant?.id || 'default'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      msgs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setFeed(msgs);
    });

    return () => unsubscribe();
  }, [user]);

  // Derived filtered feed
  const filteredFeed = useMemo(() => {
    let result = feed;
    
    // Type Filter
    if (filter === 'email') result = result.filter(m => m.type === 'email');
    if (filter === 'teams') result = result.filter(m => m.provider === 'teams');
    if (filter === 'whatsapp') result = result.filter(m => m.provider === 'whatsapp');

    // Text Filter
    if (queryText) {
      const q = queryText.toLowerCase();
      result = result.filter(m => 
        (m.subject || '').toLowerCase().includes(q) || 
        (m.snippet || '').toLowerCase().includes(q) ||
        (m.from || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [feed, filter, queryText]);

  const handleSend = async () => {
    if (!outboundMessage.trim() || !user || !firebaseUser) return;
    const msg = outboundMessage;
    setOutboundMessage('');
    
    try {
      const res = await fetch('/api/teams/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid: user.uid, 
          idToken: await firebaseUser.getIdToken(), // Pass ID Token here as well!
          message: msg, 
          chatId: 'default-crm-chat' 
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Send failed (${res.status}): ${errText}`);
      }
    } catch (e: any) {
      console.error('[CommunicationsHub] Send error:', e.message || e);
      alert(`Send failed: ${e.message || 'NetworkError'}`);
    }
  };

  const containerStyle: React.CSSProperties = detached ? {
    position: 'fixed',
    bottom: '40px',
    right: '40px',
    width: '420px',
    height: '700px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-float)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  } : {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    background: 'var(--bg-surface)'
  };

  const getProviderIcon = (provider: string) => {
     switch(provider) {
        case 'microsoft': case 'google': return <Mail size={12} className="text-[var(--text-tertiary)]" />;
        case 'teams': return <MessageSquare size={12} className="text-[#6264A7]" />;
        case 'slack': return <MessageSquare size={12} className="text-[#E01E5A]" />;
        case 'whatsapp': return <PhoneCall size={12} className="text-[#25D366]" />;
        default: return <MessageSquare size={12} />;
     }
  };

  return (
    <div style={containerStyle}>
      {/* Header & Filter Switcher */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex items-center gap-2">
            <span className="text-macro font-semibold" style={{ fontSize: '14px', letterSpacing: '-0.02em' }}>Comms Hub</span>
            <span className="text-[10px] uppercase font-bold bg-[var(--bg-active)] text-[var(--brand-primary)] px-2 py-0.5 rounded-full tracking-wider border border-[var(--brand-subtle)]">Unified</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setComposerState({})}
              className="flex items-center justify-center p-1.5 px-3 rounded-full bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-600)] transition-colors text-xs font-bold"
              title="Compose New Message"
            >
              Compose
            </button>
            <button 
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center justify-center p-1 rounded hover:bg-[var(--bg-surface)] transition-colors text-[var(--text-secondary)] hover:text-[var(--brand-primary)]"
              title="Sync Historical Emails"
            >
              <RefreshCcw size={13} className={syncing ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => setDetached(!detached)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              className="flex items-center justify-center p-1 rounded hover:bg-[var(--bg-surface)] transition-colors"
              title={detached ? "Dock to sidebar" : "Detach window"}
            >
              {detached ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-background)', borderRadius: 'var(--radius-sm)', padding: '2px', border: '1px solid var(--border)' }}>
          {[
            { id: 'all', label: 'Timeline' },
            { id: 'email', label: 'Emails' },
            { id: 'teams', label: 'Teams' },
            { id: 'whatsapp', label: 'WhatsApp', color: 'var(--color-emerald)' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setFilter(p.id as FilterType)}
              style={{
                flex: 1, padding: '4px 0', border: 'none', borderRadius: '4px',
                background: filter === p.id ? 'var(--bg-surface)' : 'transparent',
                boxShadow: filter === p.id ? 'var(--shadow-sm)' : 'none',
                color: filter === p.id ? (p.color || 'var(--text-primary)') : 'var(--text-tertiary)',
                fontWeight: filter === p.id ? 700 : 500,
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <span className="text-macro" style={{ fontWeight: filter === p.id ? 800 : 600 }}>{p.label}</span>
            </button>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Search all conversations..." 
            value={queryText}
            onChange={e => setQueryText(e.target.value)}
            style={{ 
              width: '100%', padding: '6px 12px', fontSize: '12px', 
              background: 'var(--bg-surface)', border: '1px solid var(--border)', 
              borderRadius: 'var(--radius-sm)', outline: 'none', color: 'var(--text-primary)' 
            }}
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane (Master List) */}
        <div className={`flex flex-col border-r border-[var(--border)] overflow-y-auto ${detached ? 'w-full' : 'w-[340px] shrink-0 bg-[var(--bg-canvas)]'}`} style={{ display: detached && selectedItem ? 'none' : 'flex' }}>
          {filteredFeed.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-8 opacity-50 mt-10">
                <MessageSquare className="text-[var(--text-tertiary)] mb-4" size={32} />
                <span className="text-xs text-[var(--text-secondary)]">Your timeline is empty.</span>
             </div>
          ) : (
            filteredFeed.map(item => {
              const isOutbound = item.direction === 'outbound';
              const isEmail = item.type === 'email';
              const active = selectedItem?.id === item.id;

              return (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedItem(item)}
                  className={`
                    flex flex-col border-b border-[var(--border)] p-3 cursor-pointer items-start relative
                    ${active ? 'bg-[var(--brand-50)] border-l-4 border-l-[var(--brand-500)]' : 'bg-[var(--bg-surface)] border-l-4 border-l-transparent hover:bg-[var(--bg-elevated)]'}
                  `}
                >
                  <div className="flex items-center gap-1.5 mb-1.5 px-1 w-full justify-between">
                     <div className="flex items-center gap-1.5 overflow-hidden">
                       {getProviderIcon(item.provider)}
                       <span className="text-[10px] text-[var(--text-secondary)] font-bold tracking-wide uppercase truncate">
                          {isOutbound ? 'You' : (item.from || 'Unknown')}
                       </span>
                     </div>
                     <span className="text-[9px] text-[var(--text-tertiary)] whitespace-nowrap ml-2">
                        {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                     </span>
                  </div>
                  
                  <div className="w-full flex-1 min-w-0 pr-1 px-1">
                     {isEmail && item.subject && (
                        <h4 className={`font-semibold text-xs mb-1 truncate ${active ? 'text-[var(--brand-900)]' : 'text-[var(--text-primary)]'}`}>
                          {item.subject}
                        </h4>
                     )}
                     <div className="whitespace-pre-wrap break-words line-clamp-2 text-[11px] text-[var(--text-tertiary)] leading-snug">
                       {item.snippet || item.body?.replace(/<[^>]+>/g, '')}
                     </div>
                     
                     {/* CRM Entity Mapping Badges */}
                     {item.crm_entity_links && item.crm_entity_links.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.crm_entity_links.map((link: any, idx: number) => (
                             <span key={idx} className="text-[9px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded font-bold whitespace-nowrap flex items-center gap-1">
                               <div className={`w-1.5 h-1.5 rounded-full ${link.type === 'org' ? 'bg-sky-500' : 'bg-indigo-500'}`} />
                               {link.name}
                             </span>
                          ))}
                        </div>
                     )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Pane (Detail View) */}
        {!detached && (
          <div className="flex-1 flex flex-col bg-[var(--bg-background)] overflow-hidden relative">
            {selectedItem ? (
              selectedItem.type === 'email' ? (
                <ReadingPane
                   thread={{
                      id: selectedItem.id,
                      gmailThreadId: selectedItem.thread_id || selectedItem.provider_message_id || selectedItem.id,
                      subject: selectedItem.subject || '',
                      fromEmail: selectedItem.from || '',
                      fromName: selectedItem.from || '',
                      snippet: selectedItem.snippet || '',
                      receivedAt: selectedItem.timestamp || '',
                      direction: (selectedItem.direction as any) || 'inbound',
                      tags: [],
                      crmLinks: selectedItem.crm_entity_links || [],
                      messageCount: 1,
                      isUnread: false,
                      isStarred: false,
                   }}
                   uid={user?.uid ?? ''}
                   tenantId={tenant?.id}
                   emailLogId={selectedItem.id}
                   initialLinks={selectedItem.crm_entity_links || []}
                   onReply={(to, subject, replyId, threadId) => setComposerState({ to, subject, replyId, threadId, crmLinks: selectedItem.crm_entity_links })}
                   onAction={() => {}} 
                />
              ) : (
                <div className="p-8">
                  <div className="text-xs text-[var(--text-tertiary)] uppercase font-bold tracking-widest mb-4 flex items-center gap-2">
                     {getProviderIcon(selectedItem.provider)} {selectedItem.provider} Message
                  </div>
                  <div className="bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border)] shadow-sm text-sm whitespace-pre-wrap">
                    {selectedItem.body || selectedItem.snippet}
                  </div>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-tertiary)]">
                 <Mail size={48} className="mb-4 opacity-50" />
                 <h3 className="font-bold text-sm text-[var(--text-secondary)]">No item selected</h3>
                 <p className="text-xs">Click a conversation on the left to read or tag it.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unified Input (Only for detached chat) */}
      {(filter !== 'email' && detached) && (
        <div style={{ padding: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', 
            border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '4px 8px' 
          }}>
            <input 
              type="text" 
              value={outboundMessage}
              onChange={e => setOutboundMessage(e.target.value)}
              onKeyDown={e => { if(e.key === 'Enter') handleSend(); }}
              placeholder={filter === 'whatsapp' ? "Reply to WhatsApp..." : "Reply in Teams..."}
              style={{ flex: 1, border: 'none', background: 'transparent', padding: '6px', fontSize: '13px', outline: 'none', color: 'var(--text-primary)' }}
            />
            <button 
              onClick={handleSend}
              style={{ 
              background: filter === 'whatsapp' ? 'var(--color-emerald)' : 'var(--brand-500)', 
              color: 'white', border: 'none', width: '28px', height: '28px', borderRadius: '50%',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: outboundMessage.trim() ? 1 : 0.5
            }}>
              <Send size={12} className="-ml-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Composer Pane */}
      {composerState && (
        <Composer
          initialTo={composerState.to}
          initialSubject={composerState.subject}
          replyToId={composerState.replyId}
          threadId={composerState.threadId}
          crmLinks={composerState.crmLinks || []}
          onClose={() => setComposerState(null)}
          onSent={() => setComposerState(null)}
        />
      )}
    </div>
  );
}
