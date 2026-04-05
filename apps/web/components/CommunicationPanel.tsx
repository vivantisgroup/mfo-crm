'use client';

/**
 * CommunicationPanel
 *
 * Displays all timeline communications (emails, chats, notes) linked to a specific family/contact/org.
 * Fully integrated with the new unified `communications` collection architecture.
 *
 */

import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { ExternalLink, RefreshCw, Plus, Search, MessageSquare, Mail, PhoneCall, Paperclip, Loader2 } from 'lucide-react';
import { uploadMultipleAttachments } from '@/lib/attachmentService';
import { useRouter } from 'next/navigation';
import { ReadingPane } from '@/app/(dashboard)/inbox/components/ReadingPane';
import { Composer } from '@/app/(dashboard)/inbox/components/Composer';
import { TeamsChatPane } from '@/app/(dashboard)/inbox/components/TeamsChatPane';
import { RichTextEditor } from '@/components/RichTextEditor';
import { COLOR_MAP } from '@/components/TagManager';

interface UnifiedCommunication {
  id: string;
  provider_message_id?: string;
  thread_id?: string;
  type: string;
  provider?: string;
  subject?: string;
  snippet?: string;
  body?: string;
  from?: string;
  to?: string[];
  timestamp: string;
  direction?: string;
  crm_entity_links?: any[];
  crm_entity_ids?: string[];
}

interface CommunicationPanelProps {
  familyId?:        string;
  familyName?:      string;
  contactId?:       string;
  orgId?:           string;
  primaryTag?:      string;
  systemTags?:      any[];
}

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  email:    { icon: '✉️',  color: '#6366f1', label: 'Email' },
  chat:     { icon: '💬',  color: '#6264A7', label: 'Chat' },
  note:     { icon: '📝',  color: '#8b5cf6', label: 'Note' },
  call:     { icon: '📞',  color: '#10b981', label: 'Call' },
  meeting:  { icon: '🤝',  color: '#f59e0b', label: 'Meeting' },
};

