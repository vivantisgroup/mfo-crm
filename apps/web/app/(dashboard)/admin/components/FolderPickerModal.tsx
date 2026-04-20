'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FolderOpen, Loader2, HardDrive, LayoutTemplate } from 'lucide-react';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

interface CloudItem {
  id: string;
  name: string;
  isFolder: boolean;
}

interface FolderPickerModalProps {
  tenantId: string;
  memberUid: string;
  memberName: string;
  isOpen: boolean;
  onClose: () => void;
  onSelected: (folderId: string, folderName: string) => void;
}

export function FolderPickerModal({ tenantId, memberUid, memberName, isOpen, onClose, onSelected }: FolderPickerModalProps) {
  const [provider, setProvider] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [pathStack, setPathStack] = useState<{id: string, name: string}[]>([]);
  const [items, setItems] = useState<CloudItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedFolder, setSelectedFolder] = useState<{id: string, name: string} | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Initialize Config
  useEffect(() => {
    if (!isOpen || !tenantId) return;
    const fetchConfig = async () => {
      setLoadingConfig(true);
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        const res = await fetch(`/api/admin/tenant-config?tenantId=${tenantId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.storageIntegrations) {
           const validProviders = ['sharepoint', 'onedrive'];
           const definedIntegrations = Object.keys(data.storageIntegrations).filter(k => validProviders.includes(k));
           if (definedIntegrations.length > 0) {
              const activeProvider = definedIntegrations[0];
              const config = data.storageIntegrations[activeProvider];
              setProvider(config.provider || activeProvider);
              setCredentials(config.credentials);
              setPathStack([{ id: 'root', name: config.rootFolder || 'Root Vault' }]);
           }
        }
      } catch (err) {
        console.error("Failed to load generic storage config", err);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, [isOpen, tenantId]);

  useEffect(() => {
     if (isOpen && !loadingConfig && provider && pathStack.length === 1 && pathStack[0].id === 'root') {
        fetchFolders('root', pathStack[0].name);
     }
  }, [isOpen, loadingConfig, provider]);

  const fetchFolders = async (id: string, name: string) => {
    if (!provider || !credentials) return;
    setLoading(true); setError(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();

      const res = await fetch('/api/admin/onedrive/explore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          msTenantId: credentials.tenantId,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          folderId: id,
          driveType: credentials.driveType,
          siteUrl: credentials.siteUrl
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Provider fetch failed');
      
      const targetItems = data.items || data.folders || [];
      // Only show folders in the picker
      setItems(targetItems.filter((i: any) => i.isFolder));
      
      setPathStack(prev => {
         const idx = prev.findIndex(p => p.id === id);
         if (idx >= 0) return prev.slice(0, idx + 1);
         return [...prev, { id, name }];
      });
      setSelectedFolder({ id, name }); // Defaults selection to current directory
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createFolderTemplate = async () => {
     if (!provider || !credentials) return;
     const currentFolderId = pathStack[pathStack.length - 1].id;
     setCreatingTemplate(true);
     setError(null);
     
     try {
       const { getAuth } = await import('firebase/auth');
       const token = await getAuth().currentUser?.getIdToken();
       
       // Template setup for user
       const rootName = memberName.replace(/[^a-zA-Z0-9 ]/g, '').trim() + " Workspace";
       
       // 1. Create root user folder
       const parentRes = await fetch('/api/admin/onedrive/create-folder', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
         body: JSON.stringify({
           msTenantId: credentials.tenantId, clientId: credentials.clientId, clientSecret: credentials.clientSecret,
           folderId: currentFolderId, driveType: credentials.driveType, siteUrl: credentials.siteUrl,
           newFolderName: rootName
         })
       });
       if (!parentRes.ok) throw new Error("Failed connecting to Root User directory");
       const parentData = await parentRes.json();
       const newTargetId = parentData.item.id;
       
       // 2. We can automatically create subfolders asynchronously (no need to block UI)
       const subfolders = ["01 - Onboarding", "02 - Communications", "03 - Legal & Compliance", "04 - Appraisals"];
       Promise.all(subfolders.map(sf => 
          fetch('/api/admin/onedrive/create-folder', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
             body: JSON.stringify({
                msTenantId: credentials.tenantId, clientId: credentials.clientId, clientSecret: credentials.clientSecret,
                folderId: newTargetId, driveType: credentials.driveType, siteUrl: credentials.siteUrl,
                newFolderName: sf
             })
          })
       )).catch(err => console.error("Template Gen Sub-Error", err));

       // Persist into user
       await saveSelection(newTargetId, rootName);
     } catch (err: any) {
        setError(err.message);
     } finally {
        setCreatingTemplate(false);
     }
  };

  const saveSelection = async (id: string, name: string) => {
     try {
        const db = getFirestore();
        await setDoc(doc(db, 'tenants', tenantId, 'members', memberUid), {
           homeFolderId: id,
           homeFolderDisplayName: name
        }, { merge: true });
        
        onSelected(id, name);
     } catch (err: any) {
        setError("Failed setting metadata: " + err.message);
     }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-50 border-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             <HardDrive className="text-indigo-600" />
             Select Home Folder for {memberName}
          </DialogTitle>
          <p className="text-sm text-slate-500">When this user navigates to the Documents module, they will automatically land in the specified cloud folder.</p>
        </DialogHeader>

        {loadingConfig ? (
           <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-slate-400 w-8 h-8"/></div>
        ) : !provider ? (
           <div className="py-12 flex flex-col items-center justify-center text-slate-500 bg-white rounded-lg border border-slate-200">
              <FolderOpen className="w-10 h-10 mb-2 opacity-50"/>
              <span>No Cloud Storage Configured.</span>
           </div>
        ) : (
           <div className="flex flex-col gap-4">
              {/* Path */}
              <div className="text-sm text-slate-600 bg-white border border-slate-200 rounded-lg py-2 px-3 flex flex-wrap gap-1 items-center">
                 {pathStack.map((p, i) => (
                    <React.Fragment key={p.id}>
                       <button className="hover:text-indigo-700 font-medium truncate max-w-[150px]" onClick={() => fetchFolders(p.id, p.name)}>
                          {p.name}
                       </button>
                       {i < pathStack.length - 1 && <span className="mx-1 text-slate-300">/</span>}
                    </React.Fragment>
                 ))}
                 {loading && <Loader2 className="w-3 h-3 ml-2 animate-spin text-slate-400" />}
              </div>

              {/* Error */}
              {error && <div className="text-red-500 bg-red-50 p-2 rounded-md text-xs font-bold border border-red-200">{error}</div>}

              {/* Items */}
              <div className="h-[300px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-inner text-sm">
                 {items.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center w-full h-full text-slate-400 p-8">
                       <FolderOpen size={32} className="text-slate-200 mb-2" />
                       No subfolders here.
                    </div>
                 )}
                 {items.map((item) => (
                    <div 
                       key={item.id} 
                       className={`px-4 py-3 flex justify-between items-center border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${
                          selectedFolder?.id === item.id ? 'bg-indigo-50/50' : ''
                       }`}
                       onClick={() => setSelectedFolder({ id: item.id, name: item.name })}
                       onDoubleClick={() => fetchFolders(item.id, item.name)}
                    >
                       <div className="flex items-center gap-3">
                          <FolderOpen size={18} className="text-sky-500 fill-sky-100" />
                          <span className="font-semibold text-slate-700">{item.name}</span>
                       </div>
                       <Button size="sm" variant="ghost" className="h-7 text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800" onClick={(e) => {
                          e.stopPropagation();
                          fetchFolders(item.id, item.name);
                       }}>
                          Open
                       </Button>
                    </div>
                 ))}
              </div>
              
              {/* Template generator overlay */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex justify-between items-center text-sm">
                 <div className="flex items-center gap-2 text-indigo-800 font-medium">
                    <LayoutTemplate size={16} className="text-indigo-600" />
                    No folder yet? Auto-generate a templated workspace here.
                 </div>
                 <Button onClick={createFolderTemplate} disabled={creatingTemplate || loading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm shadow-indigo-600/20">
                    {creatingTemplate && <Loader2 size={14} className="animate-spin" />} Build Template
                 </Button>
              </div>
           </div>
        )}

        <DialogFooter className="bg-slate-50 border-t border-slate-200 px-6 py-4 -mx-6 -mb-6 mt-4 rounded-b-lg flex justify-between items-center">
            <div className="text-xs text-slate-500 flex-1">
               {selectedFolder ? (
                  <span>Selected Mount Point: <span className="font-bold text-slate-700">{selectedFolder.name}</span></span>
               ) : (
                  <span>Select a folder to set as root...</span>
               )}
            </div>
            <div className="space-x-2">
               <Button variant="outline" onClick={onClose} className="border-slate-300">Cancel</Button>
               <Button onClick={() => {
                  if (selectedFolder) saveSelection(selectedFolder.id, selectedFolder.name);
               }} disabled={!selectedFolder || loading} className="bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                  Assign as Home Folder
               </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
