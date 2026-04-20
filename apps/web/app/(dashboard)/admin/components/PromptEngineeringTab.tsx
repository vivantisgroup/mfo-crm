'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface SystemPrompt {
  id: string;
  title: string;
  description: string;
  defaultPrompt: string;
  customPrompt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

interface PromptHistoryRecord {
  id: string;
  customPrompt: string;
  updatedAt: string;
  updatedBy: string;
}

export function PromptEngineeringTab() {
  const { tenant } = useAuth();
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<Record<string, PromptHistoryRecord[]>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingContent, setEditingContent] = useState<string>('');

  useEffect(() => {
    if (!tenant?.id) return;
    const fetchPrompts = async () => {
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        const res = await fetch(`/api/compliance/prompts?tenantId=${tenant.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load prompts');
        const p = data.prompts || [];
        setPrompts(p);
        if (p.length > 0) {
           setSelectedId(p[0].id);
           setEditingContent(p[0].customPrompt || p[0].defaultPrompt);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPrompts();
  }, [tenant?.id]);

  const loadHistory = async (promptId: string) => {
    if (!tenant?.id) return;
    setLoadingHistory(true);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`/api/compliance/prompts?tenantId=${tenant.id}&promptId=${promptId}&action=history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.history) {
        setHistoryData(prev => ({ ...prev, [promptId]: data.history }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelect = (p: SystemPrompt) => {
    setSelectedId(p.id);
    setEditingContent(p.customPrompt || p.defaultPrompt);
    setShowHistory(false);
  };

  const toggleHistory = () => {
    if (!selectedId) return;
    const val = !showHistory;
    setShowHistory(val);
    if (val && !historyData[selectedId]) {
      loadHistory(selectedId);
    }
  };

  const handleSave = async (promptId: string, customContent: string) => {
    if (!tenant?.id) return;
    setSavingId(promptId);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/compliance/prompts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ tenantId: tenant.id, promptId, customPrompt: customContent || '' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      
      setPrompts(prev => prev.map(p => p.id === promptId ? { ...p, customPrompt: customContent, updatedAt: new Date().toISOString() } : p));
      
      // Reload history if open
      if (showHistory) {
         loadHistory(promptId);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleResetToDefault = () => {
    const p = selectedPrompt;
    if (!p) return;
    if (!confirm('Revert to the default system prompt? This will log a new history version.')) return;
    setEditingContent(p.defaultPrompt);
    handleSave(p.id, '');
  };

  const handleClearHistory = async (promptId: string) => {
    if (!tenant?.id || !confirm('Are you sure you want to completely clear the version history for this prompt? This action cannot be undone.')) return;
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      await fetch('/api/compliance/prompts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ tenantId: tenant.id, promptId, action: 'clearHistory' })
      });
      setHistoryData(prev => ({ ...prev, [promptId]: [] }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRollback = (historyRecord: PromptHistoryRecord) => {
    if (!selectedId) return;
    if (!confirm('Rollback to this version? It will become the active prompt.')) return;
    setEditingContent(historyRecord.customPrompt);
    handleSave(selectedId, historyRecord.customPrompt);
  };

  if (loading) return <div className="text-sm p-4 text-slate-500">Loading system prompts...</div>;
  if (error) return <div className="text-sm p-4 text-red-500 bg-red-50 rounded-lg border border-red-200">Error: {error}</div>;

  const selectedPrompt = prompts.find(p => p.id === selectedId);
  const hasHistory = selectedId && historyData[selectedId] && historyData[selectedId].length > 0;
  const isModified = selectedPrompt?.customPrompt !== undefined && selectedPrompt?.customPrompt !== '';

  return (
    <div className="flex flex-col h-[750px] relative overflow-hidden rounded-2xl border border-white/20 shadow-2xl bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none"></div>

      {/* Sub-header Context */}
      <div className="relative z-10 bg-white/5 border-b border-white/10 px-6 py-5 flex flex-col gap-1 shrink-0 backdrop-blur-md">
        <h4 className="font-extrabold flex items-center gap-3 mb-1 text-white text-lg tracking-tight">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-indigo-500/30">🧠</div> 
          AI Prompt Engineering Catalog
        </h4>
        <p className="text-[0.875rem] text-indigo-100/70 max-w-3xl">
          Audit and modify the system-level instructions executed by the overarching AI platform. This determines how AIs parse documents, format texts, and reason over data within your Tenant.
        </p>
      </div>

      {/* Split Pane */}
      <div className="flex-1 flex overflow-hidden w-full gap-5 p-5 relative z-10">
         
         {/* Left Sidebar: Catalog */}
         <div className="w-[320px] shrink-0 bg-white/10 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
               <span className="font-bold text-[0.875rem] text-white tracking-wide uppercase">System Prompts</span>
               <span className="bg-white/20 text-white font-bold py-0.5 px-2.5 rounded-full text-[0.7rem] shadow-sm">{prompts.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
               <ul className="flex flex-col">
                  {prompts.map(p => (
                    <li 
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      className={`p-4 border-b border-white/5 cursor-pointer transition-all duration-200 select-none hover:bg-white/10 ${selectedId === p.id ? 'bg-indigo-500/20 border-l-4 border-l-indigo-400' : 'border-l-4 border-l-transparent'}`}
                    >
                       <div className="font-bold text-[0.9rem] text-white mb-1.5 leading-snug">{p.title}</div>
                       <div className="text-[0.75rem] text-indigo-100/60 line-clamp-2 leading-relaxed">{p.description}</div>
                       {p.customPrompt && (
                          <div className="mt-3 inline-block text-[0.65rem] font-extrabold text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded shadow-sm border border-amber-500/30 backdrop-blur-sm tracking-wider uppercase">
                             ✨ Customized
                          </div>
                       )}
                    </li>
                  ))}
               </ul>
            </div>
         </div>

         {/* Right Payload: Editor */}
         <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-300">
            {selectedPrompt ? (
               <>
                 <div className="p-6 border-b border-white/10 flex items-start justify-between bg-black/20 shrink-0">
                    <div>
                       <h3 className="text-xl font-extrabold text-white tracking-tight">{selectedPrompt.title}</h3>
                       <div className="text-[0.85rem] text-indigo-100/70 mt-1 max-w-2xl leading-relaxed">{selectedPrompt.description}</div>
                       <div className="mt-3 flex gap-4">
                         <span className="text-[0.7rem] text-white/40 font-mono tracking-wider">ID: {selectedPrompt.id}</span>
                         {selectedPrompt.updatedAt && <span className="text-[0.7rem] text-white/40 font-mono tracking-wider">LAST UPDATE: {new Date(selectedPrompt.updatedAt).toLocaleString()}</span>}
                       </div>
                    </div>
                    <div className="flex gap-3 items-center shrink-0">
                       <button 
                          onClick={toggleHistory}
                          className={`px-4 py-2 text-[0.8rem] font-bold rounded-lg transition-all duration-200 flex items-center gap-2 shadow-sm ${showHistory ? 'bg-indigo-500/30 text-indigo-100 border border-indigo-400/50' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10 hover:border-white/30'}`}
                       >
                          {showHistory ? 'Hide History' : 'Version History'}
                       </button>

                       {isModified && (
                         <button 
                            onClick={handleResetToDefault}
                            className="px-4 py-2 text-[0.8rem] text-rose-300 font-bold hover:bg-rose-500/20 rounded-lg transition-all duration-200 flex items-center gap-2 border border-rose-500/20 hover:border-rose-500/50"
                         >
                            Restore Default
                         </button>
                       )}
                       <button 
                          onClick={() => handleSave(selectedPrompt.id, editingContent)}
                          disabled={savingId === selectedPrompt.id}
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white px-5 py-2 rounded-lg text-[0.85rem] font-extrabold tracking-wide transition-all duration-300 flex items-center gap-2 shadow-lg shadow-indigo-500/25 disabled:opacity-50"
                       >
                          {savingId === selectedPrompt.id ? 'Saving...' : 'Save Strategy'}
                       </button>
                    </div>
                 </div>
                 
                 <div className="flex flex-1 overflow-hidden bg-black/10">
                   {/* Editor Area */}
                   <div className="flex-1 p-6 overflow-hidden flex flex-col relative transition-all duration-300">
                      <div className="flex items-center justify-between mb-3 px-1">
                         <div className="flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                           <span className="text-[0.75rem] font-extrabold tracking-widest uppercase text-emerald-400">System Instruction Envelope</span>
                         </div>
                         <span className="text-[0.7rem] font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded">{editingContent.length} chars</span>
                      </div>
                      <textarea 
                         value={editingContent}
                         onChange={(e) => setEditingContent(e.target.value)}
                         spellCheck={false}
                         className="flex-1 w-full bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 font-mono text-[0.85rem] leading-relaxed text-emerald-50 resize-none outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner transition-colors duration-200 custom-scrollbar"
                         style={{ tabSize: 2 }}
                         placeholder="Enter custom instructions..."
                      />
                   </div>

                   {/* History Panel */}
                   {showHistory && (
                     <div className="w-[340px] bg-slate-900/90 backdrop-blur-xl border-l border-white/10 flex flex-col overflow-hidden shadow-[-10px_0_30px_-10px_rgba(0,0,0,0.5)]">
                       <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
                         <h4 className="text-[0.8rem] font-bold text-white uppercase tracking-widest flex items-center gap-2"><span className="text-xl">📜</span> Audit Log</h4>
                         <button onClick={() => handleClearHistory(selectedPrompt.id)} className="text-[0.65rem] font-bold text-rose-400 hover:text-white transition-colors bg-rose-500/10 hover:bg-rose-500/30 px-3 py-1.5 rounded-md border border-rose-500/20 uppercase tracking-wide">Clear Log</button>
                       </div>
                       
                       <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                         {loadingHistory ? (
                           <div className="text-xs text-center text-white/40 py-8 italic hover:animate-pulse">Loading audits...</div>
                         ) : !hasHistory ? (
                           <div className="text-xs text-center text-white/40 py-8 italic">No history available for this prompt.</div>
                         ) : (
                           <div className="flex flex-col gap-4 relative before:content-[''] before:absolute before:left-[1.1rem] before:top-4 before:bottom-4 before:w-px before:bg-white/10">
                             {historyData[selectedPrompt.id].map((h, i) => (
                               <div key={h.id} className="relative pl-10">
                                 <div className={`absolute left-3 top-3 w-3 h-3 rounded-full border-2 border-slate-900 shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10 ${i === 0 ? 'bg-emerald-400 ring-2 ring-emerald-400/50' : 'bg-slate-500'}`}></div>
                                 <div className={`text-xs bg-black/40 backdrop-blur-md rounded-xl p-4 shadow-lg transition-colors border ${i === 0 ? 'border-emerald-500/30 ring-1 ring-emerald-500/20' : 'border-white/5 hover:border-white/20'}`}>
                                   <div className="flex justify-between items-start mb-2">
                                     <span className="font-bold text-white">{h.updatedBy || 'System Admin'}</span>
                                     <span className="text-[0.65rem] text-indigo-200 font-mono bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded shadow-sm">{new Date(h.updatedAt).toLocaleDateString()}</span>
                                   </div>
                                   <div className="text-[0.75rem] text-slate-300 line-clamp-3 mb-3 bg-black/50 p-2.5 rounded-lg font-mono leading-relaxed border border-white/5">
                                     {h.customPrompt ? `${h.customPrompt}` : '(Reverted to default system prompt)'}
                                   </div>
                                   {i === 0 ? (
                                     <span className="text-[0.65rem] font-extrabold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-md inline-block uppercase tracking-wider border border-emerald-400/20">Live Version</span>
                                   ) : (
                                     <button onClick={() => handleRollback(h)} className="text-[0.65rem] font-bold text-white bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/50 px-3 py-1.5 rounded-md transition-colors uppercase tracking-wider">
                                       Rollback to this
                                     </button>
                                   )}
                                 </div>
                               </div>
                             ))}
                           </div>
                         )}
                       </div>
                     </div>
                   )}
                 </div>
               </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-black/20">
                  <div className="w-24 h-24 bg-white/5 border border-white/10 shadow-2xl rounded-full flex items-center justify-center mb-6">
                     <span className="text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">🤖</span>
                  </div>
                  <h3 className="text-white font-extrabold text-2xl tracking-tight drop-shadow-md">No Instructions Selected</h3>
                  <p className="text-indigo-100/60 text-[0.9rem] mt-3 max-w-sm leading-relaxed">Select a core system prompt from the catalog on the left to audit its runtime instructions and edit its constraints.</p>
              </div>
            )}
         </div>

      </div>
    </div>
  );
}
