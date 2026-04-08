'use client';

import React, { useState, useEffect } from 'react';
import { Tag, TagColor } from '@/lib/tagService';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Trash2, Tag as TagIcon } from 'lucide-react';
import { COLOR_MAP } from './TagWheel';

interface Props {
  isOpen: boolean;
  tag: Tag | Partial<Tag> | null;
  onClose: () => void;
  onSave: (data: Partial<Tag>) => void;
  onDelete: (id: string) => void;
  uid?: string;
  userRole?: string;
}

const COLORS = Object.keys(COLOR_MAP) as TagColor[];

export default function TagEditorPanel({ isOpen, tag, onClose, onSave, onDelete, uid, userRole }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<TagColor>('slate');

  useEffect(() => {
    if (isOpen && tag) {
      setName(tag.name || '');
      setColor(tag.color || 'slate');
    }
  }, [isOpen, tag]);

  if (!isOpen) return null;

  // Per recent decision: Tags are open to all users currently.
  // Future architecture will allow tenant_admins to explicitly impose restrictive modes.
  const isReadOnly = false;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-end overflow-hidden p-6 lg:p-10 pointer-events-none">
        
        {/* Backdrop */}
        <motion.div 
           initial={{ opacity: 0 }} 
           animate={{ opacity: 1 }} 
           exit={{ opacity: 0 }}
           onClick={onClose}
           className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
        />

        {/* Floating Panel */}
        <motion.div 
           initial={{ x: '100%', opacity: 0, rotateY: 15 }}
           animate={{ x: 0, opacity: 1, rotateY: 0 }}
           exit={{ x: '100%', opacity: 0, rotateY: 15 }}
           transition={{ type: 'spring', damping: 25, stiffness: 200 }}
           className="relative w-full max-w-sm h-auto max-h-full rounded-3xl bg-white shadow-2xl border border-slate-200/50 flex flex-col pointer-events-auto z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 py-6 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-3 text-slate-800">
              <div 
                 className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner"
                 style={{ backgroundColor: `color-mix(in srgb, ${COLOR_MAP[color]} 15%, transparent)`, color: COLOR_MAP[color] }}
              >
                <TagIcon size={18} strokeWidth={2.5} />
              </div>
              <div>
                 <h2 className="text-lg font-black tracking-tight leading-tight">{tag?.id ? 'Edit Tag' : 'New Tag'}</h2>
                 <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{tag?.id ? 'System Registry' : 'New Assignment'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto px-7 py-7 flex flex-col gap-8 bg-white">
             <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2.5">
                  Tag Name {isReadOnly && <span className="text-rose-400 ml-2">(Locked)</span>}
                </label>
                <input 
                   type="text" 
                   value={name}
                   onChange={e => setName(e.target.value)}
                   disabled={isReadOnly}
                   placeholder="e.g. Protocol Alpha, VIP..."
                   className={`w-full bg-slate-50 border-2 border-slate-100 text-slate-900 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all font-bold text-sm shadow-sm placeholder:font-medium placeholder:text-slate-300 ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                   autoFocus={!isReadOnly}
                />
             </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2.5">Tag Color</label>
                <div className={`grid grid-cols-6 gap-2.5 p-1 ${isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}>
                   {COLORS.map(c => (
                     <button
                       key={c}
                       onClick={() => setColor(c)}
                       disabled={isReadOnly}
                       title={c}
                       className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all ${color === c ? 'scale-110 shadow-lg ring-4 ring-offset-2 z-10' : 'hover:scale-105 shadow-sm opacity-90 hover:opacity-100'}`}
                       style={{ 
                          backgroundColor: COLOR_MAP[c],
                          ...(color === c ? { ringColor: COLOR_MAP[c] } : {})
                       }} 
                     >
                       {color === c && (
                          <motion.div 
                             layoutId="color-select"
                             className="w-4 h-4 bg-white rounded-full shadow-sm" 
                          />
                       )}
                     </button>
                   ))}
                </div>
             </div>
          </div>

          {/* Footer constraints */}
          <div className="px-7 py-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-4">
             {tag && tag.id ? (
                <button 
                  onClick={() => onDelete(tag.id!)}
                  disabled={isReadOnly}
                  className={`flex items-center justify-center gap-2 text-rose-500 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all outline-none border border-transparent w-full ${isReadOnly ? 'opacity-30 cursor-not-allowed' : 'hover:text-white hover:bg-rose-500 hover:border-rose-600 hover:shadow-lg hover:shadow-rose-500/30'}`}
                >
                  <Trash2 size={16} /> Delete
                </button>
             ) : <div className="w-full" />}
             
             <button 
                onClick={() => onSave({ ...tag, name, color })}
                disabled={!name.trim() || isReadOnly}
                className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-95 transition-all outline-none disabled:opacity-50 disabled:pointer-events-none w-full"
             >
                {isReadOnly ? 'Locked' : <><Save size={16} /> {tag?.id ? 'Save Updates' : 'Create Tag'}</>}
             </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
