'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Brain, Target, Users, Globe, BookOpen, ChevronRight } from 'lucide-react';
import type { SessionContext, SalesMethodology } from '@/lib/copilot/copilot.types';

interface SessionSetupProps {
  tenantId:  string;
  userId:    string;
  onStart:   (ctx: Omit<SessionContext, 'sessionId' | 'startedAt' | 'status'>) => void;
  isLoading: boolean;
  error?:    string | null;
}

const METHODOLOGIES: SalesMethodology[] = ['MEDDIC', 'SPIN', 'Challenger', 'Custom'];

const METHOD_DESCRIPTIONS: Record<SalesMethodology, string> = {
  MEDDIC:     'Metrics, Economic Buyer, Decision Criteria, Decision Process, Pain, Champion',
  SPIN:       'Situation, Problem, Implication, Need-Payoff questions',
  Challenger: 'Teach, Tailor, Take Control of complex deals',
  Custom:     'Define your own sales stages',
};

const PRESET_INDUSTRIES = ['Wealth Management', 'Family Office', 'Enterprise SaaS', 'Private Equity', 'Real Estate', 'Financial Advisory', 'Other'];
const PRESET_PERSONAS   = ['UHNW Family Principal', 'CFO / Finance Director', 'CEO / Founder', 'Investment Committee', 'Procurement Officer', 'Other'];

export function SessionSetup({ tenantId, userId, onStart, isLoading, error }: SessionSetupProps) {
  const [industry,       setIndustry]      = useState('Wealth Management');
  const [productName,    setProductName]   = useState('');
  const [targetPersona,  setTargetPersona] = useState('UHNW Family Principal');
  const [methodology,    setMethodology]   = useState<SalesMethodology>('MEDDIC');
  const [customStages,   setCustomStages]  = useState('');
  const [language,       setLanguage]      = useState('en');
  const [callTitle,      setCallTitle]     = useState('');

  function handleStart() {
    if (!productName.trim()) return;
    onStart({
      tenantId,
      userId,
      industry:          industry.trim(),
      productName:       productName.trim(),
      targetPersona:     targetPersona.trim(),
      methodology,
      customMethodology: methodology === 'Custom'
        ? customStages.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
      language,
      callTitle:         callTitle.trim() || undefined,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <div style={{ marginBottom: 4 }}>
        <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', margin: 0, marginBottom: 4 }}>
          Configure Co-Pilot Session
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          Inject context to personalize AI responses for this call.
        </p>
      </div>

      {/* Call title */}
      <Field label="Call Title (optional)" icon={<BookOpen size={13} />}>
        <input
          value={callTitle}
          onChange={e => setCallTitle(e.target.value)}
          placeholder="e.g. Discovery call — Rothschild family"
          style={inputStyle}
        />
      </Field>

      {/* Industry */}
      <Field label="Industry" icon={<Globe size={13} />}>
        <select value={industry} onChange={e => setIndustry(e.target.value)} style={inputStyle}>
          {PRESET_INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </Field>

      {/* Product */}
      <Field label="Your Product / Service" icon={<Target size={13} />} required>
        <input
          value={productName}
          onChange={e => setProductName(e.target.value)}
          placeholder="e.g. Vivantis Family Office Platform"
          style={inputStyle}
          required
        />
      </Field>

      {/* Target persona */}
      <Field label="Target Persona" icon={<Users size={13} />}>
        <select value={targetPersona} onChange={e => setTargetPersona(e.target.value)} style={inputStyle}>
          {PRESET_PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      {/* Methodology */}
      <Field label="Sales Methodology" icon={<Brain size={13} />}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {METHODOLOGIES.map(m => (
            <button
              key={m}
              onClick={() => setMethodology(m)}
              style={{
                padding: '8px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                border: `1px solid ${methodology === m ? 'var(--brand-500)' : 'var(--border)'}`,
                background: methodology === m ? 'var(--brand-500)15' : 'var(--bg-overlay)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: methodology === m ? 'var(--brand-500)' : 'var(--text-primary)', marginBottom: 2 }}>{m}</div>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{METHOD_DESCRIPTIONS[m].split(',')[0]}</div>
            </button>
          ))}
        </div>
        {methodology === 'Custom' && (
          <input
            value={customStages}
            onChange={e => setCustomStages(e.target.value)}
            placeholder="Stage 1, Stage 2, Stage 3 (comma-separated)"
            style={{ ...inputStyle, marginTop: 8 }}
          />
        )}
      </Field>

      {/* Language */}
      <Field label="Call Language" icon={<Globe size={13} />}>
        <select value={language} onChange={e => setLanguage(e.target.value)} style={inputStyle}>
          <option value="en">English</option>
          <option value="pt">Portuguese</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
        </select>
      </Field>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!productName.trim() || isLoading}
        style={{
          padding: '13px', borderRadius: 10, border: 'none', cursor: productName.trim() ? 'pointer' : 'not-allowed',
          background: productName.trim() ? 'var(--brand-500)' : 'var(--bg-overlay)',
          color: productName.trim() ? 'white' : 'var(--text-tertiary)',
          fontWeight: 800, fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: productName.trim() ? '0 4px 16px var(--brand-500)44' : 'none',
          transition: 'all 0.2s',
        }}
      >
        {isLoading
          ? 'Initializing…'
          : <><Mic size={15} /> Start Co-Pilot Session <ChevronRight size={14} /></>}
      </button>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
          background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444',
        }}>
          {error}
        </div>
      )}
    </motion.div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, icon, required, children }: {
  label: string; icon?: React.ReactNode; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700,
        color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {icon}
        {label}
        {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 12, borderRadius: 8,
  background: 'var(--bg-overlay)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
};
