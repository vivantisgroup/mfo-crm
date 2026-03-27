'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle } from 'lucide-react';
import type { MeddicState, SpinState, ChallengerState, SalesMethodology, MethodologyField } from '@/lib/copilot/copilot.types';
import {
  MEDDIC_FIELDS, MEDDIC_LABELS,
  SPIN_FIELDS, SPIN_LABELS,
  CHALLENGER_FIELDS, CHALLENGER_LABELS,
} from '@/lib/copilot/copilot.types';

interface MethodologyTrackerProps {
  methodology: SalesMethodology;
  state: MeddicState | SpinState | ChallengerState | null;
}

function FieldRow({ label, field, index }: { label: string; field: MethodologyField; index: number }) {
  const color = field.covered ? '#22c55e' : '#6366f1';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{ marginBottom: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        {field.covered
          ? <CheckCircle2 size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
          : <Circle size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
        <span style={{ fontSize: 11, fontWeight: 700, color: field.covered ? '#22c55e' : 'var(--text-secondary)', flex: 1 }}>
          {label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 800, color, minWidth: 28, textAlign: 'right' }}>
          {field.score}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginLeft: 21 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${field.score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ height: '100%', background: field.covered ? '#22c55e' : '#6366f144', borderRadius: 99 }}
        />
      </div>

      {/* Evidence quote */}
      {field.covered && field.evidence && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{
            marginTop: 5, marginLeft: 21, fontSize: 10, color: 'var(--text-tertiary)',
            fontStyle: 'italic', lineHeight: 1.5,
            borderLeft: '2px solid #22c55e33', paddingLeft: 6,
          }}
        >
          "{field.evidence.slice(0, 80)}{field.evidence.length > 80 ? '…' : ''}"
        </motion.div>
      )}
    </motion.div>
  );
}

export function MethodologyTracker({ methodology, state }: MethodologyTrackerProps) {
  if (!state) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
        Start a session to track {methodology} coverage.
      </div>
    );
  }

  // Determine fields and labels based on methodology
  let fields: string[];
  let labels: Record<string, string>;
  let overall: number;

  if (methodology === 'MEDDIC') {
    fields  = MEDDIC_FIELDS as string[];
    labels  = MEDDIC_LABELS;
    overall = (state as MeddicState).overallScore;
  } else if (methodology === 'SPIN') {
    fields  = SPIN_FIELDS as string[];
    labels  = SPIN_LABELS;
    overall = (state as SpinState).overallScore;
  } else {
    fields  = CHALLENGER_FIELDS as string[];
    labels  = CHALLENGER_LABELS;
    overall = (state as ChallengerState).overallScore;
  }

  const stateData = state as unknown as Record<string, MethodologyField>;
  const covered   = fields.filter(f => stateData[f]?.covered).length;

  return (
    <div>
      {/* Overall score ring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: '12px 14px', background: 'var(--bg-overlay)', borderRadius: 10 }}>
        <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="var(--border)" strokeWidth="4" />
            <motion.circle
              cx="26" cy="26" r="22"
              fill="none"
              stroke={overall >= 70 ? '#22c55e' : overall >= 40 ? '#f59e0b' : '#6366f1'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 22}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - overall / 100) }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{ transformOrigin: '26px 26px', rotate: '-90deg' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12, fontWeight: 900, color: 'var(--text-primary)',
          }}>
            {overall}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{methodology}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {covered}/{fields.length} fields covered
          </div>
        </div>
      </div>

      {/* Field rows */}
      <div>
        {fields.map((field, i) => (
          <FieldRow
            key={field}
            label={labels[field] ?? field}
            field={stateData[field] ?? { covered: false, evidence: '', score: 0, updatedAt: '' }}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
