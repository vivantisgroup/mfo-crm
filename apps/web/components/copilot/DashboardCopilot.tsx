'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import type { WidgetDefinition } from '@/lib/reportsService';

interface DashboardCopilotProps {
  onAddWidgets: (widgets: WidgetDefinition[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function DashboardCopilot({ onAddWidgets, isOpen, onClose }: DashboardCopilotProps) {
  const { tenant } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !tenant) return;

    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/reports-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, prompt: prompt.trim() })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate charts.');
      }

      if (data.widgets && Array.isArray(data.widgets) && data.widgets.length > 0) {
        onAddWidgets(data.widgets);
        setPrompt('');
        onClose(); // Auto-close on success if preferred, or keep open. We'll close to reveal.
      } else {
        throw new Error('Our AI couldn\'t design a chart for that specific prompt. Try being more descriptive.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="absolute right-6 top-20 w-[380px] bg-[var(--bg-surface)]/90 backdrop-blur-xl border border-[var(--brand-primary)]/20 shadow-2xl rounded-2xl overflow-hidden z-50 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
      
      {/* Copilot Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-gradient-to-r from-[var(--brand-primary)]/10 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)] flex items-center justify-center shadow-inner">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">AI Analytics Designer</h3>
            <p className="text-[10px] text-[var(--brand-primary)] font-semibold uppercase tracking-wider">Copilot Builder</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Intro Context */}
      <div className="p-5 text-sm text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-background)]/50">
        I am your dedicated Graphic Designer & Analytics Engineer. Describe the data visualization you want, and I will craft the necessary ECharts blocks and place them on your canvas.
      </div>

      {/* Form Area */}
      <div className="p-5">
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            disabled={isGenerating}
            placeholder="e.g., 'Show me a pie chart of families by tier in slate colors'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-primary)] text-sm rounded-xl pl-4 pr-12 py-3.5 outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] placeholder-[var(--text-tertiary)] disabled:opacity-50 transition-all shadow-inner"
          />
          <button 
            type="submit" 
            disabled={isGenerating || !prompt.trim()}
            className="absolute right-2 top-2 p-1.5 rounded-lg bg-[var(--brand-primary)] text-white hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center w-8 h-8"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>

        {/* Error State */}
        {error && (
          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-lg animate-fade-in">
            {error}
          </div>
        )}
      </div>
      
    </div>
  );
}
