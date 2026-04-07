'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { LayoutDashboard, Layers, List, BarChart2 } from 'lucide-react';
import { SecondaryDock, type SecondaryDockTab } from '@/components/SecondaryDock';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import { TASK_TYPES } from '@/lib/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import type { Task } from '@/lib/types';
import { LiveModeGate, TasksEmptyState } from '@/components/LiveModeGate';
import { CommunicationPanel } from '@/components/CommunicationPanel';
import ReactECharts from 'echarts-for-react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { useAuth } from '@/lib/AuthContext';
import { getTenantMembers } from '@/lib/tenantMemberService';
import { getAllOrgs } from '@/lib/crmService';
import { getEmployees } from '@/lib/hrService';

function useIsPlatform() {
  const [isPlatform, setIsPlatform] = useState(false);
  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
      if (t?.id === 'platform') setIsPlatform(true);
    } catch { /* ignore */ }
  }, []);
  return isPlatform;
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = 'title' | 'family' | 'priority' | 'due' | 'status' | 'queue' | 'assignee' | 'time';
type SortDir = 'asc' | 'desc';

function sortTasks(tasks: Task[], key: SortKey, dir: SortDir, queues: any[], getTime: (id: string) => number): Task[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let va: any, vb: any;
    switch (key) {
      case 'title':    va = a.title.toLowerCase();         vb = b.title.toLowerCase(); break;
      case 'family':   va = a.familyName.toLowerCase();    vb = b.familyName.toLowerCase(); break;
      case 'priority': va = PRIORITY_ORDER[a.priority] ?? 99; vb = PRIORITY_ORDER[b.priority] ?? 99; break;
      case 'due':      va = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;  vb = b.dueDate ? new Date(b.dueDate).getTime() : Infinity; break;
      case 'status':   va = a.status.toLowerCase();        vb = b.status.toLowerCase(); break;
      case 'queue': {
        const qa = queues.find((q: any) => q.id === a.queueId)?.name ?? '';
        const qb = queues.find((q: any) => q.id === b.queueId)?.name ?? '';
        va = qa.toLowerCase(); vb = qb.toLowerCase(); break;
      }
      case 'assignee': va = (a.assignedUserName ?? '').toLowerCase(); vb = (b.assignedUserName ?? '').toLowerCase(); break;
      case 'time':     va = getTime(a.id); vb = getTime(b.id); break;
      default:         return 0;
    }
    if (va < vb) return -1 * factor;
    if (va > vb) return  1 * factor;
    return 0;
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444', high: '#f59e0b', normal: '#22d3ee', low: '#64748b',
};
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function SlaChip({ task }: { task: Task }) {
  if (!task.slaBreached) return null;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
      background: 'rgba(239,68,68,0.12)', color: '#ef4444',
      border: '1px solid rgba(239,68,68,0.3)',
      animation: 'pulse 2s infinite',
      letterSpacing: '0.05em',
    }}>
      ⚠ SLA +{task.slaBreachMinutes}m
    </span>
  );
}

function AssigneeChip({ task }: { task: Task }) {
  if (task.assignedUserName) {
    const initials = task.assignedUserName.split(' ').map(n => n[0]).join('').slice(0, 2);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%', fontSize: 9, fontWeight: 700,
          background: 'linear-gradient(135deg,var(--brand-600),var(--brand-400))',
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{initials}</div>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{task.assignedUserName.split(' ')[0]}</span>
      </div>
    );
  }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
      background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
      border: '1px solid rgba(245,158,11,0.3)',
    }}>
      Unassigned
    </span>
  );
}

function TimeTracker({ task }: { task: Task }) {
  const { activeClockItem, clockElapsedSec, startClock, stopClock, getTaskTime } = useTaskQueue();
  const isActive = activeClockItem?.id === task.id;
  const totalMin = getTaskTime(task.id);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {totalMin > 0 && (
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          ⏱ {fmt(totalMin)}
        </span>
      )}
      {isActive ? (
        <button
          onClick={(e) => { e.stopPropagation(); stopClock(task.id); }}
          style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
            background: 'rgba(239,68,68,0.12)', color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            animation: 'pulse 2s infinite',
          }}
        >
          ⏹ {formatElapsed(clockElapsedSec)}
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); startClock({ id: task.id, type: 'task', name: task.title }); }}
          title="Start time tracking"
          style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
            background: 'rgba(34,197,94,0.1)', color: '#22c55e',
            border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer',
            opacity: task.status === 'completed' ? 0.3 : 1,
          }}
          disabled={task.status === 'completed'}
        >
          ▶ Track
        </button>
      )}
    </div>
  );
}

