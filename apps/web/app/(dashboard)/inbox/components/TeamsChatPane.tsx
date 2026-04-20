'use client';

import React, { useState } from 'react';
import { Send, MessageSquare, Plus, FileText, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  fromName: string;
  fromEmail: string;
  body: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  attachments?: { name: string; url: string }[];
}

export function TeamsChatPane({
  threadId,
  subject,
  participants,
  messages,
  onReply
}: {
  threadId: string;
  subject: string;
  participants: { name: string; email: string }[];
  messages: ChatMessage[];
  onReply: (body: string) => Promise<void>;
}) {
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!replyBody.trim()) return;
    setSending(true);
    try {
      await onReply(replyBody.trim());
      setReplyBody('');
    } catch (e) {
      console.error(e);
      toast.error('Failed to send Teams message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Thread Header */}
      <div className="shrink-0 px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#EEF2FC] text-[#5B5FC7] flex items-center justify-center shrink-0">
            <MessageSquare size={20} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">{subject || 'Microsoft Teams Chat'}</h2>
            <div className="text-xs font-medium text-slate-500 mt-0.5">
              {participants.map(p => p.name).join(', ')}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <span className="px-2.5 py-1 bg-[#EEF2FC] text-[#5B5FC7] text-[10px] font-bold uppercase tracking-wider rounded-md border border-[#5B5FC7]/20">
             M365 Graph Synced
           </span>
        </div>
      </div>

      {/* Messages View */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        {messages.length === 0 ? (
           <div className="text-center text-sm text-slate-400 my-auto">No messages captured in this thread yet.</div>
        ) : (
           messages.map((msg, idx) => {
             const isMe = msg.direction === 'outbound';
             return (
               <div key={msg.id || idx} className={`flex gap-3 max-w-[85%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}>
                 <div className="shrink-0 mt-1">
                   {isMe ? null : <Avatar name={msg.fromName} size="sm" shape="circle" />}
                 </div>
                 <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                   {!isMe && (
                     <div className="text-[11px] font-semibold text-slate-500 mb-1 ml-1">{msg.fromName}</div>
                   )}
                   <div 
                     className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm
                       ${isMe 
                         ? 'bg-[#5B5FC7] text-white rounded-tr-sm' 
                         : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                       }
                     `}
                   >
                     {/* Parse simple HTML or display raw */}
                     <div dangerouslySetInnerHTML={{ __html: msg.body }} className="prose-sm prose-p:my-0" />
                     
                     {msg.attachments && msg.attachments.length > 0 && (
                       <div className="mt-3 flex flex-wrap gap-2">
                         {msg.attachments.map((a, i) => (
                           <a key={i} href={a.url} target="_blank" rel="noreferrer" 
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium border transition-colors
                                ${isMe ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}
                              `}>
                             <FileText size={12} /> {a.name}
                           </a>
                         ))}
                       </div>
                     )}
                   </div>
                   <div className="text-[10px] text-slate-400 mt-1 font-medium mx-1">
                     {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </div>
                 </div>
               </div>
             );
           })
        )}
      </div>

      {/* Reply Composer */}
      <div className="shrink-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 transition-colors focus-within:border-[#5B5FC7] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#EEF2FC]">
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100 shrink-0">
            <Plus size={20} />
          </button>
          
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Reply via Microsoft Teams..."
            className="flex-1 max-h-32 min-h-[40px] bg-transparent resize-none border-none outline-none py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400"
            rows={1}
          />
          
          <button 
            onClick={handleSend}
            disabled={!replyBody.trim() || sending}
            className={`p-2 rounded-lg shrink-0 transition-all ${
              replyBody.trim() && !sending
                ? 'bg-[#5B5FC7] text-white shadow-md hover:bg-[#4a4eA6] hover:shadow-lg' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />}
          </button>
        </div>
        <div className="text-center text-[10px] text-slate-400 font-medium mt-2">
          Press <kbd className="font-sans font-bold">Enter</kbd> to send, <kbd className="font-sans font-bold">Shift+Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
}
