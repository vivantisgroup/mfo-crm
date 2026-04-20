'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  MoreVertical, 
  FileText, 
  Download, 
  Plus, 
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit3,
  X,
  Save,
  Trash2,
  Sparkles
} from 'lucide-react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/RichTextEditor';
import { 
  CommitteeMinute, 
  AllocationRow, 
  getCommitteeMinutes, 
  saveCommitteeMinute, 
  deleteCommitteeMinute 
} from '@/lib/committeeService';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';

import { v4 as uuidv4 } from 'uuid';

// Initial default matrix for a new minute
const DEFAULT_ALLOCATION: AllocationRow[] = [
  // Onshore
  { id: '1', market: 'Onshore', assetClass: 'Renda Fixa', category: 'Pós-fixada (CDI)', position: 'Positivo', comment: '' },
  { id: '2', market: 'Onshore', assetClass: 'Renda Fixa', category: 'Pré-fixada', position: 'Neutro', comment: '' },
  { id: '3', market: 'Onshore', assetClass: 'Renda Fixa', category: 'Inflação (IPCA)', position: 'Positivo', comment: '' },
  { id: '4', market: 'Onshore', assetClass: 'Renda Variável', category: 'Bovespa', position: 'Positivo', comment: '' },
  { id: '5', market: 'Onshore', assetClass: 'Multimercado', category: 'Híbrida', position: 'Neutro', comment: '' },
  // Global
  { id: '6', market: 'Global', assetClass: 'Renda Fixa', category: 'Treasuries', position: 'Neutro', comment: '' },
  { id: '7', market: 'Global', assetClass: 'Renda Fixa', category: 'Credit', position: 'Positivo', comment: '' },
  { id: '8', market: 'Global', assetClass: 'Renda Variável', category: 'Global Equities', position: 'Positivo', comment: '' },
  { id: '9', market: 'Global', assetClass: 'Alternativos', category: 'Hedge Funds', position: 'Neutro', comment: '' }
];

