'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getCommitteeMinutes, CommitteeMinute, AllocationRow } from '@/lib/committeeService';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { Plus, Edit3, Trash2, X, TrendingUp, TrendingDown, Minus, Save, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export interface MacroScenario {
  id: string;
  tenantId: string;
  title: string;
  type: 'Base' | 'Bull' | 'Bear';
  probability: number;
  description: string;
}

export default function MacroHouseViewPage() {
  const { tenant, firebaseUser } = useAuth();
  const tenantId = tenant?.id;
  const router = useRouter();
  const db = getFirestore(firebaseApp);

  // States
  const [matrixData, setMatrixData] = useState<AllocationRow[]>([]);
  const [minuteDate, setMinuteDate] = useState<string>('');
  const [scenarios, setScenarios] = useState<MacroScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Partial<MacroScenario>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Fetch Matrix from the latest Committee Minute
  useEffect(() => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }
    const fetchMatrix = async () => {
      try {
        const minutes = await getCommitteeMinutes(tenantId);
        const latestApproved = minutes.find(m => m.status === 'Aprovada' && m.allocationData && m.allocationData.length > 0);
        if (latestApproved) {
          setMatrixData(latestApproved.allocationData);
          setMinuteDate(latestApproved.date);
        }
      } catch (err) {
        console.error("Error fetching matrix:", err);
      }
    };
    fetchMatrix();
  }, [tenantId]);

  // Fetch Scenarios via Firestore Snapshot
  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, 'macroScenarios'),
      where('tenantId', '==', tenantId),
      orderBy('probability', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MacroScenario[];
      setScenarios(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching scenarios:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId, db]);

  // CRUD Functions
  const handleAddNew = () => {
    setEditingScenario({ title: '', type: 'Base', probability: 0, description: '' });
    setShowModal(true);
  };

  const handleEdit = (scenario: MacroScenario) => {
    setEditingScenario({ ...scenario });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cenário?')) {
      try {
        await deleteDoc(doc(db, 'macroScenarios', id));
        toast.success('Cenário apagado com sucesso!');
      } catch (err) {
        toast.error('Erro ao apagar cenário.');
        console.error(err);
      }
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    if (!editingScenario.title || editingScenario.probability === undefined) {
      toast.error('Preencha título e probabilidade.');
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        tenantId,
        title: editingScenario.title,
        type: editingScenario.type || 'Base',
        probability: Number(editingScenario.probability),
        description: editingScenario.description || '',
        updatedAt: serverTimestamp()
      };

      if (editingScenario.id) {
        await updateDoc(doc(db, 'macroScenarios', editingScenario.id), payload);
        toast.success('Cenário atualizado!');
      } else {
        await addDoc(collection(db, 'macroScenarios'), payload);
        toast.success('Cenário criado!');
      }
      setShowModal(false);
    } catch (err) {
      toast.error('Erro ao salvar cenário.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateMatrix = () => {
     router.push('/cio-office/committee');
  };

  // Color mappings
  const gridColors = {
    Positivo: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Neutro: 'bg-slate-50 text-slate-700 border-slate-200',
    Negativo: 'bg-rose-50 text-rose-800 border-rose-200'
  };
  const typeStyles = {
    Base: 'bg-indigo-50 border-indigo-100 text-indigo-900 badge-indigo',
    Bull: 'bg-emerald-50 border-emerald-100 text-emerald-900 badge-emerald',
    Bear: 'bg-amber-50 border-amber-100 text-amber-900 badge-amber'
  };

  const handleLoadTemplates = async () => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
       const templates: Omit<MacroScenario, 'id'>[] = [
         { title: "Soft Landing & Crescimento Global", type: "Bull", probability: 60, tenantId, description: "<p>A economia global consegue frear a inflação sem causar uma recessão profunda. Bancos centrais iniciam ciclos marginais de cortes de juros.</p>" },
         { title: "Recessão Branda (Shallow Recession)", type: "Base", probability: 25, tenantId, description: "<p>Apertos monetários cobram seu preço, levando EUA e Europa a dois trimestres de PIB negativo, mas sem grande colapso no mercado de trabalho.</p>" },
         { title: "Estagflação Persistente", type: "Bear", probability: 10, tenantId, description: "<p>Inflação de serviços e commodities não cede, obrigando os bancos centrais a manter juros altos apesar do crescimento nulo.</p>" },
         { title: "Brasil: Ajuste Fiscal Bem-sucedido", type: "Bull", probability: 55, tenantId, description: "<p>Arcabouço fiscal é cumprido no limite da margem, risco Brasil cede e atrai capital estrangeiro para a bolsa.</p>" },
         { title: "Choque Geopolítico Extremo", type: "Bear", probability: 5, tenantId, description: "<p>Nova escalada de tensões no Oriente Médio ou Ásia rompe cadeias de suprimento globais e dispara petróleo acima de $120.</p>" },
       ];
       for(const t of templates) {
          await addDoc(collection(db, 'macroScenarios'), { ...t, updatedAt: serverTimestamp() });
       }
       toast.success("5 Templates carregados com sucesso!");
    } catch(err) {
       toast.error("Erro ao carregar templates.");
       console.error(err);
    } finally {
       setIsSaving(false);
    }
  };

  const handleGenerateAIBase = async () => {
    if (!tenantId || !firebaseUser) return;
    try {
      setIsSaving(true);
      const token = await firebaseUser.getIdToken();
      // Use the prompt we just created
      const res = await fetch('/api/ai/macro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rawText: "Gere a tese elaborada e inteligente para o cenário: " + (editingScenario.title || "Condições atuais de mercado"),
          tenantId,
          provider: 'openai'
        })
      });

      if (!res.ok) {
        throw new Error('Falha na IA');
      }

      const data = await res.json();
      setEditingScenario(prev => ({
        ...prev,
        description: data.thesis || prev.description
      }));
      toast.success("Tese gerada pela IA!");
    } catch(err) {
      console.error(err);
      toast.error("Falha ao gerar com IA.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 bg-[var(--bg-background)] p-6 md:p-10 space-y-8 animate-fade-in">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">Macro & House View</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Formulário de teses, cenários macroeconômicos e matriz de convicção global.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* MATRIX SECTION (Col Span 8) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
          <div className="rounded-2xl flex-1 bg-white border border-[var(--border-subtle)] shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between bg-slate-50">
               <div>
                  <h2 className="text-lg font-bold text-slate-800">Matriz de Convicção Institucional</h2>
                  <p className="text-[13px] font-medium text-slate-500 mt-0.5">
                     {minuteDate ? `Referência: Ata do Comitê (${minuteDate})` : 'Governança ausente: Crie uma Ata de Comitê'}
                  </p>
               </div>
               <button onClick={handleUpdateMatrix} className="px-4 py-2 bg-blue-600 text-white text-[13px] font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer whitespace-nowrap">
                 Atualizar no Comitê
               </button>
            </div>
            
            <div className="flex-1 p-8 relative bg-slate-50/30">
               {isLoading ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full animate-pulse">
                    <div className="space-y-4">
                       <div className="h-6 w-32 bg-slate-200 rounded"></div>
                       <div className="flex flex-wrap gap-3">
                          <div className="h-24 w-full sm:w-[calc(50%-0.375rem)] bg-slate-200 rounded-xl"></div>
                          <div className="h-24 w-full sm:w-[calc(50%-0.375rem)] bg-slate-200 rounded-xl"></div>
                       </div>
                    </div>
                 </div>
               ) : matrixData.length === 0 ? (
                 <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium bg-slate-50/50 backdrop-blur-[1px]">
                    Nenhuma matriz oficial vinculada a uma Ata Aprovada.
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    {/* Onshore Grid */}
                    <div className="space-y-4">
                       <h3 className="font-extrabold text-sm uppercase tracking-widest text-slate-700 border-b-2 border-slate-800 pb-2">Brasil (Onshore)</h3>
                       <div className="flex flex-wrap gap-2">
                          {matrixData.filter(r => r.market === 'Onshore').map((item, idx) => (
                             <div key={idx} className={`p-3 rounded-lg border shadow-sm flex flex-col w-full sm:w-[calc(50%-0.25rem)] ${gridColors[item.position || 'Neutro']}`}>
                                <div className="text-[10px] font-black uppercase opacity-70 mb-1">{item.assetClass}</div>
                                <div className="font-bold text-[13px] leading-tight mb-2">{item.category}</div>
                                <div className="mt-auto flex items-center gap-1 font-extrabold text-[11px] uppercase tracking-wider">
                                   {item.position === 'Positivo' && <TrendingUp size={12}/>}
                                   {item.position === 'Negativo' && <TrendingDown size={12}/>}
                                   {item.position === 'Neutro' && <Minus size={12}/>}
                                   {item.position}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                    {/* Global Grid */}
                    <div className="space-y-4">
                       <h3 className="font-extrabold text-sm uppercase tracking-widest text-slate-700 border-b-2 border-slate-800 pb-2">Offshore (Global)</h3>
                       <div className="flex flex-wrap gap-2">
                          {matrixData.filter(r => r.market === 'Global').map((item, idx) => (
                             <div key={idx} className={`p-3 rounded-lg border shadow-sm flex flex-col w-full sm:w-[calc(50%-0.25rem)] ${gridColors[item.position || 'Neutro']}`}>
                                <div className="text-[10px] font-black uppercase opacity-70 mb-1">{item.assetClass}</div>
                                <div className="font-bold text-[13px] leading-tight mb-2">{item.category}</div>
                                <div className="mt-auto flex items-center gap-1 font-extrabold text-[11px] uppercase tracking-wider">
                                   {item.position === 'Positivo' && <TrendingUp size={12}/>}
                                   {item.position === 'Negativo' && <TrendingDown size={12}/>}
                                   {item.position === 'Neutro' && <Minus size={12}/>}
                                   {item.position}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
        
        {/* SCENARIOS SECTION (Col Span 4) */}
        <div className="lg:col-span-5 xl:col-span-4 rounded-3xl bg-white/60 backdrop-blur-3xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col max-h-[80vh] overflow-hidden">
          <div className="p-6 border-b border-slate-200/50 flex items-center justify-between bg-white/40">
            <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">Cenários Probabilísticos</h2>
            <div className="flex gap-2">
               {!isLoading && scenarios.length === 0 && (
                 <button onClick={handleLoadTemplates} disabled={isSaving} className="text-xs bg-indigo-50/80 text-indigo-700 font-bold px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm">
                    Modelos Base
                 </button>
               )}
               <button onClick={handleAddNew} className="p-2 text-white bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 rounded-xl transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5">
                  <Plus size={16} strokeWidth={3} />
               </button>
            </div>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
             {isLoading ? (
               <div className="space-y-4 animate-pulse">
                  <div className="h-32 bg-slate-200/50 rounded-2xl"></div>
                  <div className="h-32 bg-slate-200/50 rounded-2xl"></div>
               </div>
             ) : scenarios.length === 0 ? (
               <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3"><TrendingUp size={20} className="text-slate-400"/></div>
                  <p className="text-sm text-slate-500 font-medium">Nenhum cenário cadastrado.<br/>Crie um novo ou use os modelos.</p>
               </div>
             ) : scenarios.map(sc => (
               <div key={sc.id} className={`p-5 rounded-2xl border relative group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${typeStyles[sc.type] || typeStyles.Base}`}>
                   <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 flex items-center gap-1.5">
                      <button onClick={() => handleEdit(sc)} className="p-2 bg-white/80 hover:bg-white backdrop-blur-sm rounded-xl text-slate-700 transition-colors shadow-sm"><Edit3 size={14} strokeWidth={2.5}/></button>
                      <button onClick={() => handleDelete(sc.id)} className="p-2 bg-white/80 hover:bg-rose-50 backdrop-blur-sm rounded-xl text-rose-600 transition-colors shadow-sm"><Trash2 size={14} strokeWidth={2.5}/></button>
                   </div>
                   <div className="flex justify-between items-start mb-3 pr-16 bg">
                       <span className="font-black text-base tracking-tight leading-tight mix-blend-color-burn">{sc.title}</span>
                   </div>
                   <div className="flex items-center gap-2.5 mb-4">
                       <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-md bg-white/60 mix-blend-color-burn shadow-[0_1px_2px_rgba(0,0,0,0.05)]`}>
                         {sc.type} Case
                       </span>
                       <span className={`text-[11px] font-black tracking-wider px-2.5 py-1 rounded-lg bg-white/90 shadow-sm flex items-center gap-1 text-slate-800`}>
                         {sc.probability} <Percent size={12} strokeWidth={3}/>
                       </span>
                   </div>
                   <div className="text-[13px] opacity-90 font-medium leading-relaxed prose prose-sm max-w-none prose-p:my-1 mix-blend-color-burn" dangerouslySetInnerHTML={{ __html: sc.description }} />
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white/90 backdrop-blur-2xl ring-1 ring-white/50 rounded-3xl w-full max-w-md shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden scale-in-95 duration-300">
            <div className="px-8 py-6 border-b border-slate-200/50 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-800 text-xl tracking-tight">
                {editingScenario.id ? 'Editar Cenário' : 'Novo Cenário Macro'}
              </h3>
              <button disabled={isSaving} onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-800 bg-slate-100/50 hover:bg-slate-200/80 backdrop-blur-sm transition-all p-2 rounded-full">
                <X size={18} strokeWidth={2.5}/>
              </button>
            </div>
            
            <div className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Título do Cenário</label>
                <input 
                  type="text" 
                  value={editingScenario.title}
                  onChange={e => setEditingScenario({...editingScenario, title: e.target.value})}
                  className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all shadow-sm"
                  placeholder="Ex: Aterrissagem Suave (Base)"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                 <div>
                   <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Probabilidade (%)</label>
                   <input 
                     type="number" 
                     value={editingScenario.probability}
                     onChange={e => setEditingScenario({...editingScenario, probability: Number(e.target.value)})}
                     className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all shadow-sm"
                     placeholder="Ex: 65"
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Tipo do Case</label>
                   <select 
                     value={editingScenario.type}
                     onChange={e => setEditingScenario({...editingScenario, type: e.target.value as any})}
                     className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none transition-all shadow-sm"
                   >
                     <option value="Base">Base Case (Misto)</option>
                     <option value="Bull">Bull Case (Otimista)</option>
                     <option value="Bear">Bear Case (Pessimista)</option>
                   </select>
                 </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Tese Resumida</label>
                  <button onClick={handleGenerateAIBase} disabled={isSaving || !editingScenario.title} className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 shadow-inner px-2.5 py-1 rounded-lg cursor-pointer transition-all disabled:opacity-50 tracking-wider uppercase flex items-center gap-1">
                    <span>✨</span> IA Generate
                  </button>
                </div>
                <textarea 
                  value={editingScenario.description}
                  onChange={e => setEditingScenario({...editingScenario, description: e.target.value})}
                  className="w-full bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all min-h-[140px] resize-none shadow-sm leading-relaxed"
                  placeholder="Descreva a racionalização econômica deste cenário. A IA gerará a tese em marcação leve (HTML)."
                />
              </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-200/50 bg-slate-50/80 flex items-center justify-end gap-3 rounded-b-3xl">
              <button disabled={isSaving} onClick={() => setShowModal(false)} className="px-5 py-2.5 font-bold text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all">
                Cancelar
              </button>
              <button disabled={isSaving} onClick={handleSave} className="px-8 py-2.5 bg-gradient-to-tr from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white font-extrabold text-sm rounded-xl shadow-[0_4px_14px_0_rgba(15,23,42,0.39)] transition-all focus:ring-2 disabled:opacity-50 flex items-center gap-2">
                {isSaving ? 'Salvando...' : <><Save size={16} strokeWidth={2.5}/> Salvar Cenário</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
