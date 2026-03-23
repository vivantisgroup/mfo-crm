'use client';

/**
 * /pricing — Public-facing pricing page
 * Loads only plans with publishedToWeb=true from Firestore (or falls back to defaults).
 * No authentication required.
 */

import React, { useState, useEffect } from 'react';
import { getPlans, DEFAULT_PLANS, formatPrice, annualSavingsPct, type PlanDefinition } from '@/lib/planService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAum(n: number): string {
  if (n === -1) return 'Unlimited';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

// ─── Comparison table feature matrix ─────────────────────────────────────────

const FEATURE_MATRIX = [
  { label: 'Family CRM & KYC',          starter: true,  standard: true,  pro: true,  enterprise: true },
  { label: 'Portfolio consolidation',     starter: true,  standard: true,  pro: true,  enterprise: true },
  { label: 'Task & workflow management',  starter: true,  standard: true,  pro: true,  enterprise: true },
  { label: 'Document vault',             starter: '10GB', standard: '100GB', pro: '1TB', enterprise: 'Custom' },
  { label: 'Reporting & dashboards',      starter: false, standard: true,  pro: true,  enterprise: true },
  { label: 'Private investments tracking',starter: false, standard: true,  pro: true,  enterprise: true },
  { label: 'Suitability assessments',    starter: false, standard: true,  pro: true,  enterprise: true },
  { label: 'Estate & succession planning',starter: false, standard: false, pro: true,  enterprise: true },
  { label: 'Governance & board workflows',starter: false, standard: false, pro: true,  enterprise: true },
  { label: 'AI-powered task extraction', starter: false, standard: false, pro: true,  enterprise: true },
  { label: 'White-label branding',        starter: 'Add-on', standard: 'Add-on', pro: true, enterprise: true },
  { label: 'API access',                 starter: 'Add-on', standard: 'Add-on', pro: 'Add-on', enterprise: true },
  { label: 'Custom integrations',        starter: false, standard: false, pro: 'Add-on', enterprise: true },
  { label: 'Dedicated success manager',  starter: false, standard: false, pro: true,  enterprise: true },
  { label: 'SLA-backed support',         starter: false, standard: false, pro: '4h',  enterprise: '1h' },
  { label: 'On-premise deploy',          starter: false, standard: false, pro: false, enterprise: true },
];

const FAQS = [
  { q: 'How does AUM-based pricing work?', a: 'We charge a small annual basis-point fee on your total AUM, billed monthly (annual rate ÷ 12). This ensures pricing grows fairly with your business — you pay more only when your clients\' assets grow.' },
  { q: 'Can I switch plans at any time?', a: 'Yes. You can upgrade immediately or downgrade at your next renewal. Credits for unused time are applied automatically to your next invoice.' },
  { q: 'What happens after the trial ends?', a: 'Your data is preserved for 30 days. Select a plan to continue — no data loss. We never delete accounts without notice.' },
  { q: 'Is my data safe?', a: 'All data is encrypted at rest and in transit. We deploy on Google Cloud (Brazil region available) with SOC 2 Type II controls. Each tenant is logically isolated.' },
  { q: 'Do you offer discounts for non-profits or early-stage firms?', a: 'Yes — reach out to sales@mfonexus.com. We have a startup program and NGO pricing.' },
  { q: 'What counts as a "licensed user"?', a: 'Any named user with login credentials to your workspace. Shared/service accounts count as one seat. View-only portal access for clients is free.' },
];

// ─── Components ───────────────────────────────────────────────────────────────

