'use client';

import React, { useState } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';

import { FileText, Sparkles, AlertCircle, Maximize2, SplitSquareHorizontal } from 'lucide-react';

export default function DocumentExtractionHub() {
  usePageTitle('Automatic Document Extraction');
  
  const [activeTab, setActiveTab] = useState('Header data');

  return (
    <div className="relative w-full h-full flex flex-col bg-background text-foreground overflow-y-auto">
      {/* Dynamic SAP Fiori Document Header */}
      <div className="bg-white px-8 py-6 border-b border-[var(--border-subtle)] shadow-sm shrink-0 flex flex-col gap-4 relative z-10">
         <div className="flex justify-between items-start">
             <div>
                <div className="flex items-center gap-4 mb-2">
                   <h1 className="text-[1.75rem] font-bold text-[#32363a] tracking-tight leading-none">100000219</h1>
                   <div className="flex items-center gap-2 mt-1">
                      <span className="bg-[#0a6ed1]/10 text-[#0a6ed1] font-bold text-[0.75rem] px-2 py-0.5 rounded uppercase tracking-wider">AI Extracted</span>
                   </div>
                </div>
                <div className="text-[1.25rem] text-[#6a6d70]">Bike Order HS.pdf</div>
             </div>
             
             {/* Toolbar Actions */}
             <div className="flex items-center gap-2">
                 <button className="px-3 py-1.5 bg-[#0a6ed1] text-white font-bold rounded hover:bg-[#0854a0] transition text-[0.8125rem]">Edit</button>
                 <button className="px-3 py-1.5 border border-[#d9d9d9] text-[#bb0000] font-bold rounded hover:bg-red-50 transition text-[0.8125rem]">Delete</button>
                 <div className="w-px h-4 bg-[#d9d9d9] mx-1"></div>
                 <button className="px-3 py-1.5 border border-[#d9d9d9] text-[#0a6ed1] font-bold rounded hover:bg-[#f5f5f5] transition text-[0.8125rem]">Create a sales order</button>
                 <button className="px-3 py-1.5 border border-[#d9d9d9] text-[#0a6ed1] font-bold rounded hover:bg-[#f5f5f5] transition text-[0.8125rem]">Simulation creation</button>
                 <button className="px-3 py-1.5 border border-[#d9d9d9] text-[#0a6ed1] font-bold rounded hover:bg-[#f5f5f5] transition text-[0.8125rem] opacity-50 cursor-not-allowed">View File</button>
                 <button className="px-3 py-1.5 border border-[#d9d9d9] text-[#0a6ed1] font-bold rounded hover:bg-[#f5f5f5] transition text-[0.8125rem] flex items-center gap-1">Log <span className="opacity-50 text-[10px]">▼</span></button>
                 <button className="px-3 py-1.5 border border-[#d9d9d9] text-[var(--brand-primary)] bg-[var(--brand-faint)] font-bold rounded hover:bg-[var(--brand-primary)] hover:text-white transition text-[0.8125rem] flex items-center gap-1.5 shadow-sm"><Sparkles size={14}/> Summarize</button>
             </div>
         </div>

         {/* Header Context Metrics */}
         <div className="flex flex-wrap gap-x-12 gap-y-4 mt-2">
            <div className="flex flex-col gap-1 text-[0.8125rem]">
               <div className="flex gap-2"><span className="text-[#6a6d70] w-28">Company Code:</span> <span className="text-[#32363a]">BestRun US (1710)</span></div>
               <div className="flex gap-2 items-center"><span className="text-[#6a6d70] w-28">Source File:</span> <span className="text-[#0a6ed1] flex items-center gap-1 font-semibold"><FileText size={14}/> Bike Order HS.pdf</span></div>
               <div className="flex gap-2"><span className="text-[#6a6d70] w-28">Sales Order:</span> <span className="text-[#0a6ed1] font-semibold hover:underline cursor-pointer">428188</span></div>
            </div>
            
            <div className="flex flex-col gap-1 text-[0.8125rem]">
               <div className="flex gap-2"><span className="text-[#6a6d70] w-28">Last Changed By:</span> <span className="text-[#32363a]">Dale Jones (CB9900000065)</span></div>
               <div className="flex gap-2"><span className="text-[#6a6d70] w-28">Last Changed On:</span> <span className="text-[#32363a]">09/18/2024, 11:39:59</span></div>
               <div className="flex gap-2"><span className="text-[#6a6d70] w-28">Created By:</span> <span className="text-[#32363a]">Dale Jones (CB9900000065)</span></div>
               <div className="flex gap-2"><span className="text-[#6a6d70] w-28">Created On:</span> <span className="text-[#32363a]">09/18/2024, 11:38:55</span></div>
               <div className="flex gap-2"><span className="text-[#6a6d70] w-28">Last Simulated On:</span> <span className="text-[#32363a]">—</span></div>
            </div>

            <div className="flex flex-col gap-1">
               <span className="text-[#32363a] font-bold text-[0.875rem] mb-1">Processing Status</span>
               <span className="text-[#2a7e4b] text-[1.25rem]">Order Created</span>
            </div>

            <div className="flex flex-col gap-1">
               <span className="text-[#32363a] font-bold text-[0.875rem] mb-1">Order simulation</span>
               <span className="text-[#32363a] text-[1.25rem]">—</span>
            </div>

            <div className="flex flex-col gap-1">
               <span className="text-[#32363a] font-bold text-[0.875rem] mb-1">Withdrawn Equity</span>
               <span className="text-[#32363a] text-[1.5rem] font-light">300,00 <span className="text-[1rem] font-bold text-[#6a6d70]">USD</span></span>
            </div>
         </div>
      </div>

      <div className="flex-1 px-4 lg:px-8 py-8 bg-white flex flex-col relative overflow-hidden"><div className="max-w-[1200px] w-full mx-auto flex flex-col gap-6">

         {/* Layout Control Bar */}
         <div className="w-full flex justify-center py-2 absolute top-0 z-20 pointer-events-none">
            <div className="pointer-events-auto bg-white border border-[#d9d9d9] rounded-full px-3 py-1 flex items-center gap-4 shadow-sm opacity-50 hover:opacity-100 transition-opacity">
               <button className="text-[#0a6ed1]"><SplitSquareHorizontal size={18}/></button>
               <button className="text-[#6a6d70] hover:text-[#0a6ed1]"><Maximize2 size={16}/></button>
            </div>
         </div>

         <div className="flex-1 flex w-full">
            {/* Split Left: Extracted Data */}
            <div className="w-1/2 min-w-[500px] border-r border-[#d9d9d9] flex flex-col bg-white overflow-hidden">
               
               {/* Internal Tabs */}
               <div className="px-6 flex gap-6 border-b border-[#0a6ed1] mt-8 shrink-0">
                  <button onClick={() => setActiveTab('Header data')} className={`pb-2 text-[0.875rem] font-bold ${activeTab === 'Header data' ? 'text-[#0a6ed1] border-b-2 border-[#0a6ed1]' : 'text-[#6a6d70] hover:text-[#32363a]'}`}>Header data</button>
                  <button onClick={() => setActiveTab('Project Data')} className={`pb-2 text-[0.875rem] font-bold ${activeTab === 'Project Data' ? 'text-[#0a6ed1] border-b-2 border-[#0a6ed1]' : 'text-[#6a6d70] hover:text-[#32363a]'}`}>Project Data</button>
               </div>

               <div className="flex-1 overflow-y-auto p-8">
                  {activeTab === 'Header data' && (
                     <div className="grid grid-cols-1 xl:grid-cols-3 gap-x-8 gap-y-12">
                        
                        {/* Section 1 */}
                        <div>
                           <h3 className="font-bold text-[#32363a] text-[1rem] mb-6">Basic sales data</h3>
                           <div className="flex flex-col gap-5 text-[0.875rem]">
                              <div><div className="text-[#6a6d70] mb-0.5">Sales Organization:</div><div className="text-[#32363a]">Dom. Sales Org US (1710)</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Distribution Channel:</div><div className="text-[#32363a]">Direct Sales (10)</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Division:</div><div className="text-[#32363a]">Product Division 00 (00)</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Sales Order Type:</div><div className="text-[#32363a]">Standard Order (OR)</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Requested Delivery Date:</div><div className="text-[#32363a]">—</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Customer Reference:</div><div className="text-[#32363a]">3211624</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Customer Reference Date:</div><div className="text-[#32363a]">05/25/2024</div></div>
                           </div>
                        </div>

                        {/* Section 2 */}
                        <div>
                           <h3 className="font-bold text-[#32363a] text-[1rem] mb-6">Sold-to Party Data</h3>
                           <div className="flex flex-col gap-5 text-[0.875rem]">
                              <div><div className="text-[#6a6d70] mb-0.5">Sold-to Party:</div><div className="text-[#0a6ed1] font-semibold hover:underline cursor-pointer">Domestic US Customer Direct Debit (17100100)</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Street:</div><div className="text-[#32363a]">Little Pathway</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">House Number:</div><div className="text-[#32363a]">17</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Postal Code:</div><div className="text-[#32363a]">92128-1096</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">City:</div><div className="text-[#32363a]">San Diego</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Country/Region:</div><div className="text-[#32363a]">US</div></div>
                           </div>
                        </div>

                        {/* Section 3 */}
                        <div>
                           <h3 className="font-bold text-[#32363a] text-[1rem] mb-6">Consignee data</h3>
                           <div className="flex flex-col gap-5 text-[0.875rem]">
                              <div><div className="text-[#6a6d70] mb-0.5">Ship-to Party:</div><div className="text-[#0a6ed1] font-semibold hover:underline cursor-pointer">Domestic US Customer Direct Debit (17100100)</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Street:</div><div className="text-[#32363a]">Little Pathway</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">House Number:</div><div className="text-[#32363a]">17</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Postal Code:</div><div className="text-[#32363a]">92128-1096</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">City:</div><div className="text-[#32363a]">San Diego</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Country/Region:</div><div className="text-[#32363a]">US</div></div>
                           </div>
                        </div>

                        {/* Section 4 */}
                        <div>
                           <h3 className="font-bold text-[#32363a] text-[1rem] mb-6">Extracted purchasing data</h3>
                           <div className="flex flex-col gap-5 text-[0.875rem]">
                              <div><div className="text-[#6a6d70] mb-0.5">Purchase Order Number:</div><div className="text-[#32363a]">3211624</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Purchase Order Date:</div><div className="text-[#32363a]">05/25/2024</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5 flex items-center gap-1">Extracted Requested Delivery Date: <AlertCircle size={14} className="text-[#bb0000]"/></div><div className="text-[#bb0000] font-bold">—</div></div>
                           </div>
                        </div>

                        {/* Section 5 */}
                        <div className="xl:col-span-2">
                           <h3 className="font-bold text-[#32363a] text-[1rem] mb-6">Extracted sold-to party additional data</h3>
                           <div className="flex flex-col gap-5 text-[0.875rem]">
                              <div><div className="text-[#6a6d70] mb-0.5">Tax Registration Number:</div><div className="text-[#32363a]">—</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Additional Tax Number:</div><div className="text-[#32363a]">—</div></div>
                              <div><div className="text-[#6a6d70] mb-0.5">Bank Account:</div><div className="text-[#32363a]">—</div></div>
                           </div>
                        </div>

                     </div>
                  )}
               </div>
            </div>

            {/* Split Right: Visual PDF Viewer Canvas */}
            <div className="flex-1 bg-[#efefef] flex flex-col p-4">
               {/* Embed Iframe for PDF rendering / Placeholder */}
               <div className="flex-1 bg-white border border-[#d9d9d9] shadow-inner rounded overflow-hidden flex flex-col relative">
                  <div className="h-10 border-b border-[#e4e4e4] bg-[#fafafa] flex items-center px-4 justify-between shrink-0">
                     <div className="flex items-center gap-4 text-[#32363a] text-[0.75rem] font-bold">
                        <button className="hover:text-[#0a6ed1]">• Fit Width</button>
                     </div>
                     <div className="flex items-center gap-3 text-[#32363a] text-[0.75rem]">
                        <input type="text" value="1" readOnly className="w-8 border border-[#d9d9d9] rounded text-center py-0.5" /> / 2
                     </div>
                  </div>
                  <div className="flex-1 bg-[#525659] flex justify-center overflow-y-auto p-4">
                     {/* SAP Form Replica Context */}
                     <div className="w-[8.5in] h-[11in] bg-white shadow-xl p-16 flex flex-col shrink-0 relative">
                        
                        {/* Pink Highlights indicating extraction sources */}
                        <div className="absolute top-[280px] right-[100px] w-[200px] h-12 bg-pink-500/30 mix-blend-multiply border border-pink-500 cursor-pointer hover:bg-pink-500/50 transition"></div>
                        <div className="absolute top-[350px] right-[100px] w-[200px] h-12 bg-pink-500/30 mix-blend-multiply border border-pink-500 cursor-pointer hover:bg-pink-500/50 transition"></div>
                        <div className="absolute bottom-[300px] left-[150px] w-[180px] h-6 bg-pink-500/30 mix-blend-multiply border border-pink-500 cursor-pointer hover:bg-pink-500/50 transition"></div>

                        <div className="flex justify-between items-start mb-20">
                           <div className="w-48 h-24 bg-[#0a6ed1] text-white flex flex-col items-center justify-center pt-2 font-black text-5xl">
                              SAP <span className="text-[10px] mt-2 font-bold opacity-80 uppercase tracking-widest">For Internal Use!</span>
                           </div>
                           <div className="text-right flex flex-col gap-4 text-[10px]">
                              <div className="font-bold text-[16px] mb-4">Purchase order</div>
                              <div>
                                 <div className="text-gray-500">Purchase Order No.</div>
                                 <div className="font-medium">3211624</div>
                              </div>
                              <div>
                                 <div className="text-gray-500">Organization id</div>
                                 <div className="font-medium">11111</div>
                              </div>
                              <div className="text-right">
                                 <div className="text-gray-500 mb-1">Delivery Address</div>
                                 <div>Domestic US Customer Direct<br/>Debit 17 Caminito Pasedero, San<br/>Diego, USA, 92128-1090</div>
                              </div>
                              <div className="text-right">
                                 <div className="text-gray-500 mb-1">Invoice Address</div>
                                 <div>Domestic US Customer Direct<br/>Debit 17 Caminito Pasedero, San<br/>Diego, USA, 92128-1090</div>
                              </div>
                           </div>
                        </div>

                        <div className="flex justify-between text-[10px] items-end pb-8 border-b-2 border-slate-800 mb-8">
                           <div className="flex flex-col gap-4">
                              <div>
                                 <div className="text-gray-500">Supplier No.</div>
                                 <div className="font-bold text-purple-700">19920</div>
                              </div>
                              <div className="text-gray-500">Supplier Contact/Telephone</div>
                           </div>
                           <div className="flex text-left gap-12">
                              <div>
                                 <div className="text-gray-500">Payment Terms</div>
                                 <div className="font-bold text-purple-700">14 Days 2%; 30 Net</div>
                              </div>
                              <div>
                                 <div className="text-gray-500">Incoterms</div>
                                 <div className="font-bold text-purple-700">Delivered duty paid</div>
                              </div>
                           </div>
                        </div>

                        <table className="w-full text-[10px] text-left">
                           <thead>
                              <tr className="border-b border-gray-300">
                                 <th className="font-normal text-gray-500 pb-2">Line</th>
                                 <th className="font-normal text-gray-500 pb-2">Part Number / Description</th>
                                 <th className="font-normal text-gray-500 pb-2">Delivery</th>
                                 <th className="font-normal text-gray-500 pb-2">Quantity</th>
                                 <th className="font-normal text-gray-500 pb-2">Unit</th>
                                 <th className="font-normal text-gray-500 pb-2">Unit Price</th>
                                 <th className="font-normal text-gray-500 pb-2 text-right">Extended Price</th>
                              </tr>
                           </thead>
                           <tbody>
                              <tr>
                                 <td className="py-4">1</td>
                                 <td className="py-4 text-purple-700 font-bold">TG11<br/>Trad.Good 11, PD, Reg.Trading</td>
                                 <td className="py-4 font-bold">28-MAY-2024</td>
                                 <td className="py-4">10</td>
                                 <td className="py-4">EA</td>
                                 <td className="py-4 text-purple-700 font-bold">30</td>
                                 <td className="py-4 text-purple-700 font-bold text-right">300</td>
                              </tr>
                           </tbody>
                        </table>
                        
                     </div>
                  </div>
               </div>
            </div>
         </div>
         
      </div></div>
    </div>
  );
}
