'use client';

import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { TASKS, TASK_QUEUES, TASK_TYPES, TIME_ENTRIES, PLATFORM_USERS } from './mockData';
import type { Task, TaskQueue, TaskType, TimeEntry, AppNotification } from './types';
import { logAction } from './auditLog';

// ─── Tenant config (would come from admin settings in production) ─────────────
const DEFAULT_TIME_INTERVAL_MINUTES = 15;

// ─── Context value shape ──────────────────────────────────────────────────────

interface TaskQueueCtx {
  // Data
  tasks:       Task[];
  queues:      TaskQueue[];
  taskTypes:   TaskType[];
  timeEntries: TimeEntry[];
  notifications: AppNotification[];
  unreadCount:   number;

  // Task actions
  updateTask:   (id: string, patch: Partial<Task>) => void;
  acceptTask:   (taskId: string, userId: string, userName: string) => void;
  completeTask: (taskId: string) => void;

  // Queue management (admin only)
  addQueue:     (q: Omit<TaskQueue, 'id'>, actorId: string, actorName: string) => TaskQueue;
  updateQueue:  (id: string, patch: Partial<TaskQueue>, actorId: string, actorName: string) => void;
  /** Returns task count for a queue across all statuses (open, in_progress, completed, archived) */
  queueTaskCount: (queueId: string) => number;
  /** Migrate all tasks from one queue to another, then delete the source queue */
  migrateAndRemoveQueue: (
    fromQueueId:  string,
    toQueueId:    string,
    actorId:      string,
    actorName:    string,
    tenantId:     string,
  ) => void;
  /** Remove a queue that is empty (no tasks of any status) */
  removeEmptyQueue: (
    queueId:   string,
    actorId:   string,
    actorName: string,
    tenantId:  string,
  ) => void;

  // Time tracking
  activeClockTaskId: string | null;
  clockElapsedSec:   number;
  startClock:  (taskId: string, activityType?: string) => void;
  stopClock:   (taskId: string) => void;
  getTaskTime: (taskId: string) => number; // total minutes logged

  // Notifications
  dismissNotification: (id: string) => void;
  openNotification:    (id: string) => void;
  acceptNotification:  (id: string) => void;
  clearAllNotifications: () => void;

  // Analytics helpers
  getTimeByFamily:   () => { familyId: string; familyName: string; minutes: number }[];
  getTimeByUser:     () => { userId: string; userName: string; minutes: number }[];
  getTimeByActivity: () => { activityType: string; minutes: number }[];
}

const TaskQueueContext = createContext<TaskQueueCtx>({} as TaskQueueCtx);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function snapToInterval(minutes: number, interval = DEFAULT_TIME_INTERVAL_MINUTES): number {
  return Math.max(interval, Math.round(minutes / interval) * interval);
}