const PositionBadge = ({ position }: { position: string }) => {
  if (position === 'Positivo') {
    return (
      <div className="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
        <TrendingUp size={14} /> Positivo
      </div>
    );
  }
  if (position === 'Negativo') {
    return (
      <div className="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
        <TrendingDown size={14} /> Negativo
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-bold border border-slate-300">
      <Minus size={14} /> Neutro
    </div>
  );
};

export default function CommitteePage() {
  const { setTitle } = usePageTitle();
  const { tenant, user } = useAuth();
  const tenantId = tenant?.id;
  
  const [activeTab, setActiveTab] = useState<'minutes' | 'matrix'>('minutes');
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'view'>('list');
  const [minutes, setMinutes] = useState<CommitteeMinute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [editingMinute, setEditingMinute] = useState<Partial<CommitteeMinute>>({});
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isConsensusLoading, setIsConsensusLoading] = useState(false);
  const [consensusMarket, setConsensusMarket] = useState<'onshore' | 'global'>('onshore');
  const [aiProviders, setAiProviders] = useState<{id: string, label: string}[]>([]);
  const [selectedAiProvider, setSelectedAiProvider] = useState<string>('');

  const [tenantMembers, setTenantMembers] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const db = getFirestore(firebaseApp);
    const loadMembers = async () => {
      try {
        const snap = await getDocs(collection(db, 'tenants', tenantId, 'members'));
        setTenantMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Falha ao carregar membros do tenant', err);
      }
    };
    loadMembers();
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      import('firebase/auth').then(({ getAuth }) => {
         const currentUser = getAuth(firebaseApp).currentUser;
         if (currentUser) {
            currentUser.getIdToken().then(token => {
              fetch(`/api/ai/accounting?tenantId=${tenantId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              })
              .then(res => res.json())
              .then(data => {
                if (data.providers && data.providers.length > 0) {
                  setAiProviders(data.providers);
                  setSelectedAiProvider(data.providers[0].id);
                }
              })
              .catch(console.error);
            }).catch(console.error);
         }
      });
    }

  }, [tenantId, user]);

  useEffect(() => {
    setTitle('Comitê de Investimentos', undefined, [
      { label: 'CIO Office', href: '/cio-office' },
      { label: 'Comitê' }
    ]);
  }, [setTitle]);

  const loadMinutes = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    const data = await getCommitteeMinutes(tenantId);
    setMinutes(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadMinutes();
  }, [tenantId]);

  const handleNewMinute = () => {
    setEditingMinute({
      title: '',
      summary: '',
      date: new Date().toISOString().split('T')[0],
      status: 'Draft',
      participants: user ? [{ id: user.uid, name: user.name || user.email || 'Author', initials: (user.name || 'AU').substring(0,2).toUpperCase() }] : [],
      deliberationText: '<p>Insira as deliberações aqui...</p>',
      allocationData: [...DEFAULT_ALLOCATION],
      tenantId: tenantId || ''
    });
    setViewMode('editor');
  };

  const handleEdit = (minute: CommitteeMinute) => {
    setEditingMinute({ ...minute });
    setViewMode('editor');
  };

  const handleSave = async () => {
    if (!tenantId) {
      toast.error("Erro interno. Sem tenant ID.");
      return;
    }
    
    // Auto-generate a title since the user requested no title field
    const finalTitle = editingMinute.title || `Ata de Reunião - ${editingMinute.date}`;
    const minuteToSave = {
      ...editingMinute,
      title: finalTitle,
      summary: ''
    };

    try {
      await saveCommitteeMinute(minuteToSave as CommitteeMinute);
      setViewMode('list');
      loadMinutes();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar Ata');
    }
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingMinute({});
  };

  const handleExportPdf = async (minuteTitle: string, elementId: string = 'official-minute-document') => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Fallback to window.print if js fails, but try html2pdf first
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin:       10,
        filename:     `${minuteTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };
      
      html2pdf().set(opt).from(element).save();
      toast.success('PDF gerado com sucesso!');
    } catch (err) {
      console.error(err);
      window.print();
    }
  };

  const handlePdfIngestion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId || !user) return;
    setIsAiLoading(true);

    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth(firebaseApp).currentUser?.getIdToken();
      if (!token) throw new Error('Não autenticado');

      const formData = new FormData();
      formData.append('file', file);
      
      // Parse PDF
      let parseRes = await fetch('/api/tools/parse-pdf', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const parseData = await parseRes.json();
      if (!parseData.text) throw new Error('Não foi possível extrair o texto do PDF');

      // AI Transcribe
      const aiRes = await fetch('/api/ai/committee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rawText: parseData.text,
          tenantId: tenantId,
          provider: selectedAiProvider || 'openai'
        })
      });

      if (!aiRes.ok) {
         const err = await aiRes.json();
         throw new Error(err.details || 'Falha na IA do Comitê');
      }

      const inferredData = await aiRes.json();
      
      // Hydrate missing IDs to allocation matrix elements
      const finalAllocation = (inferredData.allocationData || []).map((row: any) => ({
        ...row,
        id: uuidv4()
      }));

      // Set State
      setEditingMinute(prev => ({
         ...prev,
         deliberationText: inferredData.deliberationText || prev.deliberationText,
         allocationData: finalAllocation.length > 0 ? finalAllocation : prev.allocationData
      }));

      toast.error('Ata Ingerida via IA com Sucesso!');

    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao inferir Ata: ' + err.message);
    } finally {
       setIsAiLoading(false);
       if (e.target) e.target.value = '';
    }
  };

  const handleGenerateConsensus = async () => {
    if (!tenantId || !user) return;
    setIsConsensusLoading(true);
    
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth(firebaseApp).currentUser?.getIdToken();
      if (!token) throw new Error('Não autenticado');

      const res = await fetch('/api/ai/consensus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenantId,
          marketType: consensusMarket
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha na IA');
      }

      const inferredData = await res.json();
      
      const finalAllocation = (inferredData.allocationData || []).map((row: any) => ({
        ...row,
        id: uuidv4()
      }));

      setEditingMinute(prev => ({
         ...prev,
         deliberationText: inferredData.deliberationText || prev.deliberationText,
         allocationData: finalAllocation.length > 0 ? finalAllocation : prev.allocationData
      }));

      toast.success('Consenso de Mercado gerado e importado!');

    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao gerar consenso: ' + err.message);
    } finally {
      setIsConsensusLoading(false);
    }
  };

  if (viewMode === 'editor') {
    return (
      <div className="space-y-6 max-w-[1200px] mx-auto pb-12 animate-fade-in">
        {/* Editor Header */}
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={handleCancel} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
              <ArrowRight size={20} className="rotate-180" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{editingMinute.id ? 'Editar Ata' : 'Nova Ata de Comitê'}</h2>
              <p className="text-[13px] text-slate-500">Desenvolva as teses e defina a matriz direcional.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={editingMinute.status} 
              onChange={e => setEditingMinute({...editingMinute, status: e.target.value as any})}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="Draft">Rascunho (Draft)</option>
              <option value="Revisão">Em Revisão</option>
              <option value="Aprovada">Aprovada & Assinada</option>
            </select>
            <button disabled={isAiLoading} onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm shadow-sm transition-colors">
              {isAiLoading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={16} />} 
              {isAiLoading ? 'Processando IA...' : 'Salvar Ata'}
            </button>
          </div>
        </div>

        {/* AI Action Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 rounded-xl shadow-sm text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
              <h3 className="font-bold flex items-center gap-2"><Sparkles size={16} /> Inteligência Artificial de Investimentos</h3>
              <p className="text-[13px] text-blue-100 mt-1">Carregue um PDF de uma ata escaneada ou gere o consenso de mercado baseado em análises de bancos de atacado.</p>
           </div>
           
           <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Box: Upload PDF */}
              <div className="flex items-center gap-2 bg-black/10 p-1.5 rounded-lg border border-white/10">
                 <select value={selectedAiProvider} onChange={e => setSelectedAiProvider(e.target.value)} className="bg-transparent text-white border-r border-white/20 text-[13px] px-2 py-1 outline-none font-medium appearance-none">
                    {aiProviders.length === 0 && <option value="" className="text-black">Sem IA</option>}
                    {aiProviders.map(p => <option key={p.id} value={p.id} className="text-black">{p.label}</option>)}
                 </select>
                 <label className={`cursor-pointer flex items-center gap-2 px-3 py-1 text-sm font-bold transition-colors ${aiProviders.length === 0 || isAiLoading ? 'opacity-50 pointer-events-none' : 'hover:bg-white/10 rounded'}`}>
                    <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfIngestion} disabled={isAiLoading || aiProviders.length === 0} />
                    <FileText size={14} /> Ingerir PDF
                 </label>
              </div>

              {/* Box: Consensus */}
              <div className="flex items-center gap-2 bg-black/10 p-1.5 rounded-lg border border-white/10">
                 <select 
                   value={consensusMarket} 
                   onChange={e => setConsensusMarket(e.target.value as 'onshore' | 'global')} 
                   className="bg-transparent text-white border-r border-white/20 text-[13px] px-2 py-1 outline-none font-medium appearance-none"
                 >
                    <option value="onshore" className="text-black">Onshore (BR)</option>
                    <option value="global" className="text-black">Global (Offshore)</option>
                 </select>
                 <button 
                   onClick={handleGenerateConsensus} 
                   disabled={isConsensusLoading} 
                   className="flex items-center gap-2 text-white px-3 py-1 text-sm font-bold shadow-sm transition-colors hover:bg-white/10 rounded disabled:opacity-50"
                 >
                    {isConsensusLoading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Sparkles size={14} />} 
                    Gerar Consenso
                 </button>
              </div>
           </div>
        </div>

        {/* Editor Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-4 text-slate-700">
                <Calendar size={20} className="text-blue-600" />
                <input 
                  type="date"
                  value={editingMinute.date}
                  onChange={e => setEditingMinute({...editingMinute, date: e.target.value})}
                  className="font-bold text-lg bg-transparent outline-none uppercase"
                />
              </div>
              <div className="h-px bg-slate-100 my-4" />
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Deliberações</label>
                <RichTextEditor 
                  content={editingMinute.deliberationText || ''} 
                  onChange={html => setEditingMinute({...editingMinute, deliberationText: html})}
                  placeholder="Registre os principais pontos discutidos, riscos mapeados e recomendações..."
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
               <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                 <span>Matriz de Alocação Oficial</span>
                 <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px]">Anexada a esta Ata</span>
               </label>
               <p className="text-[13px] text-slate-500 mb-4">Esta matriz dita as premissas e a exposição sugerida para o portfólio durante a vigência desta tese.</p>
               
               {['Onshore', 'Global'].map(market => {
                  const rows = (editingMinute.allocationData || []).map((row, idx) => ({ ...row, originalIndex: idx })).filter(r => r.market === market);
                  
                  return (
                    <div key={market} className="mb-6 last:mb-0">
                      <div className="flex items-center justify-between mb-3 border-b pb-2">
                        <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">{market}</h4>
                        <button onClick={() => {
                          const newData = [...(editingMinute.allocationData || [])];
                          newData.push({ id: uuidv4(), market: market as 'Onshore' | 'Global', assetClass: 'Nova Classe', category: 'Categoria', position: 'Neutro', comment: '' });
                          setEditingMinute({...editingMinute, allocationData: newData});
                        }} className="text-[11px] font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800 transition-colors bg-blue-50 px-2 py-1 rounded">
                          <Plus size={12} /> Adicionar Linha
                        </button>
                      </div>

                      {rows.length === 0 && <div className="text-xs text-slate-400 italic mb-4">Nenhuma alocação definida.</div>}
                      
                      <div className="space-y-3">
                        {rows.map((row) => (
                          <div key={row.originalIndex} className="border border-slate-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-start bg-slate-50/50 group">
                            <div className="col-span-3">
                              <input value={row.assetClass} onChange={e => {
                                const newData = [...(editingMinute.allocationData || [])];
                                newData[row.originalIndex].assetClass = e.target.value;
                                setEditingMinute({...editingMinute, allocationData: newData});
                              }} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-500" placeholder="Classe (ex: Renda Fixa)" />
                            </div>
                            <div className="col-span-3">
                              <input value={row.category} onChange={e => {
                                const newData = [...(editingMinute.allocationData || [])];
                                newData[row.originalIndex].category = e.target.value;
                                setEditingMinute({...editingMinute, allocationData: newData});
                              }} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500" placeholder="Categoria" />
                            </div>
                            <div className="col-span-2">
                              <select value={row.position} onChange={e => {
                                const newData = [...(editingMinute.allocationData || [])];
                                newData[row.originalIndex].position = e.target.value as any;
                                setEditingMinute({...editingMinute, allocationData: newData});
                              }} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-semibold outline-none focus:border-blue-500">
                                <option value="Positivo">Positivo</option>
                                <option value="Neutro">Neutro</option>
                                <option value="Negativo">Negativo</option>
                              </select>
                            </div>
                            <div className="col-span-3">
                              <textarea value={row.comment} onChange={e => {
                                const newData = [...(editingMinute.allocationData || [])];
                                newData[row.originalIndex].comment = e.target.value;
                                setEditingMinute({...editingMinute, allocationData: newData});
                              }} className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500 min-h-[60px] resize-none" placeholder="Tese / Racional..." />
                            </div>
                            <div className="col-span-1 flex items-center justify-center pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => {
                                const newData = [...(editingMinute.allocationData || [])];
                                newData.splice(row.originalIndex, 1);
                                setEditingMinute({...editingMinute, allocationData: newData});
                              }} className="text-slate-400 hover:text-rose-500 p-1">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
               })}
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Metadados da Reunião</label>
              <div className="space-y-3">
                <div>
                  <span className="text-[11px] text-slate-500 font-bold mb-1 block">Data Base (Reference Date)</span>
                  <input type="date" value={editingMinute.date} onChange={e => setEditingMinute({...editingMinute, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" />
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 font-bold mb-2 block">Participantes e Conselho</span>
                  
                  <div className="space-y-2 mb-3">
                    {(editingMinute.participants || []).map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {p.initials}
                          </div>
                          <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">{p.name} {idx === 0 && <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded ml-1 border border-indigo-100">CIO / Relator</span>}</span>
                        </div>
                        <button onClick={() => {
                          const newParts = [...(editingMinute.participants || [])];
                          newParts.splice(idx, 1);
                          setEditingMinute({...editingMinute, participants: newParts});
                        }} className="text-slate-400 hover:text-rose-500 shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {(editingMinute.participants || []).length === 0 && (
                      <div className="text-[11px] text-slate-400 italic">Nenhum participante adicionado.</div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <select 
                      id="new-participant"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500 text-slate-700"
                    >
                      <option value="">Selecione um membro do seu Tenant...</option>
                      {tenantMembers.filter(m => !(editingMinute.participants || []).some(p => p.id === m.id)).map(member => (
                        <option key={member.id} value={member.id}>
                          {member.displayName || member.email} ({member.role || 'Membro'})
                        </option>
                      ))}
                    </select>
                    <button 
                      onClick={() => {
                         const select = document.getElementById('new-participant') as HTMLSelectElement;
                         if (!select) return;
                         const val = select.value;
                         if (val) {
                            const member = tenantMembers.find(m => m.id === val);
                            if (!member) return;
                            const newParts = [...(editingMinute.participants || [])];
                            const name = member.displayName || member.email || 'Usuário';
                            const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                            newParts.push({ id: member.id, name, initials });
                            setEditingMinute({...editingMinute, participants: newParts});
                            select.value = '';
                         }
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded-lg border border-slate-200 transition-colors shrink-0"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 leading-tight">O primeiro participante da lista é considerado o CIO / Diretor Responsável pela ata.</p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- LIST MODE CONTENT (READ-ONLY) ---

  // Get the latest approved matrix
  const latestApprovedMatrixMinute = minutes.find(m => m.status === 'Aprovada' && m.allocationData && m.allocationData.length > 0);
  const matrixToRender = latestApprovedMatrixMinute?.allocationData || DEFAULT_ALLOCATION;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12 animate-fade-in print:pb-0">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-faint)] text-[var(--brand-primary)] flex items-center justify-center">
              <Building2 size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">Comitê de Investimentos - {tenant?.name || 'Multi-Family Office'}</h1>
              <p className="text-[13px] text-[var(--text-secondary)] font-medium">Governança institucional, atas direcionais e teses macroeconômicas.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[var(--border-subtle)] hover:bg-[var(--bg-muted)] text-[var(--text-secondary)] rounded-xl transition-all font-bold text-[13px] shadow-sm">
            <Calendar size={16} />
            Agendar Comitê
          </button>
          <button onClick={handleNewMinute} className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-emphasis)] text-white rounded-xl transition-all font-bold tracking-wide text-[13px] shadow-md shadow-[var(--brand-primary)]/20">
            <Plus size={16} />
            Nova Ata
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-6 border-b border-[var(--border-subtle)] px-2 print:hidden">
        <button 
          onClick={() => setActiveTab('minutes')}
          className={`pb-3 text-[14px] font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'minutes' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
        >
          <FileText size={16} />
          Histórico & Atas
        </button>
        <button 
          onClick={() => setActiveTab('matrix')}
          className={`pb-3 text-[14px] font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'matrix' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
        >
          <TrendingUp size={16} />
          Matriz de Alocação Oficial
        </button>
      </div>

      {/* CONTENT: HISTÓRICO */}
      {activeTab === 'minutes' && (
        <div className="bg-white rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-sm animate-fade-in min-h-[300px]">
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search size={16} className="text-[var(--text-tertiary)]" />
              <input 
                type="text" 
                placeholder="Buscar por data ou resumo..." 
                className="bg-transparent border-none outline-none text-[13px] w-64 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] font-medium"
              />
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center p-12"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
          ) : minutes.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-medium">Nenhuma ata registrada neste tenant. Crie a sua primeira avaliação clicando em "Nova Ata".</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-muted)] border-b border-[var(--border-subtle)]">
                  <th className="px-5 py-3 text-[11px] font-extrabold text-[var(--text-secondary)] uppercase tracking-widest">Data</th>
                  <th className="px-5 py-3 text-[11px] font-extrabold text-[var(--text-secondary)] uppercase tracking-widest">Identificação da Ata</th>
                  <th className="px-5 py-3 text-[11px] font-extrabold text-[var(--text-secondary)] uppercase tracking-widest">Status</th>
                  <th className="px-5 py-3 text-[11px] font-extrabold text-[var(--text-secondary)] uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {minutes.map((m) => (
                  <tr key={m.id} onClick={() => handleEdit(m)} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-muted)]/50 transition-colors cursor-pointer group">
                    <td className="px-5 py-4 font-bold text-[var(--text-primary)]">{m.date}</td>
                    <td className="px-5 py-4 min-w-[280px]">
                      <p className="font-bold text-[13px] text-[var(--text-primary)] group-hover:text-[var(--brand-primary)]">{m.title}</p>
                    </td>
                    <td className="px-5 py-4">
                      {m.status === 'Aprovada' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                          <CheckCircle2 size={12} /> Aprovada
                        </span>
                      )}
                      {m.status === 'Revisão' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200">
                          <Clock size={12} /> Em Revisão
                        </span>
                      )}
                      {m.status === 'Draft' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-300">
                          <Edit3 size={12} /> Rascunho
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { handleEdit(m); setTimeout(() => handleExportPdf(m.title || 'Ata', 'official-minute-document'), 500); }} className="w-7 h-7 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--brand-primary)] bg-white border border-[var(--border-subtle)] rounded shadow-sm" title="Exportar PDF">
                          <Download size={14} />
                        </button>
                        <button onClick={() => m.id && deleteCommitteeMinute(m.id).then(loadMinutes)} className="w-7 h-7 flex items-center justify-center text-rose-400 hover:text-rose-600 border border-transparent hover:bg-rose-50 rounded transition-colors" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* CONTENT: MATRIZ DE ALOCAÇÃO PREVIEW */}
      {activeTab === 'matrix' && (
        <div className="animate-fade-in space-y-4">
          <div className="bg-white rounded-xl border-2 border-slate-200 shadow-md overflow-hidden">
            <div className="p-6 border-b-2 border-slate-800 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-blue-600 rounded flex items-center justify-center font-black text-white text-xl">M</div>
                 <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Família MFO</h2>
                    <p className="text-xs font-bold text-slate-500">Wealth Management</p>
                 </div>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-medium text-slate-800">Comitê de Investimentos</h2>
                <p className="text-xs text-slate-500 font-bold">{latestApprovedMatrixMinute ? latestApprovedMatrixMinute.date : 'Padrão'}</p>
              </div>
            </div>
            
            {['Onshore', 'Global'].map(market => {
               const rows = matrixToRender.filter(r => r.market === market);
               if (rows.length === 0) return null;
               
               return (
                  <div key={market}>
                    <div className="bg-[#bce4fa] border-b-2 border-slate-800 py-1.5">
                       <h3 className="text-center font-bold text-sm text-slate-900 uppercase tracking-widest">{market}</h3>
                    </div>

                    <div className="overflow-x-auto">
                       <table className="w-full border-collapse">
                         <thead>
                           <tr className="bg-white border-b-2 border-slate-800 divide-x-2 divide-slate-800">
                             <th className="py-2 px-3 text-sm font-bold text-slate-900 text-center w-[15%]">Classe de Ativos</th>
                             <th className="py-2 px-3 text-sm font-bold text-slate-900 text-center w-[20%]">Categoria</th>
                             <th className="py-2 px-3 text-sm font-bold text-slate-900 text-center w-[15%]">Posicionamento</th>
                             <th className="py-2 px-3 text-sm font-bold text-slate-900 text-center">Comentários (Tese)</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-400">
                           {rows.map((row, i) => (
                             <tr key={i} className="divide-x border-slate-400 divide-slate-400 bg-white hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-3 text-sm text-center font-bold text-slate-800 align-middle">
                                  {row.assetClass}
                                </td>
                                <td className="py-3 px-3 text-sm text-center text-slate-700 font-medium align-middle">
                                  {row.category}
                                </td>
                                <td className="py-3 px-3 text-center align-middle bg-[#f5fbfe] font-bold">
                                  <PositionBadge position={row.position} />
                                </td>
                                <td className="py-3 px-4 text-[13px] text-slate-800 leading-relaxed text-justify whitespace-pre-wrap">
                                  {row.comment || '-'}
                                </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                    </div>
                  </div>
               );
            })}

            <div className="border-t-2 border-slate-800 bg-white px-4 py-1.5 text-center text-xs font-bold text-slate-800">
               Posicionamento: Positivo = Tendência de alocação; Neutro = Manutenção; Negativo = Redução. Horizonte de 6 a 12 meses.
            </div>

            <div className="border-t-[3px] border-slate-800 bg-white px-4 py-3 pb-4">
              <p className="text-[10px] text-slate-600 text-justify leading-tight">
                <strong>Disclaimer:</strong> Este documento reflete a opinião dos membros do comitê de investimentos na data da reunião listada acima. As informações são baseadas em fontes públicas consideradas confiáveis. Este documento é apenas para fins informativos e de governança interna do Multi-Family Office.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-4 print:hidden">
             <button onClick={() => handleExportPdf(latestApprovedMatrixMinute?.title || 'Ata_Comite', 'official-minute-document')} className="px-4 py-2 font-bold text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-sm bg-white transition-colors flex items-center gap-2">
               <Download size={14} /> Exportar PDF Oficial
             </button>
             {latestApprovedMatrixMinute && (
              <button onClick={() => handleEdit(latestApprovedMatrixMinute)} className="px-4 py-2 font-bold text-[13px] text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-emphasis)] rounded shadow-sm flex items-center gap-2 transition-colors">
                <Edit3 size={14} /> Revisar Tese Atual
              </button>
             )}
          </div>
        </div>
      )}

    </div>
  );
}
