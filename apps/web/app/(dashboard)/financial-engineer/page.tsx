'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, Shield, TrendingUp, Zap, BarChart3, PieChart, 
  Settings2, Settings, DollarSign, Globe2, Activity, BookOpen, 
  Copy, Check, RotateCcw, FileText, Target, ChevronDown, ChevronUp, 
  SlidersHorizontal, ListFilter, List, Briefcase, Clock, Calendar, 
  Telescope, RefreshCw 
} from 'lucide-react';
import { usePageTitle } from '@/lib/PageTitleContext';

// ============================================================================
// CONFIGURAÇÕES DE PORTFÓLIO WEALTH (ONSHORE, OFFSHORE, CONSOLIDADO)
// E MOTOR DE PRECIFICAÇÃO REAL-TIME
// ============================================================================

const PORTFOLIOS = {
  ONSHORE: {
    id: 'ONSHORE',
    name: 'Onshore (Brasil)',
    currency: 'R$',
    rateLabel: 'Selic',
    infLabel: 'IPCA',
    defaultRate: 14.75,
    defaultInf: 3.81,
    ASSET_CLASSES: {
      posFixado: { name: 'Renda Fixa Pós-Fixada', color: 'bg-blue-600', desc: 'Reserva de oportunidade e carrego tático da Selic.' },
      ipca: { name: 'Renda Fixa Inflação', color: 'bg-orange-500', desc: 'Proteção do poder de compra e juro real.' },
      prefixado: { name: 'Renda Fixa Prefixada', color: 'bg-teal-500', desc: 'Trava de taxa em cenários de fechamento de curva.' },
      multimercado: { name: 'Hedge Funds Locais', color: 'bg-purple-600', desc: 'Estratégias Macro e Long & Short para geração de Alpha.' },
      rendaVariavel: { name: 'Equities Brasil', color: 'bg-rose-600', desc: 'Empresas de valor, dividendos e FIIs.' }
    },
    BASE_ALLOCATION: {
      conservador: { posFixado: 60, ipca: 30, prefixado: 10, multimercado: 0, rendaVariavel: 0 },
      conservador_moderado: { posFixado: 45, ipca: 30, prefixado: 10, multimercado: 10, rendaVariavel: 5 },
      moderado: { posFixado: 35, ipca: 30, prefixado: 5, multimercado: 15, rendaVariavel: 15 },
      moderado_arrojado: { posFixado: 20, ipca: 25, prefixado: 5, multimercado: 15, rendaVariavel: 35 },
      arrojado: { posFixado: 10, ipca: 20, prefixado: 5, multimercado: 20, rendaVariavel: 45 }
    },
    getYields: (rate: number, inf: number) => ({
      posFixado: rate * 0.98,
      ipca: inf + 6.5, 
      prefixado: rate > 10 ? rate - 0.5 : rate + 1.5, 
      multimercado: rate + 3.0, 
      rendaVariavel: rate + 6.0
    }),
    DEFAULT_CRITERIA: {
      posFixado: { rating: 'AA', prazo: 'Alta Liquidez', diretriz: 'Mitigação de risco de crédito bancário' },
      ipca: { rating: 'A+ a AAA', prazo: 'Duration Média (3-5a)', diretriz: 'Maximizar yield isento (CRI/CRA/Debêntures)' },
      prefixado: { rating: 'AA-', prazo: 'Até 3 anos', diretriz: 'Apenas em janelas de stress na curva' },
      multimercado: { rating: 'N/A', prazo: 'D+30 a D+60', diretriz: 'Seleção de gestores top-tier (Sharpe > 0.8)' },
      rendaVariavel: { rating: 'N/A', prazo: 'Estrutural', diretriz: 'Foco em factor investing (Value & Quality)' }
    },
    getLiveSuggestions: (rate: number, inf: number) => ({
      posFixado: [
        { name: 'Tesouro Selic 2029', issuer: 'Tesouro Nacional', metric: 'Selic + 0.18%', yield: (rate + 0.18), liquidez: 'D+0', min: 145.00 },
        { name: 'CDB Banco Master', issuer: 'Master', metric: '118% CDI', yield: (rate * 1.18), liquidez: 'Venc. 2028', min: 10000.00 },
        { name: 'LF Safra', issuer: 'Safra', metric: '114% CDI', yield: (rate * 1.14), liquidez: 'Venc. 2028', min: 50000.00 },
        { name: 'LCI Banco ABC (Isento)', issuer: 'Banco ABC', metric: '95% CDI', yield: (rate * 0.95), liquidez: 'Venc. 2027', min: 50000.00 },
      ],
      ipca: [
        { name: 'Tesouro IPCA+ 2029', issuer: 'Tesouro Nacional', metric: 'IPCA + 6.35%', yield: (inf + 6.35), liquidez: 'D+1', min: 100.00 },
        { name: 'CRI Brookfield (Isento)', issuer: 'Brookfield', metric: 'IPCA + 7.20%', yield: (inf + 7.20), liquidez: 'Venc. 2030', min: 100000.00 },
        { name: 'CRA JBS (Isento)', issuer: 'JBS', metric: 'IPCA + 7.10%', yield: (inf + 7.10), liquidez: 'Venc. 2031', min: 10000.00 },
        { name: 'Debênture Localiza', issuer: 'Localiza', metric: 'IPCA + 6.80%', yield: (inf + 6.80), liquidez: 'Venc. 2031', min: 10000.00 },
      ],
      prefixado: [
        { name: 'Tesouro Prefixado 2029', issuer: 'Tesouro Nacional', metric: 'Curva Pré', yield: rate > 12 ? (rate - 0.90) : (rate + 1.20), liquidez: 'D+1', min: 100.00 },
        { name: 'CDB BMG', issuer: 'BMG', metric: 'Curva + 1.35%', yield: rate > 12 ? (rate + 0.45) : (rate + 2.50), liquidez: 'Venc. 2029', min: 10000.00 },
        { name: 'Debênture Cemig', issuer: 'Cemig', metric: 'Curva Corporativa', yield: rate > 12 ? (rate - 0.85) : (rate + 1.80), liquidez: 'Venc. 2029', min: 50000.00 },
        { name: 'LCI Banco Inter (Isento)', issuer: 'Inter', metric: 'Curva Líquida', yield: rate > 12 ? (rate - 2.25) : (rate - 0.50), liquidez: 'Venc. 2027', min: 5000.00 },
      ],
      multimercado: [
        { name: 'SPX Nimitz', issuer: 'SPX Capital', metric: 'Alvo: CDI + 4.5%', yield: (rate + 4.5), liquidez: 'D+60', min: 50000.00 },
        { name: 'Legacy Capital', issuer: 'Legacy', metric: 'Alvo: CDI + 4.0%', yield: (rate + 4.0), liquidez: 'D+30', min: 50000.00 },
        { name: 'Kinea Chronos FIM', issuer: 'Kinea', metric: 'Alvo: CDI + 3.5%', yield: (rate + 3.5), liquidez: 'D+15', min: 10000.00 },
        { name: 'Kapitalo Kappa FIM', issuer: 'Kapitalo', metric: 'Alvo: CDI + 4.8%', yield: (rate + 4.8), liquidez: 'D+60', min: 100000.00 },
      ],
      rendaVariavel: [
        { name: 'BOVA11 (ETF)', issuer: 'BlackRock', metric: 'Ibovespa Estimado', yield: (rate + 5.0), liquidez: 'D+2', min: 130.00 },
        { name: 'Constellation Ações', issuer: 'Constellation', metric: 'Ibov + Alpha 3%', yield: (rate + 8.0), liquidez: 'D+30', min: 50000.00 },
        { name: 'VALE3', issuer: 'Vale', metric: 'Div. Yield Target', yield: 9.5, liquidez: 'D+2', min: 65.00 },
        { name: 'KNRI11 (Tijolo)', issuer: 'Kinea', metric: 'Cap Rate + Inf', yield: (inf + 6.0), liquidez: 'D+2', min: 160.00 },
      ]
    })
  },
  OFFSHORE: {
    id: 'OFFSHORE',
    name: 'Offshore (Internacional)',
    currency: 'US$',
    rateLabel: 'Fed Funds Rate',
    infLabel: 'US CPI (Inflação EUA)',
    defaultRate: 4.50,
    defaultInf: 2.80,
    ASSET_CLASSES: {
      cash: { name: 'Liquidez Offshore', color: 'bg-emerald-600', desc: 'Treasuries curtos e Cash. Proteção do principal em Dólar.' },
      igBonds: { name: 'Investment Grade Bonds', color: 'bg-blue-500', desc: 'Renda Fixa corporativa global de altíssima qualidade.' },
      hyBonds: { name: 'High Yield & Credit', color: 'bg-purple-500', desc: 'Crédito com prêmio focado em geração de yield.' },
      usEquities: { name: 'US Equities', color: 'bg-rose-500', desc: 'Exposição ao motor de crescimento global (S&P 500 / Nasdaq).' },
      globalEquities: { name: 'Global Ex-US Equities', color: 'bg-slate-600', desc: 'Mercados Desenvolvidos (Europa/Japão) e Emergentes.' }
    },
    BASE_ALLOCATION: {
      conservador: { cash: 40, igBonds: 45, hyBonds: 5, usEquities: 10, globalEquities: 0 },
      conservador_moderado: { cash: 20, igBonds: 40, hyBonds: 10, usEquities: 20, globalEquities: 10 },
      moderado: { cash: 10, igBonds: 30, hyBonds: 15, usEquities: 30, globalEquities: 15 },
      moderado_arrojado: { cash: 5, igBonds: 15, hyBonds: 15, usEquities: 45, globalEquities: 20 },
      arrojado: { cash: 5, igBonds: 10, hyBonds: 10, usEquities: 50, globalEquities: 25 }
    },
    getYields: (rate: number, inf: number) => ({
      cash: rate,
      igBonds: rate + 1.2,
      hyBonds: rate + 3.8,
      usEquities: rate + 5.5, 
      globalEquities: rate + 6.0
    }),
    DEFAULT_CRITERIA: {
      cash: { rating: 'AAA', prazo: '< 1 ano', diretriz: 'US T-Bills (1-3 meses) via ETFs líquidos' },
      igBonds: { rating: 'A a AAA', prazo: 'Duration 5-7 anos', diretriz: 'Travar yields elevados no ciclo atual do Fed' },
      hyBonds: { rating: 'BB', prazo: 'Livre', diretriz: 'Gestão Ativa obrigatória para evitar defaults' },
      usEquities: { rating: 'N/A', prazo: 'Longo Prazo', diretriz: 'Core passivo (S&P) + Satélite ativo (Tech/Healthcare)' },
      globalEquities: { rating: 'N/A', prazo: 'Longo Prazo', diretriz: 'Foco em Quality na Europa e Value no Japão' }
    },
    getLiveSuggestions: (rate: number, inf: number) => ({
      cash: [
        { name: 'SGOV (0-3M T-Bill)', issuer: 'iShares', metric: 'Fed Funds Rate', yield: rate, liquidez: 'D+2', min: 100.00 }, 
        { name: 'BIL (1-3M T-Bill)', issuer: 'SPDR', metric: 'Fed Funds Rate', yield: rate, liquidez: 'D+2', min: 90.00 },
      ],
      igBonds: [
        { name: 'LQD (Corp Bond)', issuer: 'iShares', metric: 'Spread: T + 1.2%', yield: (rate + 1.2), liquidez: 'D+2', min: 110.00 }, 
        { name: 'AGG (US Aggregate)', issuer: 'iShares', metric: 'Spread: T + 0.8%', yield: (rate + 0.8), liquidez: 'D+2', min: 98.00 },
      ],
      hyBonds: [
        { name: 'HYG (High Yield)', issuer: 'iShares', metric: 'Spread: T + 3.8%', yield: (rate + 3.8), liquidez: 'D+2', min: 75.00 }, 
        { name: 'Oaktree Global Credit', issuer: 'Oaktree', metric: 'Spread: T + 4.5%', yield: (rate + 4.5), liquidez: 'D+5', min: 50000.00 },
      ],
      usEquities: [
        { name: 'VOO (S&P 500)', issuer: 'Vanguard', metric: 'ERP: Risk Free + 5.5%', yield: (rate + 5.5), liquidez: 'D+2', min: 450.00 }, 
        { name: 'QQQ (Nasdaq 100)', issuer: 'Invesco', metric: 'Tech Growth ERP', yield: (rate + 6.5), liquidez: 'D+2', min: 430.00 },
      ],
      globalEquities: [
        { name: 'VXUS (Ex-US)', issuer: 'Vanguard', metric: 'Global ERP + 6.0%', yield: (rate + 6.0), liquidez: 'D+2', min: 60.00 }, 
        { name: 'VWO (Emergentes)', issuer: 'Vanguard', metric: 'EM Risk Premium', yield: (rate + 7.5), liquidez: 'D+2', min: 45.00 },
      ]
    })
  },
  WEALTH: {
    id: 'WEALTH',
    name: 'Wealth Consolidado',
    currency: 'R$',
    rateLabel: 'Selic (Ancoragem Custo Oportunidade)',
    infLabel: 'IPCA (Base BRL)',
    defaultRate: 14.75,
    defaultInf: 3.81,
    ASSET_CLASSES: {
      brFixed: { name: 'Core Fixed Income (BR)', color: 'bg-blue-600', desc: 'O carrego estrutural: Tesouro IPCA+ e Crédito Privado High Grade.' },
      globalFixed: { name: 'Global Fixed Income (Hedge)', color: 'bg-teal-600', desc: 'Bonds internacionais servindo como hedge cambial e descorrelação.' },
      brEquities: { name: 'Equities Regionais (BR)', color: 'bg-rose-600', desc: 'Exposição tática ao mercado local (Value/Dividends).' },
      globalEquities: { name: 'Global Equities', color: 'bg-slate-700', desc: 'O motor de crescimento do portfólio (S&P 500, Tech, Megatrends).' },
      alternatives: { name: 'Alternativos & Private Markets', color: 'bg-indigo-600', desc: 'Prêmio de iliquidez: Private Equity, Venture Capital e Real Estate.' }
    },
    BASE_ALLOCATION: {
      conservador: { brFixed: 60, globalFixed: 20, brEquities: 5, globalEquities: 10, alternatives: 5 },
      conservador_moderado: { brFixed: 50, globalFixed: 20, brEquities: 5, globalEquities: 15, alternatives: 10 },
      moderado: { brFixed: 40, globalFixed: 15, brEquities: 10, globalEquities: 20, alternatives: 15 },
      moderado_arrojado: { brFixed: 25, globalFixed: 10, brEquities: 15, globalEquities: 30, alternatives: 20 },
      arrojado: { brFixed: 15, globalFixed: 5, brEquities: 15, globalEquities: 40, alternatives: 25 }
    },
    getYields: (rate: number, inf: number) => ({
      brFixed: rate * 0.98,
      globalFixed: rate * 0.85, 
      brEquities: rate + 6.0,
      globalEquities: rate + 8.0, 
      alternatives: rate + 9.0  
    }),
    DEFAULT_CRITERIA: {
      brFixed: { rating: 'AA+', prazo: 'Match com Passivo', diretriz: 'Gestão via Carteira Administrada (Exclusiva)' },
      globalFixed: { rating: 'IG', prazo: 'Duration Média', diretriz: 'Conta Offshore para eficiência sucessória e fiscal' },
      brEquities: { rating: 'N/A', prazo: 'Longo (> 5 anos)', diretriz: 'Stock Picking fundamentalista via Gestores Independentes' },
      globalEquities: { rating: 'N/A', prazo: 'Longo (> 10 anos)', diretriz: 'Alocação estrutural e passiva (ETFs Core)' },
      alternatives: { rating: 'N/A', prazo: 'Iliquidez (7-10 anos)', diretriz: 'Captura de prêmio ilíquido via fundos de Private Equity / FIPs' }
    },
    getLiveSuggestions: (rate: number, inf: number) => ({
      brFixed: [
        { name: 'Carteira Adm. Renda Fixa', issuer: 'Wealth Management', metric: 'Alvo: 105% CDI', yield: (rate * 1.05), liquidez: 'Personalizada', min: 1000000.00 },
        { name: 'Fundo Exclusivo Renda Fixa', issuer: 'Multi-Family Office', metric: 'Alvo: IMA-B + 1%', yield: (inf + 7.0), liquidez: 'D+30', min: 10000000.00 }
      ],
      globalFixed: [
        { name: 'PIMCO GIS Income Fund', issuer: 'PIMCO', metric: 'Global Yield (Hedgeado)', yield: (rate * 0.85), liquidez: 'D+5', min: 250000.00 },
        { name: 'Oaktree Global Credit', issuer: 'Oaktree', metric: 'Credit Premium', yield: (rate * 0.95), liquidez: 'D+5', min: 250000.00 }
      ],
      brEquities: [
        { name: 'Mandato Ações Value', issuer: 'Gestores Locais', metric: 'Alvo: Ibov + 3%', yield: (rate + 8.0), liquidez: 'D+30', min: 500000.00 },
        { name: 'Carteira Adm. Dividendos', issuer: 'Wealth Management', metric: 'Yield Alvo', yield: 8.5, liquidez: 'D+3', min: 1000000.00 }
      ],
      globalEquities: [
        { name: 'Vanguard Total World (VT)', issuer: 'Vanguard', metric: 'Global Equity Premium', yield: (rate + 8.0), liquidez: 'D+2', min: 100000.00 },
        { name: 'Morgan Stanley Global Brands', issuer: 'Morgan Stanley', metric: 'Quality Growth', yield: (rate + 8.5), liquidez: 'D+5', min: 250000.00 }
      ],
      alternatives: [
        { name: 'FIP Private Equity Top-Tier', issuer: 'Patria / Kinea', metric: 'Iliquidity Premium', yield: (rate + 12.0), liquidez: 'Iliquidez (8 anos)', min: 500000.00 },
        { name: 'Venture Capital Fund', issuer: 'Monashees / Kaszek', metric: 'Venture Target IRR', yield: 25.0, liquidez: 'Iliquidez (10 anos)', min: 500000.00 },
        { name: 'Real Estate Core (FIIs Inst.)', issuer: 'CSHG / Kinea', metric: 'Cap Rate + Inf', yield: (inf + 7.5), liquidez: 'D+30', min: 250000.00 }
      ]
    })
  }
};