function CheckIcon({ value }: { value: boolean | string }) {
  if (value === false) return <span style={{ color: '#475569', fontSize: 16 }}>—</span>;
  if (value === true)  return <span style={{ color: '#22c55e', fontSize: 18 }}>✓</span>;
  return <span style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', padding: '2px 6px', background: '#818cf815', borderRadius: 4 }}>{value}</span>;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [plans,   setPlans]   = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle,   setCycle]   = useState<'monthly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    getPlans()
      .then(p => setPlans(p.filter(x => x.publishedToWeb && x.status !== 'archived')))
      .catch(() => setPlans(DEFAULT_PLANS.filter(p => p.publishedToWeb)))
      .finally(() => setLoading(false));
  }, []);

  const visiblePlans = plans.filter(p => p.code !== 'TRIAL');

  // Find the most popular plan (Professional)
  const popularCode = visiblePlans[Math.floor(visiblePlans.length / 2)]?.code ?? '';

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #060918;
          --bg-card: #0d1224;
          --border: rgba(255,255,255,0.08);
          --text: #f1f5f9;
          --text-2: #94a3b8;
          --text-3: #475569;
          --brand: #6366f1;
          --brand-glow: rgba(99,102,241,0.35);
          color-scheme: dark;
        }
        body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        a { color: inherit; text-decoration: none; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid; }
        .glow-text { background: linear-gradient(135deg, #a5b4fc, #6366f1, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.6s ease both; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid var(--border)', background: 'rgba(6,9,24,0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>N</div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em' }}>MFO Nexus</span>
          </div>
          <div style={{ display: 'flex', gap: 32, fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>
            {['Features', 'Pricing', 'Security', 'Docs'].map(l => (
              <a key={l} href="#" style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>{l}</a>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="/login" style={{ padding: '9px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, border: '1px solid var(--border)', color: 'var(--text)', transition: 'border-color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              Sign in
            </a>
            <a href="/login" style={{ padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', boxShadow: '0 4px 20px var(--brand-glow)' }}>
              Start free trial →
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '100px 24px 60px', position: 'relative', overflow: 'hidden' }}>
        {/* Background orbs */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="fade-up pill" style={{ color: '#a5b4fc', borderColor: '#6366f150', background: '#6366f108', marginBottom: 24, margin: '0 auto 24px' }}>
          <span>🏆</span> Trusted by leading family offices
        </div>
        <h1 className="fade-up" style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.04em', marginBottom: 20, animationDelay: '0.1s' }}>
          Simple, transparent<br />
          <span className="glow-text">pricing that scales with you</span>
        </h1>
        <p className="fade-up" style={{ fontSize: 18, color: 'var(--text-2)', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.7, animationDelay: '0.2s' }}>
          No hidden fees. Pay for what you use — based on your team size and assets under management.
        </p>

        {/* Billing toggle */}
        <div className="fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '6px 8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 64, animationDelay: '0.3s' }}>
          <button onClick={() => setCycle('monthly')} style={{ padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: cycle === 'monthly' ? 'white' : 'transparent', color: cycle === 'monthly' ? '#0f172a' : 'var(--text-2)' }}>Monthly</button>
          <button onClick={() => setCycle('annual')} style={{ padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8, background: cycle === 'annual' ? 'white' : 'transparent', color: cycle === 'annual' ? '#0f172a' : 'var(--text-2)' }}>
            Annual
            <span style={{ fontSize: 11, background: '#22c55e', color: 'white', padding: '2px 7px', borderRadius: 6, fontWeight: 800 }}>Save 17%</span>
          </button>
        </div>
      </section>

      {/* Plans grid */}
      <section className="container" style={{ paddingBottom: 80 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-2)' }}>Loading plans…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(visiblePlans.length, 4)}, 1fr)`, gap: 16 }}>
            {visiblePlans.map((plan, idx) => {
              const isPopular = plan.code === popularCode;
              const price = formatPrice(plan, cycle);
              const saving = cycle === 'annual' ? annualSavingsPct(plan) : 0;

              return (
                <div key={plan.code} className="fade-up" style={{
                  background: isPopular ? `linear-gradient(160deg, ${plan.color}18, #0d1224 60%)` : 'var(--bg-card)',
                  border: `1px solid ${isPopular ? plan.color + '60' : 'var(--border)'}`,
                  borderRadius: 20, padding: '28px 24px',
                  position: 'relative', overflow: 'hidden',
                  boxShadow: isPopular ? `0 0 40px ${plan.color}20` : 'none',
                  animationDelay: `${idx * 0.08}s`,
                }}>
                  {isPopular && (
                    <div style={{ position: 'absolute', top: 16, right: 16, padding: '4px 12px', background: plan.color, color: 'white', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>
                      MOST POPULAR
                    </div>
                  )}
                  {/* Icon + name */}
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{plan.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>{plan.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.5 }}>{plan.description}</div>

                  {/* Price */}
                  <div style={{ marginBottom: 8 }}>
                    {price === 'Custom' ? (
                      <div style={{ fontSize: 34, fontWeight: 900, color: plan.color }}>Custom</div>
                    ) : (
                      <>
                        <span style={{ fontSize: 42, fontWeight: 900, color: plan.color }}>{price}</span>
                        <span style={{ fontSize: 14, color: 'var(--text-2)', marginLeft: 4 }}>/mo platform</span>
                      </>
                    )}
                  </div>
                  {plan.pricePerSeat > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                      + ${cycle === 'monthly' ? plan.pricePerSeat : Math.round(plan.pricePerSeatAnnual / 12)}/seat/mo
                    </div>
                  )}
                  {plan.aumFeeBps > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                      + {plan.aumFeeBps} bps/yr on AUM
                    </div>
                  )}
                  {saving > 0 && (
                    <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>
                      💚 Save {saving}% vs monthly
                    </div>
                  )}

                  {/* Limits */}
                  <div style={{ margin: '16px 0', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-2)' }}>Users</span>
                      <strong>{plan.maxSeats === -1 ? 'Unlimited' : `Up to ${plan.maxSeats}`}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-2)' }}>AUM</span>
                      <strong>{formatAum(plan.maxAumUsd)}</strong>
                    </div>
                    {plan.trialDays > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-2)' }}>Free trial</span>
                        <strong style={{ color: '#a5b4fc' }}>{plan.trialDays} days</strong>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <a href="/login" style={{
                    display: 'block', textAlign: 'center', padding: '13px 0', borderRadius: 12, fontSize: 14,
                    fontWeight: 700, marginBottom: 20, transition: 'all 0.2s', cursor: 'pointer',
                    background: isPopular ? `linear-gradient(135deg, ${plan.color}, #818cf8)` : 'transparent',
                    color: isPopular ? 'white' : plan.color,
                    border: `2px solid ${isPopular ? 'transparent' : plan.color + '80'}`,
                    boxShadow: isPopular ? `0 6px 24px ${plan.color}40` : 'none',
                  }}>
                    {price === 'Custom' ? 'Contact Sales →' : `Get started →`}
                  </a>

                  {/* Features */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {plan.features.map((feat, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                        <span style={{ color: plan.color, flexShrink: 0, marginTop: 1 }}>✓</span>
                        <span style={{ color: 'var(--text-2)', lineHeight: 1.4 }}>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Trust strip */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '32px 0' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, textAlign: 'center' }}>
          {[
            { icon: '🔒', title: 'SOC 2 Type II', desc: 'Enterprise-grade security' },
            { icon: '🇧🇷', title: 'Data residency', desc: 'Brazil & multi-region' },
            { icon: '⚡', title: '99.9% uptime SLA', desc: 'For Professional & above' },
            { icon: '🤝', title: 'No lock-in', desc: 'Export your data anytime' },
          ].map(t => (
            <div key={t.title}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="container" style={{ padding: '80px 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 12 }}>
          Full feature <span className="glow-text">comparison</span>
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-2)', marginBottom: 48, fontSize: 16 }}>
          Every detail, side by side.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700, color: 'var(--text-2)', width: '40%' }}>Feature</th>
                {['Starter', 'Standard', 'Professional', 'Enterprise'].map(n => (
                  <th key={n} style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700, width: '15%' }}>{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row, i) => (
                <tr key={row.label} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '11px 16px', color: 'var(--text-2)' }}>{row.label}</td>
                  <td style={{ textAlign: 'center', padding: '11px 16px' }}><CheckIcon value={row.starter} /></td>
                  <td style={{ textAlign: 'center', padding: '11px 16px' }}><CheckIcon value={row.standard} /></td>
                  <td style={{ textAlign: 'center', padding: '11px 16px' }}><CheckIcon value={row.pro} /></td>
                  <td style={{ textAlign: 'center', padding: '11px 16px' }}><CheckIcon value={row.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="container" style={{ padding: '0 24px 80px', maxWidth: 760 }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 40 }}>
          Frequently asked <span className="glow-text">questions</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-card)', transition: 'border-color 0.2s' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                width: '100%', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left',
              }}>
                <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{faq.q}</span>
                <span style={{ fontSize: 20, color: 'var(--text-2)', marginLeft: 16, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 22px 18px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8 }}>{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ padding: '80px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 100%, rgba(99,102,241,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <h2 style={{ fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 16 }}>
          Ready to <span className="glow-text">transform</span> your family office?
        </h2>
        <p style={{ fontSize: 17, color: 'var(--text-2)', marginBottom: 32, maxWidth: 480, margin: '0 auto 32px' }}>
          Start your free 14-day trial. No credit card required. Cancel anytime.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/login" style={{ padding: '15px 32px', borderRadius: 14, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: 'white', boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
            Start free trial →
          </a>
          <a href="mailto:sales@mfonexus.com" style={{ padding: '15px 32px', borderRadius: 14, fontSize: 16, fontWeight: 700, border: '1px solid var(--border)', color: 'var(--text)' }}>
            Talk to sales
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
        <div style={{ marginBottom: 8 }}>© 2026 MFO Nexus — All rights reserved.</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
          {['Privacy', 'Terms', 'Security', 'Status', 'Contact'].map(l => <a key={l} href="#" style={{ color: 'var(--text-3)', transition: 'color 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>{l}</a>)}
        </div>
      </footer>
    </>
  );
}
