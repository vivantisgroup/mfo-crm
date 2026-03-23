'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { DEFAULT_SUITABILITY_CONFIG, FAMILIES } from '@/lib/mockData';
import { logAction } from '@/lib/auditLog';
import type { RiskProfile, SuitabilityConfig } from '@/lib/types';

// ─── Steps ────────────────────────────────────────────────────────────────────
// 1. auth       — client enters their access passkey
// 2. questions  — answers each weighted question
// 3. result     — sees their profile + score gauge
// 4. declaration — "Declaro que as informações são verdadeiras" checkbox
// 5. pin        — transactional PIN confirmation (replaces physical signature)
// 6. success    — immutable audit receipt

type Step = 'auth' | 'questions' | 'result' | 'declaration' | 'pin' | 'success';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeScore(answers: Record<string, number>, config: SuitabilityConfig) {
  let weighted = 0;
  let maxPossible = 0;
  let total = 0;
  for (const q of config.questions) {
    const s = answers[q.id] ?? 0;
    total += s;
    weighted += s * q.weight;
    maxPossible += 4 * q.weight;
  }
  const pct = maxPossible > 0 ? Math.round((weighted / maxPossible) * 100) : 0;
  return { total, weighted: pct };
}

function resolveProfile(pct: number, config: SuitabilityConfig): RiskProfile {
  for (const b of config.bands) {
    if (pct >= b.minScore && pct <= b.maxScore) return b.label;
  }
  return 'conservative';
}

const CATEGORY_ICONS: Record<string, string> = {
  risk_tolerance: '⚠️',
  knowledge:      '📚',
  time_horizon:   '⏳',
  liquidity:      '💧',
  objectives:     '🎯',
  experience:     '🏆',
};

