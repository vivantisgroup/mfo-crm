'use client';

import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { TASK_TYPES } from './mockData';
import type { Task, TaskQueue, TaskType, TimeEntry, AppNotification } from './types';
import { logAction } from './auditLog';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
  addQueue:     (q: Omit<TaskQueue, 'id'>, actorId: string, actorName: string) => Promise<string>;
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
  activeClockItem: { id: string, type: string, name: string, title?: string, startAt: number } | null;
  clockElapsedSec:   number;
  startClock:  (entityObj: { id: string, type: string, name: string, title?: string }, activityType?: string) => void;
  stopClock:   (notes?: string, activityType?: string) => void;
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TaskQueueProvider({ children }: { children: React.ReactNode }) {
  const { tenant, user } = useAuth();
  
  const [tasks,         setTasks]         = useState<Task[]>([]);
  const [queues,        setQueues]        = useState<TaskQueue[]>([]);
  const [taskTypes]                       = useState<TaskType[]>(TASK_TYPES);
  const [timeEntries,   setTimeEntries]   = useState<TimeEntry[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // DB Sync
  useEffect(() => {
    if (!tenant?.id) return;
    
    const usTasks = onSnapshot(collection(db, 'tenants', tenant.id, 'tasks'), snap => {
       setTasks(snap.docs.map(d => ({id: d.id, ...d.data()}) as Task));
    });
    
    // In Firestore, respect definition of queues ("task_queues")
    const usQueues = onSnapshot(collection(db, 'tenants', tenant.id, 'task_queues'), snap => {
       setQueues(snap.docs.map(d => ({id: d.id, ...d.data()}) as TaskQueue));
    });
    
    const usTime = onSnapshot(collection(db, 'tenants', tenant.id, 'time_entries'), snap => {
       setTimeEntries(snap.docs.map(d => ({id: d.id, ...d.data()}) as TimeEntry));
    });

    return () => { usTasks(); usQueues(); usTime(); };
  }, [tenant?.id]);

  // ── Time tracking ──────────────────────────────────────────────────────────
  const [activeClockItem,  setActiveClockItem]  = useState<{ id: string, type: string, name: string, title?: string, startAt: number } | null>(null);
  const [clockElapsedSec,    setClockElapsedSec]    = useState(0);
  const clockInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick live clock
  useEffect(() => {
    if (!activeClockItem) { setClockElapsedSec(0); return; }
    clockInterval.current = setInterval(() => {
      setClockElapsedSec(Math.floor((Date.now() - activeClockItem.startAt) / 1000));
    }, 1000);
    return () => { if (clockInterval.current) clearInterval(clockInterval.current); };
  }, [activeClockItem]);

  const startClock = useCallback((entityObj: { id: string, type: string, name: string, title?: string }, _actType = 'note') => {
    if (activeClockItem) stopClock();  // auto-stop prev
    setActiveClockItem({ ...entityObj, startAt: Date.now() });
  }, [activeClockItem]);

  const stopClock = useCallback((notes?: string, activityType?: string) => {
    if (!activeClockItem || !tenant?.id || !user?.id) return;
    const durMin = snapToInterval((Date.now() - activeClockItem.startAt) / 60000);
    const entry = {
      taskId: activeClockItem.type === 'task' ? activeClockItem.id : null,
      linkedEntityId: activeClockItem.id,
      linkedEntityType: activeClockItem.type,
      linkedEntityName: activeClockItem.name,
      userId: user.id,
      userName: user.name,
      activityType: activityType || 'executing',
      startedAt: new Date(activeClockItem.startAt).toISOString(),
      endedAt:   new Date().toISOString(),
      durationMinutes: durMin,
      notes: notes || activeClockItem.title || ''
    };
    
    addDoc(collection(db, 'tenants', tenant.id, 'time_entries'), entry).catch(console.error);

    setActiveClockItem(null);
    setClockElapsedSec(0);
    if (clockInterval.current) clearInterval(clockInterval.current);
  }, [activeClockItem, tenant?.id, user?.id, user?.name]);

  const getTaskTime = useCallback((taskId: string) =>
    timeEntries.filter(e => e.taskId === taskId)
      .reduce((s, e) => s + (e.durationMinutes ?? 0), 0), [timeEntries]);

  // ── Task actions ───────────────────────────────────────────────────────────

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    if (!tenant?.id) return;
    updateDoc(doc(db, 'tenants', tenant.id, 'tasks', id), patch).catch(console.error);
  }, [tenant?.id]);

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
    if (activeClockItem?.id === taskId) stopClock();
    updateTask(taskId, { status: 'completed', completedAt: new Date().toISOString() });
  }, [updateTask, activeClockItem, stopClock]);

  // ── Queue management ───────────────────────────────────────────────────────

  const queueTaskCount = useCallback((queueId: string): number => {
    return tasks.filter(t => t.queueId === queueId).length;
  }, [tasks]);

  const addQueue = useCallback(async (
    q: Omit<TaskQueue, 'id'>,
    actorId: string,
    actorName: string,
  ): Promise<string> => {
    if (!tenant?.id) throw new Error("No active tenant");
    
    const docRef = await addDoc(collection(db, 'tenants', tenant.id, 'task_queues'), q);
    
    // Audit
    logAction({
      tenantId:     tenant.id,
      userId:       actorId,
      userName:     actorName,
      action:       'QUEUE_CREATED',
      resourceId:   docRef.id,
      resourceType: 'task_queue',
      resourceName: `Queue created: "${q.name}"`,
      status:       'success',
    });
    return docRef.id;
  }, [tenant?.id]);

  const updateQueue = useCallback((
    id: string,
    patch: Partial<TaskQueue>,
    actorId: string,
    actorName: string,
  ) => {
    if (!tenant?.id) return;
    updateDoc(doc(db, 'tenants', tenant.id, 'task_queues', id), patch).then(() => {
      logAction({
        tenantId:     tenant.id,
        userId:       actorId,
        userName:     actorName,
        action:       'QUEUE_UPDATED',
        resourceId:   id,
        resourceType: 'task_queue',
        resourceName: `Queue updated: "${patch.name ?? id}"`,
        status:       'success',
      });
    }).catch(console.error);
  }, [tenant?.id]);

  const removeEmptyQueue = useCallback(async (
    queueId: string,
    actorId: string,
    actorName: string,
    tenantIdParam: string,
  ) => {
    if (!tenant?.id) return;
    const count = tasks.filter(t => t.queueId === queueId).length;
    if (count > 0) {
      console.warn('[TaskQueue] removeEmptyQueue called on non-empty queue', queueId);
      return;
    }
    const name = queues.find(q => q.id === queueId)?.name ?? queueId;
    
    await deleteDoc(doc(db, 'tenants', tenant.id, 'task_queues', queueId));
    
    logAction({
      tenantId: tenant.id,
      userId:       actorId,
      userName:     actorName,
      action:       'QUEUE_DELETED',
      resourceId:   queueId,
      resourceType: 'task_queue',
      resourceName: `Queue deleted: "${name}"`,
      status:       'success',
    });
  }, [tasks, queues, tenant?.id]);

  const migrateAndRemoveQueue = useCallback(async (
    fromQueueId: string,
    toQueueId:   string,
    actorId:     string,
    actorName:   string,
    tenantIdParam:    string,
  ) => {
    if (!tenant?.id) return;
    const affected = tasks.filter(t => t.queueId === fromQueueId);
    if (affected.length === 0) {
      removeEmptyQueue(fromQueueId, actorId, actorName, tenant?.id);
      return;
    }

    // Migrate tasks
    for (const t of affected) {
      await updateDoc(doc(db, 'tenants', tenant.id, 'tasks', t.id), { queueId: toQueueId });
    }

    const fromName = queues.find(q => q.id === fromQueueId)?.name ?? fromQueueId;
    const toName   = queues.find(q => q.id === toQueueId)?.name   ?? toQueueId;

    // Remove queue
    await deleteDoc(doc(db, 'tenants', tenant.id, 'task_queues', fromQueueId));

    // Audit — one log entry for the whole operation
    logAction({
      tenantId: tenant.id,
      userId:       actorId,
      userName:     actorName,
      action:       'QUEUE_MIGRATED_AND_DELETED',
      resourceId:   fromQueueId,
      resourceType: 'task_queue',
      resourceName: `Migrated ${affected.length} task(s) from "${fromName}" → "${toName}", then deleted "${fromName}"`,
      status:       'success',
    });
  }, [tasks, queues, removeEmptyQueue, tenant?.id]);

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
    if (notif?.taskId && user) acceptTask(notif.taskId, user.id, user.name);
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  }, [notifications, acceptTask, user]);

  const clearAllNotifications = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, dismissedAt: new Date().toISOString() })));
  }, []);

  // ── MLA watcher skipped in production for remote CF/Firestore Triggers, keeping local shim for notifications ─
  
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
      activeClockItem, clockElapsedSec, startClock, stopClock, getTaskTime,
      dismissNotification, openNotification, acceptNotification, clearAllNotifications,
      getTimeByFamily, getTimeByUser, getTimeByActivity,
    }}>
      {children}
    </TaskQueueContext.Provider>
  );
}

export const useTaskQueue = () => useContext(TaskQueueContext);
