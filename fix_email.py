with open('apps/web/components/CommunicationPanel.tsx', 'w', encoding='utf-8') as f:
    f.write('''\'use client\';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, limit, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { Mail, Search, Paperclip, Send, Inbox, FileText, Trash2, Link as LinkIcon, Reply, Forward } from 'lucide-react';

export interface AgnosticEmail {
  id: string;
  folder: 'inbox' | 'sent' | 'drafts' | 'trash';
  subject: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  snippet: string;
  htmlBody: string;
  attachments?: { name: string; size: string; url: string; }[];
  createdAt: string;
  read: boolean;
  linkedOrgId?: string;
  linkedContactId?: string;
}

export function CommunicationPanel({ familyId, familyName, contactId, orgId }: any) {
  const { user, tenant } = useAuth();
  const [mails, setMails] = useState<AgnosticEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<'inbox'|'sent'|'drafts'|'trash'>('inbox');
  const [selected, setSelected] = useState<AgnosticEmail | null>(null);
  
  const [isComposing, setIsComposing] = useState(false);
  const [composeForm, setComposeForm] = useState({ to:'', cc:'', bcc:'', subject:'', htmlBody:'' });
  const [sending, setSending] = useState(false);

  const MOCK_MAILS: AgnosticEmail[] = [
    { id: '1', folder: 'inbox', subject: 'Re: Q3 Portfolio Allocation Review', fromName: 'Alex Mercer', fromEmail: 'alex@example.com', to: ['me@platform.com'], snippet: 'I took a look at the proposed real estate exposure...', htmlBody: '<p>Hi team,</p><p>I took a look at the proposed real estate exposure in the Q3 summary. I think we need to trim the REIT positions slightly given recent rate hikes.</p><p>Can we jump on a call tomorrow?</p><p>- Alex</p>', attachments: [{ name: 'Q3_Projections_v2.pdf', size: '2.4 MB', url: '#' }], createdAt: new Date(Date.now()-3600000).toISOString(), read: false },
    { id: '2', folder: 'inbox', subject: 'Tax Documentation for Cayman Entities', fromName: 'PwC Tax Advisory', fromEmail: 'tax@pwc.com', to: ['me@platform.com'], cc: ['legal@platform.com'], snippet: 'Please find attached the final K-1 forms.', htmlBody: '<div><p>Good morning,</p><p>Please find attached the final K-1 forms for the offshore vehicles, ready for execution. Let us know if the legal team has any revisions.</p><br/><b>PwC Wealth Advisory Team</b></div>', attachments: [{ name: 'Cayman_K1_Final.pdf', size: '1.1 MB', url: '#' }, { name: 'FATCA_W8.pdf', size: '450 KB', url: '#' }], createdAt: new Date(Date.now()-86400000).toISOString(), read: true },
    { id: '3', folder: 'sent', subject: 'Follow up: Onboarding Documentation', fromName: 'Me', fromEmail: 'me@platform.com', to: ['client@example.com'], snippet: 'Just following up strictly on the missing forms.', htmlBody: '<p>Hi,</p><p>Just following up on the missing KYC forms from last week. Please upload them via your secure portal link.</p><p>Best,</p>', createdAt: new Date(Date.now()-172800000).toISOString(), read: true },
  ];

  const loadMails = useCallback(async () => {
    if (!tenant?.id) { setMails(MOCK_MAILS); setLoading(false); return; }
    setLoading(true);
    try {
      const q = query(collection(db, 'tenants', tenant.id, 'emails'), limit(50));
      const snap = await getDocs(q);
      if (snap.empty) { setMails(MOCK_MAILS); } 
      else { setMails(snap.docs.map(d => ({ id: d.id, ...d.data() } as AgnosticEmail))); }
    } catch (e) { console.error('Fall back to mock due to missing index/rules', e); setMails(MOCK_MAILS); }
    finally { setLoading(false); }
  }, [tenant?.id, orgId, contactId]);

  useEffect(() => { loadMails(); }, [loadMails]);

  const filtered = mails.filter(m => m.folder === folder).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));

  const handleSend = async () => {
    if(!tenant?.id) return;
    setSending(true);
    const newMail: Omit<AgnosticEmail, 'id'> = {
      folder: 'sent', subject: composeForm.subject || 'No Subject', fromName: user?.displayName || 'Me', fromEmail: user?.email || 'me@domain.com',
      to: composeForm.to.split(',').map(s=>s.trim()).filter(Boolean),
      cc: composeForm.cc.split(',').map(s=>s.trim()).filter(Boolean),
      bcc: composeForm.bcc.split(',').map(s=>s.trim()).filter(Boolean),
      snippet: composeForm.htmlBody.substring(0, 50).replace(/<[^>]+>/g, '') + '...', htmlBody: composeForm.htmlBody,
      createdAt: new Date().toISOString(), read: true, linkedOrgId: orgId, linkedContactId: contactId
    };
    try {
      const docRef = await addDoc(collection(db, 'tenants', tenant.id, 'emails'), newMail);
      setMails(p => [{ id: docRef.id, ...newMail }, ...p]);
    } catch(e) { console.error('Failed sending', e); setMails(p => [{ id: 'mock-'+Date.now(), ...newMail}, ...p]); }
    setIsComposing(false); setSending(false); setComposeForm({ to:'', cc:'', bcc:'', subject:'', htmlBody:'' });
  };

  const fmtDate = (d:string) => new Date(d).toLocaleDateString([], { month:'short', day:'numeric' });

  return (
    <div className="flex h-full min-h-[500px] border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm relative text-slate-800">
      <div className="w-56 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
         <div className="p-4 border-b border-slate-200">
             <button onClick={()=>{setIsComposing(true); setSelected(null);}} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-sm text-sm">
                 <Mail size={16} /> Compose Mail
             </button>
         </div>
         <div className="p-3 flex flex-col gap-1 flex-1 overflow-y-auto">
             <div className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2 px-3 mt-2">Mailboxes</div>
             {[ {id:'inbox', icon: Inbox, label:'Inbox', count: mails.filter(m=>m.folder==='inbox'&&!m.read).length},
                {id:'sent', icon: Send, label:'Sent', count: 0},
                {id:'drafts', icon: FileText, label:'Drafts', count: mails.filter(m=>m.folder==='drafts').length},
                {id:'trash', icon: Trash2, label:'Trash', count: 0}
             ].map(f => (
                 <button key={f.id} onClick={()=>setFolder(f.id as any)} className={lex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-semibold transition-colors \}>
                     <div className="flex items-center gap-3"><f.icon size={16} className={folder===f.id?'text-indigo-600':'text-slate-400'} /> {f.label}</div>
                     {f.count>0 && <span className={	ext-[10px] py-0.5 px-2 rounded-full \}>{f.count}</span>}
                 </button>
             ))}
         </div>
      </div>

      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 relative z-0">
          <div className="p-3 border-b border-slate-200 bg-slate-50/50">
             <div className="relative">
                 <Search size={14} className="absolute left-3 top-1/2 -mt-[7px] text-slate-400" />
                 <input className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm" placeholder="Search emails..." />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
             {!loading && filtered.length===0 ? <div className="p-8 text-center text-slate-400 text-sm">Folder is empty.</div> : null}
             {!loading && filtered.map(mail => (
                 <div key={mail.id} onClick={()=>setSelected(mail)} className={p-4 cursor-pointer transition-colors relative \}>
                     {!mail.read && <div className="absolute top-4 right-4 w-2 h-2 bg-indigo-500 rounded-full" />}
                     <div className="flex justify-between items-baseline mb-1">
                         <div className={	ext-sm truncate pr-4 \}>{mail.fromName}</div>
                         <div className={	ext-[10px] shrink-0 \}>{fmtDate(mail.createdAt)}</div>
                     </div>
                     <div className={	ext-xs truncate mb-1 \}>{mail.subject}</div>
                     <div className="text-xs text-slate-400 truncate tracking-tight">{mail.snippet}</div>
                 </div>
             ))}
          </div>
      </div>

      <div className="flex-1 bg-white relative flex flex-col overflow-hidden">
          {(!selected && !isComposing) && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4"><Mail size={24} className="text-slate-300" /></div>
                  <div className="text-sm font-semibold text-center">Select an item to read</div>
              </div>
          )}

          {selected && !isComposing && (
              <div className="flex-1 flex flex-col h-full animate-fade-in">
                  <div className="p-6 border-b border-slate-100 flex-shrink-0">
                      <div className="flex justify-between items-start mb-4">
                          <h2 className="text-xl font-black text-slate-900 leading-tight">{selected.subject}</h2>
                          <div className="flex items-center gap-1">
                              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"><Reply size={16} /></button>
                              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"><Forward size={16} /></button>
                          </div>
                      </div>
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">{selected.fromName.charAt(0)}</div>
                              <div>
                                  <div className="text-sm font-bold text-slate-900">{selected.fromName} <span className="font-medium text-slate-500 text-xs ml-1">&lt;{selected.fromEmail}&gt;</span></div>
                                  <div className="text-xs text-slate-500 mt-0.5">To: <span className="font-semibold text-slate-700">{selected.to.join(', ')}</span> {selected.cc?.length ? • CC:  : ''}</div>
                              </div>
                          </div>
                          <div className="text-xs font-semibold text-slate-400">{new Date(selected.createdAt).toLocaleString()}</div>
                      </div>
                  </div>
                  <div className="flex-1 p-8 overflow-y-auto">
                      <div className="prose prose-sm max-w-none text-slate-800" dangerouslySetInnerHTML={{ __html: selected.htmlBody }} />
                  </div>
                  {selected.attachments && selected.attachments.length > 0 && (
                      <div className="p-6 border-t border-slate-100 bg-slate-50 mt-auto flex-shrink-0">
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{selected.attachments.length} Attachments</div>
                          <div className="flex flex-wrap gap-3">
                              {selected.attachments.map(att => (
                                  <button key={att.name} className="flex items-center gap-3 bg-white border border-slate-200 p-2.5 rounded-lg shadow-sm">
                                      <div className="w-8 h-8 rounded bg-rose-100 text-rose-600 flex items-center justify-center"><FileText size={14} /></div>
                                      <div className="text-left"><div className="text-xs font-bold text-slate-700 leading-tight">{att.name}</div><div className="text-[10px] text-slate-400 font-medium">{att.size}</div></div>
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          )}

          {isComposing && (
              <div className="absolute inset-0 z-50 bg-white flex flex-col animate-slide-up shadow-[-10px_0_30px_rgba(0,0,0,0.05)]">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="font-bold text-sm text-slate-800">New Message</div>
                      <button onClick={()=>setIsComposing(false)} className="p-1 px-3 text-xs font-bold text-slate-500">Discard</button>
                  </div>
                  <div className="flex flex-col flex-1 overflow-y-auto">
                      <div className="border-b border-slate-100 px-6 py-2 flex items-center">
                          <span className="text-xs font-bold text-slate-400 w-12">To</span>
                          <input autoFocus className="flex-1 text-sm py-1 outline-none font-medium" placeholder="Recipients..." value={composeForm.to} onChange={e=>setComposeForm({...composeForm,to:e.target.value})} />
                      </div>
                      <div className="border-b border-slate-100 px-6 py-2 flex items-center">
                          <span className="text-xs font-bold text-slate-400 w-12">Subject</span>
                          <input className="flex-1 text-sm font-bold py-1 outline-none text-slate-900" placeholder="Add a subject line..." value={composeForm.subject} onChange={e=>setComposeForm({...composeForm,subject:e.target.value})} />
                      </div>
                      <div className="flex-1 p-6 relative">
                          <textarea className="w-full h-full outline-none resize-none text-sm text-slate-800" placeholder="Start typing the email body..." value={composeForm.htmlBody} onChange={e=>setComposeForm({...composeForm,htmlBody:e.target.value})} />
                      </div>
                  </div>
                  <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="flex gap-2">
                          <button className="p-2 text-slate-400"><Paperclip size={18} /></button>
                          <button className="p-2 text-slate-400"><LinkIcon size={18} /></button>
                      </div>
                      <button onClick={handleSend} disabled={sending||!composeForm.to} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg text-sm flex items-center gap-2">
                          {sending ? 'Sending...' : <><Send size={14} /> Send Email</>}
                      </button>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
}
''')
