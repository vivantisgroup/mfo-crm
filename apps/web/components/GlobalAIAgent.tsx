'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, User, RotateCcw, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
}

export default function GlobalAIAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { tenant } = useAuth();
  const tenantId = tenant?.id;

  const toggleOpen = () => setIsOpen(!isOpen);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    // Welcome message on load
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'agent',
          content: 'Hello. I am the MFO Advisory Copilot. How can I assist you with your wealth management and strategy today?',
        },
      ]);
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          tenantId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'agent', content: data.response },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'agent', content: 'An error occurred while connecting to the Advisory Copilot.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'agent',
        content: 'Hello. I am the MFO Advisory Copilot. How can I assist you with your wealth management and strategy today?',
      },
    ]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[380px] h-[550px] bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-5 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700/50 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-200 tracking-wide">Advisory Copilot</span>
                <span className="text-[10px] text-green-400 font-medium tracking-wider uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Online
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClear}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
                title="Clear chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={toggleOpen}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${
                  msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${
                    msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4" />}
                </div>
                <div
                  className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 max-w-[85%] mr-auto">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm bg-slate-700 text-slate-300">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3 rounded-2xl text-sm leading-relaxed bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  <span className="text-slate-400">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-slate-800/80 border-t border-slate-700/50 backdrop-blur-md shrink-0">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about strategies, taxes, structures..."
                className="w-full bg-slate-900 border border-slate-700/60 rounded-xl py-3 pl-4 pr-12 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="text-center mt-2">
               <span className="text-[10px] text-slate-500">MFO-CRM Generative AI preview. Verify critical information.</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={toggleOpen}
        className="group flexItems-center justify-center w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_40px_rgb(59,130,246,0.4)] border border-white/10"
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform duration-200 rotate-90 group-hover:rotate-180" />
        ) : (
          <Bot className="w-6 h-6 transition-transform duration-200 group-hover:scale-110" />
        )}
      </button>
    </div>
  );
}
