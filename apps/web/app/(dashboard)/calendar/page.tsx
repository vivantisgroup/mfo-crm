'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { useAuth } from '@/lib/AuthContext';
import { getAllMailConnections, formatLastSync } from '@/lib/emailIntegrationService';
import useSWR from 'swr';

import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval
} from 'date-fns';
import { ChevronLeft, ChevronRight, Mail, Plus, RefreshCcw, AlertCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import EventComposer from './components/EventComposer';
import { toast } from 'sonner';

interface ConnectionStatus { microsoft?: boolean; google?: boolean; [key: string]: boolean | undefined; }
interface CalendarEvent { id?: string; title?: string; subject?: string; date: Date; start?: string; end?: string; type: 'task' | 'activity' | 'governance' | 'concierge' | 'calendar'; priority?: string; familyName?: string; subType?: string; status?: string; description?: string; location?: string; }


const EVENT_COLORS = {
  task:       { bg: 'rgba(99,102,241,0.12)',  border: '#6366f1',  dot: '#6366f1'  },
  activity:   { bg: 'rgba(16,185,129,0.12)',  border: '#10b981',  dot: '#10b981'  },
  governance: { bg: 'rgba(167,139,250,0.12)', border: '#a78bfa',  dot: '#a78bfa'  },
  concierge:  { bg: 'rgba(245,158,11,0.12)',  border: '#f59e0b',  dot: '#f59e0b'  },
  calendar:   { bg: 'rgba(59,130,246,0.12)',  border: '#3b82f6',  dot: '#3b82f6'  }, // For Google/MS events
};

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Failed to fetch');
  return r.json();
});

