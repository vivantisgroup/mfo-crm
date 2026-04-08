'use client';

import React, { useMemo } from 'react';
import { Tag } from '@/lib/tagService';
import { motion } from 'framer-motion';
import { Network } from 'lucide-react';

interface Props {
  tags: Tag[];
  onTagClick: (tag: Tag) => void;
  onAddTag: () => void;
}

export const COLOR_MAP: Record<string, string> = {
  slate: '#64748b',
  gray: '#6b7280',
  zinc: '#717f8b',
  neutral: '#737373',
  stone: '#78716c',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ba5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
};

export default function TagWheel({ tags, onTagClick, onAddTag }: Props) {
  const RADIUS = 250;
  
  const nodes = useMemo(() => {
    return tags.map((tag, i) => {
      const angle = (i / tags.length) * 2 * Math.PI - Math.PI / 2;
      return {
        ...tag,
        x: Math.cos(angle) * RADIUS,
        y: Math.sin(angle) * RADIUS,
      };
    });
  }, [tags]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Dark background radial glow */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[140px] pointer-events-none" />

      {/* SVG connective lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0">
         <g transform={`translate(50%, 50%)`}>
            {nodes.map(node => (
               <line 
                 key={`line-${node.id}`}
                 x1="0" y1="0" 
                 x2={node.x} y2={node.y} 
                 stroke={COLOR_MAP[node.color] || '#cbd5e1'} 
                 strokeWidth="1.5" 
                 strokeOpacity="0.35"
                 strokeDasharray="4 4"
               />
            ))}
            {/* Orbital Rings */}
            <circle cx="0" cy="0" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <circle cx="0" cy="0" r={RADIUS * 0.5} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="6 6" />
         </g>
      </svg>

      {/* Central Core Element */}
      <div className="absolute z-10" style={{ transform: 'translate(0, 0)' }}>
         <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAddTag}
            className="w-28 h-28 rounded-full bg-slate-900 border-[6px] border-slate-800 shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 transition-all outline-none"
         >
           <Network size={28} className="mb-1 text-slate-400" />
           <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 mt-1">Core Identity</span>
         </motion.button>
      </div>

      {/* Nodes Array */}
      <div className="absolute inset-0 pointer-events-none z-20" style={{ transform: 'translate(50%, 50%)' }}>
        {nodes.map((node, i) => {
          const baseColor = COLOR_MAP[node.color] || '#cbd5e1';
          return (
            <motion.div
              key={node.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                 scale: 1, 
                 opacity: 1, 
                 x: node.x, 
                 y: node.y,
              }}
              transition={{ delay: i * 0.05, type: 'spring', damping: 12, stiffness: 180 }}
              className="absolute group"
              style={{ left: 0, top: 0, marginLeft: -60, marginTop: -22, pointerEvents: 'auto' }}
            >
              <button 
                onClick={() => onTagClick(node)}
                className="relative w-[120px] h-[44px] flex items-center px-4 cursor-pointer rounded-full backdrop-blur-md shadow-2xl shadow-black/50 outline-none transition-all duration-300 transform group-hover:scale-110 group-hover:z-50 border border-t-[rgba(255,255,255,0.15)] border-b-[rgba(0,0,0,0.4)]"
                style={{ 
                   backgroundColor: `color-mix(in srgb, ${baseColor} 15%, #0f172a 90%)`,
                   boxShadow: `0 8px 32px color-mix(in srgb, ${baseColor} 30%, transparent)`,
                }}
              >
                {/* Node glowing dot indicator */}
                <div 
                  className="w-3.5 h-3.5 rounded-full mr-2.5 flex-shrink-0" 
                  style={{ 
                     backgroundColor: baseColor,
                     boxShadow: `0 0 12px ${baseColor}, inset 0 2px 4px rgba(255,255,255,0.5)`
                  }} 
                />
                
                <span className="text-sm font-bold text-white truncate w-full text-left tracking-wide" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  {node.name}
                </span>

                {/* Simulated count pill floating offset */}
                <span className="absolute -top-3 -right-3 w-6 h-6 bg-slate-800 text-slate-300 rounded-full border border-slate-600 text-[10px] font-black tracking-tighter flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform origin-bottom-left">
                  {Math.floor(Math.random() * 20) + 1}
                </span>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