export function CommunicationPanel({ familyId, familyName, contactId, orgId, systemTags = [] }: CommunicationPanelProps) {
  const { user, tenant }    = useAuth();
  const router              = useRouter();
  const [timeline, setTimeline] = useState<UnifiedCommunication[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<UnifiedCommunication | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isComposing, setIsComposing] = useState(false);
  const [composeType, setComposeType] = useState('note');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [activityFiles, setActivityFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editActivityId, setEditActivityId] = useState<string | null>(null);
  
  const [composer, setComposer] = useState<{ to?: string; subject?: string; replyId?: string; threadId?: string } | null>(null);
  const targetId = familyId || contactId || orgId;

  const loadTimeline = useCallback(async () => {
    if (!tenant?.id || !targetId) return;
    setLoading(true);

    try {
      // Query the new unified collection
      // We look for any communication where crm_entity_ids contains our Client/Family ID
      const commsRef = collection(db, 'communications');
      let q = query(commsRef, where('tenant_id', '==', tenant.id));
      
      const snap = await getDocs(q);
      
      // Memory filter for array contents (safest for sandbox missing composite indexes)
      let results = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as UnifiedCommunication))
          .filter(d => (d.crm_entity_ids || []).includes(targetId) || d.crm_entity_links?.some(l => l.id === targetId));

      // Append any legacy activities that haven't been migrated yet (for backwards compatibility if desired, 
      // but sticking strictly to HubSpot architecture we'd rely primarily on communications).
      const actQ = query(collection(db, 'tenants', tenant.id, 'activities'), where('linkedFamilyId', '==', targetId));
      const actSnap = await getDocs(actQ);
      const activities = actSnap.docs.map(d => {
         const data = d.data();
         return {
            id: d.id,
            type: data.type || 'note',
            subject: data.subject,
            snippet: data.snippet,
            from: data.fromName || data.fromEmail,
            timestamp: data.createdAt,
            direction: data.direction,
            attachments: data.attachments || []
         } as UnifiedCommunication;
      });

      results = [...results, ...activities];

      // Sort
      results = results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setTimeline(results);
    } catch (e) {
      console.error('[CommunicationPanel]', e);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, targetId]);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  const filteredTimeline = timeline.filter(t => {
    const q = searchQuery.toLowerCase();
    return (
      (t.subject || '').toLowerCase().includes(q) || 
      (t.snippet || '').toLowerCase().includes(q) ||
      (t.from || '').toLowerCase().includes(q)
    );
  });

  const getProviderIcon = (provider?: string, type?: string) => {
     if (provider === 'microsoft' || provider === 'google') return <Mail size={13} className="text-[var(--text-tertiary)]" />;
     if (provider === 'teams') return <MessageSquare size={13} className="text-[#6264A7]" />;
     if (provider === 'whatsapp') return <PhoneCall size={13} className="text-[#25D366]" />;
     
     // Fallbacks to generic icons based on type
     if (type === 'email') return <Mail size={13} className="text-[var(--text-tertiary)]" />;
     return <span>{TYPE_META[type || 'note']?.icon || '📝'}</span>;
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 400, border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>

      {/* Thread list */}
      <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {familyName ? `${familyName}` : 'Communications'}
              {!loading && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400, background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 12, border: '1px solid var(--border)' }}>{timeline.length} items</span>}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => { setIsComposing(true); setEditActivityId(null); setExistingAttachments([]); setSelected(null); }} title="Log Activity" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', padding: 4, color: 'var(--brand-500)', display: 'flex', alignItems: 'center' }}>
                <Plus size={14} strokeWidth={3} />
              </button>
              <button onClick={() => loadTimeline()} title="Refresh Timeline" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)' }}>
                <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input 
              type="text" 
              placeholder="Search timeline..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--bg-canvas)',
                fontSize: 12, color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.15s'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--brand-500)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-canvas)' }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 68, margin: '8px 12px', borderRadius: 8, background: 'var(--bg-elevated)', animation: 'pulse 1.5s infinite' }} />
            ))
          ) : filteredTimeline.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔇</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>No communications linked yet</div>
            </div>
          ) : filteredTimeline.map(t => {
            const active = selected?.id === t.id;
            const isOutbound = t.direction === 'outbound';
            
            return (
              <div key={t.id} onClick={() => setSelected(t)}
                style={{
                  padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  background: active ? `var(--brand-50)` : 'var(--bg-surface)',
                  borderLeft: active ? `3px solid var(--brand-500)` : '3px solid transparent',
                  position: 'relative'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ padding: 4, background: 'var(--bg-elevated)', borderRadius: 4, display: 'flex' }}>
                    {getProviderIcon(t.provider, t.type)}
                  </div>
                  <span style={{ fontWeight: active ? 700 : 600, fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                    {t.subject || (t.type === 'chat' ? 'Chat Message' : 'Note')}
                  </span>
                </div>
                {t.snippet && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6, opacity: active ? 1 : 0.8 }}>
                    {t.snippet.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="font-semibold text-[9px] uppercase tracking-wider bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                    {isOutbound ? 'You' : (t.from || 'Unknown')}
                  </span>
                  <span>{new Date(t.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-canvas)' }}>
        {isComposing ? (
           // Log New Activity UI (Same as before but pushes to unified activities temporarily or communications if supported)
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 32px' }}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                 <Plus size={20} color="var(--brand-500)" /> Log New Activity
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                 {['note', 'call', 'meeting'].map(t => (
                 <button key={t} onClick={() => setComposeType(t)} style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer',
                    background: composeType === t ? 'var(--brand-500)' : 'var(--bg-elevated)',
                    color: composeType === t ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${composeType === t ? 'var(--brand-500)' : 'var(--border)'}`,
                    transition: 'all 0.1s'
                 }}>
                    {TYPE_META[t].icon} {t}
                 </button>
                 ))}
              </div>

              <input 
                 autoFocus 
                 placeholder="Subject (e.g. Discussed portfolio rebalancing)" 
                 value={composeSubject} 
                 onChange={e => setComposeSubject(e.target.value)}
                 className="input"
                 style={{ padding: '12px 16px', fontSize: 14, marginBottom: 16, width: '100%', fontWeight: 600 }}
              />

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                 <RichTextEditor 
                 content={composeContent}
                 onChange={(html) => setComposeContent(html)}
                 placeholder="Detailed notes or minutes from the interaction (supports rich text)..."
                 />
                 
                 <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                   <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', width: 'fit-content', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                     <Paperclip size={14} /> Add Attachments
                     <input type="file" multiple onChange={(e) => {
                        if (e.target.files) {
                           setActivityFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                        }
                     }} style={{ display: 'none' }} />
                   </label>
                   {(activityFiles.length > 0 || existingAttachments.length > 0) && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                       {existingAttachments.map((f, i) => (
                         <div key={'ext-'+i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                           📎 {f.name}
                           <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExistingAttachments(existingAttachments.filter((_, idx) => idx !== i)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'currentcolor', opacity: 0.6 }}>×</button>
                         </div>
                       ))}
                       {activityFiles.map((f, i) => (
                         <div key={i} style={{ background: 'var(--brand-50)', color: 'var(--brand-600)', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                           {f.name}
                           <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActivityFiles(activityFiles.filter((_, idx) => idx !== i)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'currentcolor', opacity: 0.6 }}>×</button>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                 <button 
                 onClick={() => { setIsComposing(false); setComposeSubject(''); setComposeContent(''); setActivityFiles([]); setEditActivityId(null); setExistingAttachments([]); }} 
                 className="btn btn-ghost" 
                 style={{ color: 'var(--text-secondary)' }}
                 >
                 Cancel
                 </button>
                 <button 
                 disabled={isSaving || !composeSubject.trim()}
                 onClick={async () => {
                    if (!tenant?.id) return;
                    setIsSaving(true);
                    try {
                       let finalAttachments = [...existingAttachments];
                       if (activityFiles.length > 0) {
                          const uploaded = await uploadMultipleAttachments(tenant.id, activityFiles);
                          finalAttachments = [...finalAttachments, ...uploaded];
                       }

                       if (editActivityId) {
                          await updateDoc(doc(db, 'tenants', tenant.id, 'activities', editActivityId), {
                             type: composeType,
                             subject: composeSubject.trim(),
                             snippet: composeContent.trim(),
                             attachments: finalAttachments,
                             updatedAt: new Date().toISOString()
                          });
                       } else {
                          await addDoc(collection(db, 'tenants', tenant.id, 'activities'), {
                             type: composeType,
                             subject: composeSubject.trim(),
                             snippet: composeContent.trim(),
                             attachments: finalAttachments,
                             linkedFamilyId: familyId || null,
                             linkedContactId: contactId || null,
                             linkedOrgId: orgId || null,
                             createdAt: new Date().toISOString(),
                             fromName: user?.email || 'System User',
                             direction: 'outbound'
                          });
                       }

                       setIsComposing(false);
                       setComposeSubject('');
                       setComposeContent('');
                       setActivityFiles([]);
                       setEditActivityId(null);
                       setExistingAttachments([]);
                       loadTimeline();
                    } catch(e) { console.error(e); } finally { setIsSaving(false); }
                 }}
                 className="btn btn-primary"
                 style={{ minWidth: 100, display: 'flex', justifyContent: 'center' }}
                 >
                 {isSaving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : (editActivityId ? 'Save Changes' : 'Log Activity')}
                 </button>
              </div>
           </div>
        ) : !selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: 'var(--text-tertiary)' }}>
            <div style={{ padding: 20, background: 'var(--bg-surface)', borderRadius: '50%', border: '1px solid var(--border)' }}>
              <MessageSquare size={32} style={{ opacity: 0.4 }} color="var(--brand-500)" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em' }}>Select a timeline event or log a new activity</div>
          </div>
        ) : (selected.type === 'chat' && selected.provider === 'teams') ? (
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <TeamsChatPane 
                 threadId={selected.id}
                 subject={selected.subject || ''}
                 participants={[{name: selected.from || 'User', email: ''}]}
                 messages={[{
                    id: selected.id,
                    fromName: selected.from || 'User',
                    fromEmail: '',
                    body: selected.body || selected.snippet || '',
                    timestamp: selected.timestamp,
                    direction: (selected.direction as any) || 'inbound',
                    attachments: (selected as any).attachments || []
                 }]}
                 onReply={async (body) => {
                    const res = await fetch('/api/webhooks/teams', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({
                        action: 'reply',
                        tenantId: tenant?.id,
                        userId: user?.uid,
                        threadId: selected.provider_message_id || selected.id,
                        text: body
                      })
                    });
                    if (!res.ok) throw new Error('Reply failed');
                    loadTimeline();
                 }}
              />
           </div>
        ) : (selected.type === 'email' && selected.provider) ? (
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <ReadingPane
                 thread={{
                    id: selected.id,
                    gmailThreadId: selected.thread_id || selected.provider_message_id || selected.id,
                    subject: selected.subject || '',
                    fromEmail: selected.from || '',
                    fromName: selected.from || '',
                    snippet: selected.snippet || '',
                    receivedAt: selected.timestamp || '',
                    direction: (selected.direction as any) || 'inbound',
                    tags: [],
                    crmLinks: selected.crm_entity_links || [],
                    messageCount: 1,
                    isUnread: false,
                    isStarred: false,
                 }}
                 uid={user?.uid ?? ''}
                 tenantId={tenant?.id}
                 emailLogId={selected.id}
                 initialLinks={selected.crm_entity_links || []}
                 onReply={(to, subject, messageId, threadId) => setComposer({ to, subject, replyId: messageId, threadId })}
                 onAction={() => {}} 
              />
           </div>
        ) : (
            <div style={{ padding: 40, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', margin: 24, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                 <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
                   {getProviderIcon(selected.provider, selected.type)}
                   {selected.type} Log
                 </div>
                 {!selected.provider && (
                    <button onClick={() => {
                       setEditActivityId(selected.id);
                       setComposeSubject(selected.subject || '');
                       setComposeContent(selected.snippet || selected.body || '');
                       setComposeType(selected.type);
                       setExistingAttachments((selected as any).attachments || []);
                       setActivityFiles([]);
                       setIsComposing(true);
                    }} style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-500)', background: 'var(--brand-50)', border: '1px solid var(--brand-200)', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                       Edit Note
                    </button>
                 )}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 24, letterSpacing: '-0.02em' }}>
                {selected.subject || (selected.type === 'chat' ? 'Teams Message' : 'Activity Note')}
              </div>
              
              <div style={{ background: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 32, display: 'flex', gap: 24, alignItems: 'center' }}>
                 <div>
                   <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Logged By / From</div>
                   <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{selected.from}</div>
                 </div>
                 <div>
                   <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Date</div>
                   <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                     {new Date(selected.timestamp!).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                   </div>
                 </div>
                 {selected.to && selected.to.length > 0 && (
                   <div>
                     <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>To</div>
                     <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{selected.to.join(', ')}</div>
                   </div>
                 )}
              </div>

              {selected.body || selected.snippet ? (
                <div 
                  className="prose prose-sm prose-slate max-w-none" 
                  dangerouslySetInnerHTML={{ __html: selected.body || selected.snippet || '' }} 
                />
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No content logged for this activity.</span>
                </div>
              )}
              
              {(selected as any).attachments && (selected as any).attachments.length > 0 && (
                 <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>Attachments</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                       {(selected as any).attachments.map((a: any, i: number) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--brand-500)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: 8, textDecoration: 'none', transition: 'background 0.15s' }}>
                             <Paperclip size={14} />
                             {a.name}
                          </a>
                       ))}
                    </div>
                 </div>
              )}
            </div>
          )}
      </div>

      {composer !== null && (
        <Composer
          initialTo={composer.to}
          initialSubject={composer.subject}
          replyToId={composer.replyId}
          threadId={composer.threadId}
          onClose={() => setComposer(null)}
          onSent={() => { loadTimeline(); }}
        />
      )}
    </div>
  );
}
