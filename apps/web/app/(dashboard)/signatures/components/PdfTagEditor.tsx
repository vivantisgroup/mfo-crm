import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Calendar, FileSignature, Type, Send, GripHorizontal, X } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfTagEditorProps {
  file: File;
  recipients: { name: string; email: string }[];
  onCancel: () => void;
  onSend: (tags: any[]) => void;
  isSending?: boolean;
}

export function PdfTagEditor({ file, recipients, onCancel, onSend, isSending }: PdfTagEditorProps) {
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [fileUrl, setFileUrl] = useState<string>('');
  
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const [activeRecipient, setActiveRecipient] = useState<number>(0);
  const [tags, setTags] = useState<any[]>([]);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const addTag = (type: 'signature' | 'date' | 'initials' | 'text') => {
    const newTag = {
      id: Math.random().toString(36).substring(2, 11),
      type,
      recipientIndex: activeRecipient,
      pageNum: currentPage,
      x: 150,
      y: 150,
    };
    setTags([...tags, newTag]);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg-background)] flex flex-col animate-fade-in font-sans">
      {/* HEADER */}
      <div className="h-14 bg-white border-b border-[var(--border-subtle)] flex items-center justify-between px-6 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] p-1.5 rounded transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-[1rem] font-bold text-[var(--text-primary)] leading-tight tracking-tight">Tag Editor</h2>
            <p className="text-[0.75rem] text-[var(--text-tertiary)] truncate max-w-sm">{file.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Button disabled={isSending} variant="default" onClick={() => onSend(tags)}>
             <Send size={16} className="mr-2" /> {isSending ? 'Sending Envelope...' : 'Issue Signature Requests'}
           </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <div className="w-[300px] border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col shadow-[4px_0_12px_rgba(0,0,0,0.02)] z-10 shrink-0">
          <div className="p-6 border-b border-[var(--border-subtle)]">
             <label className="block text-[0.65rem] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Active Signer</label>
             <select 
               className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg px-3 py-2 text-[0.875rem] font-medium text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] transition-colors shadow-sm"
               value={activeRecipient}
               onChange={(e) => setActiveRecipient(Number(e.target.value))}
             >
               {recipients.map((r, i) => (
                 <option key={i} value={i}>{r.name || r.email || `Signer ${i+1}`}</option>
               ))}
             </select>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto">
             <label className="block text-[0.65rem] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Standard Fields</label>
             <div className="flex flex-col gap-3">
                <button onClick={() => addTag('signature')} className="flex items-center gap-4 p-3 bg-white border border-[var(--border-subtle)] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-faint)] rounded-xl transition-all text-left shadow-sm">
                   <div className="w-10 h-10 rounded-lg bg-yellow-100 text-yellow-700 flex items-center justify-center shrink-0"><FileSignature size={20} /></div>
                   <div className="flex-1 font-bold text-[0.875rem] text-[var(--text-primary)]">Signature</div>
                </button>
                <button onClick={() => addTag('initials')} className="flex items-center gap-4 p-3 bg-white border border-[var(--border-subtle)] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-faint)] rounded-xl transition-all text-left shadow-sm">
                   <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"><User size={20} /></div>
                   <div className="flex-1 font-bold text-[0.875rem] text-[var(--text-primary)]">Initials</div>
                </button>
                <button onClick={() => addTag('date')} className="flex items-center gap-4 p-3 bg-white border border-[var(--border-subtle)] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-faint)] rounded-xl transition-all text-left shadow-sm">
                   <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0"><Calendar size={20} /></div>
                   <div className="flex-1 font-bold text-[0.875rem] text-[var(--text-primary)]">Date Signed</div>
                </button>
                <button onClick={() => addTag('text')} className="flex items-center gap-4 p-3 bg-white border border-[var(--border-subtle)] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-faint)] rounded-xl transition-all text-left shadow-sm">
                   <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center shrink-0"><Type size={20} /></div>
                   <div className="flex-1 font-bold text-[0.875rem] text-[var(--text-primary)]">Text Box</div>
                </button>
             </div>
          </div>
        </div>

        {/* WORKSPACE */}
        <div className="flex-1 bg-[#cfd4d9] overflow-auto flex flex-col items-center p-8 relative">
          <div className="relative shadow-2xl border border-[var(--border-subtle)] bg-white origin-top" style={{ width: 800 }}>
             {fileUrl && (
               <Document file={fileUrl} onLoadSuccess={handleDocumentLoadSuccess} loading={<div className="p-20 text-center text-[var(--text-secondary)] font-bold animate-pulse">Loading Document Canvas...</div>}>
                 <Page pageNumber={currentPage} renderTextLayer={false} renderAnnotationLayer={false} width={800} />
               </Document>
             )}

             {tags.filter(t => t.pageNum === currentPage).map(tag => (
               <motion.div
                 key={tag.id}
                 drag
                 dragMomentum={false}
                 onDragEnd={(_, info) => {
                    setTags(tags.map(t => t.id === tag.id ? { ...t, x: t.x + info.offset.x, y: t.y + info.offset.y } : t));
                 }}
                 initial={{ x: tag.x, y: tag.y }}
                 style={{ position: 'absolute', top: 0, left: 0 }}
                 className="group absolute z-50 flex flex-col"
               >
                  <div style={{ width: tag.width || 130, height: tag.height || 36, fontSize: Math.max(7, Math.min(14, (tag.height || 36) * 0.35)) }} className="relative bg-[#facc15] border-2 border-yellow-600 px-1 rounded shadow-xl text-yellow-900 font-extrabold flex items-center justify-between cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform backdrop-blur-md opacity-95 group/tag">
                     <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
                        <GripHorizontal size={14} className="opacity-50 shrink-0" />
                        <span className="truncate">{tag.type.toUpperCase()}</span>
                     </div>
                     <div className="flex items-center gap-0.5 opacity-0 group-hover/tag:opacity-100 transition-opacity z-10 bg-[#facc15] shadow-[-10px_0_10px_rgba(250,204,21,1)]">
                        <button onPointerDown={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setTags(tags.map(t => t.id === tag.id ? { ...t, width: Math.max(30, (t.width || 130) - 20), height: Math.max(10, (t.height || 36) - 6) } : t)) }} className="bg-yellow-700/30 hover:bg-yellow-800 text-yellow-900 hover:text-white rounded w-5 h-5 flex items-center justify-center font-normal leading-none">-</button>
                        <button onPointerDown={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setTags(tags.map(t => t.id === tag.id ? { ...t, width: (t.width || 130) + 20, height: (t.height || 36) + 6 } : t)) }} className="bg-yellow-700/30 hover:bg-yellow-800 text-yellow-900 hover:text-white rounded w-5 h-5 flex items-center justify-center font-normal leading-none">+</button>
                        <button onPointerDown={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setTags(tags.filter(t => t.id !== tag.id)) }} className="ml-1 hover:text-red-700 text-yellow-800 hover:bg-white/50 rounded-full p-0.5"><X size={14} /></button>
                     </div>
                     <div 
                        className="absolute bottom-[-4px] right-[-4px] w-4 h-4 cursor-nwse-resize z-50 flex items-end justify-end p-0.5 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                        onPointerDown={(e) => {
                           e.stopPropagation();
                           const startX = e.clientX;
                           const startY = e.clientY;
                           const startW = tag.width || 130;
                           const startH = tag.height || 36;
                           const onMove = (me: PointerEvent) => {
                              const newW = Math.max(30, startW + (me.clientX - startX));
                              const newH = Math.max(10, startH + (me.clientY - startY));
                              setTags(prev => prev.map(t => t.id === tag.id ? { ...t, width: newW, height: newH } : t));
                           };
                           const onUp = () => {
                              window.removeEventListener('pointermove', onMove);
                              window.removeEventListener('pointerup', onUp);
                           };
                           window.addEventListener('pointermove', onMove);
                           window.addEventListener('pointerup', onUp);
                        }}
                     >
                        <div className="w-0 h-0 border-b-[6px] border-r-[6px] border-b-yellow-800 border-r-yellow-800 rounded-sm"></div>
                     </div>
                  </div>
                  <select 
                      onPointerDown={e => e.stopPropagation()}
                      value={tag.recipientIndex}
                      onChange={(e) => {
                          const newIdx = parseInt(e.target.value);
                          setTags(tags.map(t => t.id === tag.id ? { ...t, recipientIndex: newIdx } : t));
                      }}
                      className="text-[10px] font-bold bg-black/70 text-white px-2 py-0.5 rounded-b mt-[-2px] mx-auto opacity-70 cursor-pointer outline-none border-none hover:bg-black transition-colors"
                  >
                      {recipients.map((r: any, idx: number) => (
                          <option key={idx} value={idx}>{r.name || `Signer ${idx + 1}`}</option>
                      ))}
                  </select>
               </motion.div>
             ))}
          </div>

          <div className="h-20 shrink-0 opacity-0">-</div>
          
          {/* PAGE CONTROLS */}
          {numPages > 1 && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-full shadow-2xl px-6 py-3 flex items-center gap-6 z-50">
               <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p-1)} className="text-[var(--brand-primary)] bg-[var(--brand-faint)] hover:bg-[var(--brand-muted)] p-2 rounded-full disabled:opacity-30 disabled:hover:bg-[var(--brand-faint)] transition-colors"><ArrowLeft size={18} /></button>
               <span className="font-bold text-[0.875rem] text-[var(--text-secondary)] uppercase tracking-wider">Page {currentPage} of {numPages}</span>
               <button disabled={currentPage >= numPages} onClick={() => setCurrentPage(p => p+1)} className="text-[var(--brand-primary)] bg-[var(--brand-faint)] hover:bg-[var(--brand-muted)] p-2 rounded-full disabled:opacity-30 disabled:hover:bg-[var(--brand-faint)] transition-colors"><ArrowLeft size={18} className="transform rotate-180" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
