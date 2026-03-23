'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  DEFAULT_SUITABILITY_CONFIG,
  MOCK_SUITABILITY_HISTORY,
  SUITABILITY_QUESTIONS,
} from '@/lib/mockData';
import type { SuitabilityConfig, SuitabilityAuditRecord, RiskProfile } from '@/lib/types';
import { getRiskColor, formatDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuitabilityAssessmentProps {
  familyId: string;
}

type AdvisorView = 'history' | 'questionnaire' | 'config';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeWeightedScore(
  answers: Record<string, number>,
  config: SuitabilityConfig,
): { total: number; weighted: number; maxPossible: number } {
  let weighted = 0;
  let maxPossible = 0;
  let total = 0;
  for (const q of config.questions) {
    const score = answers[q.id] ?? 0;
    total += score;
    weighted += score * q.weight;
    maxPossible += 4 * q.weight;
  }
  // normalise to 0-100
  const normalised = maxPossible > 0 ? Math.round((weighted / maxPossible) * 100) : 0;
  return { total, weighted: normalised, maxPossible };
}

function resolveProfile(weightedPct: number, config: SuitabilityConfig): RiskProfile {
  for (const band of config.bands) {
    if (weightedPct >= band.minScore && weightedPct <= band.maxScore) return band.label;
  }
  return 'conservative';
}

const CATEGORY_LABELS: Record<string, string> = {
  risk_tolerance: 'Tolerância ao Risco',
  knowledge:      'Conhecimento',
  time_horizon:   'Horizonte Temporal',
  liquidity:      'Liquidez',
  objectives:     'Objetivos',
  experience:     'Experiência',
};

const CATEGORY_ICONS: Record<string, string> = {
  risk_tolerance: '⚠️',
  knowledge:      '📚',
  time_horizon:   '⏳',
  liquidity:      '💧',
  objectives:     '🎯',
  experience:     '🏆',
};

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  active:     { background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44' },
  superseded: { background: '#64748b22', color: '#94a3b8', border: '1px solid #64748b44' },
  expired:    { background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreGauge({ pct, color }: { pct: number; color: string }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const filled = circ * (pct / 100);
  return (
    <svg width={108} height={108} viewBox="0 0 108 108" style={{ display: 'block', margin: '0 auto' }}>
      <circle cx={54} cy={54} r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth={10} />
      <circle
        cx={54} cy={54} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 54 54)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x={54} y={52} textAnchor="middle" dy="0.4em" fontSize={18} fontWeight={800} fill={color}>{pct}</text>
      <text x={54} y={70} textAnchor="middle" fontSize={9} fill="var(--text-tertiary)">/ 100</text>
    </svg>
  );
}

function AuditRow({ record, config }: { record: SuitabilityAuditRecord; config: SuitabilityConfig }) {
  const [expanded, setExpanded] = useState(false);
  const band = config.bands.find(b => b.label === record.riskProfile);
  const color = band?.color ?? '#888';
  const expiry = new Date(record.expiresAt);
  const now = new Date();
  const daysToExpiry = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
  const expiryWarn = daysToExpiry > 0 && daysToExpiry < 90;

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <td>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(record.submittedAt).toLocaleDateString('pt-BR')}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{new Date(record.submittedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        </td>
        <td>
          <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', color }}>{record.riskProfile}</span>
        </td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--bg-overlay)', borderRadius: 3 }}>
              <div style={{ width: `${record.weightedScore}%`, height: 6, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, width: 30, textAlign: 'right' }}>{record.weightedScore}</span>
          </div>
        </td>
        <td style={{ fontSize: 12 }}>{record.clientName}</td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {record.clientDeclaration && <span title="Declaração aceita" style={{ fontSize: 14 }}>✅</span>}
            {record.pinConfirmed     && <span title="PIN transacional confirmado" style={{ fontSize: 14 }}>🔐</span>}
          </div>
        </td>
        <td>
          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, ...STATUS_STYLES[record.status] }}>
            {record.status === 'active' ? 'Ativo' : record.status === 'superseded' ? 'Substituído' : 'Expirado'}
          </span>
        </td>
        <td>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {expiryWarn && (
              <span style={{ fontSize: 10, color: '#f59e0b', padding: '2px 6px', background: '#f59e0b15', borderRadius: 6, border: '1px solid #f59e0b44' }}>
                Expira em {daysToExpiry}d
              </span>
            )}
            <span style={{ fontSize: 14, opacity: 0.4 }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ background: 'var(--bg-elevated)', padding: 0 }}>
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* metadata */}
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>💾 Quest. v{record.configVersion}</span>
                <span>🖥️ IP {record.ipAddress}</span>
                <span>📱 {record.userAgent.slice(0, 60)}…</span>
                <span>📅 Expira: {new Date(record.expiresAt).toLocaleDateString('pt-BR')}</span>
              </div>
              {/* answers breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                {config.questions.map(q => {
                  const score = record.answers[q.id] ?? 0;
                  const opt = q.options.find(o => o.score === score);
                  return (
                    <div key={q.id} style={{
                      padding: '8px 12px', background: 'var(--bg-surface)',
                      border: '1px solid var(--border)', borderRadius: 8,
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                        {CATEGORY_ICONS[q.category]} {CATEGORY_LABELS[q.category]}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{q.question.slice(0, 60)}…</div>
                      <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                        {opt?.label ?? 'N/A'} <span style={{ opacity: 0.5 }}>({score}pts × w{q.weight})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* declaration text snippet */}
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '8px 12px', background: 'var(--bg-overlay)', borderRadius: 6, borderLeft: '3px solid var(--brand-500)' }}>
                📝 <em>{config.declarationText.slice(0, 200)}…</em>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SuitabilityAssessment({ familyId }: SuitabilityAssessmentProps) {
  const config = DEFAULT_SUITABILITY_CONFIG;
  const history = MOCK_SUITABILITY_HISTORY.filter(r => r.familyId === familyId);
  const active  = history.find(r => r.status === 'active');

  const [view, setView]       = useState<AdvisorView>('history');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep]       = useState<'questions' | 'result'>('questions');

  const { weighted, total } = useMemo(() => computeWeightedScore(answers, config), [answers, config]);
  const profile = useMemo(() => resolveProfile(weighted, config), [weighted, config]);
  const currentBand = config.bands.find(b => b.label === profile)!;
  const allAnswered = config.questions.every(q => answers[q.id] !== undefined);

  const copyPublicLink = () => {
    const url = `${window.location.origin}/suitability/token-${familyId}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Suitability &amp; Perfil de Investidor</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Aquiério de conformidade | ANBIMA &bull; CVM Res. 30
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={copyPublicLink}>🔗 Copiar link para o cliente</button>
          {/* Tab switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
            {(['history', 'questionnaire', 'config'] as AdvisorView[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`btn btn-sm ${view === v ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ border: 'none', textTransform: 'capitalize', fontSize: 12 }}>
                {v === 'history' ? '📂 Histórico' : v === 'questionnaire' ? '📝 Questionário' : '⚙️ Config'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active profile banner ── */}
      {active && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center',
          padding: '16px 24px', borderRadius: 12,
          background: `${active ? config.bands.find(b => b.label === active.riskProfile)?.color ?? '#888' : '#888'}15`,
          border: `1px solid ${config.bands.find(b => b.label === active.riskProfile)?.color ?? '#888'}44`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: 4 }}>Perfil Atual &bull; Vigente até</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: config.bands.find(b => b.label === active.riskProfile)?.color, textTransform: 'uppercase' }}>
              {active.riskProfile}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {config.bands.find(b => b.label === active.riskProfile)?.description}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Submetido</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(active.submittedAt).toLocaleDateString('pt-BR')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Expira</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{new Date(active.expiresAt).toLocaleDateString('pt-BR')}</div>
          </div>
          <ScoreGauge pct={active.weightedScore} color={config.bands.find(b => b.label === active.riskProfile)?.color ?? '#888'} />
        </div>
      )}

      {/* ── History ── */}
      {view === 'history' && (
        <div className="card table-wrap animate-fade-in">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title">Histórico de Submissões</h3>
              <p className="text-secondary text-sm">Trilha de auditoria imutável. Cada linha inclui IP, UA, PIN e versão do questionário.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => { setView('questionnaire'); setStep('questions'); setAnswers({}); }}>
              + Nova avaliação interna
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Perfil</th>
                <th>Score (0-100)</th>
                <th>Cliente</th>
                <th>Validação</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                  Nenhuma submissão registrada ainda.
                </td></tr>
              )}
              {history.map(r => <AuditRow key={r.id} record={r} config={config} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Advisor questionnaire preview ── */}
      {view === 'questionnaire' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {step === 'questions' && (
            <>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3 }}>
                  <div style={{
                    height: 6, borderRadius: 3,
                    width: `${(Object.keys(answers).length / config.questions.length) * 100}%`,
                    background: 'var(--brand-500)', transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {Object.keys(answers).length} / {config.questions.length} respostas
                </span>
              </div>

              {config.questions.map((q, idx) => (
                <div key={q.id} className="card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: answers[q.id] ? 'var(--brand-500)' : 'var(--bg-elevated)',
                      border: `2px solid ${answers[q.id] ? 'var(--brand-500)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, color: answers[q.id] ? 'white' : 'var(--text-tertiary)',
                      transition: 'all 0.2s',
                    }}>
                      {answers[q.id] ? '✓' : idx + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        {CATEGORY_ICONS[q.category]} {CATEGORY_LABELS[q.category]}
                        {q.weight > 1 && <span style={{ marginLeft: 6, color: 'var(--brand-400)', fontWeight: 700 }}>peso {q.weight}x</span>}
                        {q.required && <span style={{ marginLeft: 6, color: '#ef4444' }}>*</span>}
                      </div>
                      <h4 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{q.question}</h4>
                      {q.helpText && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{q.helpText}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 40 }}>
                    {q.options.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt.score }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 16px', borderRadius: 8, border: 'none',
                          background: answers[q.id] === opt.score ? 'var(--brand-500)15' : 'var(--bg-elevated)',
                          boxShadow: answers[q.id] === opt.score ? `0 0 0 2px var(--brand-500)` : `0 0 0 1px var(--border)`,
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${answers[q.id] === opt.score ? 'var(--brand-500)' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {answers[q.id] === opt.score && (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-500)' }} />
                          )}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{opt.label}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)' }}>{opt.score} pts</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <button
                className="btn btn-primary"
                disabled={!allAnswered}
                onClick={() => setStep('result')}
                style={{ alignSelf: 'flex-start', minWidth: 220, height: 44 }}
              >
                Calcular perfil
              </button>
            </>
          )}

          {step === 'result' && (
            <div className="card animate-scale-in" style={{ maxWidth: 680 }}>
              <div className="card-header">
                <h3 className="card-title">Resultado — Visualização Interna</h3>
                <p className="text-secondary text-sm">Este é o fluxo que o cliente vê online (para validação interna).</p>
              </div>
              <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                <ScoreGauge pct={weighted} color={currentBand?.color ?? '#888'} />
                <div style={{ marginTop: 20, fontSize: 36, fontWeight: 900, textTransform: 'uppercase', color: currentBand?.color }}>{profile}</div>
                <p style={{ maxWidth: 480, margin: '12px auto 0', color: 'var(--text-secondary)', fontSize: 14 }}>
                  {currentBand?.description}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 32 }}>
                  {[
                    { label: 'Score bruto', value: `${total} pts` },
                    { label: 'Score ponderado', value: `${weighted}/100` },
                    { label: 'Próxima revisão', value: `${config.renewalMonths} meses` },
                  ].map(kv => (
                    <div key={kv.label} style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>{kv.label}</div>
                      <div style={{ fontWeight: 700 }}>{kv.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-footer" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={() => setStep('questions')}>Rever respostas</button>
                <button className="btn btn-outline" onClick={copyPublicLink}>🔗 Enviar link ao cliente</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Config preview ── */}
      {view === 'config' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{config.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  Versão {config.version} &bull; {config.questions.length} perguntas &bull; Renovação: {config.renewalMonths} meses &bull; PIN: {config.requirePin ? 'Sim' : 'Não'}
                </div>
              </div>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Tenant: {config.tenantId}</span>
            </div>

            {/* Score bands */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bandas de Score</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {config.bands.map(band => (
                  <div key={band.label} style={{
                    flex: band.maxScore - band.minScore,
                    padding: '10px 14px', borderRadius: 8,
                    background: band.color + '15', border: `1px solid ${band.color}44`,
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: band.color, textTransform: 'uppercase' }}>{band.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{band.minScore}–{band.maxScore} pts</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Declaration */}
            <div style={{ padding: '14px 18px', background: 'var(--bg-elevated)', borderRadius: 8, borderLeft: '3px solid var(--brand-500)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>📝 Texto da Declaração Legal</div>
              {config.declarationText}
            </div>
          </div>

          {/* Questions table */}
          <div className="card table-wrap">
            <div className="card-header">
              <h4 className="card-title">Perguntas ({config.questions.length})</h4>
              <p className="text-secondary text-sm">Configurável por tenant. Altere pesos, categorias e textos no painel de administração.</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Categoria</th>
                  <th>Pergunta</th>
                  <th>Peso</th>
                  <th>Opções</th>
                  <th>Obr.</th>
                </tr>
              </thead>
              <tbody>
                {config.questions.map((q, i) => (
                  <tr key={q.id}>
                    <td style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{i + 1}</td>
                    <td>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        {CATEGORY_ICONS[q.category]} {CATEGORY_LABELS[q.category]}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 320 }}>{q.question}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: q.weight > 1 ? 'var(--brand-400)' : 'var(--text-secondary)' }}>
                        {q.weight}x
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{q.options.length} opções (1–4 pts)</td>
                    <td>{q.required ? <span style={{ color: '#ef4444' }}>•</span> : <span style={{ opacity: 0.3 }}>-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
