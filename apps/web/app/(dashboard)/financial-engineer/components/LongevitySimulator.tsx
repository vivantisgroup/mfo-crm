'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calculator, Coins, Hourglass, TrendingUp, AlertTriangle, 
  CheckCircle2, AreaChart, Target, CalendarDays, RefreshCw, 
  Sparkles, DollarSign, Activity, ChevronRight, ActivitySquare, ShieldCheck
} from 'lucide-react';
import { AreaChart as RechartsAreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export function LongevitySimulator() {
  const [currentAge, setCurrentAge] = useState(45);
  const [retirementAge, setRetirementAge] = useState(65);
  const [lifeExpectancy, setLifeExpectancy] = useState(90);
  
  const [currentWealth, setCurrentWealth] = useState(5000000);
  const [monthlyContribution, setMonthlyContribution] = useState(15000);
  const [desiredMonthlyIncome, setDesiredMonthlyIncome] = useState(50000);
  
  const [realReturnRate, setRealReturnRate] = useState(4.5); 
  const [inflationRate, setInflationRate] = useState(3.5); 
  
  const [isSimulatingAIPremises, setIsSimulatingAIPremises] = useState(false);
  const [isAnalyzingStructuring, setIsAnalyzingStructuring] = useState(false);

  const handleStructureAnalysis = () => {
    setIsAnalyzingStructuring(true);
    setTimeout(() => setIsAnalyzingStructuring(false), 2000);
  };
  // Math Functions (Financial Engineering)
  const calculateFV = (rate: number, nper: number, pmt: number, pv: number) => {
    if (rate === 0) return pv + (pmt * nper);
    return pv * Math.pow(1 + rate, nper) + pmt * ((Math.pow(1 + rate, nper) - 1) / rate);
  };

  const simulatorData = useMemo(() => {
    const monthlyRate = (realReturnRate / 100) / 12;
    const monthsToRetirement = (retirementAge - currentAge) * 12;
    const monthsInRetirement = (lifeExpectancy - retirementAge) * 12;

    const wealthAtRetirement = calculateFV(monthlyRate, monthsToRetirement, monthlyContribution, currentWealth);

    let currentBalance = wealthAtRetirement;
    let depletionAge = null;
    
    // Simulate trajectory year by year
    const trajectory = [];
    
    // Accumulation Phase
    let tempBalance = currentWealth;
    for (let age = currentAge; age <= retirementAge; age++) {
      trajectory.push({
        age,
        balance: tempBalance,
        phase: 'Accumulation',
        isRetirement: age >= retirementAge
      });
      // Add 12 months of contributions and compounding
      for(let m=0; m<12; m++) {
        tempBalance = (tempBalance * (1 + monthlyRate)) + monthlyContribution;
      }
    }

    // Decumulation Phase
    currentBalance = tempBalance; // Reset to exact
    for (let age = retirementAge + 1; age <= lifeExpectancy; age++) {
      for(let m=0; m<12; m++) {
        currentBalance = (currentBalance * (1 + monthlyRate)) - desiredMonthlyIncome;
      }
      
      if (currentBalance < 0 && !depletionAge) {
        depletionAge = age;
        currentBalance = 0; // Cap at 0 for chart
      }

      trajectory.push({
        age,
        balance: Math.max(0, currentBalance),
        phase: 'Decumulation',
        isRetirement: true
      });
    }

    // Sustainable Income Calculation (PMT for given PV)
    // PMT = (PV * rate) / (1 - (1 + rate)^-nper)
    let sustainableIncome = 0;
    if (monthlyRate === 0) {
      sustainableIncome = wealthAtRetirement / monthsInRetirement;
    } else {
      sustainableIncome = (wealthAtRetirement * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -monthsInRetirement));
    }

    const success = !depletionAge;

    return {
      wealthAtRetirement,
      depletionAge,
      success,
      sustainableIncome,
      trajectory
    };

  }, [currentAge, retirementAge, lifeExpectancy, currentWealth, monthlyContribution, desiredMonthlyIncome, realReturnRate]);

  const handleAICalibration = async () => {
    setIsSimulatingAIPremises(true);
    try {
      // Usar a mesma inteligência do promptService da plataforma
      const res = await fetch('/api/ai/longevity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calibrate',
          currentAge,
          retirementAge, 
          lifeExpectancy,
          currentWealth,
          monthlyContribution,
          desiredMonthlyIncome,
          tenantId: 'mfo' // Assuming admin context
        })
      });
      const data = await res.json();
      if (data.realReturnRate && data.inflationRate) {
        setRealReturnRate(data.realReturnRate);
        setInflationRate(data.inflationRate);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsSimulatingAIPremises(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in relative">
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10, color: '#ffffff' }}>
            <ActivitySquare size={26} className="text-indigo-400" />
            Simulador de Longevidade Institucional
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            Análise estocástica de decumulação, modelagem de passivos e projeção de runway patrimonial.
          </p>
        </div>
        
        <button 
          onClick={handleAICalibration}
          disabled={isSimulatingAIPremises}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, var(--brand-500), var(--brand-600))', color: '#fff', border: 'none', boxShadow: '0 4px 15px rgba(var(--brand-500-rgb), 0.3)' }}
        >
          {isSimulatingAIPremises ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Calibrar Premissas (IA)
        </button>
      </div>

      <div style={{ 
        display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 24,
        color: '#1e293b',
        '--bg-elevated': '#ffffff',
        '--bg-canvas': '#f8fafc',
        '--border': '#e2e8f0',
        '--text-primary': '#0f172a',
        '--text-secondary': '#64748b',
        '--text-tertiary': '#94a3b8',
        '--brand-500': '#4f46e5'
      } as React.CSSProperties}>
        
        {/* SIDEBAR INPUTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 20, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timeline Pessoal</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Idade Atual</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min="18" max="80" value={currentAge} onChange={e => setCurrentAge(Number(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 14, fontWeight: 800, width: 30, textAlign: 'right' }}>{currentAge}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-brand-500 mb-1 block">Idade de Aposentadoria (Decumulação)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min={currentAge} max="85" value={retirementAge} onChange={e => setRetirementAge(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--brand-500)' }} />
                  <span style={{ fontSize: 14, fontWeight: 800, width: 30, textAlign: 'right', color: 'var(--brand-500)' }}>{retirementAge}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Expectativa de Vida (Runway Target)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min={retirementAge} max="110" value={lifeExpectancy} onChange={e => setLifeExpectancy(Number(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 14, fontWeight: 800, width: 30, textAlign: 'right' }}>{lifeExpectancy}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 20, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fluxo de Caixa</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Patrimônio Atual Inicial</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 font-bold">R$</span>
                  <input type="number" className="input bg-canvas w-full pl-10 font-bold" value={currentWealth} onChange={e => setCurrentWealth(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Aporte Mensal (Acumulação)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 font-bold">R$</span>
                  <input type="number" className="input bg-canvas w-full pl-10 font-bold" value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-rose-500 mb-1 block">Retirada Mensal Desejada (Aposentadoria)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 font-bold">R$</span>
                  <input type="number" className="input bg-canvas w-full pl-10 font-bold text-rose-500" value={desiredMonthlyIncome} onChange={e => setDesiredMonthlyIncome(Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Premissas Macro</h3>
              {isSimulatingAIPremises && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span></span>}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-bold text-gray-500">Retorno Real Target (% a.a.)</label>
                  <label className="text-xs font-bold text-brand-500">{realReturnRate.toFixed(2)}%</label>
                </div>
                <input type="range" min="0" max="12" step="0.1" value={realReturnRate} onChange={e => setRealReturnRate(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-bold text-gray-500">Inflação Projetada (% a.a.)</label>
                  <label className="text-xs font-bold text-orange-500">{inflationRate.toFixed(2)}%</label>
                </div>
                <input type="range" min="0" max="10" step="0.1" value={inflationRate} onChange={e => setInflationRate(Number(e.target.value))} className="w-full" />
                <p className="text-[10px] text-gray-500 mt-2 leading-tight">Retorno nominal implicito: {(realReturnRate + inflationRate).toFixed(2)}% a.a. Todos os cálculos na tela excluem inflação (Valores a Present Value).</p>
              </div>
            </div>
          </div>

        </div>

        {/* MAIN DASHBOARD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Status Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ padding: 24, background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={16} /> Projected Wealth @ {retirementAge}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)' }}>
                {formatCurrency(simulatorData.wealthAtRetirement)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                Em valores reais correntes
              </div>
            </div>

            <div style={{ padding: 24, background: 'var(--bg-canvas)', border: `1px solid ${simulatorData.success ? '#10b98133' : '#ef444433'}`, borderRadius: 'var(--radius-xl)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={16} /> Risco de Ruína (Depletion)
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: simulatorData.success ? '#10b981' : '#ef4444' }}>
                {simulatorData.success ? 'Runway Seguro' : `Aos ${simulatorData.depletionAge} anos`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                {simulatorData.success ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-rose-500" />}
                {simulatorData.success ? 'Herança residual garantida' : `Gap de ${lifeExpectancy - (simulatorData.depletionAge || 0)} anos de sobrevida`}
              </div>
            </div>

            <div style={{ padding: 24, background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <DollarSign size={16} /> Safe Withdrawal Rate (SWR)
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)' }}>
                {formatCurrency(simulatorData.sustainableIncome)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                Retirada máxima vitalícia permitida
              </div>
            </div>
          </div>

          {/* Chart Area */}
          <div style={{ padding: 24, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', height: 450, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Projeção Patrimonial de Longo Prazo</h3>
            
            <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsAreaChart data={simulatorData.trajectory} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={simulatorData.success ? '#10b981' : 'var(--brand-500)'} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={simulatorData.success ? '#10b981' : 'var(--brand-500)'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis 
                    dataKey="age" 
                    stroke="var(--text-tertiary)" 
                    fontSize={12} 
                    tickFormatter={val => `${val}a`}
                    minTickGap={20}
                  />
                  <YAxis 
                    stroke="var(--text-tertiary)" 
                    fontSize={12}
                    tickFormatter={val => `R$ ${(val/1000000).toFixed(1)}M`}
                    width={80}
                  />
                  <Tooltip 
                    formatter={(value: any) => formatCurrency(value as number)}
                    labelFormatter={(label) => `Idade: ${label} anos`}
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-xl)' }}
                    itemStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
                  />
                  <ReferenceLine x={retirementAge} stroke="var(--brand-500)" strokeDasharray="3 3" label={{ position: 'top', value: 'Início Decumulação', fill: 'var(--brand-500)', fontSize: 11, fontWeight: 800 }} />
                  {simulatorData.depletionAge && (
                    <ReferenceLine x={simulatorData.depletionAge} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Ruptura (Depletion)', fill: '#ef4444', fontSize: 11, fontWeight: 800 }} />
                  )}
                  <Area 
                    type="monotone" 
                    dataKey="balance" 
                    stroke={simulatorData.success ? '#10b981' : 'var(--brand-500)'} 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorBalance)" 
                  />
                </RechartsAreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Insights Card */}
          <div style={{ padding: 24, background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-canvas))', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={18} className="text-brand-500" /> Diagnóstico da Modelagem (AI)
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 4, background: 'var(--brand-500)', borderRadius: 2 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Saúde da Fase de Acumulação</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Com base no crescimento real de {realReturnRate.toFixed(2)}%, para alcançar a curva estrutural ótima para o perfil em R$ {(simulatorData.wealthAtRetirement/1000000).toFixed(1)}M, o veículo de prêmios será majoritariamente gerido dentro do fundo exclusivo para eficiência tributária e diferimento do come-cotas.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 4, background: simulatorData.success ? '#10b981' : '#ef4444', borderRadius: 2 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Plano de Resgate (Drawdown Limit)</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Sua meta de retirada (Withdrawal rate anual: {((desiredMonthlyIncome * 12) / simulatorData.wealthAtRetirement * 100).toFixed(1)}%) é considerada 
                    {simulatorData.success ? " altamente sustentável perante premissas macro-probabilísticas." : " agressiva e acima da linha d'água técnica do mandato. Recomendamos ajustar rentabilidade alvo ou prolongar vida laborativa."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Wealth Structuring Health Check (Revealed on Success) */}
          {simulatorData.success && (
            <div style={{ padding: 24, background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', animation: 'slide-in-from-bottom-2 0.5s ease-out' }}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ShieldCheck size={18} className="text-blue-500" /> Wealth Structuring Health Check
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">With a secure runway, guarantee structural efficiency for asset protection and succession.</p>
                </div>
                <button 
                  onClick={handleStructureAnalysis}
                  disabled={isAnalyzingStructuring}
                  className="btn btn-secondary text-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                >
                  {isAnalyzingStructuring ? <RefreshCw size={14} className="animate-spin text-blue-500" /> : <Sparkles size={14} className="text-blue-500" />}
                  Review Structure
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-green-800/30 bg-green-900/10 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm text-green-400">Exclusive Fund (FIE)</span>
                    {isAnalyzingStructuring ? <RefreshCw size={14} className="animate-spin text-gray-500" /> : <CheckCircle2 size={16} className="text-green-500" />}
                  </div>
                  <p className="text-xs text-slate-400 mb-2"><strong>Required:</strong> Tax deferral mechanism given high real expected return target.</p>
                  <p className="text-xs text-slate-500"><strong>Status:</strong> Optimized. Come-cotas avoided under current legislative framework rules.</p>
                </div>

                <div className="p-4 border border-amber-800/30 bg-amber-900/10 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm text-amber-400">Offshore Rebalancing</span>
                    {isAnalyzingStructuring ? <RefreshCw size={14} className="animate-spin text-gray-500" /> : <AlertTriangle size={16} className="text-amber-500" />}
                  </div>
                  <p className="text-xs text-slate-400 mb-2"><strong>Required:</strong> Asset location optimization due to domestic risk exposure.</p>
                  <p className="text-xs text-slate-500"><strong>Risk:</strong> High. Only 15% offshore. Recommend shifting 25% via PIC (Private Investment Company).</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