export default function CalendarPage() { const router = useRouter();
  usePageTitle('Calendar');
  const { user, firebaseUser } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeProvider, setActiveProvider] = useState<'microsoft' | 'google' | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  // Composer State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerDate, setComposerDate] = useState<Date>(new Date());
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);
  const [previewItem, setPreviewItem] = useState<CalendarEvent | null>(null);

  // Discover active provider integration
  useEffect(() => {
    if (user) {
      const activeTenant = JSON.parse(localStorage.getItem('mfo_active_tenant') || '{}');
      if (activeTenant.id) {
         getAllMailConnections(activeTenant.id, user.uid).then(conns => {
            setConnectionStatus(conns);
            if (conns.microsoft) setActiveProvider('microsoft');
            else if (conns.google) setActiveProvider('google');
         });
      }
    }
  }, [user]);

  // Fetch true calendar items based on provider
  // We use SWR so when composer saves, we just call mutate
  const [idToken, setIdToken] = useState<string>('');
  useEffect(() => {
     firebaseUser?.getIdToken().then(setIdToken);
  }, [firebaseUser]);

  const apiQuery = user && idToken && activeProvider 
    ? `/api/calendar/list?uid=${user.uid}&idToken=${idToken}&provider=${activeProvider}`
    : null;
    
  const { data: calData, mutate, isValidating } = useSWR(apiQuery, fetcher, { revalidateOnFocus: false });

  // Consolidate CRM Mock events & Real Sync Database events into one Unified View
  const events = useMemo(() => {
    const all: CalendarEvent[] = [];

    // Map fetched Live Calendar events
    if (calData && calData.events) {
       calData.events.forEach((ev: CalendarEvent) => {
          all.push({
             ...ev,
             date: new Date(ev.start),
             type: 'calendar',
          });
       });
    }


    return all.sort((a,b) => a.date.getTime() - b.date.getTime());
  }, [calData]);

  // Grid mechanics
  const monthStart = startOfMonth(currentDate);
  const monthEnd   = endOfMonth(monthStart);
  const startDate  = startOfWeek(monthStart);
  const endDate    = endOfWeek(monthEnd);
  const days       = eachDayOfInterval({ start: startDate, end: endDate });
  const weeks      = Math.ceil(days.length / 7);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Handlers
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user || !firebaseUser || !activeProvider) return;
      setIsSyncing(true);
      try {
        const activeTenant = JSON.parse(localStorage.getItem('mfo_active_tenant') || '{}');
        const res = await fetch('/api/mail/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
             uid: user.uid, 
             idToken: await firebaseUser.getIdToken(), 
             tenantId: activeTenant.id, 
             provider: activeProvider 
          })
        });
        if (!res.ok) {
           const text = await res.text();
           throw new Error(`Sync failed: ${text}`);
        }
        mutate();
      } catch (err: any) {
        console.error('Manual sync error:', err);
        toast.error(err.message || 'Error occurred during sync');
      } finally {
        setIsSyncing(false);
      }
  };

  const handleDayClick = (day: Date) => {
      setComposerDate(day);
      setEventToEdit(null);
      if (activeProvider) {
         setIsComposerOpen(true);
      }
  };

  const handleEventClick = (e: React.MouseEvent, ev: any) => {
      e.stopPropagation(); // prevent day click
      if (ev.type === 'calendar' && activeProvider) {
         setEventToEdit(ev);
         setComposerDate(ev.date);
         setIsComposerOpen(true);
      } else {
         // It's a CRM event - handle opening CRM modal (not implemented in this scope)
         setPreviewItem(ev);
      }
  };

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] bg-slate-50 overflow-hidden">
      
      {/* ITEM PREVIEW MODAL */}
      {previewItem && (
         <div className="fixed inset-0 z-[200] flex items-center justify-center font-sans">
            <div onClick={() => setPreviewItem(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 cursor-pointer" />
            <div className="relative bg-white/90 backdrop-blur-2xl ring-1 ring-white/50 border border-slate-200/50 rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] w-full max-w-md p-8 animate-in zoom-in-95 duration-300">
               <button onClick={() => setPreviewItem(null)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 bg-slate-100/50 hover:bg-slate-200/80 backdrop-blur-sm rounded-full p-2 transition-all">
                  <X size={16} strokeWidth={2.5} />
               </button>
               <div className="flex items-center gap-4 mb-8 border-b border-slate-200/50 pb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold bg-opacity-20 shadow-inner`} style={{ backgroundColor: EVENT_COLORS[previewItem.type as keyof typeof EVENT_COLORS]?.bg || '#f1f5f9', color: EVENT_COLORS[previewItem.type as keyof typeof EVENT_COLORS]?.border || '#64748b' }}>
                     {previewItem.type === 'task' ? '✓' : '⚡'}
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500/80 mb-1">{previewItem.type} Details</div>
                    <h2 className="text-xl font-extrabold text-slate-800 leading-tight">{previewItem.title}</h2>
                  </div>
               </div>
               
               <div className="space-y-6">
                  <div>
                     <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5 flex items-center gap-2"><Calendar size={12} className="text-slate-400"/> Scheduled Date</label>
                     <div className="text-sm font-semibold text-slate-700 bg-slate-50/50 border border-slate-100 rounded-xl p-3 shadow-sm">{format(previewItem.date, 'EEEE, MMMM do, yyyy')}</div>
                  </div>
                  {previewItem.familyName && (
                     <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Associated Entity</label>
                        <div className="text-sm font-semibold text-indigo-700 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex items-center gap-2 shadow-sm">🏛 {previewItem.familyName}</div>
                     </div>
                  )}
                  {previewItem.priority && (
                     <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Priority</label>
                        <div className={`text-xs font-bold px-3 py-1.5 rounded-lg inline-block shadow-sm border ${previewItem.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>{previewItem.priority.toUpperCase()}</div>
                     </div>
                  )}
               </div>

               <div className="mt-10 flex gap-3">
                  <button onClick={() => { setPreviewItem(null); router.push(previewItem.type === 'task' ? '/tasks' : '/activities'); }} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-gradient-to-tr from-slate-900 to-slate-800 text-white shadow-xl shadow-slate-900/20 hover:shadow-slate-900/30 hover:-translate-y-0.5 transition-all outline-none border border-slate-700">
                     Open {previewItem.type === 'task' ? 'Tasks' : 'Activities'} Portal
                  </button>
               </div>
            </div>
         </div>
      )}

      
      {/* ── Sidebar ── */}
      <div className="w-[280px] bg-white border-r border-slate-200 flex flex-col pt-6 pb-6 shadow-sm z-10">
        <div className="px-6 mb-8">
           <button className="w-full shadow-sm inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)] h-9 px-4 py-2 gap-2" onClick={() => handleDayClick(new Date())} disabled={!activeProvider}>
             <Plus size={16} />
             New Event
           </button>
        </div>

        {/* Sync Status area */}
        <div className="px-6 mb-8 flex flex-col gap-4">
          <div className="text-sm text-[var(--text-secondary)] text-xs font-bold uppercase tracking-wider text-slate-400">Integrations</div>
          
          {connectionStatus?.microsoft && (
          <div 
            className={`bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-3 cursor-pointer border-l-4 transition-all ${activeProvider === 'microsoft' ? 'border-l-blue-500 bg-blue-50/50' : 'border-l-transparent hover:bg-slate-50'}`} 
            onClick={() => setActiveProvider('microsoft')}
          >
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 w-full">
                   <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-xs shrink-0">🟦</div>
                   <div className="flex-1 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Microsoft 365</div>
                        <div className="flex items-center gap-1 mt-0.5">
                           <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus?.microsoft?.lastSyncResult === 'error' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'}`}></div>
                           <span className={`text-[10px] font-medium whitespace-nowrap ${connectionStatus?.microsoft?.lastSyncResult === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{connectionStatus?.microsoft?.lastSyncResult === 'error' ? 'Sync Failed' : `Synced ${formatLastSync(connectionStatus?.microsoft?.lastSyncAt)}`}</span>
                        </div>
                      </div>
                      
                      <button 
                         onClick={handleManualSync} 
                         disabled={isSyncing}
                         className="p-1.5 rounded-md hover:bg-blue-100 text-blue-500 transition-colors"
                         title="Manual Sync"
                      >
                         <RefreshCcw size={14} className={isSyncing && activeProvider === 'microsoft' ? 'animate-spin' : ''} />
                      </button>
                   </div>
                </div>
             </div>
          </div>
          )}

          {connectionStatus?.google && (
          <div 
            className={`bg-card text-card-foreground shadow-sm rounded-xl border border-[var(--border)] p-3 cursor-pointer border-l-4 transition-all ${activeProvider === 'google' ? 'border-l-red-500 bg-red-50/50' : 'border-l-transparent hover:bg-slate-50'}`}
            onClick={() => setActiveProvider('google')}
          >
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 w-full">
                   <div className="w-6 h-6 rounded bg-red-100 flex items-center justify-center text-xs shrink-0">🔴</div>
                   <div className="flex-1 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Google Workspace</div>
                        <div className="flex items-center gap-1 mt-0.5">
                           <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus?.google?.lastSyncResult === 'error' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'}`}></div>
                           <span className={`text-[10px] font-medium whitespace-nowrap ${connectionStatus?.google?.lastSyncResult === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{connectionStatus?.google?.lastSyncResult === 'error' ? 'Sync Failed' : `Synced ${formatLastSync(connectionStatus?.google?.lastSyncAt)}`}</span>
                        </div>
                      </div>

                      <button 
                         onClick={handleManualSync} 
                         disabled={isSyncing}
                         className="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition-colors"
                         title="Manual Sync"
                      >
                         <RefreshCcw size={14} className={isSyncing && activeProvider === 'google' ? 'animate-spin' : ''} />
                      </button>
                   </div>
                </div>
             </div>
          </div>
          )}

          {!connectionStatus?.microsoft && !connectionStatus?.google && connectionStatus !== null && (
             <div className="text-xs text-slate-400 flex flex-col gap-2 mt-2 p-3 bg-slate-50 rounded border border-slate-100 text-center">
                <AlertCircle size={16} className="mx-auto opacity-50" />
                No active integrations tests passed.
             </div>
          )}
        </div>

        {/* Legend */}
        <div className="px-6">
          <div className="text-sm text-[var(--text-secondary)] text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Legend</div>
          <div className="flex flex-col gap-2.5">
            {Object.entries(EVENT_COLORS).map(([type, c]) => (
              <div key={type} className="flex items-center gap-2 text-xs font-medium text-slate-600 capitalize">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.dot }} />
                <span>{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Workspace ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
         {!activeProvider && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in duration-500">
               <div className="bg-white/80 backdrop-blur-3xl ring-1 ring-white/50 border border-slate-200/50 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-3xl p-10 max-w-md text-center transform transition-all hover:scale-[1.01]">
                  <div className="w-20 h-20 bg-gradient-to-br from-amber-50 to-orange-100/50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-amber-500 shadow-inner ring-1 ring-amber-500/20">
                     <AlertCircle size={36} strokeWidth={2} />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-3">Calendar Not Synced</h3>
                  <p className="text-sm text-slate-500 mb-8 leading-relaxed px-4">You need to connect a Microsoft 365 or Google Workspace account via Settings to unlock the live Calendar Sync engine.</p>
                  <button className="inline-flex w-full items-center justify-center rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-[var(--brand-600)] to-indigo-600 text-white shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 h-12 px-6" onClick={() => window.location.assign('/settings')}>Configure Integrations</button>
               </div>
            </div>
         )}
         
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-8 py-5 flex items-center justify-between shrink-0 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] z-10 sticky top-0">
          <div className="flex items-center gap-3">
             <h3 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight">{format(currentDate, 'MMMM')} <span className="text-slate-400 font-bold ml-1">{format(currentDate, 'yyyy')}</span></h3>
             {isValidating && <RefreshCcw size={16} className="animate-spin text-indigo-500 ml-2" />}
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-slate-100 p-1 rounded-xl flex shadow-inner border border-slate-200/50">
               <button className="px-4 py-1.5 text-xs font-bold bg-white shadow-sm rounded-lg text-slate-800 tracking-wide">Month</button>
               <button className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 tracking-wide">Week</button>
            </div>
            <div className="flex items-center gap-1 pl-4 border-l border-slate-200/60">
              <button onClick={prevMonth} className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"><ChevronLeft size={18} strokeWidth={3} /></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-5 py-2.5 text-xs font-extrabold tracking-wider uppercase bg-white border border-slate-200 shadow-sm rounded-xl text-slate-700 hover:text-indigo-600 hover:border-indigo-200 transition-all">Today</button>
              <button onClick={nextMonth} className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"><ChevronRight size={18} strokeWidth={3} /></button>
            </div>
          </div>
        </div>

        {/* CSS Grid layout filling exact height */}
        <div className="flex-1 flex flex-col">
           {/* Headers row */}
           <div className="grid grid-cols-7 bg-slate-50/80 border-b border-slate-200 flex-shrink-0">
             {dayLabels.map(label => (
               <div key={label} className="py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                 {label}
               </div>
             ))}
           </div>
           
           {/* Cells container */}
           <div 
              className="flex-1 grid grid-cols-7 border-l border-slate-200" 
              style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }} // Important: equal slice
           >
             {days.map((day, idx) => {
                const dayEvents = events.filter(e => isSameDay(e.date, day));
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isToday = isSameDay(day, new Date());
                
                return (
                   <div 
                     key={day.toISOString()}
                     onClick={() => handleDayClick(day)}
                     className={`flex flex-col p-2 border-r border-b border-slate-200/60 relative group cursor-pointer hover:bg-indigo-50/40 hover:z-10 transition-all duration-300 ${!isCurrentMonth ? 'bg-slate-50/40 opacity-70' : 'bg-white/90 backdrop-blur-sm'}`}
                   >
                     {/* Day numeric label */}
                     <div className="flex justify-between items-start mb-1.5">
                        <span className={`text-[13px] font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700'}`}>
                           {format(day, 'd')}
                        </span>
                        <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <Plus size={12}/>
                        </div>
                     </div>

                     {/* Events render */}
                     <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar flex-1 pb-1">
                        {dayEvents.slice(0, 5).map(event => {
                           const c = EVENT_COLORS[event.type as keyof typeof EVENT_COLORS] || EVENT_COLORS.task;
                           return (
                              <div
                                key={event.id}
                                onClick={(e) => handleEventClick(e, event)}
                                className="group/event w-full py-1 px-2 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.02)] border border-transparent truncate hover:scale-[1.01] transition-transform"
                                style={{ background: c.bg, borderLeft: `2.5px solid ${c.border}` }}
                                title={event.title}
                              >
                                 <span className="text-[10px] font-semibold text-slate-800 leading-tight">
                                    {event.start && <span className="mr-1 text-slate-500 font-medium">{format(new Date(event.start), 'HH:mm')}</span>}
                                    {event.title}
                                 </span>
                              </div>
                           )
                        })}
                        {dayEvents.length > 5 && (
                           <div className="text-[10px] font-bold text-slate-400 pl-1 mt-1">
                              +{dayEvents.length - 5} more
                           </div>
                        )}
                     </div>
                   </div>
                );
             })}
           </div>
        </div>
      </div>
      
      {/* Sync Composer rendering */}
      {activeProvider && (
         <EventComposer 
            isOpen={isComposerOpen} 
            onClose={() => setIsComposerOpen(false)} 
            eventToEdit={eventToEdit}
            selectedDate={composerDate}
            provider={activeProvider}
            onSaved={() => {
               mutate(); // Refetch SWR events automatically
            }}
         />
      )}
    </div>
  );
}
