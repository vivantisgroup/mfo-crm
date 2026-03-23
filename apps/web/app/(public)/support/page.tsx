'use client';

import React, { useState } from 'react';
import Link from 'next/link';

type Category = 'technical' | 'billing' | 'integration' | 'compliance' | 'feature_request' | 'onboarding' | 'security' | 'other';
type Priority = 'low' | 'normal' | 'high' | 'critical';

const CATEGORIES: { id: Category; label: string; icon: string; desc: string }[] = [
  { id: 'technical', label: 'Technical Issue', icon: '🔧', desc: 'Platform errors, bugs, or performance problems' },
  { id: 'billing', label: 'Billing & Invoices', icon: '💳', desc: 'Payments, subscriptions, or invoice questions' },
  { id: 'integration', label: 'Integration Setup', icon: '🔌', desc: 'Microsoft 365, Google Workspace, or API keys' },
  { id: 'compliance', label: 'Compliance & Regulatory', icon: '⚖️', desc: 'ANBIMA, CVM, SEC, or audit questions' },
  { id: 'onboarding', label: 'Onboarding Help', icon: '🚀', desc: 'Getting started, user setup, configuration' },
  { id: 'security', label: 'Security / Access', icon: '🔐', desc: 'MFA, locked accounts, or permission issues' },
  { id: 'feature_request', label: 'Feature Request', icon: '💡', desc: 'Suggest improvements or new features' },
  { id: 'other', label: 'Other', icon: '💬', desc: 'Anything else we can help with' },
];

const FAQ = [
  { q: 'How do I reset my MFA / Authenticator?', a: 'Contact your firm admin, or submit a Security ticket above. We will verify your identity and generate a new MFA enrollment link.' },
  { q: 'How do I add more users to my account?', a: 'Go to Admin & Config → Access Control → Invite User. You can assign roles and permissions per user.' },
  { q: 'What integrations are supported?', a: 'Microsoft 365 (Outlook, Calendar, OneDrive), Google Workspace (Gmail, Calendar, Drive), and custom AI providers (OpenAI, Gemini, Claude).' },
  { q: 'Where can I find my invoices?', a: 'Invoices are available under Admin & Config → Billing & Subscriptions → Invoices tab, or emailed automatically on each billing cycle.' },
  { q: 'What are the SLA response times?', a: 'Critical: 2 hours. High: 8 hours. Normal: 2 business days. Low: 5 business days.' },
  { q: 'Is my data backed up?', a: 'Yes. All data is backed up every 6 hours to geo-redundant Firebase / GCP storage. Data residency can be configured per your compliance requirements.' },
];

