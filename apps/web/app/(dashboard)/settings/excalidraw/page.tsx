'use client';

import React, { useState, useEffect } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { Layers, Download, CheckCircle, Search, Loader2, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';

export default function ExcalidrawLibraryCatalog() {
  usePageTitle('Excalidraw Library Ecosystem');
  const { tenant } = useAuth();

  const [availableLibs, setAvailableLibs] = useState<any[]>([]);
  const [installedLibs, setInstalledLibs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!tenant?.id) return;
      try {
        // Fetch community libs
        const res = await fetch('https://libraries.excalidraw.com/libraries.json');
        const data = await res.json();
        setAvailableLibs(data);

        // Fetch installed libs
        const docRef = doc(db, 'tenants', tenant.id, 'configuration', 'excalidraw_libraries');
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().installed) {
           setInstalledLibs(snap.data().installed);
        } else {
           setInstalledLibs([]);
        }
      } catch (e) {
        console.error('Failed to fetch library catalog', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tenant?.id]);

  const toggleInstall = async (lib: any) => {
    if (!tenant?.id) return;
    
    const isInstalled = installedLibs.find(i => i.id === lib.id);
    let newInstalled = [...installedLibs];

    if (isInstalled) {
       newInstalled = newInstalled.filter(i => i.id !== lib.id);
    } else {
       // Download the actual library JSON payload and install it locally
       try {
         const libRes = await fetch(`https://libraries.excalidraw.com/${lib.source}`);
         const libData = await libRes.json();
         // libData.libraryItems contains the shapes
         newInstalled.push({
            id: lib.id,
            name: lib.name,
            version: libData.version || 1,
            libraryItems: libData.libraryItems || []
         });
       } catch (e) {
         console.error('Failed to parse library from excalidraw', e);
         return;
       }
    }

    setInstalledLibs(newInstalled);
    await setDoc(doc(db, 'tenants', tenant.id, 'configuration', 'excalidraw_libraries'), {
      installed: newInstalled
    }, { merge: true });
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

  const filtered = availableLibs.filter(lib => lib.name.toLowerCase().includes(search.toLowerCase()) || lib.description.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto w-full p-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6 w-full">
        
        <div className="flex items-center gap-3 text-slate-500 mb-2">
           <Link href="/settings" className="hover:text-indigo-600 flex items-center gap-1 text-sm"><ArrowLeft size={16} /> Back to Settings</Link>
        </div>

        <div className="bg-white px-8 py-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Layers className="text-[#6965db]" size={28} /> Excalidraw Ecosystem
              </h1>
              <p className="text-sm text-slate-500 mt-1">Install public shape libraries to empower users with standard diagramming elements.</p>
            </div>
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <input 
                 value={search} onChange={e => setSearch(e.target.value)}
                 type="text" 
                 placeholder="Search standard libraries..." 
                 className="w-64 pl-9 pr-4 py-2 border border-slate-300 bg-slate-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" 
               />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
             {filtered.map((lib) => {
               const installed = installedLibs.find(i => i.id === lib.id);
               return (
                 <div key={lib.id} className={`p-5 rounded-xl border ${installed ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white'} shadow-sm flex flex-col justify-between transition-colors`}>
                    <div>
                      <div className="font-bold text-slate-800 tracking-tight flex items-center gap-2">
                         {lib.name} 
                         {installed && <CheckCircle size={14} className="text-emerald-500" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">{lib.description}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                       <span className="text-[10px] font-mono text-slate-400">By: {lib.authors?.map((a:any)=>a.name).join(', ')}</span>
                       <button 
                         onClick={() => toggleInstall(lib)}
                         className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 ${installed ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-[#6965db] text-white hover:bg-[#5651c6]'}`}
                       >
                         {installed ? 'Uninstall' : <><Download size={12}/> Install</>}
                       </button>
                    </div>
                 </div>
               );
             })}
          </div>
        </div>

      </div>
    </div>
  );
}
