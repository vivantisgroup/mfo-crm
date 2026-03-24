'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { collection, query, where, getDocs, addDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Activity } from '@/lib/types';
import { ActivityItem } from '@/components/ActivityItem';

type Tab = 'note' | 'email' | 'whatsapp';

interface CommunicationPanelProps {
  familyId?: string;
  familyName?: string;
  linkedRecordType: 'ticket' | 'crm' | 'opportunity';
  linkedRecordId: string;
}

export function CommunicationPanel({ familyId, familyName, linkedRecordType, linkedRecordId }: CommunicationPanelProps) {
  const { user, tenant } = useAuth();
  const [tab, setTab] = useState<Tab>('note');
  
  // Feed state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer states
  const [noteBody, setNoteBody] = useState('');
  
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  
  const [waBody, setWaBody] = useState('');

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const loadActivities = useCallback(async () => {
    if (!tenant?.id || !linkedRecordId) return;
    setLoading(true);
    try {
      const qRef = query(
        collection(db, `tenants/${tenant.id}/activities`),
        where('linkedRecordId', '==', linkedRecordId),
        where('linkedRecordType', '==', linkedRecordType),
        // We order by occurredAt in memory since we might not have a composite index right away
      );
      const snap = await getDocs(qRef);
      const acts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
      acts.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      setActivities(acts);
    } catch (e: any) {
      console.error('Failed to load activities', e);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, linkedRecordId, linkedRecordType]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleSaveNote = async () => {
    if (!noteBody.trim() || !user || !tenant?.id) return;
    setSaving(true);
    setMsg('');
    try {
      const payload: Omit<Activity, 'id'> = {
        activityType: 'note',
        familyId: familyId ?? '',
        familyName: familyName ?? '',
        subject: 'Internal Note',
        body: noteBody.trim(),
        occurredAt: new Date().toISOString(),
        createdBy: user.uid,
        source: 'manual',
        tags: [],
        linkedRecordType,
        linkedRecordId
      };
      
      const docRef = await addDoc(collection(db, `tenants/${tenant.id}/activities`), payload);
      setActivities(prev => [{ id: docRef.id, ...payload }, ...prev]);
      setNoteBody('');
      setMsg('✅ Note added successfully.');
    } catch (e: any) {
      setMsg('❌ Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim() || !emailBody.trim() || !user || !tenant?.id) return;
    setSaving(true);
    setMsg('');
    try {
      // In a real scenario, this would call an API route (e.g. /api/mail/send) 
      // which uses the user's connected Gmail/Outlook account to dispatch the email.
      // For now, we simulate success and log it as an Activity.
      
      const payload: Omit<Activity, 'id'> = {
        activityType: 'email',
        familyId: familyId ?? '',
        familyName: familyName ?? '',
        subject: emailSubject || 'No Subject',
        body: `To: ${emailTo}\nCc: ${emailCc}\nBcc: ${emailBcc}\n\n${emailBody}`,
        direction: 'outbound',
        occurredAt: new Date().toISOString(),
        createdBy: user.uid,
        source: 'manual',
        tags: [],
        linkedRecordType,
        linkedRecordId
      };
      
      const docRef = await addDoc(collection(db, `tenants/${tenant.id}/activities`), payload);
      setActivities(prev => [{ id: docRef.id, ...payload }, ...prev]);
      
      setEmailTo('');
      setEmailCc('');
      setEmailBcc('');
      setEmailSubject('');
      setEmailBody('');
      setEmailAttachments([]);
      setMsg('✅ Email queued for sending.');
    } catch (e: any) {
      setMsg('❌ Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-canvas)' }}>
        {(['note', 'email', 'whatsapp'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
               flex: 1, padding: '12px 16px', fontSize: 13, fontWeight: tab === t ? 700 : 500,
               color: tab === t ? 'var(--brand-500)' : 'var(--text-secondary)',
               background: tab === t ? 'var(--bg-surface)' : 'transparent',
               border: 'none', borderBottom: tab === t ? '2px solid var(--brand-500)' : '2px solid transparent',
               cursor: 'pointer', outline: 'none', textTransform: 'capitalize'
            }}
          >
            {t === 'note' ? '📝 Log Note' : t === 'email' ? '📧 Email' : '💬 WhatsApp'}
          </button>
        ))}
      </div>

      {/* ── Composer Area ── */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        {msg && (
          <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: msg.startsWith('✅') ? '#22c55e15' : '#ef444415', color: msg.startsWith('✅') ? '#22c55e' : '#ef4444', marginBottom: 12 }}>
            {msg}
          </div>
        )}

        {tab === 'note' && (
          <div className="animate-fade-in">
            <textarea 
              className="input" 
              placeholder="Log an internal note... (Uses Markdown)"
              rows={4}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, marginBottom: 10 }}
              value={noteBody} onChange={e => setNoteBody(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={handleSaveNote} disabled={saving || !noteBody.trim()}>
                {saving ? 'Saving...' : '💾 Save Note'}
              </button>
            </div>
          </div>
        )}

        {tab === 'email' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Realistically, 'From' would be a dropdown of connected accounts */}
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" placeholder="To" style={{ flex: 1, fontSize: 13 }} value={emailTo} onChange={e => setEmailTo(e.target.value)} />
              <input className="input" placeholder="Cc" style={{ flex: 1, fontSize: 13 }} value={emailCc} onChange={e => setEmailCc(e.target.value)} />
              <input className="input" placeholder="Bcc" style={{ flex: 1, fontSize: 13 }} value={emailBcc} onChange={e => setEmailBcc(e.target.value)} />
            </div>
            <input className="input" placeholder="Subject" style={{ width: '100%', fontSize: 13, fontWeight: 600 }} value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            <textarea 
              className="input" 
              placeholder="Write your email..."
              rows={5}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
              value={emailBody} onChange={e => setEmailBody(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                📎 <input type="file" multiple style={{ display: 'none' }} onChange={e => {
                  if (e.target.files) setEmailAttachments(Array.from(e.target.files));
                }} />
                {emailAttachments.length > 0 ? `${emailAttachments.length} files selected` : 'Attach Files'}
              </label>
              <button className="btn btn-primary btn-sm" onClick={handleSendEmail} disabled={saving || !emailTo.trim() || !emailBody.trim()}>
                {saving ? 'Sending...' : '📤 Send Email'}
              </button>
            </div>
          </div>
        )}

        {tab === 'whatsapp' && (
          <div className="animate-fade-in" style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
            <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>WhatsApp Integration</h3>
            <p style={{ fontSize: 13, maxWidth: 300, margin: '0 auto' }}>Secure messaging directly from the CRM is coming soon. Connect your business number to log chats automatically.</p>
          </div>
        )}
      </div>

      {/* ── Timeline/Feed ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'var(--bg-canvas)' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 16 }}>Communication History</h4>
        
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 20 }}>Loading timeline...</div>
        ) : activities.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '40px 20px', border: '1px dashed var(--border)', borderRadius: 10 }}>
            No communication history yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activities.map(act => (
              <ActivityItem key={act.id} activity={act} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
