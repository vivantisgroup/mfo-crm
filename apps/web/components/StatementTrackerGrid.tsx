'use client';

import React, { useState, useMemo } from 'react';
import { Check, CheckCircle2, CircleDashed, Filter, Save, CalendarDays, CalendarRange, Info, Target, Inbox, Diamond, AlertCircle, Circle, BarChart2, Expand, Shrink, Type, ListCollapse, Building2, Users, Receipt, Clock, ZoomOut, ZoomIn, Globe, Mail, Bot, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';

export interface Bank {
  id: string;
  name: string;
  region: 'Offshore' | 'Onshore';
  logoUrl?: string;
  arrivalDay?: number;
  fetchMethod?: 'email' | 'auto' | 'portal';
  archived?: boolean;
}

export interface Client {
  id: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  freq: 'MON' | 'TRI';
  todos?: boolean;
}

export interface TrackerMatrix {
  [clientId: string]: {
    [bankId: string]: 'x' | 'ok' | null;
  };
}

export interface PeriodData {
  id?: string;
  period: string;
  periodName: string;
  quarter?: string;
  banks: Bank[];
  clients: Client[];
  matrix: TrackerMatrix;
}

export interface StatementTrackerGridProps {
  data: PeriodData;
  periods?: PeriodData[];
  onChange?: (newData: PeriodData) => void;
  onSave?: () => void;
  onPeriodSelect?: (id: string) => void;
  onCreatePeriod?: (year: string, month: string) => void;
  onCellClick?: (clientId: string, bankId: string) => void;
}

export function StatementTrackerGrid({
  data,
  periods = [],
  onChange,
  onSave,
  onPeriodSelect,
  onCreatePeriod,
  onCellClick
}: StatementTrackerGridProps) {
  const { userProfile } = useAuth();
  const lang = userProfile?.preferredLanguage || 'pt';

  const t = {
    monthly: lang === 'pt' ? 'Relatório Mensal' : lang === 'es' ? 'Informe Mensual' : 'Monthly Reporting',
    quarterly: lang === 'pt' ? 'Relatório Trimestral' : lang === 'es' ? 'Informe Trimestral' : 'Quarterly Reporting',
    prioHigh: lang === 'pt' ? 'Cliente Alpha (Alta Prioridade)' : lang === 'es' ? 'Cliente Alpha' : 'High Value / Alpha Client',
    prioMed: lang === 'pt' ? 'Cliente Padrão' : lang === 'es' ? 'Cliente Estándar' : 'Standard Client',
    prioLow: lang === 'pt' ? 'Baixa Prioridade' : lang === 'es' ? 'Baja Prioridad' : 'Low Priority',
    totExpected: lang === 'pt' ? 'Arquivos Esperados (Obrigatórios para fechamento)' : lang === 'es' ? 'Archivos Esperados' : 'Expected Documents',
    recTooltip: lang === 'pt' ? 'Documentos já recebidos e validados' : lang === 'es' ? 'Documentos recibidos' : 'Documents received successfully'
  };

  const [highlightClientId, setHighlightClientId] = useState<string | null>(null);
  const [highlightBankId, setHighlightBankId] = useState<string | null>(null);

  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  const [isCompactBankNames, setIsCompactBankNames] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // New Cycle Form State
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newMonth, setNewMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [isNewCycleOpen, setIsNewCycleOpen] = useState(false);

  // ── True Filtration Logic ──
  // If a Bank is highlighted, only show Clients that have expected files in that bank
  // If a Client is highlighted, only show Banks in which that client expects files
  
  const isBankRelevantForHighlight = (bankId: string) => {
    if (!highlightClientId) return true;
    return data.matrix?.[highlightClientId]?.[bankId] != null;
  };

  const isClientRelevantForHighlight = (clientId: string) => {
    if (!highlightBankId) return true;
    return data.matrix?.[clientId]?.[highlightBankId] != null;
  };

  const hasHistoricalData = (bankId: string) => {
    return data.clients.some(c => data.matrix?.[c.id]?.[bankId] != null);
  };

  const _allRelevantBanks = data.banks.filter(b => isBankRelevantForHighlight(b.id));

  // Determine which banks to actually display
  const activeBanks = _allRelevantBanks.filter(b => {
     if (b.archived) {
       // Only show if toggled, OR if it has historical data we at least want to count it (wait, if it's hidden we just hide it)
       return showArchived;
     }
     return true;
  });

  const hiddenArchivedCount = _allRelevantBanks.filter(b => b.archived && hasHistoricalData(b.id) && !showArchived).length;

  const activeClients = data.clients.filter(c => isClientRelevantForHighlight(c.id));

  // Group banks by region
  const offshoreBanks = useMemo(() => activeBanks.filter(b => b.region === 'Offshore'), [activeBanks]);
  const onshoreBanks = useMemo(() => activeBanks.filter(b => b.region === 'Onshore'), [activeBanks]);
  const sortedBanks = [...offshoreBanks, ...onshoreBanks];

  const cycleCellInfo = (clientId: string, bankId: string) => {
    if (onCellClick) {
      onCellClick(clientId, bankId);
      return;
    }
    
    // Fallback if no cell click handler
    const current = data.matrix?.[clientId]?.[bankId];
    let next: 'x' | 'ok' | null = null;
    if (current == null) next = 'x';
    else if (current === 'x') next = 'ok';
    else next = null;

    const newMatrix = { ...data.matrix };
    if (!newMatrix[clientId]) newMatrix[clientId] = {};
    newMatrix[clientId] = { ...newMatrix[clientId], [bankId]: next };

    onChange?.({ ...data, matrix: newMatrix });
  };

  const getClientTotals = (clientId: string) => {
    const row = data.matrix?.[clientId] || {};
    let total = 0;
    let rec = 0;
    Object.values(row).forEach(val => {
      if (val !== null) total++;
      if (val === 'ok') rec++;
    });
    return { total, rec };
  };

  const getBankTotals = (bankId: string) => {
    let missing = 0;
    let expected = 0;
    data.clients.forEach(c => {
      const v = data.matrix?.[c.id]?.[bankId];
      if (v !== null && v !== undefined) expected++;
      if (v === 'x') missing++;
    });
    return { missing, expected };
  };

  const toggleClientHighlight = (id: string) => {
    if (highlightClientId === id) { setHighlightClientId(null); }
    else { setHighlightClientId(id); setHighlightBankId(null); }
  };

  const toggleBankHighlight = (id: string) => {
    if (highlightBankId === id) { setHighlightBankId(null); }
    else { setHighlightBankId(id); setHighlightClientId(null); }
  };

  // ── Analytics ──
  let globalExpected = 0;
  let globalReceived = 0;
  data.clients.forEach(c => {
     const t = getClientTotals(c.id);
     globalExpected += t.total;
     globalReceived += t.rec;
  });
  const completionRate = globalExpected > 0 ? Math.round((globalReceived / globalExpected) * 100) : 0;

  // Global Projection / Historical Expectancy
  const getProjectedETA = () => {
     if (globalExpected === globalReceived && globalExpected > 0) return 'Concluído';
     
     let maxDay = 0;
     let nextBankName = '';
     let hasPending = false;
     
     activeBanks.forEach(b => {
         const t = getBankTotals(b.id);
         if (t.missing > 0 && b.arrivalDay) {
            hasPending = true;
            if (b.arrivalDay > maxDay) {
               maxDay = b.arrivalDay;
               nextBankName = b.name;
            }
         }
     });

     if (hasPending && maxDay > 0) return `Proj. Hist: Dia ${maxDay}`;
     return 'Pendente C/ Risco';
  };

  const priorityIcon = (p: string) => {
    switch (p) {
      case 'high': return <Diamond size={10} className="text-amber-500 fill-amber-500 mx-auto" />;
      case 'medium': return <Circle size={10} className="text-slate-400 fill-slate-300 mx-auto" />;
      default: return <Circle size={6} className="text-slate-200 fill-slate-200 bg-transparent mx-auto" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl shadow-sm text-[var(--text-primary)] font-sans">
      
      {/* ── Top Header & Mini Dashboard ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] rounded-t-xl shrink-0 gap-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-[1.25rem] font-bold text-[var(--text-primary)] tracking-tight">Statement Tracker</h2>
            <span className="text-xs text-[var(--text-secondary)] font-medium tracking-tight flex items-center gap-2">
               Controle Global de Recebimentos
               {data.quarter && <span className="bg-[var(--bg-elevated)] text-[10px] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-sm shadow-inner uppercase font-bold">{data.quarter}</span>}
            </span>
          </div>
        </div>

        {/* Buttons now flex-end naturally */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-md p-0.5 border border-slate-200 mr-2 shadow-inner">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-slate-800" onClick={() => setZoomLevel(Math.max(0.4, zoomLevel - 0.1))} title="Zoom Out">
               <ZoomOut size={12} />
            </Button>
            <span className="text-[10px] font-bold text-slate-500 w-8 text-center tabular-nums">{Math.round(zoomLevel * 100)}%</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-slate-800" onClick={() => setZoomLevel(Math.min(1.5, zoomLevel + 0.1))} title="Zoom In">
               <ZoomIn size={12} />
            </Button>
          </div>

          <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800" onClick={() => setIsStatsCollapsed(!isStatsCollapsed)} title="Toggle Analytics Hub">
             <BarChart2 size={14} className={isStatsCollapsed ? "opacity-50" : ""} />
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800" onClick={() => setIsCompactBankNames(!isCompactBankNames)} title="Toggle Bank Text">
             <Type size={14} className={isCompactBankNames ? "opacity-50" : ""} />
          </Button>
          <Button variant="outline" size="sm" className={`h-8 w-8 p-0 text-slate-500 hover:text-slate-800 ${showArchived ? 'bg-slate-100 shadow-inner text-amber-600 border-amber-200' : ''}`} onClick={() => setShowArchived(!showArchived)} title="Toggle Archived Institutions">
             <Inbox size={14} className={!showArchived ? "opacity-50" : ""} />
          </Button>
          
          {(highlightBankId || highlightClientId) && (
             <Button variant="ghost" size="sm" className="h-8 text-[11px] text-slate-500 hover:text-red-600 font-bold tracking-tight bg-slate-50 ml-2" onClick={() => { setHighlightBankId(null); setHighlightClientId(null); }}>
               <Filter size={14} className="mr-1.5"/> REMOVE FILTERS
             </Button>
          )}
          <Button size="sm" className="h-8 text-[11px] font-bold bg-slate-900 shadow-sm ml-2" onClick={onSave}><Save size={14} className="mr-1.5"/> Save Matrix</Button>
        </div>
      </div>

      {/* ── Matrix Area ── */}
      <div className="flex-1 overflow-auto relative">
        <TooltipProvider>
        <table
          className="w-max text-[11px] border-separate border-spacing-0 bg-[#fcfcfd]"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top left',
            marginBottom: zoomLevel < 1 ? `${(zoomLevel - 1) * 100}%` : undefined,
          }}
        >
          <thead className="sticky top-0 z-50 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
             
             {/* Region Header Row & Intake Bar (Hidden if collapsed) */}
             {!isStatsCollapsed && (
               <tr>
                 <th colSpan={6} className="bg-white border-b border-r border-slate-200 top-0 sticky left-0 z-50 h-10 px-3 align-middle">
                    <div className="flex items-center gap-2 w-full max-w-full">
                       {periods.length > 0 && onPeriodSelect && (
                         <div className="flex-1 w-full max-w-[140px]">
                            <Select value={data.id || ""} onValueChange={(val) => { if (val) onPeriodSelect(val); }}>
                               <SelectTrigger className="h-7 text-[11px] font-bold shadow-sm bg-slate-50">
                                 <SelectValue placeholder="Selecione..." />
                               </SelectTrigger>
                               <SelectContent>
                                 {periods.map(p => (
                                    <SelectItem key={p.id} value={p.id} className="text-[11px] font-bold">{p.periodName}</SelectItem>
                                 ))}
                               </SelectContent>
                            </Select>
                         </div>
                       )}
                       
                       {onCreatePeriod && (
                         <Dialog open={isNewCycleOpen} onOpenChange={setIsNewCycleOpen}>
                           <Button size="sm" variant="outline" className="h-7 w-7 p-0 shrink-0 text-slate-500 hover:text-emerald-600 shadow-sm" onClick={() => setIsNewCycleOpen(true)}><span className="text-lg leading-none">+</span></Button>
                           <DialogContent className="sm:max-w-[400px]">
                              <DialogHeader>
                                <DialogTitle>Iniciar Novo Ciclo</DialogTitle>
                              </DialogHeader>
                              <div className="flex gap-4 py-4">
                                 <div className="flex-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Mês</label>
                                    <Select value={newMonth} onValueChange={(val) => { if (val) setNewMonth(val); }}>
                                       <SelectTrigger>
                                          <SelectValue />
                                       </SelectTrigger>
                                       <SelectContent>
                                          <SelectItem value="01">Janeiro</SelectItem>
                                          <SelectItem value="02">Fevereiro</SelectItem>
                                          <SelectItem value="03">Março</SelectItem>
                                          <SelectItem value="04">Abril</SelectItem>
                                          <SelectItem value="05">Maio</SelectItem>
                                          <SelectItem value="06">Junho</SelectItem>
                                          <SelectItem value="07">Julho</SelectItem>
                                          <SelectItem value="08">Agosto</SelectItem>
                                          <SelectItem value="09">Setembro</SelectItem>
                                          <SelectItem value="10">Outubro</SelectItem>
                                          <SelectItem value="11">Novembro</SelectItem>
                                          <SelectItem value="12">Dezembro</SelectItem>
                                       </SelectContent>
                                    </Select>
                                 </div>
                                 <div className="w-[100px]">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Ano</label>
                                    <Select value={newYear} onValueChange={(val) => { if (val) setNewYear(val); }}>
                                       <SelectTrigger>
                                          <SelectValue />
                                       </SelectTrigger>
                                       <SelectContent>
                                          <SelectItem value="2024">2024</SelectItem>
                                          <SelectItem value="2025">2025</SelectItem>
                                          <SelectItem value="2026">2026</SelectItem>
                                          <SelectItem value="2027">2027</SelectItem>
                                       </SelectContent>
                                    </Select>
                                 </div>
                              </div>
                              <DialogFooter>
                                <Button size="sm" variant="outline" onClick={() => setIsNewCycleOpen(false)}>Cancelar</Button>
                                <Button size="sm" onClick={() => {
                                   onCreatePeriod(newYear, newMonth);
                                   setIsNewCycleOpen(false);
                                }} className="bg-emerald-600 hover:bg-emerald-700">Criar Tracker Zerado</Button>
                              </DialogFooter>
                           </DialogContent>
                         </Dialog>
                       )}
                    </div>
                 </th>
                 {offshoreBanks.length > 0 && (
                   <th colSpan={offshoreBanks.length} className="bg-white border-b border-l border-slate-200 font-semibold text-[10px] tracking-widest text-slate-500 uppercase text-center py-1">
                      Offshore Institutions
                   </th>
                 )}
                 {onshoreBanks.length > 0 && (
                   <th colSpan={onshoreBanks.length} className="bg-white border-b border-l border-slate-200 font-semibold text-[10px] tracking-widest text-slate-500 uppercase text-center py-1 relative">
                      Onshore Institutions
                      {hiddenArchivedCount > 0 && (
                        <div className="absolute right-2 top-1.5 flex items-center gap-1 text-[8px] text-amber-600 font-bold bg-amber-50 px-1 py-0.5 rounded outline outline-1 outline-amber-200 cursor-help" title={`${hiddenArchivedCount} Instituições Arquivadas com histórico. Clique na gaveta (Inbox) no painel superior para exibi-las.`}>
                           <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                           {hiddenArchivedCount} ARCHIVED HIDDEN
                        </div>
                      )}
                   </th>
                 )}
               </tr>
             )}

             {/* Dynamic Total Interlocking Row (Hidden if collapsed) */}
             {!isStatsCollapsed && (
               <tr className="[&_th]:bg-slate-50 [&_th]:border-b [&_th]:border-r [&_th]:border-slate-200">
                 <th colSpan={5} className="sticky left-0 bg-white z-40 text-right pr-3 border-r border-slate-100 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Total Documents Expected</th>
                 <th className="sticky left-[204px] z-40 bg-white border-r text-center border-slate-200 text-slate-800 font-bold text-[10px]"><Target size={12} className="mx-auto text-slate-400" /></th>
                 {sortedBanks.map(b => {
                   const t = getBankTotals(b.id);
                   return <th key={b.id} className="text-center font-bold text-[9px] text-slate-700" title={`Total Expected instances for ${b.name}`}>{t.expected}</th>;
                 })}
               </tr>
             )}
             
             {/* 90-Degree Vertical Bank Header Row (Hidden if compact names) */}
             {!isCompactBankNames && (
               <tr className="[&_th]:bg-white [&_th]:border-b [&_th]:border-slate-200">
                 <th colSpan={6} className={`sticky left-0 bg-white z-40 border-slate-200 border-b border-r min-w-[228px] h-[90px] p-0 outline outline-1 outline-slate-200/50`}>
                    {/* Embedded Statistics Hub */}
                    <div className="w-full h-full flex flex-col justify-center px-3 py-1.5 bg-gradient-to-br from-slate-50/80 to-white gap-1.5">
                       {/* Intake Bar Relocated */}
                       <div className="flex items-center w-full gap-2 mb-1 border-b border-slate-200/50 pb-1.5">
                         <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><Target size={11} strokeWidth={2.5}/></div>
                         <div className="flex flex-col flex-1 gap-0.5 overflow-hidden">
                            <div className="flex justify-between items-center text-[8px] font-bold text-slate-600 tracking-tight leading-none">
                               <span className="uppercase text-slate-400">Intake Completion</span>
                               <span className={completionRate === 100 ? 'text-emerald-600 whitespace-nowrap' : 'text-slate-700 whitespace-nowrap'}>{completionRate}% ({globalReceived}/{globalExpected})</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${completionRate}%` }}></div>
                            </div>
                         </div>
                       </div>

                       {/* Compact Metrics Row */}
                       <div className="flex w-full justify-between items-center mt-0.5 px-0.5">
                          <div className="flex flex-col justify-center">
                             <span className="text-[7.5px] uppercase tracking-wider text-slate-400 font-bold leading-none mb-1">Arquivos</span>
                             <span className="text-[11px] font-bold text-slate-800 leading-none">{globalExpected}</span>
                          </div>
                          <div className="flex flex-col justify-center items-center">
                             <span className="text-[7.5px] uppercase tracking-wider text-slate-400 font-bold leading-none mb-1">Instituições</span>
                             <span className="text-[11px] font-bold text-slate-800 leading-none">{activeBanks.length}</span>
                          </div>
                          <div className="flex flex-col justify-center items-end">
                             <span className="text-[7.5px] uppercase tracking-wider text-slate-400 font-bold leading-none mb-1">Famílias</span>
                             <span className="text-[11px] font-bold text-slate-800 leading-none">{activeClients.length}</span>
                          </div>
                       </div>

                       {/* ETA Full Width Bar */}
                       <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-200/50 bg-slate-50/50 px-1.5 pb-0.5 rounded">
                          <div className="flex items-center gap-1.5 shrink-0">
                             <LineChart size={10} className="text-blue-500"/>
                             <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">ETA Fechamento</span>
                          </div>
                          <span 
                            className={`text-[9.5px] font-bold leading-none truncate pl-2 ${
                              getProjectedETA() === 'Concluído' ? 'text-emerald-600' 
                              : getProjectedETA().toLowerCase().includes('risco') ? 'text-rose-600' 
                              : 'text-blue-700'
                            }`} 
                            title={getProjectedETA()}
                          >
                            {getProjectedETA()}
                          </span>
                       </div>
                    </div>
                 </th>
                 {sortedBanks.map((b) => {
                   const highlighted = b.id === highlightBankId;
                   return (
                     <th 
                        key={`name-${b.id}`} 
                        className={`h-[90px] w-[24px] min-w-[24px] max-w-[24px] px-0 align-bottom cursor-pointer transition-colors border-r border-slate-200/50 overflow-hidden ${highlighted ? '!bg-zinc-100 shadow-inner' : 'hover:bg-slate-50'}`}
                        onClick={() => toggleBankHighlight(b.id)}
                     >
                        <div className="w-[24px] h-[90px] flex items-center justify-center pb-1 cursor-pointer">
                           <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="text-[10px] font-semibold tracking-tight text-slate-600 whitespace-nowrap overflow-hidden pt-1">
                              {b.name}
                           </div>
                        </div>
                     </th>
                   );
                 })}
               </tr>
             )}

             {/* Dynamic Bank Logos Avatar Row */}
             <tr className="[&_th]:bg-white [&_th]:border-b [&_th]:border-slate-200">
               <th colSpan={6} className={`sticky left-0 bg-white z-40 border-slate-200 border-b border-r min-w-[228px] h-[24px]`}></th>
               {sortedBanks.map((b) => {
                 const highlighted = b.id === highlightBankId;
                 
                 // Hash string for deterministic brand color
                 let hash = 0;
                 for (let i = 0; i < b.name.length; i++) { hash = b.name.charCodeAt(i) + ((hash << 5) - hash); }
                 const hue = Math.abs(hash) % 360;
                 const bgColor = `hsl(${hue}, 60%, 85%)`;
                 const textColor = `hsl(${hue}, 75%, 25%)`;

                 const fetchLabel = (method: string) => {
                    switch (method) {
                       case 'auto': return 'Automático (API/Integrado)';
                       case 'portal': return 'Acesso ao Portal Obrigatório';
                       case 'email': return 'Solicitação Manual via E-mail';
                       default: return 'Indefinido';
                    }
                 };

                 return (
                   <th 
                      key={`logo-${b.id}`} 
                      className={`w-[24px] h-[24px] min-w-[24px] max-w-[24px] px-0 align-middle cursor-pointer transition-colors border-r border-slate-200/50 relative overflow-visible ${highlighted ? '!bg-zinc-100 shadow-inner' : 'hover:bg-slate-50'}`}
                      onClick={() => toggleBankHighlight(b.id)}
                   >
                     <Tooltip>
                     <TooltipTrigger>
                       <div className="flex items-center justify-center w-full h-full cursor-help relative group">
                         {b.archived && <div className="absolute inset-0 bg-white/40 z-20 pointer-events-none rounded-[4px]"></div>}
                         {b.logoUrl && (
                           <img 
                             src={b.logoUrl} 
                             alt={b.name} 
                             className={`w-[18px] h-[18px] mx-auto rounded-[4px] object-contain bg-white shadow-sm border p-[1px] ${b.archived ? 'border-amber-300 grayscale opacity-80' : 'border-slate-200/30'}`}
                             onError={(e) => {
                               e.currentTarget.style.display = 'none';
                               if (e.currentTarget.nextElementSibling) {
                                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                               }
                             }}
                           />
                         )}
                         <div 
                           className="w-[18px] h-[18px] mx-auto rounded-[4px] flex items-center justify-center text-[8px] font-bold tracking-tighter shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)]" 
                           style={{ backgroundColor: bgColor, color: textColor, display: b.logoUrl ? 'none' : 'flex' }}
                         >
                            {b.name.charAt(0).toUpperCase()}
                         </div>
                       </div>
                     </TooltipTrigger>
                     <TooltipContent side="top" className="flex flex-col gap-0.5">
                        <span className="font-bold">{b.name}</span>
                        {b.fetchMethod && (
                          <span className="text-[9px] text-slate-300 font-medium tracking-tight">Fluxo: {fetchLabel(b.fetchMethod)}</span>
                        )}
                        {b.arrivalDay && (
                          <span className="text-[9px] text-emerald-400 font-medium tracking-tight">ETA Histórico: Dia {b.arrivalDay}</span>
                        )}
                     </TooltipContent>
                     </Tooltip>
                   </th>
                 );
               })}
             </tr>

             {/* Attributes + Status Counters Alignment Row */}
             <tr className="[&_th]:bg-white [&_th]:border-b [&_th]:border-slate-200 shadow-sm relative z-30">
               <th className="sticky left-0 bg-white z-40 border-slate-200 border-b border-r w-[124px] min-w-[124px] max-w-[124px] px-1.5 py-1 text-left font-sans align-middle">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Client</span>
               </th>
               <th className="sticky left-[124px] z-40 bg-white w-[20px] min-w-[20px] px-0 align-middle text-center border-b border-slate-200 border-r border-slate-100/50 py-0.5">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help"><span className="text-[7.5px] font-bold text-amber-500 uppercase tracking-tight">Pri</span></TooltipTrigger>
                    <TooltipContent>{t.prioHigh} vs {t.prioMed}</TooltipContent>
                  </Tooltip>
               </th>
               <th className="sticky left-[144px] z-40 bg-white w-[20px] min-w-[20px] px-0 align-middle text-center border-b border-slate-200 border-r border-slate-100/50 py-0.5"><span className="text-[7.5px] font-semibold text-slate-400 uppercase tracking-tight">Tdo</span></th>
               <th className="sticky left-[164px] z-40 bg-white w-[20px] min-w-[20px] px-0 align-middle text-center border-b border-slate-200 border-r border-slate-100/50 py-0.5"><span className="text-[7.5px] font-semibold text-slate-400 uppercase tracking-tight">Frq</span></th>
               <th className="sticky left-[184px] z-40 bg-white w-[20px] min-w-[20px] px-0 align-middle text-center border-b border-slate-200 border-r border-slate-100/50 py-0.5">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help"><span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-tight border-b border-dotted border-slate-400">Tot</span></TooltipTrigger>
                    <TooltipContent>{t.totExpected}</TooltipContent>
                  </Tooltip>
               </th>
               <th className="sticky left-[204px] z-40 bg-emerald-50/20 w-[24px] min-w-[24px] px-0 align-middle text-center border-b border-r border-slate-200 py-0.5">
                  <Tooltip>
                    <TooltipTrigger className="cursor-help"><span className="text-[7.5px] font-bold text-emerald-600 uppercase tracking-tight border-b border-emerald-300 border-dotted">Rec</span></TooltipTrigger>
                    <TooltipContent>{t.recTooltip}</TooltipContent>
                  </Tooltip>
               </th>
               
               {sortedBanks.map((b) => {
                 const highlighted = b.id === highlightBankId;
                 const totals = getBankTotals(b.id);
                 return (
                   <th key={`status-${b.id}`} className={`w-[20px] px-0 py-1 align-middle border-r border-slate-200/50 transition-colors ${highlighted ? '!bg-blue-100 shadow-inner' : 'bg-slate-50/30'}`}>
                      <div className="flex justify-center items-center w-full">
                         {totals.missing > 0 ? (
                            <Tooltip>
                              <TooltipTrigger className="cursor-help">
                                <div className="w-[14px] h-[14px] rounded border border-amber-200 bg-amber-50 shadow-sm flex items-center justify-center">
                                  <span className="text-[7.5px] font-bold text-amber-600 leading-none">{totals.missing}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>{totals.missing} documentos pendentes</TooltipContent>
                            </Tooltip>
                         ) : (
                            <div className="w-[14px] h-[14px] flex items-center justify-center">
                               <Check size={9} className="text-slate-300" />
                            </div>
                         )}
                      </div>
                   </th>
                 );
               })}
             </tr>
          </thead>
          
          <tbody className="bg-white">
            {activeClients.map((c, i) => {
               const highlightedRow = c.id === highlightClientId;
               const totals = getClientTotals(c.id);

               return (
                 <tr key={c.id} className={`hover:bg-slate-50 transition-colors border-b border-slate-100 ${highlightedRow ? 'bg-zinc-50 shadow-sm ring-1 ring-zinc-200' : ''}`}>
                    <td 
                      className={`sticky left-0 bg-white z-10 px-1.5 py-0.5 border-r border-slate-200 cursor-pointer font-medium hover:bg-slate-50 transition-colors w-[124px] max-w-[124px] truncate leading-tight tracking-tight text-slate-800 text-[10px] ${highlightedRow ? '!bg-zinc-100' : ''}`}
                      onClick={() => toggleClientHighlight(c.id)}
                      title={c.name}
                    >
                      {c.name}
                    </td>
                    <td className={`sticky left-[124px] bg-white z-10 text-center w-[20px] px-0 border-r border-slate-100/50 ${highlightedRow ? '!bg-zinc-100' : ''}`}>
                       <Tooltip>
                         <TooltipTrigger className="cursor-help w-full flex justify-center py-0.5">
                           {priorityIcon(c.priority)}
                         </TooltipTrigger>
                         <TooltipContent>{c.priority === 'high' ? t.prioHigh : c.priority === 'medium' ? t.prioMed : t.prioLow}</TooltipContent>
                       </Tooltip>
                    </td>
                    <td className={`sticky left-[144px] bg-white z-10 text-center w-[20px] px-0 border-r border-slate-100/50 ${highlightedRow ? '!bg-zinc-100' : ''}`}>
                       {c.todos ? <Check size={10} className="mx-auto text-emerald-500" strokeWidth={3} /> : ''}
                    </td>
                    <td className={`sticky left-[164px] bg-white z-10 text-center w-[20px] px-0 border-r border-slate-100/50 font-semibold text-slate-500 text-[8px] ${highlightedRow ? '!bg-zinc-100' : ''}`}>
                         <Tooltip>
                           <TooltipTrigger className="cursor-help w-full flex justify-center py-0.5 outline-none">
                             {c.freq === 'MON' ? (
                                <CalendarDays size={9} className="text-slate-600 hover:text-slate-900 transition-colors" />
                             ) : (
                                <CalendarRange size={9} className="text-indigo-500 hover:text-indigo-800 transition-colors" />
                             )}
                           </TooltipTrigger>
                           <TooltipContent side="right">
                             {c.freq === 'MON' ? t.monthly : t.quarterly}
                           </TooltipContent>
                         </Tooltip>
                    </td>
                    <td className={`sticky left-[184px] bg-white z-10 text-center w-[20px] px-0 border-r border-slate-100/50 font-bold text-slate-800 text-[9px] ${highlightedRow ? '!bg-zinc-100' : ''}`}>{totals.total}</td>
                    <td className={`sticky left-[204px] bg-emerald-50/30 z-10 text-center w-[24px] px-0 border-r border-slate-200 font-bold text-emerald-600 text-[9px] ${highlightedRow ? '!bg-emerald-100/50' : ''}`}>{totals.rec}</td>

                    {/* Matrix Cells */}
                    {sortedBanks.map(b => {
                       const v = data.matrix?.[c.id]?.[b.id];
                       const highlightedCol = b.id === highlightBankId;
                       
                       let cellStyling = 'bg-white hover:bg-slate-100';
                       if (v === 'ok') cellStyling = 'bg-emerald-50/50';
                       else if (highlightedCol || highlightedRow) cellStyling = v === null ? 'bg-slate-50' : 'bg-zinc-100/80';

                       // Quiet Luxury Icons
                       let interior = null;
                       if (v === 'ok') {
                         interior = <CheckCircle2 size={12} strokeWidth={2.5} className="text-emerald-500 mx-auto drop-shadow-sm" />;
                       } else if (v === 'x') {
                         interior = <CircleDashed size={10} className="text-orange-500 mx-auto drop-shadow-sm transition-colors hover:text-orange-600" />;
                       }

                       return (
                         <td 
                            key={b.id} 
                            onClick={() => cycleCellInfo(c.id, b.id)}
                            className={`text-center cursor-pointer transition-colors w-[24px] min-w-[24px] max-w-[24px] px-0 border-r border-slate-100/80 ${cellStyling}`}
                         >
                            {interior}
                         </td>
                       );
                    })}
                 </tr>
               );
            })}
          </tbody>
          
          {/* ── Sticky Overlap Footer ── */}
          <tfoot className="sticky bottom-0 z-40 bg-white/80 backdrop-blur-md shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-slate-200">
             <tr className="text-[9px] font-semibold text-slate-800 leading-none">
               <td colSpan={5} className="sticky left-0 bg-white/80 backdrop-blur-md border-r border-slate-200 text-right pr-2 font-bold text-slate-900 tracking-widest z-50">
                  <span className="flex items-center justify-end w-full uppercase"><AlertCircle size={10} className="mr-1 text-amber-500" /> Pending Arrival</span>
               </td>
               <td className="sticky left-[204px] bg-white/80 backdrop-blur-md border-r border-slate-200 text-center font-bold text-amber-600 text-[10px] z-50">{globalExpected - globalReceived}</td>
               
               {sortedBanks.map((b) => {
                  const t = getBankTotals(b.id);
                  const emphasis = t.missing > 0 ? 'text-amber-600 font-bold bg-amber-50/70 border-r-amber-100' : 'text-slate-300 font-medium';
                  return <td key={b.id} className={`py-1 text-center border-r border-slate-200/50 ${emphasis}`}>{t.missing > 0 ? t.missing : '-'}</td>;
               })}
             </tr>
          </tfoot>
        </table>
        </TooltipProvider>
      </div>
    </div>
  );
}
