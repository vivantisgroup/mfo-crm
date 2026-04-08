'use client';

import React, { useState, useEffect } from 'react';
import { PlayCircle, StopCircle, X, ChevronRight, Briefcase } from 'lucide-react';
import { useTaskQueue } from '@/lib/TaskQueueContext';

export function GlobalTimeLogger() {
  const { activeClockItem, clockElapsedSec, stopClock } = useTaskQueue();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [activityType, setActivityType] = useState('executing');

  useEffect(() => {
    if (!activeClockItem) {
      setIsModalOpen(false);
      setNotes('');
      setActivityType('executing');
    }
  }, [activeClockItem]);

  if (!activeClockItem) return null;

  const m = Math.floor(clockElapsedSec / 60);
  const s = clockElapsedSec % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');

  const handleStopRequest = () => {
    setIsModalOpen(true);
  };

  const handleCommit = () => {
    stopClock(notes, activityType);
    setIsModalOpen(false);
  };

  return (
    <>
      <div 
        className="flex items-center bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:border-indigo-300 transition-all animate-fade-in"
        onClick={handleStopRequest}
        title={`Tracking ${activeClockItem.type}: ${activeClockItem.name}`}
      >
        <div className="flex items-center justify-center bg-indigo-100 text-indigo-600 px-3 py-1.5 h-full">
           <PlayCircle size={16} className="animate-pulse" />
        </div>
        <div className="px-3 py-1.5 flex items-center gap-2">
           <div className="flex flex-col min-w-0">
             <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 leading-none truncate max-w-[100px]">
               {activeClockItem.name}
             </span>
             <span className="text-xs font-mono font-medium leading-none mt-1">
               {mm}:{ss}
             </span>
           </div>
           <StopCircle size={16} className="text-indigo-400 opacity-50 hover:opacity-100 hover:text-red-500 transition-colors ml-1" />
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
             <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-elevated)] flex justify-between items-center">
               <h3 className="font-bold text-sm flex items-center gap-2">
                 <StopCircle size={16} className="text-red-500" />
                 Commit Time Log
               </h3>
               <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                 <X size={16} />
               </button>
             </div>
             <div className="p-5">
               <div className="flex items-center gap-3 mb-5 bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border)]">
                 <Briefcase size={20} className="text-[var(--brand-primary)]" />
                 <div>
                   <div className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider">Target Entity</div>
                   <div className="text-sm font-bold text-[var(--text-primary)] truncate max-w-[300px]">
                     {activeClockItem.name} <span className="text-[var(--text-tertiary)] font-normal text-xs">({activeClockItem.type})</span>
                   </div>
                 </div>
                 <div className="ml-auto text-right">
                   <div className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider">Elapsed</div>
                   <div className="text-lg font-mono font-bold text-indigo-600">{mm}:{ss}</div>
                 </div>
               </div>

               <div className="flex flex-col gap-4">
                 <div>
                   <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Activity Type</label>
                   <select 
                     className="w-full bg-[var(--bg-canvas)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]"
                     value={activityType} onChange={e => setActivityType(e.target.value)}
                   >
                     <option value="executing">Execution / Deep Work</option>
                     <option value="meeting">Client Meeting</option>
                     <option value="call">Call / Comms</option>
                     <option value="analysis">Research & Analysis</option>
                     <option value="admin">Administrative</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Work Notes (Optional)</label>
                   <textarea
                     className="w-full bg-[var(--bg-canvas)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] min-h-[80px] resize-none"
                     placeholder="Describe the work done..."
                     value={notes}
                     onChange={e => setNotes(e.target.value)}
                   />
                 </div>
               </div>
             </div>
             <div className="px-5 py-4 bg-[var(--bg-elevated)] border-t border-[var(--border)] flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  Cancel
                </button>
                <button onClick={handleCommit} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">
                  Submit Timesheet
                </button>
             </div>
           </div>
        </div>
      )}
    </>
  );
}
