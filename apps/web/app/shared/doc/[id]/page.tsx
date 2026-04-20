'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { Loader2, Lock, FileText, Download } from 'lucide-react';

export default function SharedDocumentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const tenant = searchParams?.get('tenant') as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<any>(null);

  useEffect(() => {
    if (!id || !tenant) {
       setError("Invalid sharing link. Missing required parameters.");
       setLoading(false);
       return;
    }

    const loadDoc = async () => {
       try {
          const db = getFirestore(firebaseApp);
          const docRef = doc(db, 'tenants', tenant, 'knowledgeArticles', id);
          const snap = await getDoc(docRef);

          if (!snap.exists()) {
             setError("Document not found or has been removed.");
             return;
          }

          const data = snap.data();
          if (data.visibility !== 'shared') {
             setError("This document is no longer publicly shared.");
             return;
          }

          setArticle(data);
       } catch (err) {
          setError("An error occurred while loading this document.");
       } finally {
          setLoading(false);
       }
    };

    loadDoc();
  }, [id, tenant]);

  const handlePrint = () => {
     window.print();
  };

  if (loading) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
           <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
           <p className="text-slate-500 font-medium">Loading secure document...</p>
        </div>
     );
  }

  if (error || !article) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
           <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Lock className="text-red-500" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
              <p className="text-slate-600 font-medium leading-relaxed mb-8">{error}</p>
           </div>
        </div>
     );
  }

  return (
     <div className="min-h-screen bg-slate-50 print:bg-white text-slate-900 font-sans">
        {/* Top Navbar */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-50 print:hidden shadow-sm">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center">
                 <FileText className="text-indigo-600" size={18} />
              </div>
              <span className="font-semibold text-slate-800 truncate max-w-[300px] sm:max-w-[500px]">
                 {article.title || 'Shared Document'}
              </span>
           </div>
           <button 
              onClick={handlePrint}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md font-semibold text-sm transition-colors"
           >
              <Download size={16} /> <span className="hidden sm:inline">Save PDF</span>
           </button>
        </div>

        {/* Document Content Container */}
        <div className="max-w-[850px] mx-auto py-12 px-6 sm:px-12 print:p-0 print:m-0">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-16 min-h-[800px] print:shadow-none print:border-none print:min-h-0 print:p-0">
              {/* Rich Text Output */}
              <div 
                 className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-4xl prose-h1:mb-8 prose-h2:text-2xl prose-h2:mt-10 prose-p:leading-relaxed prose-a:text-indigo-600 hover:prose-a:text-indigo-500"
                 dangerouslySetInnerHTML={{ __html: article.content }} 
              />
           </div>

           <div className="mt-8 text-center text-slate-400 text-sm print:hidden pb-12 flex flex-col items-center gap-2">
              <Lock size={14} className="text-slate-300" />
              <span>Securely shared via MFO-CRM Vault</span>
           </div>
        </div>
     </div>
  );
}
