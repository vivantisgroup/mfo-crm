'use client';

import React, { useState } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, UploadCloud, CheckCircle2, FileText, AlertTriangle, Play, RefreshCcw, Eye, Library, Trash2, ArrowRight, Inbox } from 'lucide-react';
import { useHarmonization } from './useHarmonization';
import { toast } from 'sonner';

// Mocked queue data representing AI intake jobs
const MOCK_INTAKE_QUEUE = [
  { id: 'JOB-901', name: 'Apollo_Fund_CapCall_Q3_2026.pdf', type: 'Capital Call', status: 'awaiting_review', confidence: 98, date: '2026-04-10', extractedData: { rawInstitution: 'Apollo Global', amount: 250000, deadline: '2026-04-20', iban: 'US90BOFA0000123456789' } },
  { id: 'JOB-902', name: 'Blackstone_Q1_K1_Schedule.pdf', type: 'K-1 Tax Form', status: 'processing', confidence: null, date: '2026-04-11', extractedData: null },
  { id: 'JOB-903', name: 'Extrato_Bancario_Santander.pdf', type: 'Account Statement', status: 'awaiting_review', confidence: 82, date: '2026-04-09', extractedData: { rawInstitution: 'SAN TDER', amount: 125000, deadline: '-', iban: '-' } }
];