const PROFILE_ORDER = ['conservador', 'conservador_moderado', 'moderado', 'moderado_arrojado', 'arrojado'];
const PROFILE_NAMES: Record<string, string> = {
  conservador: 'Conservador (Preservação)',
  conservador_moderado: 'Conservador Moderado',
  moderado: 'Moderado (Balanço)',
  moderado_arrojado: 'Moderado Arrojado',
  arrojado: 'Arrojado (Crescimento Estrutural)'
};

const DEFAULT_PROMPT = `Conforme o mandato de gestão para a estratégia {{geografia}}, apresentamos o desenho estrutural do seu portfólio alinhado ao perfil {{perfil}} e horizonte de {{horizonte}}.

O racional de alocação visa {{objetivo_perfil}}. Considerando o atual custo de oportunidade (Taxa Base ancorada em {{selic}}%), {{estrategia_juros}}.

{{estrategia_inflacao}} A política de investimentos mantém aderência aos princípios de proteção fiduciária e otimização de fronteira eficiente.`;

export default function FinancialEngineerPage() {
  usePageTitle('Financial Engineer');
  // --- Global State ---
  const [activeTab, setActiveTab] = useState('WEALTH'); 
  const [profile, setProfile] = useState('moderado');
  const [amount, setAmount] = useState(5000000); 
  const [horizon, setHorizon] = useState('longo'); 
  
  // Macros state
  const [macros, setMacros] = useState<Record<string, {rate: number, inf: number}>>({
    ONSHORE: { rate: PORTFOLIOS.ONSHORE.defaultRate, inf: PORTFOLIOS.ONSHORE.defaultInf },
    OFFSHORE: { rate: PORTFOLIOS.OFFSHORE.defaultRate, inf: PORTFOLIOS.OFFSHORE.defaultInf },
    WEALTH: { rate: PORTFOLIOS.WEALTH.defaultRate, inf: PORTFOLIOS.WEALTH.defaultInf }
  });

  const [targetRealReturn, setTargetRealReturn] = useState(0); 
  const [isCustomGoal, setIsCustomGoal] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false); 
  const [copied, setCopied] = useState(false);
  
  const [assetCriteria, setAssetCriteria] = useState<any>({});
  const [expandedSection, setExpandedSection] = useState<Record<string, any>>({});
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT);
  const [showPromptConfig, setShowPromptConfig] = useState(false);

  const port = (PORTFOLIOS as any)[activeTab];
  const activeRate = macros[activeTab].rate;
  const activeInf = macros[activeTab].inf;

  useEffect(() => {
    setAssetCriteria(port.DEFAULT_CRITERIA);
    setExpandedSection({}); 
  }, [activeTab, port]);

  const handleMacroChange = (field: string, val: string) => {
    setIsSimulating(true);
    setMacros(prev => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [field]: Number(val) }
    }));
    setTimeout(() => setIsSimulating(false), 500); 
  };

  const handleCriteriaChange = (assetKey: string, field: string, value: string) => {
    setAssetCriteria((prev: any) => ({ ...prev, [assetKey]: { ...prev[assetKey], [field]: value } }));
  };

  const yields = useMemo(() => port.getYields(activeRate, activeInf), [port, activeRate, activeInf]);

  const profileStats = useMemo(() => {
    const getStats = (prof: string) => {
      let base = { ...port.BASE_ALLOCATION[prof] };
      
      const highRateThreshold = activeTab === 'OFFSHORE' ? 5.0 : 12.0;
      const lowRateThreshold = activeTab === 'OFFSHORE' ? 2.5 : 8.0;

      const keys = Object.keys(base);
      const safeAssetKey = keys[0]; 
      const riskAssetKey = activeTab === 'WEALTH' ? keys[3] : keys[keys.length - 2]; 
      const altAssetKey = activeTab === 'WEALTH' ? keys[4] : keys[keys.length - 1];

      if (activeRate >= highRateThreshold) {
        if (base[riskAssetKey] > 5) { base[riskAssetKey] -= 5; base[safeAssetKey] += 5; }
      } else if (activeRate < lowRateThreshold) {
        if (base[safeAssetKey] > 15) { base[safeAssetKey] -= 10; base[riskAssetKey] += 10; }
      }

      if (horizon === 'curto') {
        const riskShift = Math.min(base[riskAssetKey], 15);
        base[riskAssetKey] -= riskShift;
        base[safeAssetKey] += riskShift;
        
        if (activeTab === 'WEALTH' && base[altAssetKey] > 0) {
          const altShift = base[altAssetKey];
          base[altAssetKey] -= altShift;
          base[safeAssetKey] += altShift;
        }
      } else if (horizon === 'longo') {
        if (base[safeAssetKey] > 10) {
          base[safeAssetKey] -= 5;
          base[riskAssetKey] += 5;
        }
      }

      let weightedReturn = 0;
      keys.forEach(key => {
        weightedReturn += (yields[key] * (base[key] / 100));
      });

      return {
        allocation: base,
        weightedReturn,
        realReturn: weightedReturn - activeInf,
        oneYearGross: amount * (1 + (weightedReturn / 100)),
        yields
      };
    };

    return PROFILE_ORDER.reduce((acc, p) => ({ ...acc, [p]: getStats(p) }), {}) as any;
  }, [port, activeRate, activeInf, amount, yields, activeTab, horizon]);

  useEffect(() => {
    if (!isCustomGoal) {
      setTargetRealReturn(profileStats[profile].realReturn);
    } else {
      const minR = profileStats['conservador'].realReturn;
      const maxR = profileStats['arrojado'].realReturn;
      if (targetRealReturn < minR) setTargetRealReturn(minR);
      if (targetRealReturn > maxR) setTargetRealReturn(maxR);
    }
  }, [activeRate, activeInf, profile, isCustomGoal, profileStats, activeTab, targetRealReturn]);

  const dynamicStats = useMemo(() => {
    const orderedStats = PROFILE_ORDER.map(p => ({ id: p, ...profileStats[p] }));
    let lower = orderedStats[0];
    let upper = orderedStats[orderedStats.length - 1];

    for (let i = 0; i < orderedStats.length - 1; i++) {
      if (targetRealReturn >= orderedStats[i].realReturn && targetRealReturn <= orderedStats[i+1].realReturn) {
        lower = orderedStats[i];
        upper = orderedStats[i+1];
        break;
      }
    }

    if (targetRealReturn <= lower.realReturn) return { ...lower, closestProfile: lower.id };
    if (targetRealReturn >= upper.realReturn) return { ...upper, closestProfile: upper.id };

    const range = upper.realReturn - lower.realReturn;
    const weightUpper = range === 0 ? 0 : (targetRealReturn - lower.realReturn) / range;
    const weightLower = 1 - weightUpper;

    const interpolatedAllocation: any = {};
    Object.keys(port.ASSET_CLASSES).forEach(key => {
      interpolatedAllocation[key] = (lower.allocation[key] * weightLower) + (upper.allocation[key] * weightUpper);
    });

    let weightedReturn = 0;
    Object.keys(interpolatedAllocation).forEach(key => {
      weightedReturn += (yields[key] * (interpolatedAllocation[key] / 100));
    });

    return {
      allocation: interpolatedAllocation,
      weightedReturn,
      realReturn: weightedReturn - activeInf,
      oneYearGross: amount * (1 + (weightedReturn / 100)),
      yields,
      closestProfile: weightUpper > 0.5 ? upper.id : lower.id
    };
  }, [targetRealReturn, profileStats, yields, activeInf, amount, port]);

  const allocation = dynamicStats.allocation;
  const projections = dynamicStats;
  
  const liveSuggestions = useMemo(() => port.getLiveSuggestions(activeRate, activeInf), [port, activeRate, activeInf]);

  const rationale = useMemo(() => {
    const effectiveProfile = dynamicStats.closestProfile;
    
    let objetivo_perfil = '';
    if (effectiveProfile === 'conservador') objetivo_perfil = 'a máxima preservação de capital e alta liquidez para fazer face a passivos de curto prazo';
    if (effectiveProfile === 'conservador_moderado') objetivo_perfil = 'proteger o principal, incorporando prêmios de risco conservadores para eficiência fiscal e ganhos marginais';
    if (effectiveProfile === 'moderado') objetivo_perfil = 'um portfólio balanceado entre a proteção do carrego estrutural e a alocação tática em crescimento global';
    if (effectiveProfile === 'moderado_arrojado') objetivo_perfil = 'focar na maximização do retorno total (Total Return), aceitando prêmios de iliquidez e volatilidade em troca de geração de alfa a médio prazo';
    if (effectiveProfile === 'arrojado') objetivo_perfil = 'uma abordagem patrimonial de longo prazo, fortemente enviesada para equities globais e ativos alternativos';

    let estrategia_juros = '';
    if (activeTab === 'WEALTH' || activeTab === 'ONSHORE') {
      estrategia_juros = activeRate >= 12 ? 'asseguramos uma sobreponderação em renda fixa High Grade para capturar retornos reais assimétricos' : 'libertamos orçamento de risco para ativos de capital e mandatos de Private Equity';
    } else {
      estrategia_juros = activeRate >= 4.0 ? 'ancoramos a parcela core da carteira internacional em US Treasuries e crédito IG de elevada qualidade' : 'incrementamos o risco sistémico através de factor investing em equities';
    }

    let estrategia_inflacao = `Num cenário de inflação a ${activeInf.toFixed(2)}%, a engenharia do portfólio visa garantir retornos reais acima da perda de poder de compra, combinando ativos reais e indexadores diretos.`;

    const nomePerfil = isCustomGoal ? `Personalizado (${PROFILE_NAMES[effectiveProfile]})` : PROFILE_NAMES[profile];
    const horizonteStr = horizon === 'curto' ? 'Curto Prazo (< 2 anos)' : horizon === 'medio' ? 'Médio Prazo (2-5 anos)' : 'Longo Prazo (> 5 anos)';

    return promptTemplate
      .replace(/{{perfil}}/g, nomePerfil)
      .replace(/{{horizonte}}/g, horizonteStr)
      .replace(/{{geografia}}/g, port.name)
      .replace(/{{selic}}/g, activeRate.toFixed(2))
      .replace(/{{ipca}}/g, activeInf.toFixed(2))
      .replace(/{{objetivo_perfil}}/g, objetivo_perfil)
      .replace(/{{estrategia_juros}}/g, estrategia_juros)
      .replace(/{{estrategia_inflacao}}/g, estrategia_inflacao);
  }, [profile, dynamicStats.closestProfile, isCustomGoal, activeRate, activeInf, promptTemplate, port, activeTab, horizon]);

  const formatCurrency = (val: number) => new Intl.NumberFormat(activeTab === 'OFFSHORE' ? 'en-US' : 'pt-BR', { style: 'currency', currency: port.currency === 'R$' ? 'BRL' : 'USD' }).format(val);

  return (
    <div className="page-wrapper animate-fade-in" style={{ padding: '0 20px', paddingBottom: 60 }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div style={{ padding: '24px 28px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Briefcase size={26} className="text-brand-500" />
              Wealth Allocation Engine
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              Pricing mark-to-market em tempo real • Análise quantitativa
              {isSimulating && <RefreshCw size={14} className="animate-spin text-brand-500" />}
            </p>
          </div>
          <div style={{ display: 'flex', background: 'var(--bg-canvas)', padding: 4, borderRadius: 12, border: '1px solid var(--border)' }}>
            {['ONSHORE', 'OFFSHORE', 'WEALTH'].map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setIsCustomGoal(false); }}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: activeTab === tab ? 'var(--bg-surface)' : 'transparent',
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: activeTab === tab ? '1px solid var(--border)' : '1px solid transparent',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: activeTab === tab ? 'var(--shadow-sm)' : 'none'
                }}
              >
                {tab === 'ONSHORE' && '🇧🇷 Onshore'}
                {tab === 'OFFSHORE' && '🇺🇸 Offshore'}
                {tab === 'WEALTH' && '🌍 Global'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 4fr) 8fr', gap: 24 }}>
        
        {/* ─── Sidebar Configs ───────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Form */}
          <div style={{ padding: 24, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings2 size={18} className="text-brand-500" /> Parâmetros
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 8, display: 'block' }}>
                  AUM ({port.currency})
                </label>
                <div style={{ position: 'relative' }}>
                  <DollarSign className="text-brand-400" size={16} style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="input"
                    style={{ paddingLeft: 36, width: '100%', fontSize: 14, fontWeight: 700 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 8, display: 'block' }}>
                  Horizonte de Investimento
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { id: 'curto', label: 'Curto', sub: '< 2a', icon: Clock },
                    { id: 'medio', label: 'Médio', sub: '2-5a', icon: Calendar },
                    { id: 'longo', label: 'Longo', sub: '> 5a', icon: Telescope }
                  ].map(h => {
                    const Icon = h.icon;
                    const isActive = horizon === h.id;
                    return (
                      <button key={h.id} onClick={() => { setHorizon(h.id); setIsCustomGoal(false); }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', borderRadius: 8,
                          background: isActive ? 'var(--bg-surface)' : 'var(--bg-canvas)',
                          border: `1px solid ${isActive ? 'var(--brand-500)' : 'var(--border)'}`,
                          color: isActive ? 'var(--brand-500)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s'
                        }}>
                        <Icon size={16} style={{ marginBottom: 4 }} />
                        <span style={{ fontSize: 11, fontWeight: 800 }}>{h.label}</span>
                        <span style={{ fontSize: 9 }}>{h.sub}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 8, display: 'block' }}>
                  Suitability (Política de Risco)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { id: 'conservador', label: 'Conservador', icon: ShieldCheck, color: '#3b82f6' },
                    { id: 'conservador_moderado', label: 'Cons. Moderado', icon: Shield, color: '#06b6d4' },
                    { id: 'moderado', label: 'Moderado', icon: BarChart3, color: '#8b5cf6' },
                    { id: 'moderado_arrojado', label: 'Mod. Arrojado', icon: TrendingUp, color: '#f97316' },
                    { id: 'arrojado', label: 'Arrojado', icon: Zap, color: '#f43f5e' }
                  ].map(p => {
                    const isActive = !isCustomGoal && profile === p.id;
                    const Icon = p.icon;
                    return (
                      <button key={p.id} onClick={() => { setProfile(p.id); setIsCustomGoal(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8,
                          border: `1px solid ${isActive ? p.color : 'var(--border)'}`,
                          background: isActive ? `${p.color}15` : 'var(--bg-canvas)', cursor: 'pointer', transition: 'all 0.1s'
                        }}>
                        <Icon size={18} style={{ color: isActive ? p.color : 'var(--text-tertiary)' }} />
                        <span style={{ fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Contexto Macro */}
          <div style={{ padding: 24, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe2 size={18} className="text-brand-500" /> Cenário Macro
            </h2>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 20 }}>Precificação Mark-to-Market automática</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{port.rateLabel}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand-500)' }}>{activeRate.toFixed(2)}%</span>
                </div>
                <input type="range" min="0" max="20" step="0.25" value={activeRate} onChange={e => handleMacroChange('rate', e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{port.infLabel}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>{activeInf.toFixed(2)}%</span>
                </div>
                <input type="range" min="0" max="15" step="0.1" value={activeInf} onChange={e => handleMacroChange('inf', e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          {/* Goal Seeking */}
          <div style={{ padding: 24, background: 'var(--brand-500)10', border: '1px solid var(--brand-500)33', borderRadius: 'var(--radius-xl)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--brand-600)' }}>
              <Target size={18} /> Meta de Retorno Real
            </h2>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 16 }}>Ajuste a meta para gerar reposicionamento automático</p>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <input type="range" min={(profileStats as any)['conservador'].realReturn.toFixed(2)} max={(profileStats as any)['arrojado'].realReturn.toFixed(2)} step="0.05" 
                value={targetRealReturn} onChange={(e) => { setTargetRealReturn(Number(e.target.value)); setIsCustomGoal(true); }} style={{ flex: 1 }} />
              <input type="number" 
                value={targetRealReturn.toFixed(2)} onChange={e => { setTargetRealReturn(Number(e.target.value)); setIsCustomGoal(true); }}
                className="input" style={{ width: 80, fontSize: 14, fontWeight: 800, textAlign: 'right', color: 'var(--brand-600)' }}
              />
            </div>
            {isCustomGoal && (
              <div style={{ marginTop: 20, padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}>
                O modelo reposicionou taticamente para o framework <strong style={{ color: 'var(--brand-500)' }}>{PROFILE_NAMES[dynamicStats.closestProfile]}</strong> para viabilizar meta de {targetRealReturn.toFixed(2)}% real.
              </div>
            )}
          </div>
        </div>

        {/* ─── Main Analytics Board ──────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ padding: 24, background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Métrica do Portfólio (T+12m)</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 6 }}>{formatCurrency(projections.oneYearGross)}</div>
              <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={16} /> +{projections.weightedReturn.toFixed(2)}% de Retorno Anual
              </div>
            </div>
            <div style={{ padding: 24, background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-canvas))', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Alpha Spread (Real Return)</div>
              <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 6, color: 'var(--brand-500)' }}>+{projections.realReturn.toFixed(2)}%</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Prêmio livre do mandato {port.infLabel} ({activeInf.toFixed(2)}%)</div>
            </div>
          </div>

          {/* Allocation View */}
          <div style={{ padding: 24, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
              <PieChart size={20} className="text-brand-500" /> Detalhamento Tático
            </h2>

            {/* Scale Bar */}
            <div style={{ display: 'flex', height: 28, borderRadius: 14, overflow: 'hidden', marginBottom: 32, border: '1px solid var(--border)' }}>
              {Object.keys(allocation).map(key => allocation[key] > 0 && (
                <div key={key} title={port.ASSET_CLASSES[key].name} style={{
                  width: `${allocation[key]}%`, height: '100%', 
                  background: (port.ASSET_CLASSES as any)[key].color.includes('rose') ? '#f43f5e' : 
                              (port.ASSET_CLASSES as any)[key].color.includes('teal') ? '#0d9488' : 
                              (port.ASSET_CLASSES as any)[key].color.includes('blue') ? '#3b82f6' : 
                              (port.ASSET_CLASSES as any)[key].color.includes('purple') ? '#8b5cf6' : 
                              (port.ASSET_CLASSES as any)[key].color.includes('orange') ? '#f97316' : 
                              (port.ASSET_CLASSES as any)[key].color.includes('emerald') ? '#10b981' : 
                              (port.ASSET_CLASSES as any)[key].color.includes('indigo') ? '#4f46e5' : '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: 'white', borderRight: '1px solid rgba(255,255,255,0.2)'
                }}>
                  {allocation[key] >= 5 ? `${allocation[key].toFixed(1)}%` : ''}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {Object.keys(allocation).sort((a,b) => allocation[b] - allocation[a]).map(key => {
                if (allocation[key] === 0) return null;
                const asset = (port.ASSET_CLASSES as any)[key];
                const value = (amount * allocation[key]) / 100;
                return (
                  <div key={key} style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: asset.color.includes('blue') ? '#3b82f6' : asset.color.includes('rose') ? '#f43f5e' : '#64748b' }} />
                        {asset.name}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 900 }}>{allocation[key].toFixed(1)}%</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}>{asset.desc}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Volume Alocado</div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(value)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Yield Target</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{projections.yields[key].toFixed(2)}% a.a.</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* AI Generation Memo */}
          <div style={{ padding: 24, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
             <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <BookOpen size={20} className="text-brand-500" /> Parecer Estratégico do Comitê
            </h2>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', padding: '16px 20px', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 12, borderLeft: '4px solid var(--brand-500)' }}>
              {rationale.split('\n').map((p, i) => <p key={i} style={{ marginBottom: p.trim() ? 12 : 0 }}>{p}</p>)}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(rationale); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />} 
                {copied ? 'Copiado' : 'Copiar Memo'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
