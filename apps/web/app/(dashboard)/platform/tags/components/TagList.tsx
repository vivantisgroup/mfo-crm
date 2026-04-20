'use client';

import React from 'react';
import { Tag } from '@/lib/tagService';
import { Hash } from 'lucide-react';
import { COLOR_MAP } from './TagWheel';

interface Props {
  tags: Tag[];
  onTagClick: (tag: Tag) => void;
  uid: string;
}

export default function TagList({ tags, onTagClick, uid }: Props) {
  return (
    <div className="w-full h-full overflow-y-auto px-6 py-6 custom-scrollbar bg-white">
      <div className="max-w-4xl mx-auto border border-slate-200 rounded-2xl shadow-sm overflow-hidden bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Tag Name</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Color</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tags.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-medium">No tags available.</td>
              </tr>
            ) : tags.map((t, i) => {
              const color = COLOR_MAP[t.color] || '#cbd5e1';
              const isOwner = t.createdBy === uid;
              
              return (
                <tr 
                  key={t.id} 
                  onClick={() => onTagClick(t)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-black/5 group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, white)` }}
                    >
                      <Hash size={14} style={{ color: color }} />
                    </div>
                    {t.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest"
                      style={{ 
                        color: `color-mix(in srgb, ${color} 90%, black)`, 
                        backgroundColor: `color-mix(in srgb, ${color} 10%, white)`,
                        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`
                      }}
                    >
                      {t.color}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isOwner ? 'text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md' : 'text-slate-400'}`}>
                      {isOwner ? 'Creator' : 'Global'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
