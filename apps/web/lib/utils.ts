import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function formatCurrency(value: number, currency = 'USD', compact = false): string {
  if (compact) {
    const absVal = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (absVal >= 1_000_000_000) return `${sign}$${(absVal / 1_000_000_000).toFixed(1)}B`;
    if (absVal >= 1_000_000) return `${sign}$${(absVal / 1_000_000).toFixed(1)}M`;
    if (absVal >= 1_000) return `${sign}$${(absVal / 1_000).toFixed(0)}K`;
    return `${sign}$${absVal.toFixed(0)}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(decimals)}%`;
}

export function formatDate(dateStr: string, fmt = 'MMM d, yyyy'): string {
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return dateStr;
  }
}

export function formatRelativeDate(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function formatMultiple(value: number): string {
  return `${value.toFixed(2)}x`;
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'aggressive': return 'var(--color-red)';
    case 'growth': return 'var(--color-amber)';
    case 'balanced': return 'var(--color-blue)';
    case 'conservative': return 'var(--color-green)';
    default: return 'var(--color-muted)';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'approved': case 'active': case 'clear': case 'resolved': case 'completed': case 'paid': case 'signed':
      return 'var(--badge-success)';
    case 'pending': case 'in_review': case 'scheduled': case 'in_progress':
      return 'var(--badge-warning)';
    case 'flagged': case 'overdue': case 'urgent': case 'cancelled':
      return 'var(--badge-danger)';
    default:
      return 'var(--badge-neutral)';
  }
}

export function getActivityIcon(type: string): string {
  switch (type) {
    case 'email': return '✉️';
    case 'call': return '📞';
    case 'meeting': return '🤝';
    case 'note': return '📝';
    case 'document_shared': return '📄';
    case 'task_completed': return '✅';
    case 'capital_call': return '💰';
    default: return '•';
  }
}

export function getDocumentIcon(type: string): string {
  switch (type) {
    case 'trust_deed': case 'will': case 'legal_agreement': return '⚖️';
    case 'tax_return': return '🧾';
    case 'financial_statement': case 'report': return '📊';
    case 'investment_doc': return '📈';
    case 'kyc': return '🪪';
    case 'passport': return '🛂';
    default: return '📄';
  }
}

export function getServiceIcon(type: string): string {
  switch (type) {
    case 'travel': return '✈️';
    case 'property': return '🏡';
    case 'healthcare': return '🏥';
    case 'education': return '🎓';
    case 'event': return '🎉';
    case 'legal': return '⚖️';
    default: return '🛎️';
  }
}

export function getTierBadgeColor(tier: string): string {
  switch (tier) {
    case 'platinum': return 'var(--badge-platinum)';
    case 'gold': return 'var(--badge-gold)';
    default: return 'var(--badge-neutral)';
  }
}
