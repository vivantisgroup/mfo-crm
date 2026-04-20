'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Tag, getAllTags, createTag, TagColor } from '@/lib/tagService';
import { X, Plus, Hash, Loader2, Sparkles } from 'lucide-react';
import { COLOR_MAP } from '@/components/TagManager';

interface Props {
  tags: string[];
  tenantId: string;
  onChange: (tags: string[]) => void;
  suggestContext?: string;
}

export function InlineTagBay({ tags, tenantId, onChange, suggestContext }: Props) {
  const [globalTags, setGlobalTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tenantId) getAllTags(tenantId).then(setGlobalTags);
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

  const suggestedTags = useMemo(() => {
    if (!suggestContext || !globalTags.length) return [];
    const textToScan = suggestContext.toLowerCase();
    return globalTags.filter(t => 
      !tags.includes(t.name) && 
      (textToScan.includes(t.name.toLowerCase()) || (t.searchKey && textToScan.includes(t.searchKey.toLowerCase())))
    ).slice(0, 3);
  }, [suggestContext, globalTags, tags]);

  const filteredTags = globalTags.filter(t => 
    t.name.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t.name)
  );
  
  const exactMatch = globalTags.find(t => t.name.toLowerCase() === input.trim().toLowerCase());

  const addTag = (tagName: string) => {
    if (!tags.includes(tagName)) onChange([...tags, tagName]);
    setInput('');
    setIsOpen(false);
  };

  const createAndAdd = async () => {
    const newName = input.trim();
    if (!newName || !tenantId) return;
    setIsLoading(true);
    try {
      const COLORS: TagColor[] = ['red', 'orange', 'amber', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'rose'];
      const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      const newGlobal = await createTag(newName, randomColor, tenantId);
      setGlobalTags(prev => [...prev, newGlobal]);
      if (!tags.includes(newName)) onChange([...tags, newName]);
      setInput('');
      setIsOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const getTagColor = (tagName: string) => {
    const found = globalTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (found && found.color !== 'slate') return COLOR_MAP[found.color];
    const COLORS = ['red', 'orange', 'amber', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'rose'];
    const h = tagName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return COLOR_MAP[COLORS[h % COLORS.length]];
  };

  return (
    <div className="relative inline-flex items-center gap-1.5 flex-wrap" ref={containerRef}>
      {tags.map((tag, idx) => {
        const color = getTagColor(tag);
        return (
           <span key={`${tag}-${idx}`} style={{
             fontSize: 9, padding: '1px 6px', borderRadius: 4,
             background: `color-mix(in srgb, ${color} 15%, transparent)`, 
             color: `color-mix(in srgb, ${color} 90%, black)`, 
             border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
             fontWeight: 700, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4
           }}>
             {tag}
             <button 
               onClick={() => onChange(tags.filter(t => t !== tag))}
               style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', display: 'flex', color: 'inherit', opacity: 0.6 }}
               onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
               onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
             >
               <X size={10} strokeWidth={3} />
             </button>
           </span>
        );
      })}

      {/* Add Button */}
      <button
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        style={{
          fontSize: 9, padding: '1px 6px', borderRadius: 4,
          background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
          border: '1px dashed var(--border)', fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.1s'
        }}
        onMouseOver={e => e.currentTarget.style.background = 'var(--bg-surface)'}
        onMouseOut={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
      >
        <Plus size={10} strokeWidth={3} /> Add
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', marginTop: 8, left: 0, width: 220, zIndex: 100,
          background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.15)', overflow: 'hidden', padding: 4
        }}>
           <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
             <input
               ref={inputRef}
               value={input}
               onChange={e => setInput(e.target.value)}
               placeholder="Search tags..."
               style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}
             />
           </div>
           
           <div style={{ maxHeight: 200, overflowY: 'auto' }}>
             {suggestedTags.length > 0 && !input && (
                <div style={{ marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ padding: '0 8px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#f59e0b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                     <Sparkles size={10} /> Suggested
                  </div>
                  {suggestedTags.map(t => {
                     const color = COLOR_MAP[t.color] || COLOR_MAP['slate'];
                     return (
                       <button
                         key={`sug-${t.id}`}
                         onClick={() => addTag(t.name)}
                         style={{
                           width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none',
                           cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6
                         }}
                         onMouseOver={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                         onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                       >
                         <div style={{ width: 14, height: 14, borderRadius: 4, background: color }} />
                         <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</span>
                       </button>
                     );
                  })}
                </div>
             )}

             {filteredTags.map(t => {
                const color = COLOR_MAP[t.color];
                return (
                  <button
                    key={t.id}
                    onClick={() => addTag(t.name)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '6px 8px', background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: color }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</span>
                  </button>
                );
             })}

             {input.trim() && !exactMatch && (
                 <button
                   onClick={createAndAdd}
                   style={{
                     width: '100%', textAlign: 'left', padding: '8px', background: 'var(--brand-faint)',
                     border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6,
                     marginTop: 4, color: 'var(--brand-500)', fontWeight: 700, fontSize: 13
                   }}
                 >
                   <Plus size={14} /> Create "{input.trim()}"
                 </button>
             )}
           </div>
        </div>
      )}
    </div>
  );
}
