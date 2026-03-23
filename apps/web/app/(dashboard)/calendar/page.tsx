'use client';

import React, { useState, useMemo } from 'react';
import Header from '@/components/Header';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO
} from 'date-fns';
import { useTranslation } from '@/lib/i18n/context';
import { TASKS, ACTIVITIES, GOVERNANCE_MEETINGS, SERVICE_REQUESTS } from '@/lib/mockData';
import { Cloud, RefreshCw, ChevronLeft, ChevronRight, Mail, Calendar as CalendarIcon } from 'lucide-react';

const EVENT_COLORS = {
  task:       { bg: 'rgba(99,102,241,0.12)',  border: '#6366f1',  dot: '#6366f1'  },
  activity:   { bg: 'rgba(16,185,129,0.12)',  border: '#10b981',  dot: '#10b981'  },
  governance: { bg: 'rgba(167,139,250,0.12)', border: '#a78bfa',  dot: '#a78bfa'  },
  concierge:  { bg: 'rgba(245,158,11,0.12)',  border: '#f59e0b',  dot: '#f59e0b'  },
};

export default function CalendarPage() {
  const { t, language } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSyncing, setIsSyncing]     = useState(false);
  const [activeSync, setActiveSync]   = useState<'outlook' | 'google' | null>('outlook');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Consolidate all event-like items
  const events = useMemo(() => {
    const all: any[] = [];

    TASKS.forEach(task => {
      all.push({
        id: `task-${task.id}`,
        title: task.title,
        date: parseISO(task.dueDate || new Date().toISOString()),
        type: 'task',
        priority: task.priority,
        familyName: task.familyName,
      });
    });

    ACTIVITIES.forEach(act => {
      if (act.activityType === 'meeting' || act.activityType === 'call') {
        all.push({
          id: `act-${act.id}`,
          title: act.subject,
          date: parseISO(act.occurredAt || new Date().toISOString()),
          type: 'activity',
          subType: act.activityType,
          familyName: act.familyName,
        });
      }
    });

    GOVERNANCE_MEETINGS.forEach(meet => {
      all.push({
        id: `gov-${meet.id}`,
        title: meet.governanceName,
        date: parseISO(meet.meetingDate),
        type: 'governance',
        familyName: meet.familyName,
      });
    });

    SERVICE_REQUESTS.forEach(req => {
      if (req.targetDate) {
        all.push({
          id: `req-${req.id}`,
          title: req.title,
          date: parseISO(req.targetDate),
          type: 'concierge',
          familyName: req.familyName,
        });
      }
    });

    return all;
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd   = endOfMonth(monthStart);
  const startDate  = startOfWeek(monthStart);
  const endDate    = endOfWeek(monthEnd);
  const days       = eachDayOfInterval({ start: startDate, end: endDate });
  const weeks      = Math.ceil(days.length / 7);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 2000);
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const selectedEvents = selectedDay
    ? events.filter(e => isSameDay(e.date, selectedDay))
    : [];

  return (
    <div className="page" style={{ padding: 0 }}>
      <Header
        title={t('nav.calendar')}
        subtitle="Unified Scheduling & Cloud Integration"
        actions={
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '4px 12px', fontSize: 13,
            }}>
              <Cloud size={14} style={{ color: activeSync === 'outlook' ? '#3b82f6' : 'var(--text-tertiary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Last sync: 10m ago</span>
              <button
                onClick={handleSync}
                style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--brand-400)' }}
              >
                <RefreshCw size={14} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
            <button className="btn btn-primary btn-sm">+ Event</button>
          </div>
        }
      />

      {/* Layout */}
      <div style={{ display: 'flex', height: 'calc(100vh - var(--header-height))', overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <div style={{
          width: 220, borderRight: '1px solid var(--border)',
          background: 'var(--bg-surface)', padding: '20px 16px',
          display: 'flex', flexDirection: 'column', gap: 24,
          overflowY: 'auto', flexShrink: 0,
        }}>
          {/* Integrations */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Cloud Integrations
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { id: 'outlook' as const, icon: '📧', label: 'Outlook M365', sub: 'Connected', color: '#3b82f6' },
                { id: 'google'  as const, icon: '📅', label: 'Google Workspace', sub: 'Disconnected', color: '#ef4444' },
              ].map(s => (
                <div
                  key={s.id}
                  onClick={() => setActiveSync(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                    background: activeSync === s.id ? `${s.color}10` : 'transparent',
                    border: `1px solid ${activeSync === s.id ? `${s.color}44` : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: s.id === 'outlook' ? '#22c55e' : 'var(--text-tertiary)' }}>{s.sub}</div>
                  </div>
                  {activeSync === s.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, marginLeft: 'auto' }} />}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Legend
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(EVENT_COLORS).map(([type, c]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                  <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected day events */}
          {selectedDay && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                {format(selectedDay, 'MMM d')}
              </div>
              {selectedEvents.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No events</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedEvents.map(ev => {
                    const c = EVENT_COLORS[ev.type as keyof typeof EVENT_COLORS] ?? EVENT_COLORS.task;
                    return (
                      <div key={ev.id} style={{
                        fontSize: 11, padding: '6px 9px', borderRadius: 6,
                        background: c.bg, borderLeft: `3px solid ${c.border}`,
                        color: 'var(--text-primary)', lineHeight: 1.4,
                      }}>
                        <div style={{ fontWeight: 600 }}>{ev.title}</div>
                        {ev.familyName && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{ev.familyName}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Calendar main ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)', minWidth: 0 }}>
          {/* Month nav */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 24px', borderBottom: '1px solid var(--border)',
            background: 'var(--bg-surface)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 2 }}>
                {['Month', 'Week', 'Day'].map((v, i) => (
                  <button key={v} className={`btn btn-ghost btn-sm`} style={{ minWidth: 52, fontSize: 11, opacity: i > 0 ? 0.4 : 1 }}>{v}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={prevMonth} className="icon-btn btn-sm"><ChevronLeft size={16} /></button>
                <button onClick={() => setCurrentDate(new Date())} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>Today</button>
                <button onClick={nextMonth} className="icon-btn btn-sm"><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>

          {/* Grid — flex column fills remaining height exactly */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Day labels row */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
              background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
            }}>
              {dayLabels.map(label => (
                <div key={label} style={{
                  padding: '8px 0', textAlign: 'center',
                  fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Day cells — each row gets equal slice of remaining height */}
            <div style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridTemplateRows: `repeat(${weeks}, 1fr)`,
              gap: 0,
              overflow: 'hidden',
            }}>
              {days.map((day, idx) => {
                const dayEvents = events.filter(e => isSameDay(e.date, day));
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isToday  = isSameDay(day, new Date());
                const isSel    = selectedDay && isSameDay(day, selectedDay);
                const MAX_VIS  = 3;

                return (
                  <div
                    key={day.toString()}
                    onClick={() => setSelectedDay(isSel ? null : day)}
                    style={{
                      background:
                        isSel       ? 'var(--brand-900)' :
                        isToday     ? 'var(--bg-elevated)' :
                        isCurrentMonth ? 'var(--bg-canvas)' : 'var(--bg-surface)',
                      padding: '6px 8px',
                      display: 'flex', flexDirection: 'column', gap: 3,
                      opacity: isCurrentMonth ? 1 : 0.35,
                      border: isSel ? `1px solid var(--brand-500)` : isToday ? `1px solid var(--brand-500)44` : '1px solid var(--border)',
                      cursor: 'pointer', overflow: 'hidden',
                      transition: 'background 0.12s',
                    }}
                  >
                    <span style={{
                      fontSize: 12, fontWeight: isToday ? 800 : 500,
                      color: isToday ? 'var(--brand-400)' : 'var(--text-secondary)',
                      lineHeight: 1,
                    }}>
                      {format(day, 'd')}
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden' }}>
                      {dayEvents.slice(0, MAX_VIS).map(event => {
                        const c = EVENT_COLORS[event.type as keyof typeof EVENT_COLORS] ?? EVENT_COLORS.task;
                        return (
                          <div
                            key={event.id}
                            title={`${event.title} · ${event.familyName}`}
                            style={{
                              fontSize: 9, padding: '1px 5px', borderRadius: 3,
                              background: c.bg, borderLeft: `2px solid ${c.border}`,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              lineHeight: 1.4,
                            }}
                          >
                            {event.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > MAX_VIS && (
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', paddingLeft: 3 }}>
                          +{dayEvents.length - MAX_VIS} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
