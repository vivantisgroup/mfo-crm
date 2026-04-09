'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { useAuth } from '@/lib/AuthContext';
import { getAllMailConnections } from '@/lib/emailIntegrationService';
import useSWR from 'swr';

import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval
} from 'date-fns';
import { TASKS, ACTIVITIES, GOVERNANCE_MEETINGS, SERVICE_REQUESTS } from '@/lib/mockData';
import { ChevronLeft, ChevronRight, Mail, Plus, RefreshCcw, AlertCircle } from 'lucide-react';
import { Card, Badge, Title, Text, Button } from '@tremor/react';

// Import our new advanced composer
import EventComposer from './components/EventComposer';

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

export default function CalendarPage() {
  usePageTitle('Calendar');
  const { user, firebaseUser } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeProvider, setActiveProvider] = useState<'microsoft' | 'google' | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  // Composer State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerDate, setComposerDate] = useState<Date>(new Date());
  const [eventToEdit, setEventToEdit] = useState<any>(null);

  // Discover active provider integration
  useEffect(() => {
    if (user) {
      getAllMailConnections(user.uid).then(conns => {
         setConnectionStatus(conns);
         if (conns.microsoft) setActiveProvider('microsoft');
         else if (conns.google) setActiveProvider('google');
      });
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
    const all: any[] = [];

    // Map fetched Live Calendar events
    if (calData && calData.events) {
       calData.events.forEach((ev: any) => {
          all.push({
             ...ev,
             date: new Date(ev.start),
             type: 'calendar',
          });
       });
    }

    // Include some CRM events 
    TASKS.forEach(task => {
      all.push({ id: `task-${task.id}`, title: task.title, date: new Date(task.dueDate || new Date()), type: 'task', priority: task.priority, familyName: task.familyName });
    });
    ACTIVITIES.forEach(act => {
      if (act.activityType === 'meeting' || act.activityType === 'call') {
        all.push({ id: `act-${act.id}`, title: act.subject, date: new Date(act.occurredAt || new Date()), type: 'activity', subType: act.activityType, familyName: act.familyName });
      }
    });

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
        alert(err.message || 'Error occurred during sync');
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
         alert(`This is a CRM entity: ${ev.type}. Navigate to CRM to edit.`);
      }
  };

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] bg-slate-50 overflow-hidden">
      
      {/* ── Sidebar ── */}
      <div className="w-[280px] bg-white border-r border-slate-200 flex flex-col pt-6 pb-6 shadow-sm z-10">
        <div className="px-6 mb-8">
           <Button icon={Plus} color="indigo" className="w-full shadow-sm" onClick={() => handleDayClick(new Date())} disabled={!activeProvider}>
             New Event
           </Button>
        </div>

        {/* Sync Status area */}
        <div className="px-6 mb-8 flex flex-col gap-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-slate-400">Integrations</Text>
          
          {connectionStatus?.microsoft && (
          <Card 
            className={`p-3 cursor-pointer border-l-4 transition-all ${activeProvider === 'microsoft' ? 'border-l-blue-500 bg-blue-50/50' : 'border-l-transparent hover:bg-slate-50'}`} 
            onClick={() => setActiveProvider('microsoft')}
          >
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 w-full">
                   <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-xs shrink-0">🟦</div>
                   <div className="flex-1 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Microsoft 365</div>
                        <div className="flex items-center gap-1 mt-0.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></div>
                           <span className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">Synced</span>
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
          </Card>
          )}

          {connectionStatus?.google && (
          <Card 
            className={`p-3 cursor-pointer border-l-4 transition-all ${activeProvider === 'google' ? 'border-l-red-500 bg-red-50/50' : 'border-l-transparent hover:bg-slate-50'}`}
            onClick={() => setActiveProvider('google')}
          >
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 w-full">
                   <div className="w-6 h-6 rounded bg-red-100 flex items-center justify-center text-xs shrink-0">🔴</div>
                   <div className="flex-1 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Google Workspace</div>
                        <div className="flex items-center gap-1 mt-0.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></div>
                           <span className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">Synced</span>
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
          </Card>
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
          <Text className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Legend</Text>
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
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-50 flex items-center justify-center">
               <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-8 max-w-sm text-center">
                  <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500">
                     <AlertCircle size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">No Calendar Connected</h3>
                  <p className="text-sm text-slate-500 mb-6">You need to connect a Microsoft 365 or Google Workspace account via Settings to unlock the live Calendar Sync functionalities.</p>
                  <Button onClick={() => window.location.assign('/admin/settings')}>Go to Integrations</Button>
               </div>
            </div>
         )}
         
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
             <Title className="text-slate-800 tracking-tight text-2xl">{format(currentDate, 'MMMM yyyy')}</Title>
             {isValidating && <RefreshCcw size={16} className="animate-spin text-slate-400 ml-2" />}
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-slate-100 p-1 rounded-lg flex shadow-inner">
               <button className="px-4 py-1.5 text-xs font-bold bg-white shadow-sm rounded-md text-slate-800">Month</button>
               <button className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700">Week</button>
            </div>
            <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
              <button onClick={prevMonth} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
              <button onClick={() => setCurrentDate(new Date())} className="px-4 py-1.5 text-xs font-bold bg-white border border-slate-200 shadow-sm rounded-lg text-slate-700 hover:bg-slate-50">Today</button>
              <button onClick={nextMonth} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight size={18} /></button>
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
                     className={`flex flex-col p-2 border-r border-b border-slate-200 relative group cursor-pointer hover:bg-indigo-50/30 transition-colors ${!isCurrentMonth ? 'bg-slate-50/50 opacity-60' : 'bg-white'}`}
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