function QueueChip({ queueId }: { queueId: string }) {
  const { queues } = useTaskQueue();
  const q = queues.find(x => x.id === queueId);
  if (!q) return null;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
      background: `${q.color}18`, color: q.color,
      border: `1px solid ${q.color}44`,
    }}>
      {q.icon} {q.name}
    </span>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, draggable, onClick, onDragStart, onDragEnd }: {
  task: Task;
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?:   (e: React.DragEvent) => void;
}) {
  const taskType = TASK_TYPES.find(t => t.id === task.taskTypeId);
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  return (
    <div
      draggable={draggable}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${task.slaBreached ? 'rgba(239,68,68,0.35)' : 'var(--border)'}`,
        borderLeft: `3px solid ${PRIORITY_COLOR[task.priority]}`,
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        cursor: draggable ? 'grab' : 'default',
        boxShadow: task.slaBreached ? '0 0 0 1px rgba(239,68,68,0.15)' : 'var(--shadow-sm)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Row 1: Type icon + title */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {taskType && (
          <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{taskType.icon}</span>
        )}
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, flex: 1 }}>
          {task.title}
        </div>
      </div>

      {/* Row 2: Queue chip + SLA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {task.queueId && <QueueChip queueId={task.queueId} />}
        <SlaChip task={task} />
        {task.source === 'email_ai' && (
          <span className="badge badge-brand" style={{ fontSize: 9, padding: '1px 6px' }}>AI</span>
        )}
      </div>

      {task.description && (
        <div style={{
          fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{task.description}</div>
      )}

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'var(--brand-400)', fontWeight: 600 }}>{task.familyName}</span>
          {task.dueDate && (
            <span style={{ fontSize: 10, color: isOverdue ? '#ef4444' : 'var(--text-tertiary)' }}>
              📅 {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              {isOverdue ? ' ⚠' : ''}
            </span>
          )}
        </div>
        <AssigneeChip task={task} />
      </div>

      {/* Time tracker */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <TimeTracker task={task} />
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
          {taskType?.name ?? task.priority}
        </span>
      </div>
    </div>
  );
}

// ─── Analytics View ───────────────────────────────────────────────────────────

function AnalyticsView() {
  const isPlatform = useIsPlatform();
  const { getTimeByFamily, getTimeByUser, getTimeByActivity, tasks, queues, timeEntries } = useTaskQueue();
  const byFamily   = getTimeByFamily();
  const byUser     = getTimeByUser();
  const byActivity = getTimeByActivity();
  const totalMin   = timeEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);

  const queueLoad = queues.map(q => ({
    label: q.name,
    value: tasks.filter(t => t.queueId === q.id && t.status !== 'completed').length,
    color: q.color,
  }));

  const ACTIVITY_LABELS: Record<string, string> = {
    email: 'Email', call: 'Call', meeting: 'Meeting', note: 'Research / Notes',
    task_completed: 'Task Completed', document_shared: 'Document', capital_call: 'Capital Call',
  };

  // ECharts Configurations
  const familyOptions = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} mins' },
    series: [{
      type: 'treemap',
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      data: byFamily.map(f => ({ name: f.familyName, value: f.minutes, itemStyle: { color: f.minutes > 60 ? '#6366f1' : '#10b981' } })),
    }]
  };

  const userBarOptions = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: 'Minutes' },
    yAxis: { type: 'category', data: byUser.map(u => u.userName) },
    series: [{
      name: 'Time Logged',
      type: 'bar',
      data: byUser.map(u => u.minutes),
      itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] }
    }]
  };

  const activityPieOptions = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} mins ({d}%)' },
    legend: { bottom: '0%', left: 'center' },
    series: [{
      name: 'Activity',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false, position: 'center' },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
      labelLine: { show: false },
      data: byActivity.map(a => ({ name: ACTIVITY_LABELS[a.activityType] ?? a.activityType, value: a.minutes }))
    }]
  };

  const queueLoadOptions = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: queueLoad.map(q => q.label) },
    yAxis: { type: 'value', name: 'Open Tasks' },
    series: [{
      name: 'Tasks',
      type: 'bar',
      data: queueLoad.map(q => ({ value: q.value, itemStyle: { color: q.color } })),
      itemStyle: { borderRadius: [4, 4, 0, 0] }
    }]
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        {[
          { label: 'Total Hours Logged', value: fmt(totalMin), icon: '⏱' },
          { label: 'Open Tasks', value: tasks.filter(t => t.status === 'open').length, icon: '⭕' },
          { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, icon: '🔄' },
          { label: 'SLA Breaches', value: tasks.filter(t => t.slaBreached).length, icon: '⚠', alert: true },
          { label: 'Unassigned', value: tasks.filter(t => !t.assignedUserId && t.status !== 'completed').length, icon: '👤', alert: true },
        ].map(kpi => (
          <div key={kpi.label} style={{
            padding: '18px 20px', background: 'var(--bg-surface)', border: `1px solid ${kpi.alert ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{kpi.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: kpi.alert && Number(kpi.value.toString().replace(/[^0-9.-]+/g,"")) > 0 ? '#ef4444' : 'var(--text-primary)' }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20 }}>⏱ Time by {isPlatform ? 'Entity' : 'Family'}</div>
          {byFamily.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-canvas)', borderRadius: 8 }}>No time logged yet</div>
          ) : (
            <ReactECharts option={familyOptions} style={{ height: '300px' }} />
          )}
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20 }}>👤 Time by Team Member</div>
          {byUser.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-canvas)', borderRadius: 8 }}>No time logged yet</div>
          ) : (
            <ReactECharts option={userBarOptions} style={{ height: '300px' }} />
          )}
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20 }}>🗂 Time by Activity Type</div>
          {byActivity.length === 0 ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-canvas)', borderRadius: 8 }}>No time logged yet</div>
          ) : (
            <ReactECharts option={activityPieOptions} style={{ height: '300px' }} />
          )}
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 20 }}>📋 Open Tasks by Queue</div>
          <ReactECharts option={queueLoadOptions} style={{ height: '300px' }} />
        </div>
      </div>
    </div>
  );
}

