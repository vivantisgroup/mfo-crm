'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { Calendar, Clock, Contact, X, Video, FileText } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ContactModel {
  id: string;
  name: string;
  email: string;
  logoUrl?: string; // or avatar URL
  role?: string;
}

export interface EventComposerProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: any; // The mapped event from /api/calendar/list
  selectedDate?: Date;
  provider: 'microsoft' | 'google';
  onSaved: () => void;
}

export default function EventComposer({ isOpen, onClose, eventToEdit, selectedDate, provider, onSaved }: EventComposerProps) {
  const { user, firebaseUser } = useAuth();
  const db = getFirestore(firebaseApp);
  
  const [loading, setLoading]     = useState(false);
  const [contacts, setContacts]   = useState<ContactModel[]>([]);
  const [search, setSearch]       = useState('');
  
  // Form State
  const [subject, setSubject]     = useState('');
  const [start, setStart]         = useState('');
  const [end, setEnd]             = useState('');
  const [isOnline, setIsOnline]   = useState(true);
  const [description, setDesc]    = useState('');
  
  // Array of email objects (not comma separated string)
  const [attendees, setAttendees] = useState<{name: string, email: string, avatar?: string}[]>([]);

  useEffect(() => {
    // Load contacts automatically for the dropdown
    async function load() {
      try {
         const snap = await getDocs(query(collection(db, 'platform_contacts'), orderBy('name')));
         const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContactModel));
         setContacts(loaded);
      } catch (e) {
         console.error('Failed to load contacts for composer', e);
      }
    }
    if (isOpen) load();
  }, [isOpen, db]);

  useEffect(() => {
    if (isOpen) {
      if (eventToEdit) {
        setSubject(eventToEdit.title || '');
        setStart(eventToEdit.start ? format(new Date(eventToEdit.start), "yyyy-MM-dd'T'HH:mm") : '');
        setEnd(eventToEdit.end ? format(new Date(eventToEdit.end), "yyyy-MM-dd'T'HH:mm") : '');
        setIsOnline(eventToEdit.isOnlineMeeting || !!eventToEdit.onlineMeetingUrl);
        setDesc(eventToEdit.description || '');
        const mappedAttendees = (eventToEdit.attendees || []).map((a: any) => ({
           id: a.email,
           name: a.name || a.email.split('@')[0],
           email: a.email,
        }));
        setAttendees(mappedAttendees);
      } else {
        setSubject('');
        const baseDate = selectedDate || new Date();
        baseDate.setMinutes(0);
        baseDate.setSeconds(0);
        baseDate.setMilliseconds(0);
        setStart(format(baseDate, "yyyy-MM-dd'T'HH:mm"));
        
        const endDate = new Date(baseDate);
        endDate.setHours(endDate.getHours() + 1);
        setEnd(format(endDate, "yyyy-MM-dd'T'HH:mm"));
        
        setIsOnline(true);
        setDesc('');
        setAttendees([]);
      }
    }
  }, [isOpen, eventToEdit, selectedDate]);

  if (!isOpen) return null;

  async function handleSave() {
    setLoading(true);
    try {
      if (!user || !firebaseUser) throw new Error("Unauthenticated");
      const idToken = await firebaseUser.getIdToken();
      const endpoint = eventToEdit ? '/api/calendar/update' : '/api/calendar/create';
      const method = eventToEdit ? 'PATCH' : 'POST';
      
      const payload = {
        eventId: eventToEdit?.id,
        uid: user.uid,
        idToken,
        provider,
        subject,
        start,
        end,
        description,
        createOnlineMeeting: isOnline,
        attendees: attendees.map(a => a.email)
      };

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'API Error');
      
      onSaved();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to save event: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const addAttendee = (email: string) => {
    const contact = contacts.find(c => c.email === email);
    if (!attendees.some(a => a.email === email)) {
       setAttendees([...attendees, { email, name: contact?.name || email, avatar: contact?.logoUrl }]);
    }
    setSearch('');
  };

  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter(a => a.email !== email));
  };

  const filteredContacts = useMemo(() => {
    if (!search) return contacts.slice(0, 5);
    return contacts.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.email.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 10);
  }, [contacts, search]);

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/20 backdrop-blur-sm transition-all duration-300">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right overflow-hidden border-l border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold tracking-tight mb-2">{eventToEdit ? 'Edit Event' : 'New Event'}</h3>
            <div className="text-sm text-[var(--text-secondary)] text-xs">{provider === 'microsoft' ? 'Microsoft 365' : 'Google Workspace'} Sync</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
          
          <div>
            <input 
              autoFocus
              className="w-full text-2xl font-bold bg-transparent border-0 border-b-2 border-transparent focus:border-indigo-500 focus:ring-0 px-0 py-2 placeholder:text-slate-300 transition-colors"
              placeholder="Event Title..."
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
             <div>
               <label className="text-xs font-semibold text-slate-500 flex items-center gap-1 mb-2"><Calendar size={12}/> Start</label>
               <input 
                 type="datetime-local" 
                 className="w-full text-sm rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                 value={start}
                 onChange={e => setStart(e.target.value)}
               />
             </div>
             <div>
               <label className="text-xs font-semibold text-slate-500 flex items-center gap-1 mb-2"><Clock size={12}/> End</label>
               <input 
                 type="datetime-local" 
                 className="w-full text-sm rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                 value={end}
                 onChange={e => setEnd(e.target.value)}
               />
             </div>
          </div>

          <hr className="my-4 border-t border-[var(--border)] my-2" />

          {/* CRM Contacts Invitee list - One per line */}
          <div>
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
              <Contact size={16} /> Attendees
            </label>
            
            <div className="flex flex-col gap-2 mb-4">
               {attendees.map(att => (
                 <div key={att.email} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
                   <div className="flex items-center gap-3">
                     {att.avatar ? (
                        <img src={att.avatar} className="w-8 h-8 rounded-full object-cover shadow-sm bg-slate-100" alt={att.name}/>
                     ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shadow-sm">
                           {att.name.charAt(0).toUpperCase()}
                        </div>
                     )}
                     <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">{att.name}</span>
                        <span className="text-xs text-slate-500">{att.email}</span>
                     </div>
                   </div>
                   <button onClick={() => removeAttendee(att.email)} className="text-slate-400 hover:text-red-500 p-1">
                      <X size={14} />
                   </button>
                 </div>
               ))}
               {attendees.length === 0 && (
                 <p className="text-xs text-slate-400 italic py-2">No attendees selected.</p>
               )}
            </div>

            {/* Selector Combobox Substitute */}
            <div className="relative">
              <input 
                 type="text"
                 className="w-full text-sm rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-400"
                 placeholder="+ Search CRM Contact to invite..."
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 onKeyDown={e => {
                    if (e.key === 'Enter' && search.includes('@')) {
                       e.preventDefault();
                       addAttendee(search);
                    }
                 }}
              />
              {search && (
                 <div className="absolute top-11 left-0 right-0 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-20">
                    {filteredContacts.map(c => (
                       <button 
                         key={c.id} 
                         className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center gap-3"
                         onClick={(e) => { e.preventDefault(); addAttendee(c.email); }}
                       >
                         {c.logoUrl ? (
                            <img src={c.logoUrl} className="w-6 h-6 rounded-full object-cover bg-slate-100" alt={c.name}/>
                         ) : (
                            <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold">
                               {c.name.charAt(0).toUpperCase()}
                            </div>
                         )}
                         <div className="flex flex-col">
                           <span className="text-sm font-medium text-slate-900">{c.name}</span>
                           <span className="text-xs text-slate-500">{c.email}</span>
                         </div>
                       </button>
                    ))}
                    {filteredContacts.length === 0 && search.includes('@') && (
                       <button 
                         className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm text-indigo-600 font-medium flex items-center gap-2"
                         onClick={(e) => { e.preventDefault(); addAttendee(search); }}
                       >
                         + Invite new email: {search}
                       </button>
                    )}
                 </div>
              )}
            </div>
          </div>

          <hr className="my-4 border-t border-[var(--border)] my-2" />
          
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
             <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
               <Video size={18} className={isOnline ? 'text-indigo-600' : 'text-slate-400'}/>
               {provider === 'microsoft' ? 'Teams Meeting' : 'Google Meet'}
             </div>
             <input type="checkbox" checked={isOnline} onChange={e => setIsOnline(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" />
          </div>

          <div>
             <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
              <FileText size={16} /> Meeting Notes (Internal/External depending on provider logic)
             </label>
             <textarea 
               className="w-full text-sm rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 resize-none"
               rows={4}
               value={description}
               onChange={e => setDesc(e.target.value)}
               placeholder="Agenda, notes, instructions..."
             />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent hover:bg-slate-100 h-9 px-4 py-2 text-slate-700" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white shadow hover:bg-[var(--brand-700)] h-9 px-4 py-2" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : (eventToEdit ? 'Save Changes' : 'Create Event')}
          </button>
        </div>

      </div>
    </div>
  );
}
