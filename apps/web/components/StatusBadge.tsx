import React from 'react';
import type { KycStatus, TaskStatus } from '@/lib/types';

function getStatusClass(status: string): string {
  switch (status) {
    case 'approved': case 'active': case 'clear': case 'resolved':
    case 'completed': case 'paid': case 'signed':
      return 'badge badge-success';
    case 'pending': case 'in_review': case 'scheduled': case 'in_progress':
      return 'badge badge-warning';
    case 'flagged': case 'overdue': case 'urgent': case 'cancelled':
      return 'badge badge-danger';
    default:
      return 'badge badge-neutral';
  }
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const displayLabel = label || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return (
    <span className={getStatusClass(status)}>
      {displayLabel}
    </span>
  );
}
