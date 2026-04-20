'use client';

import React, { useState } from 'react';
import { Sparkles, X, Bot, Loader2, Check, Link2, PlusCircle, PenTool } from 'lucide-react';
import { RecordLinkDropdown } from './RecordLinkDropdown';
import { getFirestore, doc, updateDoc, setDoc, collection, getDoc } from 'firebase/firestore';

interface SmartSummarizerProps {
  uid: string;
  tenantId: string;
  messages: any[];
}

export function SmartSummarizer({ uid, tenantId, messages }: SmartSummarizerProps) {
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [includeThread, setIncludeThread] = useState(messages.length > 1);
  const [selectedLinks, setSelectedLinks] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSummarize = async () => {
    if (messages.length === 0) return;
    setLoading(true);
    setError('');
    
    // Choose which messages to include based on the checkbox
    const msgsToProcess = includeThread ? messages : [messages[messages.length - 1]];
    
    // Build the aggregate text context
    const contextLines = msgsToProcess.map(m => {
      const subject = m.subject || '(Sem Assunto)';
      const from = m.from || m.sender || 'Unknown';
      const text = m.text || m.snippet || m.bodyPreview || '(Sem conteúdo em texto)';
      return `Assunto: ${subject}\nDe: ${from}\nData: ${m.date || ''}\nMensagem: ${text}`;
    });
    
    const textToSummarize = contextLines.join('\n\n---\n\n');

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, textToSummarize }),
      });
      if (!res.ok) throw new Error('Falha ao rodar sumarizador inteligente.');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSummaryData(data);
      
      // Pre-select if AI highly recommended a record
      if (data.suggested_record_id && data.suggested_record_type) {
         setSelectedLinks([{
            id: data.suggested_record_id,
            type: data.suggested_record_type,
            name: `Registro Recomendado (${data.suggested_record_type})`,
            tenantId
         }]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToRecord = async (actionType: 'update' | 'create') => {
    if (!summaryData?.summary) return;
    setIsSaving(true);
    try {
      const db = getFirestore();
      const now = new Date().toISOString();
      const summaryText = summaryData.summary;

      if (actionType === 'update') {
         if (selectedLinks.length === 0) throw new Error('Selecione um registro para atualizar.');
         const target = selectedLinks[0];
         let colPath = '';
         if (target.type === 'task') colPath = `tenants/${tenantId}/tasks`;
         else if (target.type === 'activity') colPath = `tenants/${tenantId}/activities`;
         else if (target.type === 'ticket') colPath = `platform_tickets`;
         else throw new Error('Tipo de registro não suportado para atualização via resumo.');

         const ref = doc(db, colPath, target.id);
         if (target.type === 'ticket') {
            const snap = await getDoc(ref);
            if (snap.exists()) {
               const data = snap.data();
               const newActivities = [{ type: 'note', title: 'Resumo de Comunicação Adicionado', message: summaryText, timestamp: now }, ...(data.activities || [])];
               await updateDoc(ref, { activities: newActivities, updatedAt: now });
            }
         } else {
            // For tasks/activities append to description
            const snap = await getDoc(ref);
            if (snap.exists()) {
               const currentDesc = snap.data().description || '';
               const newDesc = currentDesc + `\n\n=== Resumo Adicionado em ${new Date().toLocaleDateString()} ===\n` + summaryText;
               await updateDoc(ref, { description: newDesc, updatedAt: now });
            }
         }
      } else if (actionType === 'create') {
         if (selectedLinks.length === 0) throw new Error('Selecione "Nova Tarefa" no dropdown primeiro, ou crie a partir do botão abaixo.');
         // Usually if creating via dropdown it's already created as 'open' by the dropdown inline creator.
         // But let's verify if the user just clicked create before dropdown
         const target = selectedLinks[0];
         let colPath = '';
         if (target.type === 'task') colPath = `tenants/${tenantId}/tasks`;
         else if (target.type === 'activity') colPath = `tenants/${tenantId}/activities`;
         else if (target.type === 'ticket') colPath = `platform_tickets`;

         const ref = doc(db, colPath, target.id);
         const snap = await getDoc(ref);
         if (snap.exists()) {
             // Since inline creation sets a default description, we overwrite it with the summary
             await updateDoc(ref, { description: summaryText, updatedAt: now });
         }
      }
      setIsModalOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openSummarizer = () => {
    setSummaryData(null);
    setError('');
    setSelectedLinks([]);
    setIncludeThread(messages.length > 1);
    setIsModalOpen(true);
  };

  return (
    <>
      <button 
        onClick={openSummarizer}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all uppercase tracking-wide"
      >
        <Sparkles size={13} />
        Summarize
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-[var(--border)] relative flex flex-col">
            
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-elevated)]">
               <div className="flex items-center gap-2 text-amber-500">
                  <Bot size={20} />
                  <h3 className="font-bold text-sm">Resumo da Comunicação (AI)</h3>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                 <X size={16} />
               </button>
            </div>

            <div className="p-6 text-sm overflow-y-auto max-h-[70vh] custom-scrollbar">
               {!summaryData && !loading && (
                 <div className="flex flex-col gap-4">
                   <p className="text-[var(--text-secondary)]">Deseja gerar um resumo super rápido dos pontos principais?</p>
                   
                   {messages.length > 1 && (
                     <label className="flex items-center gap-2 text-sm font-medium cursor-pointer border p-3 rounded-lg bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:bg-[var(--bg-background)]">
                       <input 
                         type="checkbox" 
                         checked={includeThread} 
                         onChange={e => setIncludeThread(e.target.checked)} 
                         className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                       />
                       Incluir toda a Thread (histórico de e-mails da conversa)
                     </label>
                   )}

                   <button onClick={handleSummarize} className="mt-2 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg">
                      <Sparkles size={15} /> Gerar Resumo
                   </button>
                 </div>
               )}

               {loading && (
                  <div className="flex flex-col items-center justify-center py-10 opacity-70">
                     <Loader2 className="animate-spin text-amber-500 mb-3" size={32} />
                     <p className="text-[var(--text-secondary)] font-bold">Lendo a comunicação...</p>
                     <p className="text-[var(--text-tertiary)] text-xs mt-1">Sintetizando contexto e sugerindo ações...</p>
                  </div>
               )}

               {error && (
                  <div className="p-4 bg-red-50 text-red-500 rounded-lg text-xs font-bold border border-red-100 flex items-center gap-2 mb-4">
                     <X size={16} /> {error}
                  </div>
               )}

               {summaryData && !loading && (
                  <div className="flex flex-col gap-5">
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                      <h4 className="text-[11px] uppercase font-bold text-amber-800 tracking-widest mb-2 flex items-center gap-2">
                        <Sparkles size={12} /> Resumo Gerado
                      </h4>
                      <div className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed font-medium">
                        {summaryData.summary}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)]">
                      <h4 className="text-[11px] uppercase font-bold text-[var(--text-tertiary)] tracking-widest mb-3 flex items-center gap-2">
                        <Link2 size={12} /> Ações & Vínculos Rápidos
                      </h4>
                      <p className="text-xs text-[var(--text-secondary)] mb-3">Vincule ou adicione este resumo a um registro existente (Tarefa, Ticket ou Atividade):</p>
                      
                      <RecordLinkDropdown
                        uid={uid}
                        tenantId={tenantId}
                        links={selectedLinks}
                        onChange={(links) => setSelectedLinks(links)}
                      />

                      {selectedLinks.length > 0 && (
                         <div className="mt-4 p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg flex flex-col gap-2">
                           <button disabled={isSaving} onClick={() => handleApplyToRecord('update')} className="w-full flex justify-center items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors">
                             {isSaving ? <Loader2 size={14} className="animate-spin" /> : <PenTool size={14} />}
                             Atualizar Registro Selecionado
                           </button>
                           {selectedLinks[0].subtitle?.startsWith('New') && (
                             <button disabled={isSaving} onClick={() => handleApplyToRecord('create')} className="w-full flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors">
                               {isSaving ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                               Usar Resumo como Descrição
                             </button>
                           )}
                         </div>
                      )}
                    </div>
                  </div>
               )}
            </div>

            {/* Footer */}
            {summaryData && !loading && (
               <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-elevated)] flex justify-end gap-3">
                  <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] text-xs font-bold px-5 py-2 rounded-lg transition-colors">
                     Fechar
                  </button>
               </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

