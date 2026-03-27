'use client';

import React from 'react';
import Link from 'next/link';
import { useLiveMode } from '@/lib/useLiveMode';

interface Props {
  /** Rendered when authenticated in live production mode and no real data exists */
  emptyState: React.ReactNode;
  /** The real page content (shown in demo/mock mode or when live data is present) */
  children: React.ReactNode;
  /** When true, show children even in live mode (e.g. once real data is fetched) */
  hasLiveData?: boolean;
}

/**
 * LiveModeGate
 *
 * In live (authenticated) mode:
 *   - If hasLiveData=true → renders children with the real data
 *   - If hasLiveData=false (default) → renders emptyState
 * In demo mode (unauthenticated):
 *   - Always renders children (mock data flows through normally)
 */
export function LiveModeGate({ emptyState, children, hasLiveData = false }: Props) {
  const isLive = useLiveMode();
  if (isLive && !hasLiveData) return <>{emptyState}</>;
  return <>{children}</>;
}

// ─── Reusable empty state card ─────────────────────────────────────────────────

interface EmptyStateProps {
  icon:        string;
  title:       string;
  description: string;
  actions?:    { label: string; href?: string; onClick?: () => void; primary?: boolean }[];
  /** Optional extra content below actions */
  children?:   React.ReactNode;
}

export function EmptyState({ icon, title, description, actions, children }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '80px 40px', minHeight: '50vh',
    }}>
      <div style={{ fontSize: 64, marginBottom: 20, filter: 'grayscale(0.2)' }}>{icon}</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>{title}</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 420, lineHeight: 1.7, marginBottom: actions?.length ? 28 : 0 }}>
        {description}
      </p>
      {actions && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {actions.map(a => a.href ? (
            <Link key={a.label} href={a.href} className={a.primary ? 'btn btn-primary' : 'btn btn-secondary'}>
              {a.label}
            </Link>
          ) : (
            <button key={a.label} onClick={a.onClick} className={a.primary ? 'btn btn-primary' : 'btn btn-secondary'}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Pre-built empty states for every major section ───────────────────────────

export function FamiliesEmptyState() {
  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Families & CRM</h1>
          <p className="page-subtitle">Manage family relationships, KYC, and settings</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary">Export CRM</button>
          <button className="btn btn-primary">Onboard Family</button>
        </div>
      </div>
      <div className="card">
        <EmptyState
          icon="👨‍👩‍👧‍👦"
          title="No families yet"
          description="Your client database is empty. Start by onboarding your first family."
          actions={[
            { label: '+ Onboard Family', primary: true },
          ]}
        />
      </div>
    </div>
  );
}

export function TasksEmptyState() {
  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Manage and track work items across queues</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary">+ New Task</button>
        </div>
      </div>
      <div className="card">
        <EmptyState
          icon="✅"
          title="No tasks yet"
          description="No tasks have been created in this workspace. Add your first task or set up task queues in Admin."
          actions={[
            { label: '+ Create Task', primary: true },
            { label: 'Configure Queues', href: '/admin' },
          ]}
        />
      </div>
    </div>
  );
}

export function ActivitiesEmptyState() {
  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Activities</h1>
          <p className="page-subtitle">Communication and interaction timeline</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary">+ Log Activity</button>
        </div>
      </div>
      <div className="card">
        <EmptyState
          icon="💬"
          title="No activities logged"
          description="Start tracking client interactions — calls, meetings, emails, and more — to keep a full communication history."
          actions={[
            { label: '+ Log Activity', primary: true },
          ]}
        />
      </div>
    </div>
  );
}

export function PortfolioEmptyState() {
  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Portfolio</h1>
          <p className="page-subtitle">Investment holdings and performance</p>
        </div>
      </div>
      <div className="card">
        <EmptyState
          icon="📊"
          title="No portfolio data"
          description="There is no investment or portfolio data in this workspace yet. Onboard families with assets to get started."
          actions={[
            { label: 'Onboard Families', href: '/families', primary: true },
          ]}
        />
      </div>
    </div>
  );
}

export function DocumentsEmptyState() {
  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Document Vault</h1>
          <p className="page-subtitle">Secure document storage and management</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary">+ Upload Document</button>
        </div>
      </div>
      <div className="card">
        <EmptyState
          icon="🗄️"
          title="Document vault is empty"
          description="No documents have been uploaded yet. Upload agreements, reports, KYC documents, and more."
          actions={[
            { label: '+ Upload Document', primary: true },
          ]}
        />
      </div>
    </div>
  );
}

export function CalendarEmptyState() {
  return (
    <EmptyState
      icon="📅"
      title="No calendar events"
      description="No upcoming events scheduled. Connect your Google or Outlook calendar in your profile settings, or create events manually."
      actions={[
        { label: 'Connect Calendar', primary: true },
      ]}
    />
  );
}
