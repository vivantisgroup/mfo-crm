'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Maximize2, Settings, Minus, Sparkles, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CopilotDrawer({ onClose }: { onClose: () => void }) {
  const { user, tenant } = useAuth();
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string }[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // The tenant admin controls the assistant name. Default to "Joule" if unset to mimic Fiori standard.
  const assistantName = tenant?.aiAssistantName || 'Joule';

  const quickActions = [
    'View Job Data',
    'Create New Position',
    'Change Chosen Name',
    'Change Location'
  ];

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const cleanText = text.trim();
    setChatInput('');
    
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: cleanText }]);
    setIsTyping(true);

    // Simulated Copilot Backend Pipeline
    setTimeout(() => {
      let reply = `I have logged your request: "${cleanText}". How else can I assist you today?`;
      if (cleanText.toLowerCase().includes('job')) reply = 'Navigating to Automation Hub jobs... I have loaded the background execution threads.';
      else if (cleanText.toLowerCase().includes('position')) reply = 'Redirecting you to the HR module to create a new personnel position.';
      
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative font-sans overflow-hidden">
      
      {/* Dynamic Copilot Canvas Header (Gradient based on SAP Joule brand) */}
      <div className="relative shrink-0 text-white shadow-md z-10" style={{ background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)' }}>
         <div className="flex justify-between items-center px-4 py-3">
            <h2 className="font-bold text-[15px] tracking-tight">{assistantName}</h2>
            <div className="flex items-center gap-4 text-white/90">
               <button className="hover:text-white transition-colors" title="Expand">
                 <Maximize2 size={16} />
               </button>
               <button className="hover:text-white transition-colors" title="Settings">
                 <Settings size={16} />
               </button>
               <button className="hover:text-white transition-colors" title="Minimize" onClick={onClose}>
                 <Minus size={16} />
               </button>
            </div>
         </div>

         {messages.length === 0 && (
           <>
             {/* Center Logo Area */}
             <div className="flex justify-center shrink-0 w-full pt-1 pb-4">
                <div className="relative">
                   <Sparkles size={64} strokeWidth={1} className="text-white drop-shadow-md" />
                </div>
             </div>

             {/* Welcome Area */}
             <div className="px-6 pb-6 pt-2">
                <div className="text-[14px] text-white/90 font-medium tracking-wide">
                   Hello {user?.name?.split(' ')[0] ?? 'User'},
                </div>
                <div className="text-[32px] font-light tracking-tight leading-tight mt-1 mb-4 drop-shadow-sm">
                   How can I help you?
                </div>

                {/* Instruction Bubble */}
                <div className="bg-white text-slate-800 p-4 rounded-xl shadow-lg border border-white/20 text-[14px]">
                   Talk to me naturally. For example, "I want to view time off"
                </div>
             </div>
           </>
         )}
      </div>

      {/* Body Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 flex flex-col gap-4">
         {messages.length === 0 ? (
           <>
             <h4 className="font-bold text-[14px] text-slate-800 mb-2 px-2">Get started with {assistantName}</h4>
             <div className="flex flex-wrap gap-2 px-2">
                {quickActions.map(action => (
                   <button 
                     key={action}
                     onClick={() => handleSend(action)}
                     className="px-4 py-2 bg-white border border-slate-300 rounded-full text-[13px] font-bold text-[#0a6ed1] hover:bg-slate-50 hover:border-[#0a6ed1] transition-all shadow-sm"
                   >
                     {action}
                   </button>
                ))}
             </div>
           </>
         ) : (
           <div className="flex flex-col gap-4 w-full">
             {messages.map((msg) => (
               <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[#0a6ed1] text-white rounded-br-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'}`}>
                   {msg.content}
                 </div>
               </div>
             ))}
             {isTyping && (
               <div className="flex w-full justify-start animate-fade-in">
                 <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-white border border-slate-200 rounded-bl-sm text-slate-500 shadow-sm flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                   <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                   <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                 </div>
               </div>
             )}
           </div>
         )}
      </div>

      {/* Floating Chat Input Footer */}
      <div className="absolute bottom-4 left-4 right-4 bg-white border border-slate-200 rounded-xl shadow-xl flex items-center p-1.5 focus-within:border-[#0a6ed1] focus-within:ring-2 focus-within:ring-[#0a6ed1]/20 transition-all z-10">
         <input 
           type="text" 
           placeholder={`Message ${assistantName}...`} 
           value={chatInput}
           onChange={e => setChatInput(e.target.value)}
           onKeyDown={e => {
             if (e.key === 'Enter') handleSend(chatInput);
           }}
           className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] px-3 placeholder:text-slate-400 outline-none"
         />
         <button 
           disabled={!chatInput.trim()}
           className="w-10 h-10 shrink-0 bg-[#0a6ed1] text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-slate-300 transition-colors ml-2 hover:bg-[#085ab3]"
           onClick={() => handleSend(chatInput)}
         >
           <Send size={16} className="-ml-0.5" />
         </button>
      </div>

      {/* SAP Required Legal Footer */}
      <div className="absolute bottom-1 left-0 right-0 text-center z-10 bg-slate-50/80 backdrop-blur-sm rounded-t-lg">
         <span className="text-[9px] text-slate-400">
            {assistantName} is powered by generative AI and output should be reviewed.
         </span>
      </div>

    </div>
  );
}
