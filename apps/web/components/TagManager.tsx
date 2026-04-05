'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Tag, getAllTags, createTag } from '@/lib/tagService';
import { X, Plus, Hash, Loader2 } from 'lucide-react';

interface TagManagerProps {
  tags: string[];
  onChange?: (tags: string[]) => void;
  readOnly?: boolean;
}

export const COLOR_MAP: Record<string, string> = {
  slate: '#64748b', gray: '#6b7280', zinc: '#717f8b', neutral: '#737373', stone: '#78716c',
  red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308', lime: '#84cc16',
  green: '#22c55e', emerald: '#10b981', teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ba5e9',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef',
  pink: '#ec4899', rose: '#f43f5e',
};

export function TagManager({ tags, onChange, readOnly }: TagManagerProps) {
  const [input, setInput] = useState('');
  const [globalTags, setGlobalTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAllTags().then(setGlobalTags);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTags = globalTags.filter(t => 
    t.name.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t.name)
  );
  
  const exactMatch = globalTags.find(t => t.name.toLowerCase() === input.trim().toLowerCase());

  const addExisting = (tagName: string) => {
    if (!tags.includes(tagName)) {
      onChange?.([...tags, tagName]);
    }
    setInput('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const createAndAdd = async () => {
    const newName = input.trim();
    if (!newName) return;
    
    setIsLoading(true);
    try {
      // Create new tag dynamically globally
      const newGlobal = await createTag(newName, 'slate'); // default to 'slate' 
      setGlobalTags(prev => [...prev, newGlobal]);
      
      if (!tags.includes(newName)) {
        onChange?.([...tags, newName]);
      }
      
      setInput('');
      setIsOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTags.length > 0 && input.length > 0 && !exactMatch) {
         // Auto-add first matched result if filtering
         addExisting(filteredTags[0].name);
      } else if (input.trim() && !exactMatch) {
         createAndAdd();
      } else if (exactMatch) {
         addExisting(exactMatch.name);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      // Small UX improvement: remove last tag on backspace if input is empty
      const newTags = [...tags];
      newTags.pop();
      onChange?.(newTags);
    }
  };

  const removeTag = (tag: string) => {
    onChange?.(tags.filter(t => t !== tag));
  };

  const getTagColor = (tagName: string) => {
    const found = globalTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    return found ? COLOR_MAP[found.color] : COLOR_MAP['slate'];
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        className={`flex flex-wrap gap-2 items-center min-h-[44px] p-2 rounded-xl border transition-all duration-200 ${isOpen ? 'border-sky-400 bg-white ring-4 ring-sky-500/10 shadow-sm' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'}`}
        onClick={() => { if(!readOnly) { setIsOpen(true); inputRef.current?.focus(); } }}
      >
        {tags.map(tag => {
          const color = getTagColor(tag);
          return (
            <span 
              key={tag} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm cursor-default hover:shadow-md transition-shadow group"
              style={{ 
                backgroundColor: `color-mix(in srgb, ${color} 10%, white)`,
                color: `color-mix(in srgb, ${color} 90%, black)`,
                border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`
              }}
            >
              <Hash size={13} style={{ color: color }} className="opacity-70 group-hover:opacity-100 transition-opacity" />
              <span style={{ textShadow: `0 1px 0 rgba(255,255,255,0.8)` }}>{tag}</span>
              {!readOnly && (
                <button 
                  onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                  className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors focus:outline-none"
                >
                  <X size={13} />
                </button>
              )}
            </span>
          );
        })}
        
        {!readOnly && (
          <div className="flex-1 min-w-[140px] flex items-center gap-2">
            {!isLoading ? (
               <input
                 ref={inputRef}
                 type="text"
                 value={input}
                 onChange={(e) => {
                   setInput(e.target.value);
                   setIsOpen(true);
                 }}
                 onKeyDown={handleKeyDown}
                 onFocus={() => setIsOpen(true)}
                 placeholder={tags.length === 0 ? "Search or create tags..." : "Add tag..."}
                 className="w-full bg-transparent border-none outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium px-2 py-1"
               />
            ) : (
               <div className="flex items-center gap-2 text-sky-500 px-2 text-xs font-bold uppercase tracking-widest">
                  <Loader2 size={14} className="animate-spin" /> Committing...
               </div>
            )}
          </div>
        )}
      </div>

      {/* Global Typeahead & Create Menu */}
      {isOpen && !readOnly && (!isLoading) && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[100] bg-white border border-slate-200 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
            
            {/* Quick Helper Text */}
            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
               {input ? 'Registry Search Results' : 'Available Globals'}
            </div>

            {filteredTags.length === 0 && !input && (
                <div className="px-3 py-4 text-center text-xs font-bold text-slate-400 italic">
                  No unmatched global tags found.
                </div>
            )}

            {filteredTags.map(t => {
               const color = COLOR_MAP[t.color];
               return (
                 <button
                   key={t.id}
                   onClick={() => addExisting(t.name)}
                   className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all group focus:bg-slate-50 outline-none"
                   autoFocus={input.length > 0 && t === filteredTags[0]} 
                 >
                   <div 
                     className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-black/5 group-hover:scale-110 transition-transform"
                     style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, white)` }}
                   >
                     <Hash size={14} style={{ color: color }} />
                   </div>
                   <div className="flex flex-col">
                     <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 group-focus:text-slate-900 leading-tight tracking-tight">{t.name}</span>
                     <span className="text-[10px] text-slate-400 font-semibold tracking-wide capitalize">{t.color} spectrum</span>
                   </div>
                   <div className="ml-auto text-[10px] font-black tracking-widest text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      SELECT ⏎
                   </div>
                 </button>
               );
            })}

            {/* Inline Global Creation Trigger */}
            {input.trim() && !exactMatch && (
              <div className="mt-1 pt-1 border-t border-slate-100/60">
                <button
                  onClick={createAndAdd}
                  className="relative overflow-hidden flex items-center gap-3 w-full text-left px-3 py-3 rounded-xl bg-blue-50/50 hover:bg-blue-50 text-blue-700 transition-all group border border-transparent hover:border-blue-200 outline-none hover:shadow-sm"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-600 shadow-md shadow-blue-600/20 flex items-center justify-center shrink-0 text-white group-hover:scale-105 transition-transform group-hover:bg-blue-700">
                    <Plus size={16} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col z-10">
                    <span className="text-sm font-black tracking-tight drop-shadow-sm">Create "{input.trim()}"</span>
                    <span className="text-[10px] text-blue-500 uppercase tracking-widest font-bold">Instantiate New Global</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <div className="ml-auto text-[10px] font-black tracking-widest text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-blue-100 px-2 py-1 rounded-md">
                      ENTER ⏎
                   </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
