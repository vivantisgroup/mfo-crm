'use client';

import React, { useState } from 'react';
import { Sparkles, Minus, Maximize2, Settings, Send } from 'lucide-react';

export function HRCopilot({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed right-6 bottom-6 w-[360px] h-[550px] bg-white rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden animate-slide-in-right border border-slate-200">
      
      {/* Top Header Panel (Purple Gradient) */}
      <div className="h-[280px] bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-5 flex flex-col relative shrink-0">
         <div className="flex justify-between items-center text-white/90">
            <span className="font-bold text-[13px]">Joule</span>
            <div className="flex items-center gap-3">
               <button className="hover:text-white transition"><Maximize2 size={14}/></button>
               <button className="hover:text-white transition"><Settings size={14}/></button>
               <button onClick={onClose} className="hover:text-white transition"><Minus size={16}/></button>
            </div>
         </div>

         <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 relative flex items-center justify-center mb-6">
               <Sparkles className="text-white absolute w-full h-full" strokeWidth={1} />
            </div>
            
            <div className="w-full">
               <div className="text-[13px] text-white/90 mb-1">Hello Geoff,</div>
               <h2 className="text-[28px] font-light text-white leading-tight">How can I help you?</h2>
            </div>
         </div>

         <div className="absolute w-[calc(100%-40px)] bottom-5 left-5 bg-white rounded-lg p-3 shadow-sm border border-white/20">
            <p className="text-[11px] text-slate-700 leading-relaxed font-medium">Talk to me naturally. For example, "I want to view time off"</p>
         </div>
      </div>

      {/* Action / Body Panel */}
      <div className="flex-1 bg-white p-5 flex flex-col">
         
         <div className="text-[12px] font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2">Get started with Joule</div>
         
         <div className="flex flex-wrap gap-2 mb-auto">
            <button className="px-3 py-1.5 border border-[#d9d9d9] text-[#0a6ed1] font-bold text-[11px] rounded-full hover:bg-blue-50 transition cursor-pointer">View Job Data</button>
            <button className="px-3 py-1.5 border border-[#d9d9d9] text-[#0a6ed1] font-bold text-[11px] rounded-full hover:bg-blue-50 transition cursor-pointer">Create New Position</button>
            <button className="px-3 py-1.5 border border-[#d9d9d9] text-[#0a6ed1] font-bold text-[11px] rounded-full hover:bg-blue-50 transition cursor-pointer">Change Chosen Name</button>
            <button className="px-3 py-1.5 border border-[#d9d9d9] text-[#0a6ed1] font-bold text-[11px] rounded-full hover:bg-blue-50 transition cursor-pointer">Change Location</button>
         </div>

         <div className="mt-4">
            <div className="relative border border-[#d9d9d9] rounded-lg bg-white shadow-inner flex items-end overflow-hidden focus-within:border-purple-500">
               <textarea rows={1} placeholder="Message Joule..." className="w-full text-[13px] p-3 pt-3 resize-none outline-none max-h-[100px] text-slate-800 placeholder-slate-400 bg-transparent"></textarea>
               <button className="p-2.5 mr-1 mb-0.5 text-white bg-[#0a6ed1] rounded-full hover:bg-[#0854a0] transition-colors self-end">
                  <Send size={14} className="ml-[1px]" />
               </button>
            </div>
            <div className="text-[9px] text-slate-400 mt-2 text-center leading-tight">
               Joule is powered by generative AI and all output should be reviewed before use. Please do not enter any sensitive personal data.
            </div>
         </div>

      </div>

    </div>
  );
}
