'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderOpen, File, HardDrive, Search, LayoutGrid, List as ListIcon, Loader2, Tag, Info, ShieldCheck, X, FolderPlus, UploadCloud } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getFirestore, doc, collection, getDocs, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';

function getConsistentColor(text: string) {
  const colors = [
    'bg-red-100 text-red-800 border-red-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-green-100 text-green-800 border-green-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-cyan-100 text-cyan-800 border-cyan-200',
    'bg-sky-100 text-sky-800 border-sky-200',
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-violet-100 text-violet-800 border-violet-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-rose-100 text-rose-800 border-rose-200',
  ];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

interface CloudItem {
  id: string;
  name: string;
  isFolder: boolean;
  itemCount?: number;
  size?: number;
  lastModifiedDateTime?: string;
  webUrl?: string;
  downloadUrl?: string;
  parentPath?: string;
}

interface FileMetadata {
  id: string;
  tags: string[];
  entities: string[];
  customName?: string;
  description?: string;
}

interface StorageExplorerProps {
  tenantId: string;
  embedded?: boolean;
  contextFamilyId?: string;
}

export function StorageExplorer({ tenantId, embedded, contextFamilyId }: StorageExplorerProps) {
  const { user } = useAuth();
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [provider, setProvider] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<any>(null);
  
  const [pathStack, setPathStack] = useState<{id: string, name: string}[]>([]);
  const [items, setItems] = useState<CloudItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // View & Meta State
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<CloudItem | null>(null);
  
  // Viewer State
  const [showViewer, setShowViewer] = useState(false);
  const [viewerExpanded, setViewerExpanded] = useState(false);
  
  // Write States
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Linkage Entity State
  const [globalEntities, setGlobalEntities] = useState<{id: string, name: string, type: string}[]>([]);
  const [entitySearchQuery, setEntitySearchQuery] = useState('');
  const [isEntityDropdownOpen, setIsEntityDropdownOpen] = useState(false);

  const canWriteVault = useMemo(() => {
     if (!user?.role) return false;
     return ['saas_master_admin', 'tenant_admin', 'business_manager', 'sales_manager', 'revenue_manager', 'account_executive', 'sdr'].includes(user.role);
  }, [user]);
  
  // Metadata Engine
  const [metadataMap, setMetadataMap] = useState<Record<string, FileMetadata>>({});
  
  // 1. Initial Load: Get Tenant Configuration for Storage
  useEffect(() => {
    if (!tenantId) return;
    const fetchConfig = async () => {
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        const res = await fetch(`/api/admin/tenant-config?tenantId=${tenantId}&_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        const data = await res.json();
        
        if (data.storageIntegrations) {
           const validProviders = ['sharepoint', 'onedrive', 'gdrive', 'aws', 'dropbox'];
           const definedIntegrations = Object.keys(data.storageIntegrations).filter(k => validProviders.includes(k));
           
           if (definedIntegrations.length > 0) {
              const activeProvider = definedIntegrations[0];
              const config = data.storageIntegrations[activeProvider];
              setProvider(config.provider || activeProvider);
              setCredentials(config.credentials);
              
              // Resolve User Home Folder overrides
              let rootId = 'root';
              let rootName = config.rootFolder || 'Root';
              try {
                  const db = getFirestore();
                  if (contextFamilyId) {
                      const famSnap = await getDoc(doc(db, 'tenants', tenantId, 'families', contextFamilyId));
                      if (famSnap.exists() && famSnap.data().storage_landing_folder_id) {
                          rootId = famSnap.data().storage_landing_folder_id;
                          rootName = famSnap.data().storage_landing_folder_name || 'Home';
                      }
                  } else if (user?.uid) {
                      const tMemberSnap = await getDoc(doc(db, 'tenants', tenantId, 'members', user.uid));
                      if (tMemberSnap.exists()) {
                         const tM = tMemberSnap.data();
                         if (tM.homeFolderId) {
                            rootId = tM.homeFolderId;
                            rootName = tM.homeFolderDisplayName || rootName;
                         }
                      }
                  }
              } catch(e) { console.warn("Failed resolving user's home space", e) }

              setPathStack([{ id: rootId, name: rootName }]);
           } else if (typeof data.storageIntegrations.provider === 'string' && data.storageIntegrations.credentials) {
              // Legacy fallback if no modern integrations defined yet
              let p = data.storageIntegrations.provider;
              if (p === 'onedrive' && data.storageIntegrations.credentials?.driveType === 'site') {
                 p = 'sharepoint';
              }
              setProvider(p);
              setCredentials(data.storageIntegrations.credentials);
              setPathStack([{ id: 'root', name: data.storageIntegrations.rootFolder || 'Root' }]);
           }
        }
      } catch (err) {
        console.error("Failed to load generic storage config", err);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, [tenantId]);

  // Load Entities for Contextual Linking
  useEffect(() => {
    if (!tenantId) return;
    const db = getFirestore();
    const fetchEntities = async () => {
      try {
        const orgsSnap = await getDocs(collection(db, 'tenants', tenantId, 'organizations'));
        const familiesSnap = await getDocs(collection(db, 'tenants', tenantId, 'families'));
        const contactsSnap = await getDocs(collection(db, 'tenants', tenantId, 'contacts'));
        const tasksSnap = await getDocs(collection(db, 'tenants', tenantId, 'tasks'));
        
        const entities: {id: string, name: string, type: string}[] = [];
        orgsSnap.forEach(d => {
           const name = (d.data().name || '').trim();
           if (name && name.toLowerCase() !== 'unknown') {
               entities.push({ id: d.id, name, type: d.data().type === 'family_group' ? 'Family' : 'Organization' });
           }
        });
        familiesSnap.forEach(d => {
           const name = (d.data().name || '').trim();
           if (name && name.toLowerCase() !== 'unknown') {
               entities.push({ id: d.id, name, type: 'Family' });
           }
        });
        contactsSnap.forEach(d => {
           const name = `${d.data().firstName || ''} ${d.data().lastName || ''}`.trim();
           if (name && name.toLowerCase() !== 'unknown') {
               entities.push({ id: d.id, name, type: 'Contact' });
           }
        });
        tasksSnap.forEach(d => {
           const name = (d.data().title || '').trim();
           if (name && name.toLowerCase() !== 'unknown') {
               entities.push({ id: d.id, name, type: 'Task' });
           }
        });
        
        setGlobalEntities(entities.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.log("Failed to prepopulate entities", err);
      }
    };
    fetchEntities();
  }, [tenantId]);

  // 2. Initial Mount Folder Call once config is loaded
  useEffect(() => {
     if (!loadingConfig && provider && pathStack.length === 1 && pathStack[0].id) {
        fetchFolders(pathStack[0].id, pathStack[0].name);
     }
  }, [loadingConfig, provider]);

  // 3. Metadata listener
  useEffect(() => {
    if (!tenantId) return;
    const db = getFirestore();
    const metaRef = collection(db, 'tenants', tenantId, 'fileMetadata');
    const unsub = onSnapshot(metaRef, (snap) => {
       const map: Record<string, FileMetadata> = {};
       snap.forEach(d => { map[d.id] = d.data() as FileMetadata; });
       setMetadataMap(map);
    });
    return () => unsub();
  }, [tenantId]);

  const fetchFolders = async (id: string, name: string) => {
    if (!provider || !credentials) return;
    setLoading(true);
    setError(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      let res;

      if (provider === 'onedrive' || provider === 'sharepoint') {
        res = await fetch('/api/admin/onedrive/explore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            msTenantId: credentials.tenantId,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            serviceAccountEmail: credentials.serviceAccount,
            folderId: id,
            driveType: credentials.driveType,
            siteUrl: credentials.siteUrl
          })
        });
      }

      if (!res) throw new Error("Storage provider fetcher not implemented yet.");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Provider fetch failed');
      
      setItems(data.items || data.folders || []);
      
      setPathStack(prev => {
         const idx = prev.findIndex(p => p.id === id);
         if (idx >= 0) return prev.slice(0, idx + 1);
         return [...prev, { id, name }];
      });
      setSelectedItem(null);
      setShowViewer(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMetadataUpdate = async (tagUpdate: string[], entitiesUpdate: string[]) => {
      if (!selectedItem || !tenantId) return;
      const db = getFirestore();
      await setDoc(doc(db, 'tenants', tenantId, 'fileMetadata', selectedItem.id), {
          id: selectedItem.id,
          tags: tagUpdate,
          entities: entitiesUpdate,
          updatedAt: new Date().toISOString()
      }, { merge: true });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !provider || !credentials) return;
    setLoading(true);
    setIsCreatingFolder(false);
    
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      const currentFolderId = pathStack[pathStack.length - 1].id;

      const res = await fetch('/api/admin/onedrive/create-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          msTenantId: credentials.tenantId,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          serviceAccountEmail: credentials.serviceAccount,
          folderId: currentFolderId,
          driveType: credentials.driveType,
          siteUrl: credentials.siteUrl,
          newFolderName: newFolderName
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create folder');
      
      setNewFolderName('');
      
      // Implement optimistic UI to bypass Azure Graph index latency
      if (data.item) {
         setItems(prev => [data.item, ...prev].sort((a,b) => {
             if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
             return a.isFolder ? -1 : 1;
         }));
      }
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !provider || !credentials) return;
    if (file.size > 4 * 1024 * 1024) {
       setError("File is larger than 4MB simple-upload limit.");
       if (fileInputRef.current) fileInputRef.current.value = '';
       return;
    }
    
    setIsUploading(true);
    setError(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      const currentFolderId = pathStack[pathStack.length - 1].id;

      const formData = new FormData();
      formData.append('msTenantId', credentials.tenantId);
      formData.append('clientId', credentials.clientId);
      formData.append('clientSecret', credentials.clientSecret);
      if (credentials.serviceAccount) formData.append('serviceAccountEmail', credentials.serviceAccount);
      formData.append('folderId', currentFolderId);
      if (credentials.driveType) formData.append('driveType', credentials.driveType);
      if (credentials.siteUrl) formData.append('siteUrl', credentials.siteUrl);
      formData.append('file', file);

      const res = await fetch('/api/admin/onedrive/upload', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload file');
      
      // Optimistic UI push to bypass index latency
      if (data.item) {
         setItems(prev => [...prev.filter(i => i.id !== data.item.id), data.item].sort((a,b) => {
             if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
             return a.isFolder ? -1 : 1;
         }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredItems = useMemo(() => {
     let temp = items;
     if (contextFamilyId) {
         temp = temp.filter(item => {
            // Either it's a folder, or its metadata entities array explicitly includes the family context
            if (item.isFolder) return true;
            const meta = metadataMap[item.id];
            return meta?.entities?.some(e => e.includes(contextFamilyId));
         });
     }
     
     if (!searchQuery) return temp;
     const q = searchQuery.toLowerCase();
     return temp.filter(item => {
        // Direct string match
        if (item.name.toLowerCase().includes(q)) return true;
        
        // Metadata match
        const meta = metadataMap[item.id];
        if (meta) {
           if (meta.tags?.some(t => t.toLowerCase().includes(q))) return true;
           if (meta.entities?.some(t => t.toLowerCase().includes(q))) return true;
        }
        return false;
     });
  }, [items, searchQuery, metadataMap, contextFamilyId]);

  const filteredGlobalEntities = useMemo(() => {
     if (!entitySearchQuery) return [];
     const q = entitySearchQuery.toLowerCase();
     return globalEntities.filter(e => e.name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q)).slice(0, 15);
  }, [globalEntities, entitySearchQuery]);

  function formatBytes(bytes?: number) {
    if (bytes === undefined || bytes === null || bytes === 0) return '--';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  if (loadingConfig) {
    return <div className="flex h-[400px] w-full items-center justify-center text-slate-500 animate-pulse">Initializing Integrated Vault...</div>;
  }

  if (!provider) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
         <HardDrive className="w-12 h-12 text-slate-300 mb-4" />
         <h3 className="text-lg font-semibold text-slate-800">Storage Not Configured</h3>
         <p className="text-sm text-slate-500 mt-2 max-w-md">The organizational file vault has not been mapped to a cloud provider. Please context the SaaS Administrator to configure Microsoft SharePoint or similar integrations.</p>
      </div>
    );
  }

  return (
    <Card className="w-full flex flex-col bg-slate-50 relative border-none" style={{ height: embedded ? '100%' : 'calc(100vh - 8rem)', marginTop: embedded ? 0 : 24 }}>
      {!embedded && (
        <CardHeader className="flex flex-row items-center justify-between py-4 border-b bg-white">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl flex items-center gap-2">
              <HardDrive size={22} className="text-indigo-600" />
              Document Storage Provider
            </CardTitle>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded ml-2 font-mono">
              {provider} active
            </span>
          </div>
        </CardHeader>
      )}
      
      <CardContent className={`flex-1 p-0 flex flex-col relative overflow-hidden ${embedded ? 'bg-white' : ''}`}>
      {/* HEADER / TOOLBAR */}
      <CardHeader className="py-4 border-b bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
             <HardDrive className="text-indigo-600" size={20} /> Documents
          </CardTitle>
          {/* Breadcrumbs */}
          <div className="text-sm text-slate-500 font-medium mt-1 flex flex-wrap gap-1 items-center">
             {pathStack.map((p, i) => {
                const entityName = globalEntities.find(e => String(e.id) === String(p.name))?.name;
                const displayName = metadataMap[p.id]?.customName || entityName || p.name;
                return (
                <React.Fragment key={p.id}>
                   <button className="hover:text-indigo-600 transition-colors hover:underline focus:outline-none" onClick={() => fetchFolders(p.id, p.name)}>
                      {displayName}
                   </button>
                   {i < pathStack.length - 1 && <span className="mx-1 text-slate-300">/</span>}
                </React.Fragment>
             )})}
             {contextFamilyId && ['saas_master_admin', 'tenant_admin'].includes(user?.role || '') && (
                 <button 
                   className="ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white transition-colors"
                   onClick={async () => {
                       const currentFolder = pathStack[pathStack.length - 1];
                       const db = getFirestore();
                       try {
                           await setDoc(doc(db, 'tenants', tenantId, 'families', contextFamilyId), {
                               storage_landing_folder_id: currentFolder.id,
                               storage_landing_folder_name: metadataMap[currentFolder.id]?.customName || globalEntities.find(e => String(e.id) === String(currentFolder.name))?.name || currentFolder.name
                           }, { merge: true });
                           toast.success('Landing folder updated successfully!');
                       } catch (err) {
                           console.error(err);
                           toast.error("Failed to update landing folder.");
                       }
                   }}
                 >
                   ⚲ Set Landing Folder
                 </button>
             )}
          </div>
        </div>

        <div className="flex items-center gap-3">
           {/* Write Gate */}
           {canWriteVault && (
             <div className="flex items-center gap-2 mr-2">
                {isCreatingFolder ? (
                   <div className="flex items-center gap-2">
                      <Input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} placeholder="Folder Name..." className="h-8 text-xs w-32 border-indigo-200" />
                      <Button size="sm" className="h-8 px-2 text-xs" onClick={handleCreateFolder}>Add</Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setIsCreatingFolder(false)}><X size={14}/></Button>
                   </div>
                ) : (
                   <Button size="sm" variant="outline" className="h-8 border-slate-200 text-slate-600 gap-1" onClick={() => setIsCreatingFolder(true)}>
                      <FolderPlus size={14} /> New Folder
                   </Button>
                )}
                
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                <Button size="sm" className="h-8 gap-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                   {isUploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Upload
                </Button>
             </div>
           )}

           <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <Input 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search files or metadata tags..." 
                className="w-64 pl-9 h-9 text-sm border-slate-200 focus-visible:ring-indigo-500" 
              />
           </div>
           <div className="flex bg-white rounded-md border border-slate-200 shadow-sm p-0.5">
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-sm transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                 <ListIcon size={16} />
              </button>
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                 <LayoutGrid size={16} />
              </button>
           </div>
        </div>
      </CardHeader>

      <div className="flex flex-1 overflow-hidden relative">
        {/* MAIN EXPLORER AREA */}
        <CardContent className="flex-1 p-0 overflow-y-auto bg-white border-r border-slate-100">
           {loading ? (
              <div className="flex flex-col items-center justify-center w-full h-full text-slate-400 font-medium animate-pulse gap-3">
                 <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                 Synchronizing directly with {provider}...
              </div>
           ) : error ? (
              <div className="p-6">
                 <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium border border-red-200 text-sm">
                   <span className="font-bold">Sync Error: </span>{error}
                 </div>
              </div>
           ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center w-full h-full text-slate-400 mb-10">
                <FolderOpen size={48} className="text-slate-200 mb-4 drop-shadow-sm" />
                <span className="font-semibold text-slate-500">No matching items found</span>
                <span className="text-sm mt-1">Try adjusting your metadata search filters or directory.</span>
              </div>
           ) : viewMode === 'list' ? (
              <table className="w-full text-sm text-left">
                 <thead className="bg-[#fcfdfd] border-b border-slate-200 sticky top-0 z-10 shadow-sm shadow-slate-100/50">
                    <tr>
                       <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[11px] tracking-wider">Name</th>
                       <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[11px] tracking-wider w-40">Modified</th>
                       <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[11px] tracking-wider w-32 hidden sm:table-cell">Size</th>
                       <th className="px-6 py-3 font-semibold text-slate-500 uppercase text-[11px] tracking-wider w-48 hidden md:table-cell">CRM Metadata Tags</th>
                    </tr>
                 </thead>
                 <tbody>
                    {filteredItems.map(item => {
                       const meta = metadataMap[item.id];
                       const isSelected = selectedItem?.id === item.id;
                       return (
                          <tr 
                             key={item.id} 
                             onClick={() => {
                                if(item.isFolder){
                                   fetchFolders(item.id, item.name);
                                } else {
                                   setSelectedItem(item);
                                   // if(!showViewer) setShowViewer(true);
                                }
                             }}
                             className={`border-b border-slate-100 transition-all cursor-[context-menu] group ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                          >
                             <td className="px-6 py-3.5 flex items-center gap-3">
                                {item.isFolder ? (
                                   <FolderOpen size={20} className="text-sky-500 fill-sky-100 group-hover:text-indigo-500 transition-colors" />
                                ) : (
                                   <File size={20} className="text-slate-400 group-hover:text-indigo-400 transition-colors" />
                                )}
                                <span className={`font-medium ${item.isFolder ? 'text-slate-800' : 'text-slate-600'} group-hover:text-indigo-700 transition-colors line-clamp-1`}>{meta?.customName || globalEntities.find(e => String(e.id) === String(item.name))?.name || item.name}</span>
                             </td>
                             <td className="px-6 py-3.5 text-slate-500 text-xs">
                                {item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime).toLocaleDateString() : '--'}
                             </td>
                             <td className="px-6 py-3.5 text-slate-500 text-xs font-mono hidden sm:table-cell">
                                {item.isFolder ? (typeof item.itemCount === 'number' ? `${item.itemCount} items` : '--') : formatBytes(item.size)}
                             </td>
                             <td className="px-6 py-3.5 hidden md:table-cell">
                                <div className="flex flex-wrap gap-1">
                                   {meta?.tags && meta.tags.map(t => (
                                      <span key={t} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 text-[10px] rounded hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors">#{t}</span>
                                   ))}
                                   {meta?.entities && meta.entities.map(e => {
                                      const displayE = e.split(' | ')[0];
                                      return (
                                         <span key={e} className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] rounded font-semibold flex items-center gap-1">
                                            <Tag size={10}/> {displayE}
                                         </span>
                                      );
                                   })}
                                </div>
                             </td>
                          </tr>
                       )
                    })}
                 </tbody>
              </table>
           ) : (
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                 {filteredItems.map(item => {
                    const isSelected = selectedItem?.id === item.id;
                    return (
                       <div 
                         key={item.id} 
                         onClick={() => {
                            if(item.isFolder){
                               fetchFolders(item.id, item.name);
                            } else {
                               setSelectedItem(item);
                            }
                         }}
                         className={`flex flex-col items-center p-4 border rounded-xl cursor-[context-menu] transition-all group ${isSelected ? 'border-indigo-500 bg-indigo-50/30 shadow-sm ring-1 ring-indigo-500/50' : 'border-transparent hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm'}`}
                       >
                          <div className="w-16 h-16 flex items-center justify-center mb-3 transition-transform group-hover:scale-105">
                             {item.isFolder ? (
                                <FolderOpen size={56} className="text-sky-500 fill-sky-100" strokeWidth={1.5} />
                             ) : (
                                <File size={52} className="text-slate-400 stroke-[1.5px]" />
                             )}
                          </div>
                          <span className={`text-xs font-semibold text-center line-clamp-2 leading-snug w-full ${isSelected ? 'text-indigo-800' : 'text-slate-700'}`}>
                             {metadataMap[item.id]?.customName || globalEntities.find(e => String(e.id) === String(item.name))?.name || item.name}
                          </span>
                       </div>
                    )
                 })}
              </div>
           )}
        </CardContent>

        {/* MODAL FILE VIEWER */}
        <Dialog open={selectedItem !== null && showViewer && !!(selectedItem.webUrl && !selectedItem.isFolder)} onOpenChange={setShowViewer}>
           <DialogContent showCloseButton={false} className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-100 rounded-xl">
              <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm z-10 shrink-0">
                 <div className="flex items-center gap-3 pl-2">
                    <button onClick={() => setShowViewer(false)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                       <X size={18}/>
                    </button>
                    <span className="font-bold text-sm text-slate-800 line-clamp-1">{metadataMap[selectedItem?.id || '']?.customName || selectedItem?.name}</span>
                 </div>
                 <div className="flex items-center gap-2 pr-2">
                    <a href={selectedItem?.webUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2" title="Open in Native Sharepoint viewer">
                       <UploadCloud size={14} className="rotate-180" /> <span className="text-xs font-semibold hidden sm:inline">Native App / Download</span>
                    </a>
                 </div>
              </div>
              <div className="flex-1 w-full bg-slate-200/50 relative h-full flex flex-col justify-center items-center">
                 {selectedItem?.name.match(/\.(pdf|png|jpe?g|gif|svg|webp|docx?|xlsx?|pptx?)$/i) ? (
                    <iframe 
                       src={
                          selectedItem.name.match(/\.(pdf|png|jpe?g|gif|svg|webp)$/i) && selectedItem.downloadUrl 
                             ? `/api/admin/proxy?url=${encodeURIComponent(selectedItem.downloadUrl)}` 
                             : (selectedItem.name.match(/\.(docx?|xlsx?|pptx?)$/i) && selectedItem.downloadUrl
                                 ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(selectedItem.downloadUrl)}`
                                 : (selectedItem.webUrl?.includes('sharepoint.com') || selectedItem.webUrl?.includes('onedrive.live.com') ? `${selectedItem.webUrl}${selectedItem.webUrl.includes('?') ? '&' : '?'}action=embedview` : selectedItem.webUrl || ''))
                       } 
                       className="w-full h-full border-none bg-white rounded-b-xl"
                       title="Document Viewer"
                    />
                 ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-xl shadow-sm text-center max-w-md mx-auto">
                       <File size={64} className="text-slate-300 mb-4 stroke-1" />
                       <h3 className="text-lg font-bold text-slate-800 mb-1">Formato não suportado</h3>
                       <p className="text-xs text-slate-500 mb-6">Este arquivo ({selectedItem?.name.split('.').pop()?.toUpperCase()}) não pode ser visualizado diretamente no navegador.</p>
                       <a href={selectedItem?.webUrl || selectedItem?.downloadUrl} target="_blank" rel="noreferrer" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-md transition-colors flex items-center gap-2 text-sm shadow">
                          <UploadCloud size={16} className="rotate-180" />
                          Fazer Download
                       </a>
                    </div>
                 )}
              </div>
           </DialogContent>
        </Dialog>

        {/* METADATA INSPECTOR PANEL (RIGHT COLUMN) */}
        {selectedItem && (
           <div className={`w-80 bg-slate-50 border-l border-slate-200 flex flex-col transition-all duration-300 ${selectedItem ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm shadow-slate-100">
                 <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-800"><Info size={16} className="text-indigo-600"/> File Insights</h3>
                 <button onClick={() => setSelectedItem(null)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                    <X size={16}/>
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 pb-20">
                 {/* File Core Info */}
                 <div className="flex flex-col items-center text-center p-4 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 group relative overflow-hidden">
                    {selectedItem.webUrl && !selectedItem.isFolder && selectedItem.name.match(/\.(pdf|png|jpe?g|gif|svg|webp|docx?|xlsx?|pptx?)$/i) ? (
                        <div className="w-full h-[200px] mb-4 bg-slate-100 rounded border border-slate-200 relative group/viewer overflow-hidden">
                           <iframe 
                              src={
                                 selectedItem.name.match(/\.(pdf|png|jpe?g|gif|svg|webp)$/i) && selectedItem.downloadUrl 
                                    ? `/api/admin/proxy?url=${encodeURIComponent(selectedItem.downloadUrl)}` 
                                    : (selectedItem.name.match(/\.(docx?|xlsx?|pptx?)$/i) && selectedItem.downloadUrl
                                        ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(selectedItem.downloadUrl)}`
                                        : (selectedItem.webUrl?.includes('sharepoint.com') || selectedItem.webUrl?.includes('onedrive.live.com') ? `${selectedItem.webUrl}${selectedItem.webUrl.includes('?') ? '&' : '?'}action=embedview` : selectedItem.webUrl || ''))
                              } 
                              className="w-full h-full border-none pointer-events-none"
                              title="Document Viewer Thumbnail"
                           />
                           <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 hover:bg-slate-900/10 transition-colors opacity-0 hover:opacity-100 cursor-pointer pointer-events-auto" onClick={() => setShowViewer(true)}>
                              <button className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full shadow-lg transform hover:scale-110 transition-all flex items-center gap-2 text-xs font-bold px-4">
                                  <UploadCloud size={14} className="rotate-180" /> Detach
                              </button>
                           </div>
                        </div>
                    ) : (
                       <File size={40} className="text-indigo-500 mb-3 stroke-[1.5px]" />
                    )}
                    <div className="relative w-full group/input px-4">
                       <input 
                          className="font-bold text-sm text-slate-800 break-all leading-tight text-center bg-transparent border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-0 transition-colors px-1 py-1 w-full"
                          value={metadataMap[selectedItem.id]?.customName || selectedItem.name}
                          onChange={(e) => {
                             const val = e.target.value;
                             setMetadataMap(prev => ({ ...prev, [selectedItem.id]: { ...prev[selectedItem.id], customName: val, id: selectedItem.id, tags: prev[selectedItem.id]?.tags || [], entities: prev[selectedItem.id]?.entities || [] } }));
                          }}
                          onBlur={async (e) => {
                              if (!tenantId) return;
                              const db = getFirestore();
                              await setDoc(doc(db, 'tenants', tenantId, 'fileMetadata', selectedItem.id), {
                                  id: selectedItem.id,
                                  customName: e.target.value,
                                  updatedAt: new Date().toISOString()
                              }, { merge: true });
                          }}
                          title="Click to rename display name"
                       />
                       <span className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 opacity-0 group-hover/input:opacity-100 transition-opacity pointer-events-none pointer-events-none text-xs">✎</span>
                    </div>
                    <span className="text-xs text-slate-500 mt-1 font-mono">{formatBytes(selectedItem.size)}</span>
                 </div>

                 {/* System Properties */}
                 <div className="flex justify-between items-center py-2 border-b border-slate-200 mb-1">
                    <span className="text-xs text-slate-500">Modified</span>
                    <span className="text-xs font-medium text-slate-700">{selectedItem.lastModifiedDateTime ? new Date(selectedItem.lastModifiedDateTime).toLocaleDateString() : '--'}</span>
                 </div>
                 


                 {/* CRM Metadata Editor Engine */}
                 <div className="mt-8">
                    <div className="flex items-center gap-2 mb-4">
                       <ShieldCheck className="text-sky-600" size={16}/>
                       <h4 className="font-bold text-sm text-slate-800">Contextual Linkage</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                       Attach entities to natively index this file alongside standard CRM records globally.
                    </p>

                     <div className="space-y-4">
                        {/* Entity Linker Field */}
                        <div className="relative">
                           <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2 block">Linked CRM Entities</label>
                           <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <Input 
                                 placeholder="Search entities to assign..." 
                                 className="text-xs h-9 pl-9 bg-white border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                                 value={entitySearchQuery}
                                 onChange={(e) => {
                                    setEntitySearchQuery(e.target.value);
                                    setIsEntityDropdownOpen(true);
                                 }}
                                 onFocus={() => setIsEntityDropdownOpen(true)}
                                 onBlur={() => setTimeout(() => setIsEntityDropdownOpen(false), 200)}
                                 onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.currentTarget.value.trim() && filteredGlobalEntities.length === 0) {
                                       const meta = metadataMap[selectedItem.id] || { tags: [], entities: [] };
                                       const identifier = e.currentTarget.value.trim();
                                       if (!meta.entities?.includes(identifier)) {
                                          const newEntities = [...(meta.entities || []), identifier];
                                          handleMetadataUpdate(meta.tags || [], newEntities);
                                       }
                                       setEntitySearchQuery('');
                                    }
                                 }}
                              />
                           </div>
                           
                           {/* entity assignment dropdown */}
                           {isEntityDropdownOpen && !!entitySearchQuery && (
                              <div className="absolute top-16 left-0 right-0 z-50 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto w-[350px]">
                                 {filteredGlobalEntities.length === 0 ? (
                                    <div className="p-3 text-xs text-slate-500 text-center">Press Enter to add custom "{entitySearchQuery}"</div>
                                 ) : (
                                    filteredGlobalEntities.map(entity => (
                                       <button
                                          key={entity.id}
                                          className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                                          onClick={() => {
                                             const meta = metadataMap[selectedItem.id] || { tags: [], entities: [] };
                                             // Store ID to allow intersection filtering (like Family 360)
                                             const identifier = `[${entity.type}] ${entity.name} | ${entity.id}`;
                                             if (!meta.entities?.includes(identifier)) {
                                                const newEntities = [...(meta.entities || []), identifier];
                                                handleMetadataUpdate(meta.tags || [], newEntities);
                                             }
                                             setEntitySearchQuery('');
                                             setIsEntityDropdownOpen(false);
                                          }}
                                       >
                                          <span className="font-semibold text-slate-700 truncate mr-2">{entity.name}</span>
                                          <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] shrink-0 font-medium">
                                             {entity.type}
                                          </span>
                                       </button>
                                    ))
                                 )}
                              </div>
                           )}

                           <div className="flex flex-wrap gap-1.5 mt-3">
                              {(metadataMap[selectedItem.id]?.entities || []).map((entity) => {
                                 const displayEntity = entity.split(' | ')[0];
                                 const colorClass = getConsistentColor(displayEntity);
                                 return (
                                    <span key={entity} className={`${colorClass} text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center justify-between group shadow-sm border`}>
                                       {displayEntity}
                                       <button 
                                          className="ml-2 opacity-50 hover:text-red-600 focus:outline-none transition-colors border-l pl-2 border-slate-200/50 group-hover:opacity-100"
                                          onClick={() => {
                                             const meta = metadataMap[selectedItem.id];
                                             handleMetadataUpdate(meta.tags, meta.entities.filter(e => e !== entity));
                                          }}
                                       >
                                          <X size={12}/>
                                       </button>
                                    </span>
                                 );
                              })}
                           </div>
                        </div>

                        {/* Static Tags Field */}
                        <div>
                           <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2 mt-6 block">Classification Tags</label>
                           <div className="relative">
                              <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <Input 
                                 placeholder="Add tags... (Press Enter)" 
                                 className="text-xs h-9 pl-9 bg-white border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                                 onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                       const meta = metadataMap[selectedItem.id] || { tags: [], entities: [] };
                                       const newTags = [...(meta.tags || []), e.currentTarget.value.trim()];
                                       handleMetadataUpdate(newTags, meta.entities || []);
                                       e.currentTarget.value = '';
                                    }
                                 }}
                              />
                           </div>
                           <div className="flex flex-wrap gap-1.5 mt-3">
                              {(metadataMap[selectedItem.id]?.tags || []).map((tag) => {
                                 const colorClass = getConsistentColor(tag);
                                 return (
                                    <span key={tag} className={`${colorClass} text-[10px] px-2.5 py-1 rounded shadow-sm flex items-center justify-between group border`}>
                                       #{tag}
                                       <button 
                                          className="ml-2 opacity-50 group-hover:opacity-100 focus:outline-none transition-opacity"
                                          onClick={() => {
                                             const meta = metadataMap[selectedItem.id];
                                             handleMetadataUpdate(meta.tags.filter(t => t !== tag), meta.entities);
                                          }}
                                       >
                                          ×
                                       </button>
                                    </span>
                                 );
                              })}
                           </div>
                        </div>
                     </div>
                 </div>
              </div>
           </div>
        )}
      </div>
      </CardContent>
    </Card>
  );
}
