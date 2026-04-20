'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore';
import { X, Search, Loader2, Link2, Building2, User, Users, CheckSquare, Zap, Target } from 'lucide-react';
import { Tag, getAllTags } from '@/lib/tagService';
import { COLOR_MAP } from '@/components/TagManager';

type CrmLinkTarget = { id: string; name: string; type: string; tenantId: string; tags?: string[]; [key: string]: any };

interface SearchResult {
  type:     string;
  id:       string;
  name:     string;
  subtitle: string;
  tenantId: string;
  tags?:    string[];
}

interface Props {
  emailLogId?: string;
  uid: string;
  tenantId: string;
  links: CrmLinkTarget[];
  onChange: (links: CrmLinkTarget[]) => void;
  onAutoTag?: (tags: string[]) => void;
  readOnly?: boolean;
}

const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID ?? 'mfo-crm';

async function searchCollection(
  idToken: string,
  collectionPath: string,
  nameField: string,
  subtitleField: string,
  type: string,
  tenantId: string,
  query: string,
): Promise<SearchResult[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?pageSize=15`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) return [];
  const data = await res.json();
  const docs: any[] = data.documents ?? [];
  const q = query.toLowerCase();

  return docs
    .map(doc => {
      const f = doc.fields ?? {};
      const fName = f.firstName?.stringValue ?? '';
      const lName = f.lastName?.stringValue ?? '';
      const name  = f[nameField]?.stringValue ?? f.name?.stringValue ?? (fName || lName ? `${fName} ${lName}`.trim() : '');
      const subtitle = f[subtitleField]?.stringValue ?? f.email?.stringValue ?? '';
      const tags = f.tags?.arrayValue?.values?.map((v: any) => v.stringValue || '').filter(Boolean) ?? [];
      return {
        type,
        id:       doc.name.split('/').pop() ?? '',
        name,
        subtitle,
        tenantId,
        tags,
      };
    })
    .filter(r => r.name.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q) || !q);
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  org: <Building2 size={12} />,
  contact: <User size={12} />,
  family: <Users size={12} />,
  task: <CheckSquare size={12} />,
  activity: <Target size={12} />
};

export function RecordLinkDropdown({ emailLogId, uid, tenantId, links, onChange, onAutoTag, readOnly }: Props) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [globalTags, setGlobalTags] = useState<Tag[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tenantId) getAllTags(tenantId).then(setGlobalTags).catch(console.error);
  }, [tenantId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setIsSearching(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken() ?? '';
      // Search Orgs and Contacts concurrently
      const [orgs, contacts, families] = await Promise.all([
        searchCollection(idToken, 'platform_orgs', 'name', 'industry', 'org', tenantId, q),
        searchCollection(idToken, `tenants/${tenantId}/contacts`, 'name', 'email', 'contact', tenantId, q),
        searchCollection(idToken, `tenants/${tenantId}/families`, 'name', 'email', 'family', tenantId, q),
      ]);
      setResults([...orgs, ...contacts, ...families].slice(0, 10)); // max 10 top results
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  }, [tenantId]);

  const handleInputChange = (val: string) => {
    setInput(val);
    setIsOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim()) {
      debounceRef.current = setTimeout(() => runSearch(val), 300);
    } else {
      setResults([]);
    }
  };

  const toggleLink = async (record: SearchResult) => {
    const already = links.find(l => l.type === record.type && l.id === record.id);
    const newLinks = already
      ? links.filter(l => !(l.type === record.type && l.id === record.id))
      : [...links, { type: record.type, id: record.id, name: record.name, tenantId: record.tenantId, tags: record.tags }];

    setIsSaving(true);
    try {
      if (!emailLogId) {
         onChange(newLinks);
      } else {
        const idToken = await getAuth().currentUser?.getIdToken() ?? '';
        const res = await fetch('/api/mail/link', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ uid, idToken, emailLogId, links: newLinks, tenantId }),
        });
        if (!res.ok) throw new Error('Save failed');
        onChange(newLinks);
      }
      
      if (!already) {
        if (onAutoTag) {
          if (record.tags && record.tags.length > 0) {
            onAutoTag(record.tags);
          } else {
            onAutoTag([record.name]);
          }
        }
        setInput('');
        setResults([]);
        setIsOpen(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
      inputRef.current?.focus();
    }
  };

  const handleInlineCreate = async (type: string, collectionPath: string) => {
    if (!input.trim() || !tenantId) return;
    setIsSaving(true);
    try {
      const db = getFirestore();
      const rootRef = doc(collection(db, collectionPath));
      
      const payload: any = {
        id: rootRef.id,
        createdAt: new Date().toISOString()
      };

      if (type === 'task' || type === 'activity') {
        payload.title = input.trim();
        payload.description = 'Created inline during email tracking.';
        payload.status = 'open';
        payload.priority = 'medium';
      } else {
        payload.name = input.trim();
      }

      // Special rule: tasks/activities belong to the tenant explicitly
      if (type === 'task' || type === 'activity') payload.tenantId = tenantId;

      await setDoc(rootRef, payload);
      
      // Select the newly created document silently
      const fakeResult: SearchResult = {
         type,
         id: rootRef.id,
         name: input.trim(),
         subtitle: `New ${type}`,
         tenantId
      };
      
      await toggleLink(fakeResult);
    } catch (e) {
      console.error('Failed inline creation', e);
    } finally {
      setIsSaving(false);
    }
  };

  const removeLink = async (recordType: string, recordId: string) => {
    const newLinks = links.filter(l => !(l.type === recordType && l.id === recordId));
    setIsSaving(true);
    try {
      if (!emailLogId) {
         onChange(newLinks);
      } else {
        const idToken = await getAuth().currentUser?.getIdToken() ?? '';
        const res = await fetch('/api/mail/link', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ uid, idToken, emailLogId, links: newLinks, tenantId }),
        });
        if (res.ok) onChange(newLinks);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const getTagColor = (tagName: string) => {
    const found = globalTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    return found ? COLOR_MAP[found.color] : COLOR_MAP['slate'];
  };

  // Build the unified list of pills from the links
  // If a link has tags, we map each tag. If it has no tags, we map its name.
  // We attach the underlying record so the 'X' removes that record.
  const pills = links.flatMap(l => {
    if (l.tags && l.tags.length > 0) {
      return [];
    }
    return [{ text: l.name, isTag: false, link: l }];
  });

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        className={`flex flex-wrap gap-2 items-center min-h-[44px] p-2 rounded-xl border transition-all duration-200 ${isOpen ? 'border-sky-400 bg-surface ring-4 ring-sky-500/10 shadow-sm' : 'border-border bg-canvas hover:bg-canvas hover:border-border'}`}
        onClick={() => { if(!readOnly) { setIsOpen(true); inputRef.current?.focus(); } }}
      >
        {pills.map((p, idx) => {
          const color = p.isTag ? getTagColor(p.text) : COLOR_MAP['slate'];
          return (
            <span 
              key={`${p.link.id}-${idx}`} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm cursor-default hover:shadow-md transition-shadow group"
              style={{ 
                backgroundColor: `color-mix(in srgb, ${color} 10%, white)`,
                color: `color-mix(in srgb, ${color} 90%, black)`,
                border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`
              }}
            >
              {p.isTag ? (
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              ) : (
                 <Link2 size={12} style={{ color: color }} className="opacity-70" />
              )}
              <span style={{ textShadow: `0 1px 0 rgba(255,255,255,0.8)` }}>{p.text}</span>
              {!readOnly && (
                <button 
                  onClick={(e) => { e.stopPropagation(); removeLink(p.link.type, p.link.id); }}
                  className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors focus:outline-none"
                  disabled={isSaving}
                >
                  <X size={13} />
                </button>
              )}
            </span>
          );
        })}
        
        {!readOnly && (
          <div className="flex-1 min-w-[150px] flex items-center gap-2">
            {!isSaving ? (
               <input
                 ref={inputRef}
                 type="text"
                 value={input}
                 onChange={(e) => handleInputChange(e.target.value)}
                 onFocus={() => setIsOpen(true)}
                 placeholder={links.length === 0 ? "Search Records..." : "Link another..."}
                 className="w-full bg-transparent border-none outline-none text-sm font-semibold text-primary placeholder:text-tertiary placeholder:font-medium px-2 py-1"
               />
            ) : (
               <div className="flex items-center gap-2 text-sky-500 px-2 text-xs font-bold uppercase tracking-widest">
                  <Loader2 size={14} className="animate-spin" /> Updating...
               </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Typeahead Dropdown */}
      {isOpen && !readOnly && (!isSaving) && input.trim().length > 0 && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-72 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">

            {input && results.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-tertiary">
                  CRM Records
              </div>
            )}

            {isSearching && (
                <div className="px-3 py-4 flex items-center justify-center text-tertiary">
                  <Loader2 size={18} className="animate-spin" />
                </div>
            )}

            {!isSearching && input && results.length === 0 && (
                <div className="px-3 py-4 text-center text-xs font-bold text-tertiary italic">
                  No records found matching "{input}"
                </div>
            )}

            {!isSearching && results.map(r => {
               const alreadyLinked = links.some(l => l.type === r.type && l.id === r.id);
               return (
                 <button
                   key={`${r.type}-${r.id}`}
                   onClick={() => toggleLink(r)}
                   className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl transition-all group focus:bg-canvas outline-none ${alreadyLinked ? 'bg-sky-50 hover:bg-sky-100 text-sky-900' : 'hover:bg-canvas text-secondary hover:text-primary'}`}
                 >
                   <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-black/5 group-hover:scale-110 transition-transform ${alreadyLinked ? 'bg-sky-100 text-sky-600' : 'bg-elevated text-tertiary'}`}>
                     {TYPE_ICONS[r.type] || <Link2 size={14} />}
                   </div>
                   <div className="flex flex-col flex-1 min-w-0">
                     <span className="text-sm font-bold leading-tight tracking-tight truncate">{r.name}</span>
                     {r.subtitle && <span className="text-[10px] text-tertiary font-semibold tracking-wide truncate">{r.subtitle}</span>}
                   </div>
                   
                   {/* Reveal the tag it will resolve to */}
                   <div className="flex gap-1 flex-shrink-0 ml-2">
                      {r.tags && r.tags.length > 0 ? (
                         r.tags.slice(0, 2).map((t, i) => {
                           const color = getTagColor(t);
                           return (
                             <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color: color }}>
                               {t}
                             </span>
                           )
                         })
                      ) : (
                         <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-elevated text-tertiary">Un-tagged</span>
                      )}
                   </div>
                 </button>
               );
            })}

            {/* Quick Actions / Inline Creation Panel */}
            {input.trim() && !isSearching && (
               <div className="mt-2 border-t border-border pt-1">
                 <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-tertiary">
                     Criação Rápida
                 </div>
                 <button onClick={() => handleInlineCreate('task', `tenants/${tenantId}/tasks`)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-sky-600 hover:bg-sky-50 rounded-lg text-left transition-colors">
                    <CheckSquare size={13} /> Nova Tarefa "{input}"
                 </button>
                 <button onClick={() => handleInlineCreate('org', 'platform_orgs')} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg text-left transition-colors">
                    <Building2 size={13} /> Cadastrar Empresa "{input}"
                 </button>
                 <button onClick={() => handleInlineCreate('contact', 'platform_contacts')} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg text-left transition-colors">
                    <User size={13} /> Novo Contato "{input}"
                 </button>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
