'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Shield, Anchor, CheckCircle2, FileSignature, Coffee, X, Fingerprint, LockKeyhole, Search, Download, ArrowRight, Loader2, ExternalLink } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/AuthContext';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { useSearchParams } from 'next/navigation';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

function LuxuryWealthPortalInner() {
  const [activeTab, setActiveTab] = useState<'wealth' | 'entities' | 'vault' | 'concierge'>('wealth');
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signatureExecuted, setSignatureExecuted] = useState(false);
  const [signingProgress, setSigningProgress] = useState(0);

  const { tenant } = useAuth();
  const searchParams = useSearchParams();
  const orgId = searchParams?.get('orgId');

  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
     if (activeTab === 'vault' && tenant?.id) {
        setLoadingDocs(true);
        const loadDocs = async () => {
           try {
              const db = getFirestore(firebaseApp);
              const snap = await getDocs(collection(db, 'tenants', tenant.id, 'knowledgeArticles'));
              const allDocs = snap.docs.map(d => ({id: d.id, ...d.data()}));
              
              const filtered = allDocs.filter((d: any) => {
                 if (orgId && d.permissions && d.permissions[orgId]) return true;
                 if (d.visibility === 'shared') return true;
                 if (!orgId && d.visibility !== 'private') return true; // Show tenant wide / shared if no org set
                 return false;
              });
              setDocuments(filtered);
           } catch(e) {
              console.error(e);
           } finally {
              setLoadingDocs(false);
           }
        };
        loadDocs();
     }
  }, [activeTab, tenant?.id, orgId]);

  // Discreet Aesthetic Pie Chart (Quiet Luxury)
  const pieOption = {
    tooltip: { trigger: 'item', backgroundColor: '#ffffff', textStyle: { color: '#000000', fontFamily: 'serif' }, borderWidth: 1, borderColor: '#e5e5e5', padding: 12 },
    legend: { show: false },
    series: [
      {
        name: 'Allocations',
        type: 'pie',
        radius: ['70%', '85%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 0, borderColor: '#fcfcfc', borderWidth: 2 },
        label: { show: false },
        data: [
          { value: 45, name: 'Liquid Assets', itemStyle: { color: '#2c3e50' } }, // Slate Dark
          { value: 25, name: 'Private Equity', itemStyle: { color: '#7f8c8d' } }, // Neutral Grey
          { value: 30, name: 'Real Estate', itemStyle: { color: '#bdc3c7' } } // Light Silver
        ]
      }
    ]
  };

  const handleSignSimulate = () => {
     let progress = 0;
     const interval = setInterval(() => {
        progress += 10;
        setSigningProgress(progress);
        if (progress >= 100) {
           clearInterval(interval);
           setTimeout(() => {
             setSignatureExecuted(true);
             setTimeout(() => setSignModalOpen(false), 2000);
           }, 500);
        }
     }, 150);
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a] font-sans selection:bg-[#2c3e50] selection:text-white">
       
       {/* DISCREET NAVBAR */}
       <nav className="px-8 md:px-16 py-8 flex justify-between items-center border-b border-[#eaeaea] bg-[#fcfcfc] sticky top-0 z-40">
          <div className="flex items-center gap-6">
             <span className="font-serif text-[1.25rem] tracking-wider text-[#2c3e50]">P &bull; R</span>
             <span className="hidden md:inline-block w-px h-4 bg-[#eaeaea]"></span>
             <span className="hidden md:inline-block text-[0.65rem] uppercase tracking-widest text-[#7f8c8d]">Family Office Services</span>
          </div>
          <div className="flex items-center gap-8">
             <button className="text-[0.65rem] uppercase tracking-widest text-[#7f8c8d] hover:text-[#1a1a1a] transition-colors">Client Profile</button>
             <button className="text-[0.65rem] uppercase tracking-widest text-[#7f8c8d] hover:text-[#1a1a1a] transition-colors">Advisory Team</button>
             <div className="w-8 h-8 rounded-full bg-[#f4f4f4] border border-[#eaeaea] flex items-center justify-center font-serif text-[#2c3e50] text-xs">RS</div>
          </div>
       </nav>

       <main className="max-w-[1200px] mx-auto px-8 md:px-16 py-16">
          <header className="mb-24 text-center">
             <h4 className="text-[0.6rem] uppercase tracking-[0.3em] text-[#7f8c8d] mb-4">Confidential Environment</h4>
             <h1 className="text-[2.5rem] md:text-[3.5rem] font-serif leading-tight text-[#2c3e50]">Strategic Preservation.</h1>
             <p className="mt-4 text-[0.85rem] text-[#7f8c8d] max-w-lg mx-auto leading-relaxed">All metrics are encrypted and provided exclusively for review by the authorized principal.</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
             
             {/* LEFT COLUMN: THE LEDGER */}
             <div className="lg:col-span-4 flex flex-col gap-12">
                
                <div className="border-b border-[#eaeaea] pb-8">
                   <h5 className="text-[0.6rem] uppercase tracking-[0.2em] text-[#7f8c8d] font-semibold mb-2">Total Consolidated Holdings</h5>
                   <div className="text-[2.5rem] font-serif tracking-tight text-[#2c3e50]">$124,500,000</div>
                   <div className="flex items-center gap-2 text-[#7f8c8d] mt-2 text-[0.75rem] font-medium">
                      Valuation as of 04:00 GMT
                   </div>
                </div>

                <div>
                   <h5 className="text-[0.6rem] uppercase tracking-[0.2em] text-[#7f8c8d] font-semibold mb-6">Required Actions</h5>
                   
                   <div className="flex flex-col gap-6">
                      {/* Action Required Box */}
                      <div className={`border-l-2 pl-4 py-1 transition-all ${signatureExecuted ? 'border-[#bdc3c7]' : 'border-[#2c3e50]'}`}>
                         <h3 className="text-[0.95rem] font-serif text-[#2c3e50] mb-2">Apollo Fund IV Capital Call</h3>
                         <p className="text-[0.8rem] text-[#7f8c8d] mb-3 leading-relaxed">
                            {signatureExecuted ? 'Signature recorded. Transaction securely verified.' : 'Authorization required to wire $250k into the alternatives SPV structure.'}
                         </p>
                         {!signatureExecuted && (
                           <button onClick={() => setSignModalOpen(true)} className="text-[0.65rem] uppercase tracking-[0.1em] font-semibold text-[#2c3e50] hover:text-[#000] border-b border-[#2c3e50] pb-0.5 inline-flex flex-row items-center gap-1 transition-colors">
                             Execute Signature <ArrowRight size={12}/>
                           </button>
                         )}
                      </div>

                      {/* White-Glove Request */}
                      <div className="border-l-2 border-[#eaeaea] pl-4 py-1">
                         <h3 className="text-[0.95rem] font-serif text-[#2c3e50] mb-2">Chalet Itinerary Confirmation</h3>
                         <p className="text-[0.8rem] text-[#7f8c8d] mb-3 leading-relaxed">Your primary advisor has finalized the accommodations for December.</p>
                         <button className="text-[0.65rem] uppercase tracking-[0.1em] font-semibold text-[#7f8c8d] hover:text-[#2c3e50] transition-colors">Review Documents</button>
                      </div>
                   </div>
                </div>

             </div>

             {/* RIGHT COLUMN: THE DASHBOARD */}
             <div className="lg:col-span-8">
                
                {/* Minimal Tab Selector */}
                <div className="flex gap-10 border-b border-[#eaeaea] mb-12 pb-2">
                   <button onClick={() => setActiveTab('wealth')} className={`text-[0.65rem] uppercase tracking-[0.2em] transition-colors pb-2 relative ${activeTab === 'wealth' ? 'text-[#2c3e50] font-bold' : 'text-[#7f8c8d] hover:text-[#2c3e50]'}`}>
                      Allocation
                      {activeTab === 'wealth' && <div className="absolute bottom-[-2px] left-0 w-full h-[1px] bg-[#2c3e50]"></div>}
                   </button>
                   <button onClick={() => setActiveTab('entities')} className={`text-[0.65rem] uppercase tracking-[0.2em] transition-colors pb-2 relative ${activeTab === 'entities' ? 'text-[#2c3e50] font-bold' : 'text-[#7f8c8d] hover:text-[#2c3e50]'}`}>
                      Structuring
                      {activeTab === 'entities' && <div className="absolute bottom-[-2px] left-0 w-full h-[1px] bg-[#2c3e50]"></div>}
                   </button>
                   <button onClick={() => setActiveTab('vault')} className={`text-[0.65rem] uppercase tracking-[0.2em] transition-colors pb-2 relative ${activeTab === 'vault' ? 'text-[#2c3e50] font-bold' : 'text-[#7f8c8d] hover:text-[#2c3e50]'}`}>
                      Secure Vault
                      {activeTab === 'vault' && <div className="absolute bottom-[-2px] left-0 w-full h-[1px] bg-[#2c3e50]"></div>}
                   </button>
                   <button onClick={() => setActiveTab('concierge')} className={`text-[0.65rem] uppercase tracking-[0.2em] transition-colors pb-2 relative ${activeTab === 'concierge' ? 'text-[#2c3e50] font-bold' : 'text-[#7f8c8d] hover:text-[#2c3e50]'}`}>
                      Lifestyle
                      {activeTab === 'concierge' && <div className="absolute bottom-[-2px] left-0 w-full h-[1px] bg-[#2c3e50]"></div>}
                   </button>
                </div>

                {/* Tab Contents */}
                {activeTab === 'wealth' && (
                  <div className="animate-fade-in">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                        <div className="relative">
                           <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-[1.5rem] font-serif text-[#2c3e50]">$124.5</span>
                           </div>
                           <ReactECharts option={pieOption} style={{ height: '360px', width: '100%' }} />
                        </div>
                        <div className="flex flex-col gap-6">
                           <div className="pb-4 border-b border-[#eaeaea]">
                              <div className="flex items-center gap-3 mb-1">
                                 <div className="w-1.5 h-1.5 bg-[#2c3e50]"></div>
                                 <span className="text-[0.7rem] uppercase tracking-widest text-[#7f8c8d]">Liquid Assets</span>
                              </div>
                              <span className="text-[1.15rem] font-serif text-[#2c3e50]">$56,025,000</span>
                           </div>

                           <div className="pb-4 border-b border-[#eaeaea]">
                              <div className="flex items-center gap-3 mb-1">
                                 <div className="w-1.5 h-1.5 bg-[#7f8c8d]"></div>
                                 <span className="text-[0.7rem] uppercase tracking-widest text-[#7f8c8d]">Private Equity</span>
                              </div>
                              <span className="text-[1.15rem] font-serif text-[#2c3e50]">$31,125,000</span>
                           </div>

                           <div className="pb-4">
                              <div className="flex items-center gap-3 mb-1">
                                 <div className="w-1.5 h-1.5 bg-[#bdc3c7]"></div>
                                 <span className="text-[0.7rem] uppercase tracking-widest text-[#7f8c8d]">Real Estate & Alternatives</span>
                              </div>
                              <span className="text-[1.15rem] font-serif text-[#2c3e50]">$37,350,000</span>
                           </div>
                        </div>
                     </div>
                  </div>
                )}
                
                {activeTab === 'entities' && (
                  <div className="flex flex-col items-center justify-center min-h-[360px] text-center animate-fade-in border border-[#eaeaea] bg-white">
                     <Anchor size={24} className="text-[#bdc3c7] mb-6" />
                     <h3 className="text-[1.35rem] font-serif text-[#2c3e50] mb-3">Offshore Segregation</h3>
                     <p className="text-[0.8rem] text-[#7f8c8d] max-w-sm mx-auto leading-relaxed">Core foundation holdings are actively shielded in the designated Trust compliant framework.</p>
                     <button className="mt-8 border border-[#2c3e50] text-[#2c3e50] px-8 py-2.5 text-[0.65rem] uppercase tracking-widest hover:bg-[#2c3e50] hover:text-white transition-colors">Request Ledger</button>
                  </div>
                )}

                {activeTab === 'vault' && (
                  <div className="animate-fade-in border border-[#eaeaea] bg-white">
                     <div className="flex justify-between items-center p-6 border-b border-[#eaeaea] bg-[#fafafa]">
                        <h3 className="text-[1rem] font-serif text-[#2c3e50]">Encrypted Documents</h3>
                        <div className="flex items-center bg-white border border-[#eaeaea] overflow-hidden">
                           <div className="pl-3 pr-2 flex items-center shrink-0">
                              <Search size={12} className="text-[#7f8c8d]" />
                           </div>
                           <input placeholder="Locate file..." className="bg-transparent text-[0.75rem] text-[#2c3e50] outline-none w-32 py-1.5 placeholder-[#bdc3c7]" />
                        </div>
                     </div>
                     <div className="flex flex-col">
                        {loadingDocs ? (
                           <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#bdc3c7]" size={24} /></div>
                        ) : documents.length === 0 ? (
                           <div className="p-12 text-center text-[#7f8c8d] text-[0.85rem]">No encrypted documents available in your vault.</div>
                        ) : (
                           documents.map((doc, idx) => {
                              const dateStr = new Date(doc.updatedAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                              return (
                                 <div key={doc.id} className="flex items-center justify-between p-5 border-b border-[#eaeaea] hover:bg-[#fafafa] transition-colors group cursor-pointer" onClick={() => window.open(`/shared/doc/${doc.id}?tenant=${tenant?.id}`, '_blank')}>
                                    <div className="flex items-center gap-4">
                                       <LockKeyhole size={14} className="text-[#bdc3c7] shrink-0"/>
                                       <div>
                                          <div className="text-[0.85rem] text-[#2c3e50] font-medium mb-1">{doc.title || 'Untitled Document'}</div>
                                          <div className="text-[0.65rem] text-[#7f8c8d] uppercase tracking-widest">{dateStr} &mdash; SECURE</div>
                                       </div>
                                    </div>
                                    <button className="text-[#bdc3c7] hover:text-[#2c3e50] transition-colors shrink-0"><ExternalLink size={16}/></button>
                                 </div>
                              );
                           })
                        )}
                     </div>
                  </div>
                )}

                {activeTab === 'concierge' && (
                  <div className="animate-fade-in border border-[#eaeaea] bg-white p-8 min-h-[360px]">
                     <h3 className="text-[1.35rem] font-serif text-[#2c3e50] mb-6">Concierge & Lifestyle</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="border border-[#eaeaea] p-6 hover:shadow-sm transition-shadow">
                           <Coffee size={20} className="text-[#bdc3c7] mb-4" />
                           <h4 className="font-serif text-[#2c3e50] text-[1.05rem] mb-2">Curated Travel</h4>
                           <p className="text-[0.75rem] text-[#7f8c8d] leading-relaxed mb-4">Aviation, superyacht charters, and distinct elite hospitality sourcing strictly verified by the operational team.</p>
                           <button className="text-[0.65rem] uppercase tracking-widest text-[#2c3e50] font-semibold hover:text-[#7f8c8d] transition-colors border-b border-[#2c3e50] pb-0.5">Submit Inquiry</button>
                        </div>
                        <div className="border border-[#eaeaea] p-6 bg-[#fafafa]">
                           <Shield size={20} className="text-[#2c3e50] mb-4" />
                           <h4 className="font-serif text-[#2c3e50] text-[1.05rem] mb-2">Active St. Moritz Request</h4>
                           <p className="text-[0.75rem] text-[#7f8c8d] leading-relaxed mb-4">Chalet reservation verified. Ground transport routing in progress. Arrival Dec 15th via Zurich HB.</p>
                           <button className="text-[0.65rem] uppercase tracking-widest text-[#2c3e50] font-semibold hover:text-[#7f8c8d] transition-colors border-b border-[#2c3e50] pb-0.5">Review Profile</button>
                        </div>
                     </div>
                  </div>
                )}

             </div>

          </div>
       </main>

       {/* DISCREET SIGNATURE MODAL */}
       {signModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
             <div className="absolute inset-0 bg-[#fcfcfc]/90 backdrop-blur-sm" onClick={() => setSignModalOpen(false)}></div>
             <div className="w-full max-w-md bg-white border border-[#eaeaea] shadow-2xl relative z-10 animate-fade-in">
                <div className="flex justify-between items-center p-6 border-b border-[#eaeaea]">
                   <span className="text-[0.65rem] uppercase tracking-widest text-[#7f8c8d] font-semibold">Verification Protocol</span>
                   <button className="text-[#bdc3c7] hover:text-[#2c3e50] transition-colors" onClick={() => setSignModalOpen(false)}><X size={16}/></button>
                </div>
                
                <div className="p-8 text-center">
                   <h2 className="text-[1.35rem] font-serif text-[#2c3e50] mb-3">Authorize Wire Transfer</h2>
                   <p className="text-[0.8rem] text-[#7f8c8d] leading-relaxed max-w-sm mx-auto mb-10">By signing, you legally instruct the trustee to release $250,000.00 USD to Apollo Fund IV LP corresponding to the K1 Schedule.</p>

                   {!signatureExecuted && signingProgress === 0 ? (
                      <button 
                        onMouseDown={handleSignSimulate}
                        onMouseUp={() => { if(signingProgress < 100) setSigningProgress(0); }}
                        onMouseLeave={() => { if(signingProgress < 100) setSigningProgress(0); }}
                        className="mx-auto w-20 h-20 rounded-full border border-[#2c3e50] flex flex-col items-center justify-center text-[#2c3e50] hover:bg-[#fafafa] transition-colors focus:outline-none"
                      >
                         <Fingerprint size={28} />
                      </button>
                   ) : signingProgress < 100 ? (
                      <div className="w-full max-w-[200px] mx-auto flex flex-col items-center gap-3">
                         <div className="w-full h-[2px] bg-[#eaeaea] overflow-hidden">
                            <div className="h-full bg-[#2c3e50] transition-all duration-150 ease-out" style={{ width: `${signingProgress}%` }}></div>
                         </div>
                         <span className="text-[0.55rem] uppercase tracking-[0.2em] text-[#7f8c8d]">Encrypting Identity...</span>
                      </div>
                   ) : (
                      <div className="flex flex-col items-center animate-fade-in pb-4">
                         <CheckCircle2 size={32} className="text-[#2c3e50] mb-4" />
                         <h3 className="text-[1rem] font-serif text-[#2c3e50] mb-1">Legally Binding</h3>
                         <p className="text-[0.65rem] text-[#7f8c8d] uppercase tracking-widest">Transaction Hash Confirmed</p>
                      </div>
                   )}
                </div>
             </div>
          </div>
       )}

    </div>
  );
}

export default function LuxuryWealthPortal() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#fafafa] text-[#7f8c8d] tracking-[0.2em] uppercase text-xs animate-pulse">Initializing Portal...</div>}>
      <LuxuryWealthPortalInner />
    </Suspense>
  );
}
