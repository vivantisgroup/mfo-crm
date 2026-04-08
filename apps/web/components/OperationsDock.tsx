'use client';

import React, { useState } from 'react';
import { CommunicationsHub } from './CommunicationsHub';
import { DocumentVault } from './DocumentVault';
import { AgendaTab } from './AgendaTab';

type OpsTab = 'comms' | 'vault' | 'agenda' | 'tasks';

export function OperationsDock() {
  const [activeTab, setActiveTab] = useState<OpsTab>('comms');

  return (
    <aside className="ops-dock">
      {/* Tab Controller (Utility Tab Dock for Right Rail) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        gap: '4px',
        background: 'var(--bg-canvas)'
      }}>
        {[
          { id: 'comms', label: 'Comms', icon: '💬' },
          { id: 'vault', label: 'Vault', icon: '📁' },
          { id: 'agenda', label: 'Agenda', icon: '📅' },
          { id: 'tasks', label: 'Tasks', icon: '✅' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as OpsTab)}
            style={{
              flex: 1,
              padding: '6px 0',
              border: 'none',
              background: activeTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'background 0.2s',
              boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <span style={{ fontSize: '14px' }}>{tab.icon}</span>
            <span className="text-macro" style={{ fontSize: '10px' }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Router View */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {activeTab === 'comms' && <CommunicationsHub />}
        {activeTab === 'vault' && <DocumentVault />}
        {activeTab === 'agenda' && <AgendaTab />}
        {activeTab === 'tasks' && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <span className="text-micro">Tasks</span>
            <div style={{ marginTop: '12px', fontSize: '13px' }}>All caught up!</div>
          </div>
        )}
      </div>
    </aside>
  );
}

export function OpsFooterDock() {
  return (
    <div className="ops-footer-dock">
      <button title="Settings" className="hover-lift" style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </button>
      <div style={{ width: 1, height: '16px', background: 'var(--border)' }} />
      <button title="Help" className="hover-lift" style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </button>
    </div>
  );
}