export default function DocumentIntakePage() {
  usePageTitle('Document Intake');
  const { rules, loading: dictionaryLoading, addRule, deleteRule, harmonize } = useHarmonization();
  
  const [queue, setQueue] = useState(MOCK_INTAKE_QUEUE);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // New Rule State
  const [newRuleRaw, setNewRuleRaw] = useState('');
  const [newRuleNormalized, setNewRuleNormalized] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState<'institution' | 'asset_ticker' | 'currency'>('institution');

  const triggerAIProcessing = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setQueue(prev => prev.map(job => 
        job.status === 'processing' 
          ? { ...job, status: 'awaiting_review', confidence: 94, extractedData: { rawInstitution: 'BX RE', amount: 0, deadline: '2026-04-15', iban: '-' } } 
          : job
      ));
      setIsProcessing(false);
    }, 2000);
  };

  const approveJob = (id: string, harmonizedData: any) => {
    setQueue(prev => prev.map(job => job.id === id ? { ...job, status: 'completed', extractedData: harmonizedData } : job));
    setSelectedJob(null);
    toast.success('Document committed successfully');
  };

  const handleAddRule = async () => {
    if (!newRuleRaw.trim() || !newRuleNormalized.trim()) return;
    try {
       await addRule({ rawText: newRuleRaw, normalizedName: newRuleNormalized, category: newRuleCategory });
       setNewRuleRaw('');
       setNewRuleNormalized('');
       toast.success('Rule mapped successfully!');
    } catch(err) {
       toast.error('Failed to save mapping rule.');
    }
  };

  const handleDictionaryLearn = async (rawString: string, matchedInstitution: string) => {
    try {
        await addRule({ rawText: rawString, normalizedName: matchedInstitution, category: 'institution' });
        toast.success(`Agent mapping learned: ${rawString} -> ${matchedInstitution}`);
    } catch (e) {
        toast.error('Failed to train AI model');
    }
  };

  // Inspect specific job
  const renderInspector = () => {
     if (!selectedJob) return null;
     
     // Check if the extracted data hits the harmonization dictionary
     const match = harmonize(selectedJob.extractedData.rawInstitution);
     const mappedName = match ? match.normalizedName : '';
     const isAutoMatched = !!match;

     return (
        <div className="w-[450px] shrink-0 border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] animate-fade-in flex flex-col h-full z-10 shadow-xl">
           <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--brand-faint)]">
              <div className="flex items-center justify-between mb-2">
                 <h2 className="text-[1.125rem] font-bold text-[var(--brand-primary)] flex items-center gap-2">
                   <Bot size={18} /> AI Output Review
                 </h2>
                 <span className="text-[0.75rem] font-bold text-[var(--color-green)] bg-[#e6f4ea] px-2 py-0.5 rounded uppercase flex items-center gap-1">
                   {selectedJob.confidence}% Confidence
                 </span>
              </div>
              <p className="text-[0.75rem] text-[var(--text-secondary)]">{selectedJob.name}</p>
           </div>
           
           <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-[var(--bg-elevated)] border border-dashed border-[var(--border-strong)] h-40 mb-6 flex items-center justify-center rounded text-[var(--text-tertiary)] uppercase font-bold text-[10px] tracking-wider relative overflow-hidden group">
                 <FileText size={32} className="opacity-20 absolute" />
                 PDF Vision Canvas Preview Area
              </div>

              <h3 className="text-[0.875rem] font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 border-b border-[var(--border-subtle)] pb-2 flex items-center gap-2">
                 <CheckCircle2 size={16} className="text-[var(--color-green)]"/> Extracted Values
              </h3>
              
              <div className="grid grid-cols-1 gap-6" >
                 <div className="flex flex-col gap-2 relative">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Extracted Institution / Issuer</label>
                    
                    <div className="flex flex-col gap-2 bg-[var(--bg-canvas)] p-3 rounded-lg border border-[var(--border-subtle)]">
                       <span className="text-sm font-semibold flex items-center gap-2 text-[var(--text-primary)]">
                         <FileText size={14} className="text-[var(--text-tertiary)]"/>
                         RAW: <span className="font-mono text-[var(--color-orange)]">"{selectedJob.extractedData.rawInstitution}"</span>
                       </span>
                       <div className="flex justify-center"><ArrowRight size={14} className="text-[var(--text-tertiary)]" /></div>
                       
                       {isAutoMatched ? (
                           <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2 rounded text-sm text-emerald-800">
                             <div className="flex items-center gap-2 font-bold"><Library size={16} /> {mappedName}</div>
                             <span className="text-[9px] uppercase tracking-wider bg-emerald-200 px-1.5 py-0.5 rounded">Auto-Harmonized</span>
                           </div>
                       ) : (
                           <div className="flex flex-col gap-2">
                              <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-tight">Manual Harmonization Mapping</span>
                              <div className="flex gap-2">
                                <Input id="manual-map" placeholder="Official Entity Name..." className="h-8 text-sm" />
                                <Button size="sm" variant="default" className="h-8 shrink-0 tracking-tight" onClick={() => {
                                    const val = (document.getElementById('manual-map') as HTMLInputElement).value;
                                    if(val) handleDictionaryLearn(selectedJob.extractedData.rawInstitution, val);
                                }}>Learn & Map</Button>
                              </div>
                           </div>
                       )}
                    </div>
                 </div>

                 <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Financial Amount</label>
                    <Input defaultValue={selectedJob.extractedData.amount.toString()} type="number" />
                 </div>
                 
                 <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Due Date / Reference</label>
                    <Input defaultValue={selectedJob.extractedData.deadline} />
                 </div>
              </div>
           </div>

           <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedJob(null)}>Dismiss</Button>
              <Button variant="default" onClick={() => approveJob(selectedJob.id, { ...selectedJob.extractedData, finalInstitution: mappedName || selectedJob.extractedData.rawInstitution })}>
                 Approve & Commit Data
              </Button>
           </div>
        </div>
     );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-canvas)] w-full overflow-hidden">
      <div className="flex justify-between items-center px-4 lg:px-8 py-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] z-10 w-full shrink-0">
         <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Document Intake</h1>
            <p className="text-sm text-[var(--text-secondary)]">Agentic extraction and harmonization of financial documents</p>
         </div>
      </div>

      <div className="flex-1 overflow-hidden flex w-full">
         <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <Tabs defaultValue="queue" className="w-full">
               <TabsList className="mb-6 mx-2 w-[400px]">
                  <TabsTrigger value="queue" className="flex-1"><Inbox size={14} className="mr-2"/> Intake Queue</TabsTrigger>
                  <TabsTrigger value="dictionary" className="flex-1"><Library size={14} className="mr-2"/> Harmonization Lexicon</TabsTrigger>
               </TabsList>

               <TabsContent value="queue" className="mt-0">
                  <div className="flex justify-end mb-4 gap-2">
                     <Button variant="secondary" size="sm" className="bg-white"><UploadCloud size={14} className="mr-2"/>Upload Document</Button>
                     <Button variant="default" size="sm" onClick={triggerAIProcessing} disabled={isProcessing}>
                       <Play size={14} className="mr-2"/>
                       {isProcessing ? 'Agent is Mapping...' : 'Run Autonomous Extraction'}
                     </Button>
                  </div>
                  <div className="overflow-x-auto w-full border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)]">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)] text-[10px] uppercase font-bold tracking-widest text-[var(--text-secondary)]">
                        <tr className="[&_th]:p-3 [&_th]:font-semibold [&_th]:text-left">
                          <th>Job ID</th>
                          <th>Document Name</th>
                          <th>AI Classified Type</th>
                          <th>OCR Entity</th>
                          <th>Status</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {queue.map(job => {
                          const isSelected = selectedJob?.id === job.id;
                          const hasExtractedEntity = job.extractedData?.rawInstitution;
                          // Optional implicit check vs dictionary:
                          const isHarmonized = hasExtractedEntity && !!harmonize(job.extractedData.rawInstitution);

                          return (
                            <tr key={job.id} onClick={() => job.status === 'awaiting_review' && setSelectedJob(job)} className={`border-b border-[var(--border-subtle)] ${isSelected ? 'bg-[var(--brand-faint)]' : 'hover:bg-[var(--bg-canvas)]'} ${job.status === 'awaiting_review' ? 'cursor-pointer' : 'opacity-80'}`}>
                              <td className="p-3 font-bold text-[10px] text-[var(--text-secondary)] tracking-wider">#{job.id.split('-')[1]}</td>
                              <td className="p-3 font-medium text-[var(--text-primary)] flex items-center gap-2">
                                 <FileText size={14} className={job.status === 'completed' ? 'text-[var(--color-green)]' : 'text-[var(--brand-primary)]'} />
                                 {job.name}
                              </td>
                              <td className="p-3"><span className="text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">{job.type}</span></td>
                              <td className="p-3">
                                  {hasExtractedEntity ? (
                                     <div className="flex items-center gap-1.5 opacity-80">
                                       <span className="font-mono text-[11px] text-[var(--color-orange)]">"{job.extractedData.rawInstitution}"</span>
                                       {isHarmonized ? <CheckCircle2 size={12} className="text-[var(--color-green)]" /> : null}
                                     </div>
                                  ) : (
                                     <span className="text-[10px] text-[var(--text-tertiary)] italic">Pending extraction</span>
                                  )}
                              </td>
                              <td className="p-3">
                                 {job.status === 'awaiting_review' && <span className="flex items-center gap-1 text-[var(--color-orange)] font-bold text-[10px] uppercase tracking-wide"><AlertTriangle size={12}/> Review</span>}
                                 {job.status === 'completed' && <span className="flex items-center gap-1 text-[var(--color-green)] font-bold text-[10px] uppercase tracking-wide"><CheckCircle2 size={12}/> Committed</span>}
                                 {job.status === 'processing' && <span className="flex items-center gap-1 text-[var(--brand-primary)] font-bold text-[10px] uppercase tracking-wide"><RefreshCcw size={12} className={isProcessing ? "animate-spin" : ""}/> Parsing</span>}
                              </td>
                              <td className="p-3 text-right">
                                 {job.status === 'awaiting_review' && <Button variant="outline" size="sm" className="h-7 text-xs"><Eye size={12} className="mr-2"/> Inspect</Button>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
               </TabsContent>

               <TabsContent value="dictionary" className="mt-0">
                  <div className="grid grid-cols-[1fr_300px] gap-6">
                     <div className="border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] overflow-hidden">
                        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
                           <h2 className="text-sm font-bold text-[var(--text-primary)]">Active Harmonization Mappings</h2>
                        </div>
                        {dictionaryLoading ? (
                           <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Loading dictionary...</div>
                        ) : rules.length === 0 ? (
                           <div className="p-8 text-center text-sm text-[var(--text-secondary)]">No rules established. The AI engine will create them when you perform manual mapping during intake.</div>
                        ) : (
                           <table className="w-full text-sm">
                             <thead className="bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)] text-[10px] uppercase font-bold tracking-widest text-[var(--text-secondary)]">
                               <tr className="[&_th]:p-3 [&_th]:text-left">
                                 <th>Category</th>
                                 <th>Raw PDF Extracted Text</th>
                                 <th>Standardized Database Entity</th>
                                 <th className="text-right">Remove</th>
                               </tr>
                             </thead>
                             <tbody>
                               {rules.map(rule => (
                                 <tr key={rule.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-canvas)]">
                                   <td className="p-3"><span className="text-[10px] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[var(--text-secondary)]">{rule.category}</span></td>
                                   <td className="p-3 font-mono text-[12px] text-[var(--color-orange)] font-medium">"{rule.rawText}"</td>
                                   <td className="p-3 flex items-center gap-2 font-bold text-[var(--text-primary)]"><Library size={14} className="text-emerald-500" /> {rule.normalizedName}</td>
                                   <td className="p-3 text-right">
                                      <Button variant="ghost" size="sm" onClick={() => deleteRule(rule.id)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"><Trash2 size={12} /></Button>
                                   </td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                        )}
                     </div>

                     <div className="border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] p-5 h-min">
                        <h3 className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Add Manual Mapping Rule</h3>
                        <div className="flex flex-col gap-4">
                           <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-[var(--text-primary)]">Category</label>
                              <Select value={newRuleCategory} onValueChange={(v: any) => setNewRuleCategory(v)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="institution">Financial Institution</SelectItem>
                                   <SelectItem value="asset_ticker">Asset Ticker</SelectItem>
                                   <SelectItem value="currency">Currency Code</SelectItem>
                                </SelectContent>
                              </Select>
                           </div>
                           <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-[var(--text-primary)]">Raw Extracted String</label>
                              <Input placeholder="e.g. SAN TDER" value={newRuleRaw} onChange={e => setNewRuleRaw(e.target.value)} />
                           </div>
                           <div className="flex justify-center"><ArrowRight size={14} className="text-[var(--text-tertiary)]" /></div>
                           <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-[var(--text-primary)]">Standardized Official Name</label>
                              <Input placeholder="e.g. Banco Santander SA" value={newRuleNormalized} onChange={e => setNewRuleNormalized(e.target.value)} />
                           </div>
                           <Button onClick={handleAddRule} className="mt-2 w-full font-bold shadow-sm">Save Rule Mapping</Button>
                        </div>
                     </div>
                  </div>
               </TabsContent>
            </Tabs>
         </div>

         {/* The Inspector Sidebar */}
         {renderInspector()}
      </div>
    </div>
  );
}
