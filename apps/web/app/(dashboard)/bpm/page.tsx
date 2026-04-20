'use client';

import React, { useState } from 'react';
import ActiveWorkflows from './components/ActiveWorkflows';
import TaskQueue from './components/TaskQueue';
import ProcessBuilder from './components/ProcessBuilder';

export default function BPMUnifiedPage() {
  const [activeTab, setActiveTab] = useState<'workflows' | 'tasks' | 'builder'>('workflows');

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-[calc(100vh-64px)] overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Business Process Operations</h1>
        <p className="text-[var(--text-secondary)] mt-2 text-sm max-w-2xl">
          Unified command center for process automation, queue management, and organizational workflows.
        </p>
      </div>

      {/* Glassmorphic Tabs */}
      <div className="flex gap-2 mb-8 bg-[var(--bg-surface)] p-1.5 rounded-2xl border border-[var(--border)] w-[max-content] backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${
            activeTab === 'workflows'
              ? 'bg-[var(--bg-card)] text-[var(--brand-500)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Active Workflows
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${
            activeTab === 'tasks'
              ? 'bg-[var(--bg-card)] text-[var(--brand-500)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          Task Queue
        </button>

        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 ${
            activeTab === 'builder'
              ? 'bg-[var(--bg-card)] text-[var(--brand-500)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          Architecture Builder
        </button>
      </div>

      {/* Tab Content Container */}
      <div>
        {activeTab === 'workflows' && <ActiveWorkflows />}
        {activeTab === 'tasks' && <TaskQueue />}
        {activeTab === 'builder' && <ProcessBuilder />}
      </div>
    </div>
  );
}
