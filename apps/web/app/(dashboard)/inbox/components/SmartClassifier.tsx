'use client';

import React, { useState } from 'react';
import { Sparkles, Check, X, Tag as TagIcon, Bot, ArrowRight, Loader2, PlusCircle } from 'lucide-react';
import { getFirestore, doc, updateDoc, setDoc, collection } from 'firebase/firestore';
import { RecordLinkDropdown } from './RecordLinkDropdown';

interface SmartClassifierProps {
  uid: string;
  tenantId: string;
  thread: any;
  currentLinks: any[];
  onLinksUpdated: (newLinks: any[]) => void;
}

export function SmartClassifier({ uid, tenantId, thread, currentLinks, onLinksUpdated }: SmartClassifierProps) {
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<any>(null);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClassify = async () => {
    setLoading(true);
    setError('');
    setIsModalOpen(true);
    try {
      const res = await fetch('/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, tenantId, thread }),
      });
      if (!res.ok) throw new Error('Falha ao rodar classificador inteligente.');
      const data = await res.json();
      setPredictions(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!predictions) return;
    setLoading(true);
    try {
      const db = getFirestore();
      
      // Merge suggested links
      const mergedLinks = [...currentLinks];
      const suggestedLinks = predictions.suggested_entities || [];
      const newLinksToApply: any[] = [];

      for (const sl of suggestedLinks) {
        if (!mergedLinks.find(l => l.id === sl.id)) {
           const linkBundle = { id: sl.id, type: sl.type, name: sl.name };
           mergedLinks.push(linkBundle);
           newLinksToApply.push(linkBundle);
        }
      }

      // If we got new links, save them
      if (newLinksToApply.length > 0) {
        const activeIds = mergedLinks.map(l => l.id);
        if (uid && !activeIds.includes(uid)) activeIds.push(uid);

        await updateDoc(doc(db, 'communications', thread.id), {
          crm_entity_links: mergedLinks,
          crm_entity_ids: activeIds
        });
        onLinksUpdated(mergedLinks);
      }

      // Process New Task / Activity
      if (predictions.suggested_new_action) {
         const act = predictions.suggested_new_action;
         const rootRef = doc(collection(db, act.type === 'activity' ? `tenants/${tenantId}/activities` : `tenants/${tenantId}/tasks`));
         const payload: any = {
            id: rootRef.id,
            title: act.title,
            description: act.summary,
            status: 'open',
            createdAt: new Date().toISOString(),
            priority: 'medium'
         };

         // If we know who this is for, link the task to them
         if (mergedLinks.length > 0) {
            payload.linkedEntityId = mergedLinks[0].id;
            payload.linkedEntityName = mergedLinks[0].name;
            payload.linkedEntityType = mergedLinks[0].type;
         }

         await setDoc(rootRef, payload);
      }

      setIsModalOpen(false);
      setPredictions(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={handleClassify}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all uppercase tracking-wide"
      >
        <Sparkles size={13} />
        Smart Classify
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-[var(--border)] relative flex flex-col">
            
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-elevated)]">
               <div className="flex items-center gap-2 text-indigo-500">
                  <Bot size={20} />
                  <h3 className="font-bold text-sm">AI Communications Classifier</h3>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                 <X size={16} />
               </button>
            </div>

            <div className="p-6 text-sm">
               {loading && (
                  <div className="flex flex-col items-center justify-center py-10 opacity-70">
                     <Loader2 className="animate-spin text-indigo-500 mb-3" size={32} />
                     <p className="text-[var(--text-secondary)] font-bold">Scanning relationships & context...</p>
                     <p className="text-[var(--text-tertiary)] text-xs mt-1">Applying deterministic heuristics and neural NLP...</p>
                  </div>
               )}

               {error && (
                  <div className="p-4 bg-red-50 text-red-500 rounded-lg text-xs font-bold border border-red-100 flex items-center gap-2">
                     <X size={16} /> {error}
                  </div>
               )}

               {predictions && !loading && (
                  <div className="flex flex-col gap-5">
                     <p className="text-xs text-[var(--text-secondary)] border-b pb-2">
                       Inteligência Artificial concluiu a varredura desta thread. Veja as associações sugeridas:
                     </p>
                     
                     {/* Links Sugeridos */}
                     <div>
                        <h4 className="text-[11px] uppercase font-bold text-[var(--text-tertiary)] tracking-widest mb-3">
                           🔖 Associar as seguintes Entidades
                        </h4>
                        {(predictions.suggested_entities || []).length === 0 ? (
                           <p className="text-[var(--text-tertiary)] text-xs italic">Nenhuma entidade nova encontrada nesta mensagem.</p>
                        ) : (
                           <div className="flex flex-col gap-2">
                              {predictions.suggested_entities.map((ent: any, i: number) => (
                                 <div key={i} className="flex items-start gap-3 p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl">
                                    <TagIcon size={14} className="text-indigo-400 mt-0.5" />
                                    <div>
                                       <p className="font-bold text-xs text-[var(--text-primary)]">{ent.name}</p>
                                       <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{ent.reason}</p>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>

                     {/* Manual Actions Fallback */}
                     {(predictions.suggested_entities || []).length === 0 && (
                        <div className="mt-2 p-4 border border-dashed border-[var(--brand-subtle)] rounded-xl bg-[var(--brand-50)]/50">
                           <h4 className="text-[11px] uppercase font-bold text-[var(--text-tertiary)] tracking-widest mb-3">
                              🔍 Busca Manual & Criação Rápidas
                           </h4>
                           <p className="text-xs text-[var(--text-secondary)] mb-4">
                              A Inteligência não convergiu com alta certeza. Você pode forçar a associação pesquisando todo o banco ou criando um novo registro:
                           </p>
                           <div className="flex items-center gap-3">
                               <div className="flex-1">
                                 <RecordLinkDropdown
                                   emailLogId={thread.id}
                                   uid={uid}
                                   tenantId={tenantId}
                                   links={currentLinks}
                                   onChange={(links) => { onLinksUpdated(links); setIsModalOpen(false); }}
                                 />
                               </div>
                               <button 
                                 onClick={() => {
                                    setIsModalOpen(false);
                                    window.open(`/tarefas`, '_blank');
                                 }}
                                 className="px-3 py-1 flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-xs font-bold hover:bg-indigo-100 transition-colors"
                               >
                                  <PlusCircle size={14} /> Criar Relacionamento
                               </button>
                           </div>
                        </div>
                     )}

                     {/* Criação de Tracking Item */}
                     <div>
                        <h4 className="text-[11px] uppercase font-bold text-[var(--text-tertiary)] tracking-widest mb-3">
                           ⚡ Ação Operacional Recomendada
                        </h4>
                        {!predictions.suggested_new_action ? (
                           <p className="text-[var(--text-tertiary)] text-xs italic">Apenas notificação. Nenhuma tarefa necessária.</p>
                        ) : (
                           <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                 <span className="bg-emerald-200 text-emerald-800 text-[9px] font-bold uppercase px-1.5 rounded">
                                    Nova {predictions.suggested_new_action.type}
                                 </span>
                                 <h5 className="font-bold text-xs text-emerald-900">{predictions.suggested_new_action.title}</h5>
                              </div>
                              <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
                                 {predictions.suggested_new_action.summary}
                              </p>
                           </div>
                        )}
                     </div>
                  </div>
               )}
            </div>

            {/* Footer */}
            {predictions && !loading && (
               <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-elevated)] flex justify-end gap-3">
                  <button onClick={() => setIsModalOpen(false)} className="text-xs font-bold text-[var(--text-secondary)] px-4 py-2 hover:bg-[var(--bg-surface)] rounded-lg">
                     Cancel
                  </button>
                  <button onClick={handleApply} className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold px-5 py-2 rounded-lg flex items-center gap-2 shadow-sm">
                     <Check size={14} /> Accept Classifications
                  </button>
               </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
