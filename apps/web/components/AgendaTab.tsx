'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Title, Text, Badge } from '@tremor/react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, RefreshCcw } from 'lucide-react';
import useSWR from 'swr';
import { useAuth } from '@/lib/AuthContext';
import { getAllMailConnections } from '@/lib/emailIntegrationService';
import { TASKS, ACTIVITIES } from '@/lib/mockData';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const EVENT_COLORS = {
  task: '#6366f1',
  activity: '#10b981',
  governance: '#a78bfa',
  concierge: '#f59e0b',
  calendar: '#3b82f6',
};

export function AgendaTab() {
  const { user, firebaseUser } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [activeProvider, setActiveProvider] = useState<'microsoft' | 'google' | null>(null);
  const [idToken, setIdToken] = useState<string>('');

  useEffect(() => {
    if (user) {
      getAllMailConnections(user.uid).then(conns => {
         if (conns.microsoft) setActiveProvider('microsoft');
         else if (conns.google) setActiveProvider('google');
      });
    }
  }, [user]);

  useEffect(() => {
     if (firebaseUser) {
       firebaseUser.getIdToken().then(setIdToken).catch(() => {});
     }
  }, [firebaseUser]);

  const apiQuery = user && idToken && activeProvider 
    ? `/api/calendar/list?uid=${user.uid}&idToken=${idToken}&provider=${activeProvider}`
    : null;
    
  const { data: calData, isValidating } = useSWR(apiQuery, fetcher, { revalidateOnFocus: false });

  const events = useMemo(() => {
    const all: any[] = [];
    
    // Remote events from connected calendar provider
    if (calData && calData.events) {
       calData.events.forEach((ev: any) => {
          all.push({
             ...ev,
             id: ev.id || Math.random().toString(),
             date: new Date(ev.start),
             title: ev.title || ev.subject || 'Event',
             type: 'calendar',
          });
       });
    }
    
    // Local CRM mock events
    TASKS.forEach(task => {
      all.push({ id: `task-${task.id}`, title: task.title, date: new Date(task.dueDate || new Date()), type: 'task' });
    });
    ACTIVITIES.forEach(act => {
      if (act.activityType === 'meeting' || act.activityType === 'call') {
        all.push({ id: `act-${act.id}`, title: act.subject, date: new Date(act.occurredAt || new Date()), type: 'activity' });
      }
    });

    return all.sort((a,b) => a.date.getTime() - b.date.getTime());
  }, [calData]);

  // Calendar math
  const monthStart = startOfMonth(currentDate);
  const monthEnd   = endOfMonth(monthStart);
  const startDate  = startOfWeek(monthStart);
  const endDate    = endOfWeek(monthEnd);
  const days       = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const selectedDayEvents = events.filter(e => isSameDay(e.date, selectedDate));

  return (
    <div className="flex flex-col h-full bg-[var(--bg-background)] relative overflow-hidden" style={{ minHeight: '400px' }}>
      {/* Mini Calendar Header */}
      <div className="flex items-center justify-between p-4 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2">
           <Title className="text-sm font-bold text-[var(--text-primary)]">{format(currentDate, 'MMMM yyyy')}</Title>
           {isValidating && <RefreshCcw size={12} className="animate-spin text-[var(--text-tertiary)]" />}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded transition-colors"><ChevronLeft size={16} /></button>
          <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }} className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--brand-primary)] px-2 transition-colors">Today</button>
          <button onClick={nextMonth} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Mini Calendar Grid */}
      <div className="bg-[var(--bg-surface)] px-4 border-b border-[var(--border-subtle)] shrink-0 shadow-sm py-2">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-[var(--text-tertiary)]">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const dayEvents = events.filter(e => isSameDay(e.date, day));

            return (
              <div key={day.toISOString()} className="flex justify-center flex-col items-center">
                 <button
                   onClick={() => setSelectedDate(day)}
                   className={`relative flex items-center justify-center w-7 h-7 rounded-sm text-[11px] font-medium transition-all
                     ${!isCurrentMonth ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}
                     ${isSelected ? 'bg-[var(--brand-primary)] text-white shadow-md font-bold hover:brightness-110' : 'hover:bg-[var(--bg-elevated)]'}
                     ${isToday && !isSelected ? 'text-[var(--brand-primary)] font-bold bg-[var(--brand-faint)]' : ''}
                   `}
                 >
                   {format(day, 'd')}
                 </button>
                 <div className="flex gap-[2px] mt-[2px] h-1 w-full justify-center">
                   {dayEvents.slice(0, 3).map((e, i) => (
                     <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: EVENT_COLORS[e.type as keyof typeof EVENT_COLORS] || '#cbd5e1' }} />
                   ))}
                 </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events List for Selected Day */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-1">
          <Text className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{format(selectedDate, 'EEEE, MMM do')}</Text>
          <Badge size="xs" color="slate">{selectedDayEvents.length}</Badge>
        </div>

        {selectedDayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-[var(--text-tertiary)] space-y-3">
            <CalendarIcon size={32} className="opacity-20" />
            <span className="text-[11px] text-center font-medium">No events scheduled.</span>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
             {selectedDayEvents.map(ev => {
                const color = EVENT_COLORS[ev.type as keyof typeof EVENT_COLORS] || '#cbd5e1';
                return (
                  <div key={ev.id} className="p-3 bg-[var(--bg-surface)] w-full rounded-lg shadow-sm border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors cursor-pointer group flex gap-3 items-start relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: color }} />
                    <div className="flex flex-col items-center justify-start text-[var(--text-tertiary)] pt-0.5 pl-1 shrink-0 w-[40px]">
                       <span className="text-[10px] font-bold leading-none mt-0.5 text-center flex flex-col items-center justify-center">
                         {ev.start ? format(new Date(ev.start), 'HH:mm') : <><Clock size={12} className="mb-1" /> All</>}
                       </span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                       <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--brand-primary)] transition-colors" title={ev.title}>{ev.title}</span>
                       <span className="text-[10px] text-[var(--text-secondary)] capitalize">{ev.type}</span>
                    </div>
                  </div>
                );
             })}
          </div>
        )}
      </div>
    </div>
  );
}
