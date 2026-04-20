'use client';
import { Document, Page, pdfjs } from 'react-pdf';
import { useState } from 'react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Eye } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

export function ClientPdfViewer({ 
  fileUrl, 
  setNumPages, 
  tags, 
  signers, 
  myEmail,
  filledTags = {},
  onTagClick
}: { 
  fileUrl: string; 
  setNumPages?: (n: number) => void; 
  tags?: any[]; 
  signers?: any[]; 
  myEmail?: string | null;
  filledTags?: Record<string, any>;
  onTagClick?: (tag: any) => void;
}) {
  const [totalPages, setTotalPages] = useState(0);
  const myIndex = signers?.findIndex(s => s.email === myEmail) ?? -1;

  return (
    <div style={{ position: 'relative' }} className="flex flex-col gap-6 bg-slate-100 items-center overflow-x-hidden p-6">
      <Document 
        file={fileUrl} 
        onLoadSuccess={({numPages}) => { setTotalPages(numPages); if(setNumPages) setNumPages(numPages); }}
        onLoadError={console.error}
        loading={<div className="p-20 text-center text-[var(--text-secondary)] animate-pulse font-bold"><Eye className="mx-auto mb-2 opacity-50"/>Reading encrypted document bytes...</div>}
      >
        {Array.from(new Array(totalPages), (el, index) => {
           const pNum = index + 1;
           const pageTags = (tags || []).filter(t => t.pageNum === pNum);
           return (
             <div key={`page_${pNum}`} className="relative bg-white shadow-xl min-h-[500px] mb-8 border border-slate-200 origin-top">
                <Page pageNumber={pNum} width={800} renderTextLayer={false} renderAnnotationLayer={false} />
                
                {pageTags.map(tag => {
                  const isMine = tag.recipientIndex === myIndex;
                  const tagValue = filledTags[tag.id];
                  const isFilled = !!tagValue;
                  
                  if (isFilled) {
                    const w = tag.width || 130;
                    const h = tag.height || 36;
                     return (
                       <div 
                           key={tag.id} 
                           id={`tag-${tag.id}`} 
                           style={{ position: 'absolute', left: tag.x, top: tag.y, width: w, height: h }} 
                           className={`z-20 relative flex flex-col justify-center rounded transition-all ${isMine ? 'cursor-pointer hover:bg-blue-50/50 hover:ring-2 hover:ring-blue-300/50' : 'pointer-events-none'}`}
                           onClick={() => { if (isMine && onTagClick) onTagClick(tag) }}
                           title={isMine ? "Click to change signature" : ""}
                       >
                          
                          {/* The DocuSign Bracket */}
                          <div className="absolute left-0 top-[5%] bottom-[5%] w-[10px] border-l-[1.5px] border-y-[1.5px] border-[#2563eb] rounded-l-[3px]"></div>

                          {/* Top Identity Block */}
                          <div className="absolute top-[5%] left-[14px] text-[7px] font-bold text-[#1a4c99] leading-none whitespace-nowrap" style={{ transform: 'translateY(-50%)' }}>
                             {tag.type === 'initial' ? 'E-Initials:' : 'Electronically signed by:'}
                          </div>

                          {/* Core Signature Area */}
                          <div className="w-full h-full pt-[8px] pb-[8px] pl-[16px] pr-[4px] flex flex-col justify-center overflow-hidden">
                             {typeof tagValue === 'object' && tagValue?.image ? (
                                <img src={tagValue.image} alt={tagValue.text || 'Signature'} className="w-full h-full object-contain object-left mix-blend-multiply opacity-90" />
                             ) : (
                                <div className="font-caveat font-medium text-[#1a4c99] truncate w-full text-left" style={{ fontSize: `${Math.min(h * 0.55, (w / (tagValue?.text?.length || tagValue?.length || 10)) * 1.8)}px`, lineHeight: '1.1' }}>
                                  {tagValue?.text || tagValue}
                                </div>
                             )}
                          </div>
                             
                          {/* Hash Label at Bottom - Only for full signatures */}
                          {tag.type !== 'initial' && (
                             <div className="absolute bottom-[5%] left-[14px] text-[6px] text-slate-500 font-mono tracking-tight leading-none whitespace-nowrap" style={{ transform: 'translateY(50%)' }}>
                               {tag.id.substring(0, 18).toUpperCase()}
                             </div>
                          )}
                       </div>
                     );
                  }

                  return (
                    <div
                      key={tag.id}
                      id={`tag-${tag.id}`}
                      onClick={() => { if (isMine && onTagClick) onTagClick(tag) }}
                      style={{ position: 'absolute', left: tag.x, top: tag.y, width: tag.width, height: tag.height }}
                      className={`px-4 py-2 rounded font-extrabold text-[12px] uppercase flex items-center justify-center gap-2 shadow opacity-90 transition-all z-10 
                        ${isMine ? 'bg-[#facc15] border-2 border-yellow-600 text-yellow-900 shadow-yellow-500/50 animate-pulse ring-4 ring-yellow-400/30 cursor-pointer hover:scale-105 scroll-mt-32' : 'bg-slate-100 border-2 border-slate-300 text-slate-500 opacity-60 pointer-events-none'}
                      `}
                    >
                       <span className="truncate">{tag.type === 'signature' ? 'Sign Here' : tag.type}</span>
                       
                       {!isMine && signers && signers[tag.recipientIndex] && (
                         <div className="absolute -bottom-[18px] w-[150%] left-[-25%] text-center text-[9px] font-bold text-slate-600 truncate pointer-events-none drop-shadow-sm">
                           {signers[tag.recipientIndex].name || signers[tag.recipientIndex].email}
                         </div>
                       )}
                    </div>
                  );
                })}
             </div>
           );
        })}
      </Document>
    </div>
  );
}