// ─── Queue View — with collapsible columns ────────────────────────────────────

function QueueView({ tasks, onSelectTask }: { tasks: Task[]; onSelectTask: (task: Task) => void }) {
  const { queues, acceptTask } = useTaskQueue();
  // Set of collapsed queue IDs
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
      {queues.map(q => {
        const qTasks    = tasks.filter(t => t.queueId === q.id && t.status !== 'completed');
        const unassigned = qTasks.filter(t => !t.assignedUserId);
        const isCollapsed = collapsed.has(q.id);
        const breaches    = qTasks.filter(t => t.slaBreached);

        return (
          <div
            key={q.id}
            style={{
              // Collapsed: narrow vertical strip; expanded: full width column
              width: isCollapsed ? 44 : 300,
              flexShrink: 0,
              background: 'var(--bg-surface)',
              border: `1px solid ${q.color}33`,
              borderTop: `3px solid ${q.color}`,
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
              display: 'flex',
              flexDirection: isCollapsed ? 'column' : 'column',
            }}
          >
            {/* ── Column header ── */}
            {isCollapsed ? (
              /* Vertical strip when collapsed */
              <div
                onClick={() => toggle(q.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '16px 0',
                  cursor: 'pointer',
                  gap: 8,
                  userSelect: 'none',
                  flex: 1,
                  minHeight: 200,
                }}
                title={`Expand ${q.name} (${qTasks.length} tasks)`}
              >
                {/* Expand chevron */}
                <span style={{ fontSize: 12, color: q.color, transform: 'rotate(-90deg)', display: 'inline-block' }}>▲</span>
                {/* Count bubble */}
                <span style={{
                  fontSize: 10, fontWeight: 800, width: 22, height: 22,
                  borderRadius: '50%', background: `${q.color}22`, color: q.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {qTasks.length}
                </span>
                {/* Label — rotated 90° */}
                <div style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                  fontSize: 11, fontWeight: 700, color: 'var(--text-primary)',
                  whiteSpace: 'nowrap', marginTop: 4,
                }}>
                  {q.icon} {q.name}
                </div>
                {/* SLA warning dot */}
                {breaches.length > 0 && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#ef4444',
                    animation: 'pulse 2s infinite',
                    marginTop: 4,
                  }} />
                )}
              </div>
            ) : (
              /* Full header when expanded */
              <div style={{ padding: '14px 16px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
                    <span>{q.icon}</span>
                    <span>{q.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {unassigned.length > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                        background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                        border: '1px solid rgba(245,158,11,0.3)',
                      }}>
                        {unassigned.length} unassigned
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
                    }}>{qTasks.length}</span>
                    {/* Collapse button */}
                    <button
                      onClick={() => toggle(q.id)}
                      title="Collapse column"
                      style={{
                        width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)',
                        background: 'var(--bg-elevated)', color: 'var(--text-tertiary)',
                        cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                    >
                      ‹‹
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                  Pick-up SLA: {q.assignSlaMinutes < 60 ? `${q.assignSlaMinutes}m` : `${q.assignSlaMinutes / 60}h`}
                  {breaches.length > 0 && (
                    <span style={{ marginLeft: 8, color: '#ef4444', fontWeight: 700 }}>
                      ⚠ {breaches.length} breach{breaches.length !== 1 ? 'es' : ''}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── Task cards (only when expanded) ── */}
            {!isCollapsed && (
              <div style={{
                padding: '0 12px 16px',
                display: 'flex', flexDirection: 'column', gap: 10,
                overflowY: 'auto', maxHeight: 'calc(100vh - 280px)',
              }}>
                {qTasks.length === 0 ? (
                  <div style={{
                    border: '1px dashed var(--border)', borderRadius: 12, height: 60,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-tertiary)', fontSize: 12,
                  }}>
                    Queue empty
                  </div>
                ) : qTasks.map(task => (
                  <div key={task.id} style={{ position: 'relative' }}>
                    <TaskCard task={task} onClick={() => onSelectTask(task)} />
                    {!task.assignedUserId && (
                      <button
                        onClick={() => acceptTask(task.id, 'usr-rm-001', 'Alexandra Torres')}
                        style={{
                          position: 'absolute', bottom: 10, right: 10,
                          fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                          background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: 'white',
                          border: 'none', cursor: 'pointer',
                        }}
                      >
                        Accept ✓
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Board View ───────────────────────────────────────────────────────────────

function BoardView({ tasks, onSelectTask }: { tasks: Task[]; onSelectTask: (task: Task) => void }) {
  const { updateTask } = useTaskQueue();

  const handleDrop = (e: React.DragEvent, status: 'open' | 'in_progress' | 'completed') => {
    e.preventDefault();
    const id = e.dataTransfer.getData('taskId');
    if (id) updateTask(id, { status });
  };

  const cols = [
    { id: 'open',        icon: '⭕', label: 'To Do' },
    { id: 'in_progress', icon: '🔄', label: 'In Progress' },
    { id: 'completed',   icon: '✅', label: 'Done' },
  ];

  return (
    <div style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 16 }}>
      {cols.map(col => {
        const items = tasks.filter(t => t.status === col.id);
        return (
          <div
            key={col.id}
            style={{ flex: 1, minWidth: 320, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 16 }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => handleDrop(e, col.id as any)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {col.icon} {col.label}
              </span>
              <span style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                {items.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 120 }}>
              {items.map(task => (
                <TaskCard
                  key={task.id} task={task} draggable
                  onClick={() => onSelectTask(task)}
                  onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
                  onDragEnd={e => e.currentTarget.classList.remove('dragging')}
                />
              ))}
              {items.length === 0 && (
                <div style={{ border: '1px dashed var(--border)', borderRadius: 12, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List View — with sortable columns & advanced filters ─────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span style={{
      display: 'inline-flex', flexDirection: 'column',
      gap: 1, marginLeft: 4, opacity: active ? 1 : 0.3,
      verticalAlign: 'middle',
    }}>
      <span style={{ fontSize: 7, lineHeight: 1, color: active && dir === 'asc'  ? 'var(--brand-400)' : 'currentColor' }}>▲</span>
      <span style={{ fontSize: 7, lineHeight: 1, color: active && dir === 'desc' ? 'var(--brand-400)' : 'currentColor' }}>▼</span>
    </span>
  );
}

function ListView({ tasks: allTasks, onSelectTask }: { tasks: Task[]; onSelectTask: (task: Task) => void }) {
  const isPlatform = useIsPlatform();
  const { queues, getTaskTime } = useTaskQueue();

  // ── Column sort state ──────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sh = (key: SortKey, label: string) => (
    <th
      onClick={() => handleSort(key)}
      style={{
        padding: '10px 14px', fontSize: 10, fontWeight: 600,
        color: sortKey === key ? 'var(--brand-400)' : 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        textAlign: 'left', whiteSpace: 'nowrap', cursor: 'pointer',
        userSelect: 'none',
        borderBottom: `2px solid ${sortKey === key ? 'var(--brand-500)' : 'transparent'}`,
        transition: 'color 0.15s',
      }}
    >
      {label}<SortIcon active={sortKey === key} dir={sortDir} />
    </th>
  );

  // ── Advanced filter state ──────────────────────────────────────────────────
  const [showFilters, setShowFilters]   = useState(false);
  const [fStatus,     setFStatus]       = useState('All');
  const [fAssignee,   setFAssignee]     = useState('All');
  const [fSla,        setFSla]          = useState('All');     // 'All' | 'breached' | 'ok'
  const [fOverdue,    setFOverdue]      = useState(false);
  const [fDueFrom,    setFDueFrom]      = useState('');
  const [fDueTo,      setFDueTo]        = useState('');
  const [fTaskType,   setFTaskType]     = useState('All');

  // Derive filter option lists from the incoming task set (so they stay contextual)
  const assignees  = useMemo(() => [...new Set(allTasks.filter(t => t.assignedUserName).map(t => t.assignedUserName!))].sort(), [allTasks]);
  const taskTypes  = useMemo(() => [...new Set(allTasks.map(t => t.taskTypeId).filter(Boolean))], [allTasks]);

  // Count active advanced filters for the badge
  const advancedActiveCount = [fStatus !== 'All', fAssignee !== 'All', fSla !== 'All', fOverdue, !!fDueFrom, !!fDueTo, fTaskType !== 'All'].filter(Boolean).length;

  function clearAdvanced() {
    setFStatus('All'); setFAssignee('All'); setFSla('All');
    setFOverdue(false); setFDueFrom(''); setFDueTo(''); setFTaskType('All');
  }

  // ── Apply advanced filters then sort ──────────────────────────────────────
  const visible = useMemo(() => {
    const now = new Date();
    const filtered = allTasks.filter(t => {
      if (fStatus !== 'All'   && t.status   !== fStatus)             return false;
      if (fAssignee !== 'All' && t.assignedUserName !== fAssignee
          && !(fAssignee === '_unassigned' && !t.assignedUserId))    return false;
      if (fSla === 'breached' && !t.slaBreached)                     return false;
      if (fSla === 'ok'       &&  t.slaBreached)                     return false;
      if (fOverdue && !(t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed')) return false;
      if (fDueFrom && t.dueDate && new Date(t.dueDate) < new Date(fDueFrom)) return false;
      if (fDueTo   && t.dueDate && new Date(t.dueDate) > new Date(fDueTo))   return false;
      if (fTaskType !== 'All' && t.taskTypeId !== fTaskType)         return false;
      return true;
    });
    return sortTasks(filtered, sortKey, sortDir, queues, getTaskTime);
  }, [allTasks, fStatus, fAssignee, fSla, fOverdue, fDueFrom, fDueTo, fTaskType, sortKey, sortDir, queues, getTaskTime]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const selectStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 6,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Toolbar row ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        borderBottom: 'none', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
          {visible.length} of {allTasks.length} tasks
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {advancedActiveCount > 0 && (
            <button
              onClick={clearAdvanced}
              style={{ fontSize: 11, color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Clear filters ({advancedActiveCount})
            </button>
          )}
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: showFilters ? 'var(--brand-500)' : 'var(--bg-elevated)',
              border: `1px solid ${showFilters ? 'var(--brand-500)' : 'var(--border)'}`,
              color: showFilters ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            ⚙ Advanced Filters
            {advancedActiveCount > 0 && (
              <span style={{
                background: 'var(--brand-500)', color: 'white',
                borderRadius: '50%', width: 16, height: 16, fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{advancedActiveCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Advanced filter panel ───────────────────────────────────────────── */}
      {showFilters && (
        <div style={{
          padding: '16px 20px', background: 'var(--bg-surface)',
          border: '1px solid var(--border)', borderBottom: 'none',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14,
        }}>
          {/* Status */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Status</label>
            <select style={selectStyle} value={fStatus} onChange={e => setFStatus(e.target.value)}>
              <option value="All">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Assignee */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Assignee</label>
            <select style={selectStyle} value={fAssignee} onChange={e => setFAssignee(e.target.value)}>
              <option value="All">All team members</option>
              <option value="_unassigned">Unassigned only</option>
              {assignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* SLA */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>SLA Status</label>
            <select style={selectStyle} value={fSla} onChange={e => setFSla(e.target.value)}>
              <option value="All">All</option>
              <option value="breached">Breached only</option>
              <option value="ok">Within SLA</option>
            </select>
          </div>

          {/* Task Type */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Task Type</label>
            <select style={selectStyle} value={fTaskType} onChange={e => setFTaskType(e.target.value)}>
              <option value="All">All types</option>
              {taskTypes.map(id => {
                const tt = TASK_TYPES.find(t => t.id === id);
                return <option key={id} value={id}>{tt ? `${tt.icon} ${tt.name}` : id}</option>;
              })}
            </select>
          </div>

          {/* Due from */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Due — From</label>
            <input type="date" style={{ ...selectStyle, width: '100%' }} value={fDueFrom} onChange={e => setFDueFrom(e.target.value)} />
          </div>

          {/* Due to */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Due — To</label>
            <input type="date" style={{ ...selectStyle, width: '100%' }} value={fDueTo} onChange={e => setFDueTo(e.target.value)} />
          </div>

          {/* Overdue toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>Overdue Only</label>
            <button
              onClick={() => setFOverdue(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: fOverdue ? '#ef444415' : 'var(--bg-elevated)',
                border: `1px solid ${fOverdue ? '#ef4444' : 'var(--border)'}`,
                color: fOverdue ? '#ef4444' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 14, height: 14, borderRadius: 3,
                background: fOverdue ? '#ef4444' : 'transparent',
                border: `2px solid ${fOverdue ? '#ef4444' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {fOverdue && <span style={{ fontSize: 9, color: 'white', fontWeight: 900 }}>✓</span>}
              </div>
              Overdue tasks
            </button>
          </div>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ overflow: 'auto', borderRadius: showFilters ? '0 0 var(--radius-lg) var(--radius-lg)' : 'var(--radius-lg)', marginTop: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-surface)' }}>
              {sh('title',    'Task')}
              {sh('queue',    'Queue')}
              {sh('assignee', 'Assignee')}
              {sh('family',   isPlatform ? 'Entity' : 'Family')}
              {sh('priority', 'Priority')}
              {sh('due',      'Due Date')}
              {sh('time',     'Time Logged')}
              {sh('status',   'Status')}
              <th style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap' }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                  No tasks match the current filters.
                </td>
              </tr>
            )}
            {visible.map(task => {
              const q = queues.find(q => q.id === task.queueId);
              const taskType = TASK_TYPES.find(t => t.id === task.taskTypeId);
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
              return (
                <tr
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Task */}
                  <td style={{ padding: '12px 14px', maxWidth: 260 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        {taskType && <span style={{ flexShrink: 0 }}>{taskType.icon}</span>}
                        <span>{task.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {task.slaBreached && <SlaChip task={task} />}
                        {task.source === 'email_ai' && <span className="badge badge-brand" style={{ fontSize: 9, padding: '1px 5px' }}>AI</span>}
                      </div>
                    </div>
                  </td>

                  {/* Queue */}
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    {q ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: q.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: q.color, display: 'inline-block', flexShrink: 0 }} />
                        {q.name}
                      </span>
                    ) : <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>—</span>}
                  </td>

                  {/* Assignee */}
                  <td style={{ padding: '12px 14px' }}>
                    <AssigneeChip task={task} />
                  </td>

                  {/* Family */}
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--brand-400)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {task.familyName}
                  </td>

                  {/* Priority */}
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: `${PRIORITY_COLOR[task.priority]}18`,
                      color: PRIORITY_COLOR[task.priority],
                      border: `1px solid ${PRIORITY_COLOR[task.priority]}44`,
                      textTransform: 'capitalize', whiteSpace: 'nowrap',
                    }}>
                      {task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟠' : task.priority === 'normal' ? '🔵' : '⚫'} {task.priority}
                    </span>
                  </td>

                  {/* Due date */}
                  <td style={{ padding: '12px 14px', fontSize: 12, color: isOverdue ? '#ef4444' : 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: isOverdue ? 700 : 400 }}>
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    {isOverdue && ' ⚠'}
                  </td>

                  {/* Time tracked */}
                  <td style={{ padding: '12px 14px' }}>
                    <TimeTracker task={task} />
                  </td>

                  {/* Status */}
                  <td style={{ padding: '12px 14px' }}>
                    <StatusBadge status={task.status} />
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      ···
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function TaskDropdowns({ task }: { task: Task }) {
  const isPlatform = useIsPlatform();
  const { tenant } = useAuth();
  const { updateTask } = useTaskQueue();
  
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [families, setFamilies] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;
    
    // Fetch members (Tenant members)
    getTenantMembers(tenant.id).then(res => {
      setMembers(res.map(r => ({ id: r.uid, name: r.displayName || r.email })));
    }).catch(console.error);

    // Fetch HR employees
    getEmployees().then(res => {
      setEmployees(res.map(r => ({ id: r.id, name: r.name })));
    }).catch(console.error);

    // Fetch platform orgs/families
    if (isPlatform) {
      getAllOrgs().then(res => {
        setFamilies(res.map(r => ({ id: r.id, name: r.name })));
      }).catch(console.error);
    } else {
      // Stub: in real non-platform tenants we'd fetch from their specific family service
      // For now, allow dynamic switching if possible
    }
  }, [tenant?.id, isPlatform]);

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 'var(--radius-md)',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer',
    width: '100%'
  };

  const handleAssigneeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      updateTask(task.id, { assignedUserId: '', assignedUserName: '', assignedTo: '' });
      return;
    }
    // Attempt to match from members, then employees
    const mem = members.find(m => m.id === val);
    if (mem) {
      updateTask(task.id, { assignedUserId: mem.id, assignedUserName: mem.name, assignedTo: mem.name });
      return;
    }
    const emp = employees.find(ep => ep.id === val);
    if (emp) {
      updateTask(task.id, { assignedUserId: emp.id, assignedUserName: emp.name, assignedTo: emp.name });
    }
  };

  const handleFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const fam = families.find(f => f.id === val);
    if (fam) {
      updateTask(task.id, { familyId: fam.id, familyName: fam.name });
    }
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateTask(task.id, { dueDate: e.target.value ? new Date(e.target.value).toISOString() : '' });
  };

  return (
    <>
      <div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
          {isPlatform ? 'Entity' : 'Family'}
        </span>
        {isPlatform && families.length > 0 ? (
           <select style={selectStyle} value={task.familyId || ''} onChange={handleFamilyChange}>
             <option value="">-- Select {isPlatform ? 'Entity' : 'Family'} --</option>
             {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
           </select>
        ) : (
           <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-400)' }}>{task.familyName}</span>
        )}
      </div>
      <div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Assignee</span>
        <select style={selectStyle} value={task.assignedUserId || task.assignedUserName || ''} onChange={handleAssigneeChange}>
          <option value="">Unassigned</option>
          {members.length > 0 && (
            <optgroup label="Tenant Members">
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </optgroup>
          )}
          {employees.length > 0 && (
            <optgroup label="Employees (HR)">
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </optgroup>
          )}
          {/* Fallback if assigned user is not in our loaded lists */}
          {task.assignedUserName && !members.some(m => m.id === task.assignedUserId) && !employees.some(e => e.id === task.assignedUserId) && (
            <option value={task.assignedUserId || task.assignedUserName}>{task.assignedUserName}</option>
          )}
        </select>
      </div>
      <div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Due Date</span>
        <input 
          type="date" 
          style={selectStyle} 
          value={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ''} 
          onChange={handleDueDateChange} 
        />
      </div>
    </>
  );
}

function TaskDetailView({ task, onClose }: { task: Task; onClose: () => void }) {
  const isPlatform = useIsPlatform();
  const { queues } = useTaskQueue();
  const q = queues.find(x => x.id === task.queueId);
  const taskType = TASK_TYPES.find(t => t.id === task.taskTypeId);
  
  const { setTitle } = usePageTitle();
  
  useEffect(() => {
    setTitle('Workflows', '', [
      { label: 'Queues', onClick: onClose },
      { label: task.title }
    ]);
    return () => {
      setTitle('Workflows', '', []);
    };
  }, [task.title, onClose, setTitle]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: 24, flex: 1, minHeight: 0 }}>
        {/* Left Col: Task Details */}
        <div style={{ paddingRight: 8, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              {taskType && <span style={{ fontSize: 24 }}>{taskType.icon}</span>}
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{task.title}</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={task.status} />
              <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `${PRIORITY_COLOR[task.priority]}18`, color: PRIORITY_COLOR[task.priority], border: `1px solid ${PRIORITY_COLOR[task.priority]}44`, textTransform: 'capitalize' }}>
                {task.priority} Priority
              </span>
              {q && (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `${q.color}18`, color: q.color, border: `1px solid ${q.color}44` }}>
                  {q.icon} {q.name}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>Description</h3>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {task.description || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No description provided.</span>}
            </div>
          </div>

          <div className="rounded-tremor-default border border-tremor-border bg-tremor-background shadow-tremor-card p-6" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
              <TaskDropdowns task={task} />
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Created</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{new Date(task.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Communication Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <CommunicationPanel 
            familyId={task.familyId} 
            familyName={task.familyName} 
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = 'board' | 'queue' | 'list' | 'analytics';

export default function TasksPage() {
  const { setTitle } = usePageTitle();
  const isPlatform = useIsPlatform();
  const { tasks, queues } = useTaskQueue();

  const [view,           setView]           = useState<ViewMode>('board');
  const [selectedTask,   setSelectedTask]   = useState<Task | null>(null);
  const handleCloseTask = useCallback(() => setSelectedTask(null), []);
  const [search,         setSearch]         = useState('');
  const [familyFilter,   setFamilyFilter]   = useState('All');
  const [queueFilter,    setQueueFilter]    = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Global filters applied to all views; ListView has its own additional layer
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const q  = search === '' || t.title.toLowerCase().includes(search.toLowerCase()) || (t.description ?? '').toLowerCase().includes(search.toLowerCase());
      
      let fq = true;
      if (familyFilter !== 'All') {
        if (isPlatform) {
          if (familyFilter === 'Organizations') fq = !!t.linkedOrgId;
          else if (familyFilter === 'Contacts') fq = !!t.linkedContactId;
          else if (familyFilter === 'Tickets') fq = t.linkedRecordType === 'ticket';
        } else {
          fq = t.familyName === familyFilter;
        }
      }

      const qq = queueFilter  === 'All'   || t.queueId    === queueFilter;
      const pq = priorityFilter === 'All' || t.priority   === priorityFilter;
      return q && fq && qq && pq;
    });
    // Note: ListView sorts itself; other views sort by priority
  }, [tasks, search, familyFilter, queueFilter, priorityFilter, isPlatform]);

  const filteredSorted = useMemo(() =>
    [...filtered].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
  [filtered]);

  const breachCount = tasks.filter(t => t.slaBreached && t.status !== 'completed').length;
  const unassigned  = tasks.filter(t => !t.assignedUserId && t.status !== 'completed').length;
  const families    = [...new Set(tasks.map(t => t.familyName))];

  const hasGlobalFilters = search || familyFilter !== 'All' || queueFilter !== 'All' || priorityFilter !== 'All';
  const MAIN_TABS: SecondaryDockTab[] = [
    { id: 'board', label: 'Board', icon: LayoutDashboard },
    { id: 'queue', label: 'Queues', icon: Layers },
    { id: 'list', label: 'List', icon: List },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  ];

  useEffect(() => {
    if (!selectedTask) {
      setTitle('Workflows', 'Task Queues', undefined);
    }
  }, [setTitle, selectedTask]);

  // Views — Board & Queue get priority-sorted list; List manages its own sort
  if (selectedTask) {
    return (
      <LiveModeGate emptyState={<TasksEmptyState />} hasLiveData={tasks.length > 0}>
        <div className="flex flex-col absolute inset-0 overflow-y-auto bg-canvas z-0">
          <div className="page animate-fade-in" style={{ width: '100%', padding: '0 24px', paddingBottom: 60 }}>
          <TaskDetailView task={selectedTask} onClose={handleCloseTask} />
        </div>
      </div>
      </LiveModeGate>
    );
  }

  return (
    <LiveModeGate emptyState={<TasksEmptyState />} hasLiveData={tasks.length > 0}>
    <div className="flex flex-col absolute inset-0 overflow-hidden bg-canvas z-0">
      <SecondaryDock tabs={MAIN_TABS as any} activeTab={view} onTabChange={setView as any} />
      <main className="flex-1 flex flex-col min-h-0 relative animate-fade-in px-4 lg:px-8 pt-6 pb-12 overflow-y-auto w-full">
        {/* Page Header Actions / Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {tasks.filter(t => t.status !== 'completed').length} active tasks
            {unassigned > 0 && <> · <span style={{ color: '#f59e0b', fontWeight: 600 }}>{unassigned} unassigned</span></>}
            {breachCount > 0 && <> · <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠ {breachCount} SLA breach{breachCount !== 1 ? 'es' : ''}</span></>}
          </div>
          <button className="btn btn-primary" style={{ fontSize: 13 }}>+ New Task</button>
        </div>

      {view !== 'analytics' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={16} className="text-tertiary shrink-0" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              style={{ width: '100%', padding: '8px 14px 8px 36px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}
            />
          </div>
          {[
            { 
              value: familyFilter,   
              onChange: setFamilyFilter,   
              opts: isPlatform ? ['All', 'Organizations', 'Contacts', 'Tickets'] : ['All', ...families],                  
              label: isPlatform ? 'All Entities' : 'All Families',  
              lbl: (v: string) => v 
            },
            { value: queueFilter,    onChange: setQueueFilter,    opts: ['All', ...queues.map(q => q.id)],     label: 'All Queues',    lbl: (v: string) => queues.find(q => q.id === v)?.name ?? v },
            { value: priorityFilter, onChange: setPriorityFilter, opts: ['All', 'urgent', 'high', 'normal', 'low'], label: 'All Priorities', lbl: (v: string) => v },
          ].map((f, i) => (
            <select
              key={f.label} value={f.value}
              onChange={e => f.onChange(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}
            >
              {f.opts.map((o, idx) => (
                <option key={`${o}-${idx}`} value={o}>{o === 'All' ? f.label : f.lbl(o)}</option>
              ))}
            </select>
          ))}
          {hasGlobalFilters && (
            <button
              onClick={() => { setSearch(''); setFamilyFilter('All'); setQueueFilter('All'); setPriorityFilter('All'); }}
              style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {view === 'board'     && <BoardView     tasks={filteredSorted} onSelectTask={setSelectedTask} />}
      {view === 'queue'     && <QueueView     tasks={filteredSorted} onSelectTask={setSelectedTask} />}
      {view === 'list'      && <ListView      tasks={filtered} onSelectTask={setSelectedTask} />}
      {view === 'analytics' && <AnalyticsView />}
      </main>
    </div>
    </LiveModeGate>
  );
}