function makeNotifId() { return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }
function makeQueueId()  { return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`; }

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TaskQueueProvider({ children }: { children: React.ReactNode }) {
  const [tasks,         setTasks]         = useState<Task[]>(TASKS);
  const [queues,        setQueues]        = useState<TaskQueue[]>(TASK_QUEUES);   // now mutable
  const [taskTypes]                        = useState<TaskType[]>(TASK_TYPES);
  const [timeEntries,   setTimeEntries]   = useState<TimeEntry[]>(TIME_ENTRIES);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // ── Time tracking ──────────────────────────────────────────────────────────
  const [activeClockTaskId,  setActiveClockTaskId]  = useState<string | null>(null);
  const [activeClockStart,   setActiveClockStart]   = useState<number | null>(null);
  const [clockElapsedSec,    setClockElapsedSec]    = useState(0);
  const clockInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick live clock
  useEffect(() => {
    if (activeClockStart === null) { setClockElapsedSec(0); return; }
    clockInterval.current = setInterval(() => {
      setClockElapsedSec(Math.floor((Date.now() - activeClockStart) / 1000));
    }, 1000);
    return () => { if (clockInterval.current) clearInterval(clockInterval.current); };
  }, [activeClockStart]);

  const startClock = useCallback((taskId: string, _actType = 'note') => {
    if (activeClockTaskId) stopClock(activeClockTaskId);  // auto-stop prev
    setActiveClockTaskId(taskId);
    setActiveClockStart(Date.now());
  }, [activeClockTaskId]);

  const stopClock = useCallback((taskId: string) => {
    if (!activeClockStart) return;
    const durMin = snapToInterval((Date.now() - activeClockStart) / 60000);
    const entry: TimeEntry = {
      id: `te-${Date.now()}`,
      taskId,
      userId: 'usr-rm-001',   // current user — in production, from auth context
      userName: 'Alexandra Torres',
      activityType: 'note',
      startedAt: new Date(activeClockStart).toISOString(),
      endedAt:   new Date().toISOString(),
      durationMinutes: durMin,
    };
    setTimeEntries(prev => [...prev, entry]);
    setActiveClockTaskId(null);
    setActiveClockStart(null);
    setClockElapsedSec(0);
    if (clockInterval.current) clearInterval(clockInterval.current);
  }, [activeClockStart]);

  const getTaskTime = useCallback((taskId: string) =>
    timeEntries.filter(e => e.taskId === taskId)
      .reduce((s, e) => s + (e.durationMinutes ?? 0), 0), [timeEntries]);

  // ── Task actions ───────────────────────────────────────────────────────────

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const acceptTask = useCallback((taskId: string, userId: string, userName: string) => {
    updateTask(taskId, {
      assignedUserId: userId,
      assignedUserName: userName,
      assignedTo: userName,
      pickedUpAt: new Date().toISOString(),
    });
    addNotification({
      type: 'task_assigned',
      title: 'Task accepted',
      body: `You accepted a task from the queue.`,
      taskId,
      severity: 'info',
    });
  }, [updateTask]);

  const completeTask = useCallback((taskId: string) => {
    if (activeClockTaskId === taskId) stopClock(taskId);
    updateTask(taskId, { status: 'completed', completedAt: new Date().toISOString() });
  }, [updateTask, activeClockTaskId, stopClock]);

  // ── Queue management ───────────────────────────────────────────────────────

  const queueTaskCount = useCallback((queueId: string): number => {
    return tasks.filter(t => t.queueId === queueId).length;
  }, [tasks]);

  const addQueue = useCallback((
    q: Omit<TaskQueue, 'id'>,
    actorId: string,
    actorName: string,
  ): TaskQueue => {
    const newQueue: TaskQueue = { ...q, id: makeQueueId() };
    setQueues(prev => [...prev, newQueue]);
    // Audit
    logAction({
      tenantId:     'tenant-001',
      userId:       actorId,
      userName:     actorName,
      action:       'QUEUE_CREATED',
      resourceId:   newQueue.id,
      resourceType: 'task_queue',
      resourceName: `Queue created: "${newQueue.name}"`,
      status:       'success',
    });
    return newQueue;
  }, []);

  const updateQueue = useCallback((
    id: string,
    patch: Partial<TaskQueue>,
    actorId: string,
    actorName: string,
  ) => {
    setQueues(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
    logAction({
      tenantId:     'tenant-001',
      userId:       actorId,
      userName:     actorName,
      action:       'QUEUE_UPDATED',
      resourceId:   id,
      resourceType: 'task_queue',
      resourceName: `Queue updated: "${patch.name ?? id}"`,
      status:       'success',
    });
  }, []);

  const removeEmptyQueue = useCallback((
    queueId: string,
    actorId: string,
    actorName: string,
    tenantId: string,
  ) => {
    const count = tasks.filter(t => t.queueId === queueId).length;
    if (count > 0) {
      console.warn('[TaskQueue] removeEmptyQueue called on non-empty queue', queueId);
      return;
    }
    const name = queues.find(q => q.id === queueId)?.name ?? queueId;
    setQueues(prev => prev.filter(q => q.id !== queueId));
    logAction({
      tenantId,
      userId:       actorId,
      userName:     actorName,
      action:       'QUEUE_DELETED',
      resourceId:   queueId,
      resourceType: 'task_queue',
      resourceName: `Queue deleted: "${name}"`,
      status:       'success',
    });
  }, [tasks, queues]);

  const migrateAndRemoveQueue = useCallback((
    fromQueueId: string,
    toQueueId:   string,
    actorId:     string,
    actorName:   string,
    tenantId:    string,
  ) => {
    const affected = tasks.filter(t => t.queueId === fromQueueId);
    if (affected.length === 0) {
      removeEmptyQueue(fromQueueId, actorId, actorName, tenantId);
      return;
    }

    // Migrate tasks
    setTasks(prev => prev.map(t =>
      t.queueId === fromQueueId ? { ...t, queueId: toQueueId } : t
    ));

    const fromName = queues.find(q => q.id === fromQueueId)?.name ?? fromQueueId;
    const toName   = queues.find(q => q.id === toQueueId)?.name   ?? toQueueId;

    // Remove queue
    setQueues(prev => prev.filter(q => q.id !== fromQueueId));

    // Audit — one log entry for the whole operation
    logAction({
      tenantId,
      userId:       actorId,
      userName:     actorName,
      action:       'QUEUE_MIGRATED_AND_DELETED',
      resourceId:   fromQueueId,
      resourceType: 'task_queue',
      resourceName: `Migrated ${affected.length} task(s) from "${fromName}" → "${toName}", then deleted "${fromName}"`,
      status:       'success',
    });
  }, [tasks, queues, removeEmptyQueue]);

  // ── Notifications ──────────────────────────────────────────────────────────

  const addNotification = (n: Omit<AppNotification, 'id' | 'createdAt'>) => {
    setNotifications(prev => [
      { ...n, id: makeNotifId(), createdAt: new Date().toISOString() },
      ...prev,
    ]);
  };

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, dismissedAt: new Date().toISOString() } : n));
  }, []);

  const openNotification = useCallback((id: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  }, []);

  const acceptNotification = useCallback((id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif?.taskId) acceptTask(notif.taskId, 'usr-rm-001', 'Alexandra Torres');
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  }, [notifications, acceptTask]);

  const clearAllNotifications = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, dismissedAt: new Date().toISOString() })));
  }, []);

  // ── SLA watcher — runs every 60s and emits notifications for breaches ──────
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      tasks.forEach(task => {
        if (task.status === 'completed' || task.status === 'cancelled') return;
        const queue     = queues.find(q => q.id === task.queueId);
        const taskType  = taskTypes.find(t => t.id === task.taskTypeId);
        const createdMs = new Date(task.createdAt).getTime();

        // Assignment SLA
        if (!task.assignedUserId && queue) {
          const ageMin = (now - createdMs) / 60000;
          if (ageMin > queue.assignSlaMinutes && !task.slaBreached) {
            updateTask(task.id, { slaBreached: true, slaBreachMinutes: Math.round(ageMin - queue.assignSlaMinutes) });
            addNotification({
              type: 'sla_assign_breach',
              title: `⚠ Unassigned SLA Breach — ${queue.name}`,
              body: `"${task.title}" for ${task.familyName} has not been picked up (${Math.round(ageMin)} min).`,
              taskId: task.id, queueId: queue.id, familyId: task.familyId,
              severity: 'critical',
            });
          }
        }

        // Completion SLA
        if (task.dueDate && taskType) {
          const dueMs = new Date(task.dueDate).getTime();
          if (now > dueMs && !task.slaBreached) {
            updateTask(task.id, { slaBreached: true });
            addNotification({
              type: 'sla_completion_breach',
              title: `⚠ Overdue — ${taskType.name}`,
              body: `"${task.title}" for ${task.familyName} passed its due date.`,
              taskId: task.id, familyId: task.familyId,
              severity: 'critical',
            });
          }
        }
      });
    };

    // Seed initial breaches from mock data
    tasks.filter(t => t.slaBreached && !t.assignedUserId).forEach(t => {
      const q = queues.find(q => q.id === t.queueId);
      if (!q) return;
      const already = notifications.some(n => n.taskId === t.id && n.type === 'sla_assign_breach');
      if (!already) {
        addNotification({
          type: 'sla_assign_breach',
          title: `⚠ Unassigned SLA Breach — ${q.name}`,
          body: `"${t.title}" for ${t.familyName} (${t.slaBreachMinutes} min over SLA).`,
          taskId: t.id, queueId: q.id, familyId: t.familyId, severity: 'critical',
        });
      }
    });

    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, queues, taskTypes]);

  // ── Analytics ──────────────────────────────────────────────────────────────

  const getTimeByFamily = useCallback(() => {
    const map: Record<string, { familyId: string; familyName: string; minutes: number }> = {};
    timeEntries.forEach(e => {
      const task = tasks.find(t => t.id === e.taskId);
      if (!task) return;
      if (!map[task.familyId]) map[task.familyId] = { familyId: task.familyId, familyName: task.familyName, minutes: 0 };
      map[task.familyId].minutes += e.durationMinutes ?? 0;
    });
    return Object.values(map).sort((a, b) => b.minutes - a.minutes);
  }, [timeEntries, tasks]);

  const getTimeByUser = useCallback(() => {
    const map: Record<string, { userId: string; userName: string; minutes: number }> = {};
    timeEntries.forEach(e => {
      if (!map[e.userId]) map[e.userId] = { userId: e.userId, userName: e.userName, minutes: 0 };
      map[e.userId].minutes += e.durationMinutes ?? 0;
    });
    return Object.values(map).sort((a, b) => b.minutes - a.minutes);
  }, [timeEntries]);

  const getTimeByActivity = useCallback(() => {
    const map: Record<string, { activityType: string; minutes: number }> = {};
    timeEntries.forEach(e => {
      if (!map[e.activityType]) map[e.activityType] = { activityType: e.activityType, minutes: 0 };
      map[e.activityType].minutes += e.durationMinutes ?? 0;
    });
    return Object.values(map).sort((a, b) => b.minutes - a.minutes);
  }, [timeEntries]);

  const unreadCount = notifications.filter(n => !n.dismissedAt && !n.readAt).length;

  return (
    <TaskQueueContext.Provider value={{
      tasks, queues, taskTypes, timeEntries, notifications, unreadCount,
      updateTask, acceptTask, completeTask,
      addQueue, updateQueue, queueTaskCount,
      removeEmptyQueue, migrateAndRemoveQueue,
      activeClockTaskId, clockElapsedSec, startClock, stopClock, getTaskTime,
      dismissNotification, openNotification, acceptNotification, clearAllNotifications,
      getTimeByFamily, getTimeByUser, getTimeByActivity,
    }}>
      {children}
    </TaskQueueContext.Provider>
  );
}

export const useTaskQueue = () => useContext(TaskQueueContext);