export default function SupportPublicPage() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [category, setCategory] = useState<Category | null>(null);
  const [priority, setPriority] = useState<Priority>('normal');
  const [form, setForm] = useState({ name: '', email: '', company: '', title: '', description: '', attachment: '' });
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !form.name || !form.email || !form.title || !form.description) return;
    setStep('success');
  };

  const ticketId = `TKT-2026-${String(Math.floor(Math.random() * 900) + 90).padStart(4, '0')}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', padding: '0 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #6366f1, #818cf8)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 16, boxShadow: '0 0 12px #6366f166' }}>V</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--text-primary)' }}>VIVANTS</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.12em' }}>SUPPORT CENTER</div>
            </div>
          </Link>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <a href="#faq" style={{ fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none' }}>FAQ</a>
            <Link href="/login" className="btn btn-primary btn-sm">Platform Login</Link>
          </div>
        </div>
      </div>

      {step === 'success' ? (
        /* Success State */
        <div style={{ maxWidth: 640, margin: '80px auto', padding: '60px 48px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🎟️</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>Ticket Submitted!</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 24 }}>Your support ticket has been created. Our team will respond within the SLA timeframe for your priority level.</p>
          <div style={{ padding: '20px 28px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', marginBottom: 32, display: 'inline-block' }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>YOUR TICKET ID</div>
            <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 900, color: 'var(--brand-400)' }}>{ticketId}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32, textAlign: 'left' }}>
            {[
              { label: 'Priority', value: priority },
              { label: 'Category', value: CATEGORIES.find(c => c.id === category)?.label || '' },
              { label: 'Confirmation sent to', value: form.email },
              { label: 'Expected response', value: priority === 'critical' ? '2 hours' : priority === 'high' ? '8 hours' : priority === 'normal' ? '2 business days' : '5 business days' },
            ].map(f => (
              <div key={f.label} style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{f.value}</div>
              </div>
            ))}
          </div>
          <button onClick={() => { setStep('form'); setCategory(null); setForm({ name: '', email: '', company: '', title: '', description: '', attachment: '' }); }} className="btn btn-primary">Submit Another Ticket</button>
        </div>
      ) : (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 40 }}>
          {/* Main Form */}
          <div>
            <div style={{ marginBottom: 48 }}>
              <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 8 }}>
                How can we <span style={{ color: 'var(--brand-500)' }}>help?</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>
                Fill in the form to open a support ticket. Our team monitors tickets 24/7 for critical issues.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Step 1: Category */}
              <div style={{ marginBottom: 36 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 16 }}>1. What do you need help with?</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {CATEGORIES.map(cat => (
                    <div
                      key={cat.id} onClick={() => setCategory(cat.id)}
                      style={{
                        padding: '14px 16px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                        border: `2px solid ${category === cat.id ? 'var(--brand-500)' : 'var(--border)'}`,
                        background: category === cat.id ? 'var(--brand-500)0d' : 'var(--bg-elevated)',
                        display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'all 0.15s'
                      }}
                    >
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{cat.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{cat.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{cat.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 2: Contact Details */}
              <div style={{ marginBottom: 36 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 16 }}>2. Your Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Full Name *</label>
                    <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" style={{ width: '100%', padding: '10px 14px' }} placeholder="Alexandra Torres" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Work Email *</label>
                    <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input" style={{ width: '100%', padding: '10px 14px' }} placeholder="you@company.com" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Organization / Tenant Name</label>
                    <input type="text" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="input" style={{ width: '100%', padding: '10px 14px' }} placeholder="Vivants Multi-Family Office" />
                  </div>
                </div>
              </div>

              {/* Step 3: Ticket Details */}
              <div style={{ marginBottom: 36 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 16 }}>3. Describe the Issue</div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Subject / Title *</label>
                  <input type="text" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input" style={{ width: '100%', padding: '10px 14px' }} placeholder="Brief description of the issue…" />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Description *</label>
                  <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input" style={{ width: '100%', padding: '10px 14px', minHeight: 140, resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} placeholder="Please describe the issue in detail — what happened, what you expected, steps to reproduce…" />
                </div>
              </div>

              {/* Step 4: Priority */}
              <div style={{ marginBottom: 36 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 16 }}>4. Priority</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {([
                    { id: 'low', label: '🟢 Low', desc: '5 biz days' },
                    { id: 'normal', label: '🔵 Normal', desc: '2 biz days' },
                    { id: 'high', label: '🟡 High', desc: '8 hours' },
                    { id: 'critical', label: '🔴 Critical', desc: '2 hours' },
                  ] as const).map(p => (
                    <div
                      key={p.id} onClick={() => setPriority(p.id)}
                      style={{
                        flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'center',
                        border: `2px solid ${priority === p.id ? 'var(--brand-500)' : 'var(--border)'}`,
                        background: priority === p.id ? 'var(--brand-500)0d' : 'var(--bg-elevated)', transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>SLA: {p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: 16, fontWeight: 700 }}>
                🎫 Submit Support Ticket →
              </button>
            </form>
          </div>

          {/* Sidebar — FAQ & Status */}
          <div>
            <div style={{ padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>🟢 All Systems Operational</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Platform status as of March 20, 2026</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { name: 'Web Application', status: 'up' },
                  { name: 'Firestore Database', status: 'up' },
                  { name: 'AI Services', status: 'up' },
                  { name: 'Email Delivery', status: 'up' },
                  { name: 'Calendar Sync', status: 'degraded' },
                ].map(s => (
                  <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{s.name}</span>
                    <span style={{ color: s.status === 'up' ? '#22c55e' : '#f59e0b', fontWeight: 700, fontSize: 12 }}>
                      {s.status === 'up' ? '✓ Operational' : '⚠ Degraded'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>⏱ SLA Response Times</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {[
                  { priority: 'Critical', time: '2 hours', color: '#ef4444' },
                  { priority: 'High', time: '8 hours', color: '#f59e0b' },
                  { priority: 'Normal', time: '2 biz days', color: '#6366f1' },
                  { priority: 'Low', time: '5 biz days', color: '#64748b' },
                ].map(s => (
                  <div key={s.priority} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 12px', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                    <span style={{ color: s.color, fontWeight: 700 }}>{s.priority}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{s.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ */}
            <div id="faq" style={{ padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>❓ Frequently Asked</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {FAQ.map((item, i) => (
                  <div key={i} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button
                      onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-canvas)', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}
                    >
                      {item.q}
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{faqOpen === i ? '▲' : '▼'}</span>
                    </button>
                    {faqOpen === i && (
                      <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '24px 48px', textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
        MFO Nexus by Vivants Consultoria e Serviços · <a href="mailto:suporte@vivants.com.br" style={{ color: 'var(--brand-400)', textDecoration: 'none' }}>suporte@vivants.com.br</a> · <Link href="/login" style={{ color: 'var(--brand-400)', textDecoration: 'none' }}>Platform Login</Link>
      </div>
    </div>
  );
}