const STEP_LABELS = ['Identificação', 'Questionário', 'Resultado', 'Declaração', 'Confirmação'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreArc({ pct, color }: { pct: number; color: string }) {
  const r = 56;
  const circ = 2 * Math.PI * r;
  const filled = circ * (pct / 100);
  return (
    <svg width={140} height={140} viewBox="0 0 140 140" style={{ display: 'block', margin: '0 auto' }}>
      <circle cx={70} cy={70} r={r} fill="none" stroke="#1e293b" strokeWidth={12} />
      <circle
        cx={70} cy={70} r={r} fill="none"
        stroke={color} strokeWidth={12}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x={70} y={66} textAnchor="middle" dy="0.4em" fontSize={28} fontWeight={900} fill={color}>{pct}</text>
      <text x={70} y={90} textAnchor="middle" fontSize={11} fill="#64748b">de 100</text>
    </svg>
  );
}

function StepBar({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
      {STEP_LABELS.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? '#22c55e' : active ? '#6366f1' : '#1e293b',
                border: `2px solid ${done ? '#22c55e' : active ? '#818cf8' : '#334155'}`,
                fontSize: 13, fontWeight: 800, color: done || active ? 'white' : '#475569',
                transition: 'all 0.3s',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 9, fontWeight: done || active ? 700 : 400, color: done ? '#22c55e' : active ? '#818cf8' : '#475569', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#22c55e' : '#1e293b', margin: '0 4px', marginBottom: 22, transition: 'background 0.3s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicSuitabilityPage() {
  const params = useParams();
  const token  = params.token as string;

  const config  = DEFAULT_SUITABILITY_CONFIG;
  const family  = FAMILIES[0]; // In production: lookup from token DB
  const contact = family.members[0];

  const [step, setStep]             = useState<Step>('auth');
  const [passkey, setPasskey]       = useState('');
  const [authError, setAuthError]   = useState('');
  const [answers, setAnswers]       = useState<Record<string, number>>({});
  const [declared, setDeclared]     = useState(false);
  const [pin, setPin]               = useState('');
  const [pinError, setPinError]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refId]                     = useState(`SUB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`);

  // Live score calculation
  const { total, weighted } = useMemo(() => computeScore(answers, config), [answers, config]);
  const profile    = useMemo(() => resolveProfile(weighted, config), [weighted, config]);
  const band       = config.bands.find(b => b.label === profile)!;
  const allAnswered = config.questions.every(q => answers[q.id] !== undefined);

  const stepIndex: Record<Step, number> = {
    auth: 0, questions: 1, result: 2, declaration: 3, pin: 4, success: 5,
  };

  // Step handlers
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (passkey === '1234') { setStep('questions'); setAuthError(''); }
    else setAuthError('Chave de acesso inválida. Verifique o e-mail de convite.');
  };

  const handleAnswerSelect = (qId: string, score: number) => {
    setAnswers(prev => ({ ...prev, [qId]: score }));
  };

  const handlePin = async () => {
    if (pin !== '1234') { setPinError('PIN incorreto. Tente novamente.'); return; }
    setSubmitting(true);
    setPinError('');
    try {
      await logAction({
        tenantId: 'tenant-001',
        userId: 'client-public',
        userName: `${contact.firstName} ${contact.lastName}`,
        action: 'CLIENT_SUBMIT_SUITABILITY',
        resourceId: refId,
        resourceType: 'suitability_submission',
        resourceName: `Perfil: ${profile.toUpperCase()} | Score: ${weighted}/100`,
        status: 'success',
        metadata: JSON.stringify({
          configVersion: config.version,
          weightedScore: weighted,
          totalScore: total,
          riskProfile: profile,
          clientDeclaration: true,
          pinConfirmed: true,
          answers,
        }),
      });
      setTimeout(() => { setSubmitting(false); setStep('success'); }, 1400);
    } catch {
      setSubmitting(false);
    }
  };

  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + config.renewalMonths);

  // ─── Layout wrapper ───────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#050d1a',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 20px 80px',
    color: 'white',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: step === 'questions' ? 780 : 560,
    background: '#0d1929',
    border: '1px solid #1e293b',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
  };

  const bodyStyle: React.CSSProperties = { padding: '32px 40px 40px' };

  // ─── Render per step ──────────────────────────────────────────────────────

  // ── Auth ──
  if (step === 'auth') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, maxWidth: 440 }}>
          <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', padding: '32px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Acesso Restrito</h1>
            <p style={{ color: '#a5b4fc', fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
              Questionário de Perfil de Investidor<br />
              <strong>{family.name}</strong>
            </p>
          </div>
          <div style={{ padding: '32px 40px' }}>
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Chave de acesso (demo: 1234)
                </label>
                <input
                  type="password" autoFocus
                  value={passkey} onChange={e => setPasskey(e.target.value)}
                  placeholder="• • • •"
                  style={{
                    width: '100%', padding: '16px', borderRadius: 10, border: '1px solid #1e293b',
                    background: '#080f1d', color: 'white', fontSize: 28, textAlign: 'center',
                    letterSpacing: '0.6em', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {authError && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{authError}</p>}
              </div>
              <button type="submit" disabled={passkey.length < 4}
                style={{
                  padding: '14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: passkey.length >= 4 ? 'linear-gradient(135deg,#6366f1,#818cf8)' : '#1e293b',
                  color: 'white', fontWeight: 800, fontSize: 15, transition: 'all 0.2s',
                }}>
                Iniciar Questionário →
              </button>
            </form>
            <p style={{ fontSize: 10, color: '#334155', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
              Em conformidade com a Resolução CVM n.º 30/2021<br />e Deliberação ANBIMA n.º 21/2022
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (step === 'success') {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, maxWidth: 520 }}>
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>Submissão Concluída</h1>
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 32px' }}>
              Seu perfil foi registrado com sucesso e uma trilha de auditoria imutável foi gerada. Você será convidado a renovar em {config.renewalMonths} meses.
            </p>
            <div style={{ background: '#0a1228', border: '1px solid #1e293b', borderRadius: 14, padding: '24px 28px', textAlign: 'left', marginBottom: 24 }}>
              {[
                { label: 'Referência', value: refId },
                { label: 'Perfil de Risco', value: profile.toUpperCase(), color: band.color },
                { label: 'Score Ponderado', value: `${weighted}/100` },
                { label: 'Versão do Questionário', value: `v${config.version}` },
                { label: 'Data / Hora', value: new Date().toLocaleString('pt-BR') },
                { label: 'Expira em', value: expiryDate.toLocaleDateString('pt-BR') },
                { label: 'Validação', value: '🔐 PIN + ✅ Declaração digital' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #0f1f35' }}>
                  <span style={{ color: '#475569', fontSize: 12 }}>{row.label}</span>
                  <span style={{ fontWeight: 700, fontSize: 12, color: (row as any).color ?? 'white' }}>{row.value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => window.print()}
              style={{
                padding: '12px 28px', borderRadius: 10, border: '1px solid #1e293b',
                background: '#0d1929', color: '#94a3b8', cursor: 'pointer', fontSize: 13,
              }}>
              🖨️ Imprimir comprovante
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Questions / result / declaration / pin ──
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Brand header */}
        <div style={{ padding: '20px 40px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{family.name}</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Questionário de Perfil de Investidor — {config.name}</div>
          </div>
          <div style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700,
            background: '#22c55e18', color: '#22c55e', border: '1px solid #22c55e44',
          }}>
            🟢 Sessão segura
          </div>
        </div>

        <div style={bodyStyle}>
          {/* Step indicator — skip auth (0) and success */}
          <StepBar current={stepIndex[step] - 1} />

          {/* ── Questions ── */}
          {step === 'questions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Progress bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Responda todas as perguntas</h2>
                <span style={{ fontSize: 12, color: '#475569' }}>
                  {Object.keys(answers).length}/{config.questions.length}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 3, marginBottom: 32 }}>
                {config.questions.map(q => (
                  <div key={q.id} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: answers[q.id] ? '#6366f1' : '#1e293b',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
                {config.questions.map((q, idx) => (
                  <div key={q.id}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: answers[q.id] ? '#22c55e' : '#1e293b',
                        border: `2px solid ${answers[q.id] ? '#22c55e' : '#334155'}`,
                        fontSize: 12, fontWeight: 800,
                        transition: 'all 0.2s',
                      }}>
                        {answers[q.id] ? '✓' : idx + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#475569', marginBottom: 5 }}>
                          {CATEGORY_ICONS[q.category]} &nbsp;
                          {q.weight > 1 && <span style={{ color: '#818cf8', fontWeight: 700 }}>Peso {q.weight}x • </span>}
                          {q.required && <span style={{ color: '#ef4444' }}>Obrigatória</span>}
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, lineHeight: 1.5 }}>{q.question}</h3>
                        {q.helpText && <p style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{q.helpText}</p>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 38 }}>
                      {q.options.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => handleAnswerSelect(q.id, opt.score)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '13px 16px', borderRadius: 10, cursor: 'pointer',
                            textAlign: 'left', border: 'none', transition: 'all 0.15s',
                            background: answers[q.id] === opt.score ? '#6366f118' : '#0d1929',
                            boxShadow: `0 0 0 ${answers[q.id] === opt.score ? 2 : 1}px ${answers[q.id] === opt.score ? '#6366f1' : '#1e293b'}`,
                          }}
                        >
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                            border: `2px solid ${answers[q.id] === opt.score ? '#6366f1' : '#334155'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {answers[q.id] === opt.score && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />}
                          </div>
                          <span style={{ fontSize: 13, color: answers[q.id] === opt.score ? 'white' : '#94a3b8', flex: 1 }}>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep('result')}
                disabled={!allAnswered}
                style={{
                  marginTop: 40, padding: '15px', borderRadius: 12, border: 'none', cursor: allAnswered ? 'pointer' : 'not-allowed',
                  background: allAnswered ? 'linear-gradient(135deg,#6366f1,#818cf8)' : '#1e293b',
                  color: 'white', fontWeight: 800, fontSize: 15, transition: 'all 0.2s',
                  opacity: allAnswered ? 1 : 0.5,
                }}>
                Ver meu perfil de risco →
              </button>
            </div>
          )}

          {/* ── Result ── */}
          {step === 'result' && (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Seu Perfil de Investidor</h2>
              <p style={{ color: '#475569', fontSize: 13, marginBottom: 32 }}>
                Calculado com base nas suas {config.questions.length} respostas ponderadas.
              </p>
              <ScoreArc pct={weighted} color={band.color} />
              <div style={{ fontSize: 34, fontWeight: 900, textTransform: 'uppercase', color: band.color, marginTop: 16, letterSpacing: '0.05em' }}>
                {profile}
              </div>
              <p style={{ color: '#64748b', fontSize: 14, maxWidth: 400, margin: '12px auto 32px', lineHeight: 1.7 }}>
                {band.description}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 36 }}>
                {[
                  { label: 'Score bruto', value: `${total} pts` },
                  { label: 'Score ponderado', value: `${weighted}/100` },
                  { label: 'Renovação', value: `${config.renewalMonths} meses` },
                ].map(kv => (
                  <div key={kv.label} style={{ padding: '14px', background: '#080f1d', border: '1px solid #1e293b', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>{kv.label}</div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{kv.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep('questions')}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid #1e293b', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
                  ← Rever respostas
                </button>
                <button onClick={() => setStep('declaration')}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                  Confirmar e assinar →
                </button>
              </div>
            </div>
          )}

          {/* ── Declaration ── */}
          {step === 'declaration' && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Declaração Legal</h2>
              <p style={{ color: '#475569', fontSize: 13, marginBottom: 24, lineHeight: 1.7 }}>
                Leia atentamente o texto abaixo antes de confirmar.
              </p>
              <div style={{
                background: '#080f1d', border: '1px solid #1e293b', borderRadius: 12,
                padding: '20px 24px', marginBottom: 28, maxHeight: 240, overflowY: 'auto',
                fontSize: 13, color: '#94a3b8', lineHeight: 1.8,
              }}>
                {config.declarationText}
              </div>

              {/* Profile summary reminder */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px',
                background: `${band.color}12`, border: `1px solid ${band.color}44`, borderRadius: 10, marginBottom: 28,
              }}>
                <div style={{ fontWeight: 900, fontSize: 20, textTransform: 'uppercase', color: band.color }}>{profile}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Score ponderado: <strong style={{ color: 'white' }}>{weighted}/100</strong></div>
              </div>

              {/* Checkbox */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer', marginBottom: 32 }}>
                <div
                  onClick={() => setDeclared(d => !d)}
                  style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                    border: `2px solid ${declared ? '#22c55e' : '#334155'}`,
                    background: declared ? '#22c55e' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                  {declared && <span style={{ color: 'white', fontSize: 13, fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                  <strong style={{ color: 'white' }}>Declaro que as informações são verdadeiras</strong> e estou ciente que este ato,
                  realizado em ambiente digital autenticado, equivale à minha assinatura para fins
                  da Resolução CVM n.º 30/2021.
                </span>
              </label>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep('result')}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid #1e293b', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
                  ← Voltar
                </button>
                <button onClick={() => setStep('pin')} disabled={!declared}
                  style={{
                    flex: 2, padding: '13px', borderRadius: 10, border: 'none', cursor: declared ? 'pointer' : 'not-allowed',
                    background: declared ? 'linear-gradient(135deg,#22c55e,#16a34a)' : '#1e293b',
                    color: 'white', fontWeight: 800, fontSize: 15, opacity: declared ? 1 : 0.5,
                    transition: 'all 0.2s',
                  }}>
                  Confirmar declaração →
                </button>
              </div>
            </div>
          )}

          {/* ── PIN ── */}
          {step === 'pin' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🔐</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>PIN Transacional</h2>
              <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.7, maxWidth: 380, margin: '0 auto 32px' }}>
                Digite o PIN de 4 dígitos que você recebeu por SMS/e-mail.
                Este ato <strong style={{ color: 'white' }}>substitui a assinatura física</strong> e será registrado na trilha de auditoria com IP, data e hora.
              </p>
              <p style={{ fontSize: 10, color: '#475569', marginBottom: 20 }}>Demo: insira <strong style={{ color: '#818cf8' }}>1234</strong></p>

              <input
                type="password" maxLength={4} value={pin}
                onChange={e => { setPin(e.target.value); setPinError(''); }}
                placeholder="• • • •"
                style={{
                  width: '200px', padding: '18px', borderRadius: 12, border: `1px solid ${pinError ? '#ef4444' : '#1e293b'}`,
                  background: '#080f1d', color: 'white', fontSize: 32, textAlign: 'center',
                  letterSpacing: '0.8em', outline: 'none', display: 'block', margin: '0 auto 12px',
                  boxSizing: 'border-box',
                }}
              />
              {pinError && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{pinError}</p>}

              <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                <button onClick={() => setStep('declaration')}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid #1e293b', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
                  ← Voltar
                </button>
                <button onClick={handlePin} disabled={pin.length < 4 || submitting}
                  style={{
                    flex: 2, padding: '13px', borderRadius: 10, border: 'none',
                    background: pin.length >= 4 ? 'linear-gradient(135deg,#6366f1,#818cf8)' : '#1e293b',
                    color: 'white', fontWeight: 800, fontSize: 15,
                    cursor: pin.length >= 4 && !submitting ? 'pointer' : 'not-allowed',
                    opacity: pin.length >= 4 ? 1 : 0.5, transition: 'all 0.2s',
                  }}>
                  {submitting ? 'Registrando…' : 'Confirmar e enviar →'}
                </button>
              </div>

              <p style={{ marginTop: 24, fontSize: 10, color: '#1e293b', lineHeight: 1.7 }}>
                Metadados registrados: IP, User-Agent, Timestamp, ID do usuário, Versão do questionário v{config.version}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
