'use client';
import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { X, Sparkles, Send, Copy, AlertCircle, RefreshCw } from 'lucide-react';
import type { Opportunity } from '@/lib/crmService';
import { toast } from 'sonner';

export function EmailDrafterModal({ opp, onClose, onSuccess }: { opp: Opportunity; onClose: () => void; onSuccess?: (text: string) => void }) {
  const [promptTopic, setPromptTopic] = useState('Product proposal email');
  const [style, setStyle] = useState(50); // 0 = Casual, 50 = Neutral, 100 = Formal
  const [tone, setTone] = useState(50);   // 0 = Submissive, 50 = Neutral, 100 = Assertive
  const [length, setLength] = useState(50); // 0 = Short, 50 = Medium, 100 = Long
  
  const [draft, setDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { tenant } = useAuth();

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/email-drafter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant?.id,
          topic: promptTopic,
          style: style < 33 ? 'casual' : style > 66 ? 'formal' : 'neutral',
          tone: tone < 33 ? 'submissive' : tone > 66 ? 'assertive' : 'neutral',
          length: length < 33 ? 'short' : length > 66 ? 'long' : 'medium',
          orgName: opp.orgName,
          title: opp.title,
          value: opp.valueUsd
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setDraft(data.draft);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate draft. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999]" onClick={onClose}></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] max-w-[95vw] bg-white rounded-xl shadow-2xl z-[10000] flex flex-col overflow-hidden animate-fade-in border border-slate-200">
        
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
           <h2 className="text-[14px] font-bold text-slate-800 flex items-center gap-2">
             <Sparkles size={16} className="text-blue-600" /> Email Drafter
           </h2>
           <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-1 rounded-md transition-colors"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex bg-white h-[400px]">
           
           {/* Left Controls */}
           <div className="w-[350px] border-r border-slate-100 p-5 flex flex-col overflow-y-auto bg-slate-50/50">
              <div className="mb-6">
                 <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Available Prompts (1)</label>
                 <select value={promptTopic} onChange={e => setPromptTopic(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md text-[13px] px-3 py-2 text-slate-800 focus:border-blue-500 outline-none">
                    <option value="Product proposal email">Product proposal email</option>
                    <option value="Follow-up on recent meeting">Follow-up on recent meeting</option>
                    <option value="Contract negotiation opening">Contract negotiation opening</option>
                 </select>
              </div>

              <div className="mb-2">
                 <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Email Text Preferences</label>
              </div>

              {/* Style Slider */}
              <div className="mb-5">
                 <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                    <span>Style</span>
                 </div>
                 <input type="range" min="0" max="100" value={style} onChange={e => setStyle(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                 <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                    <span>Casual</span><span>Neutral</span><span>Formal</span>
                 </div>
              </div>

              {/* Tone Slider */}
              <div className="mb-5">
                 <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                    <span>Tone</span>
                 </div>
                 <input type="range" min="0" max="100" value={tone} onChange={e => setTone(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                 <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                    <span>Submissive</span><span>Neutral</span><span>Assertive</span>
                 </div>
              </div>

              {/* Length Slider */}
              <div className="mb-6">
                 <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                    <span>Length</span>
                 </div>
                 <input type="range" min="0" max="100" value={length} onChange={e => setLength(Number(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                 <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                    <span>Short</span><span>Medium</span><span>Long</span>
                 </div>
              </div>

              <button disabled={isGenerating} onClick={handleGenerate} className="mt-auto flex items-center justify-center gap-2 w-full py-2 bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 rounded text-[13px] font-bold transition-colors disabled:opacity-50">
                 {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                 {isGenerating ? 'Generating...' : 'Generate Draft'}
              </button>
           </div>

           {/* Right Preview */}
           <div className="flex-1 p-5 flex flex-col relative text-[#32363a]">
              <div className="flex items-center gap-2 mb-3 px-2">
                 <div className="font-bold text-[13px]">Draft</div>
                 {isGenerating && <div className="text-[11px] text-blue-600 animate-pulse font-medium">Writing...</div>}
              </div>
              
              <div className="flex-1 bg-white border border-slate-200 rounded-md p-4 text-[13px] leading-relaxed overflow-y-auto whitespace-pre-wrap outline-none" contentEditable suppressContentEditableWarning>
                 {draft || (
                   <span className="text-slate-400 italic">Click "Generate Draft" to create an AI-powered email for {opp.orgName}. The email will be tailored to the parameters specified on the left.</span>
                 )}
              </div>
              
           </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white text-[11px]">
           <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <AlertCircle size={12} /> Created by Generative AI. Verify results before usage.
           </div>
           <div className="flex items-center gap-2">
              <button disabled={!draft} onClick={() => navigator.clipboard.writeText(draft)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30"><Copy size={16} /></button>
              <button onClick={onClose} className="px-4 py-1.5 rounded font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
              <button disabled={!draft} onClick={() => { if(onSuccess) onSuccess(draft); onClose(); }} className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">Apply</button>
           </div>
        </div>

      </div>
    </>
  );
}
