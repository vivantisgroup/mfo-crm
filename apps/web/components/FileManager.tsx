'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { File, Folder, Download, Trash2, UploadCloud, Loader2, AlertCircle, X, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

interface FileManagerProps {
  entityType: string;
  entityId: string;
}

const DOCUMENT_TYPES = ['Contract', 'Invoice', 'Report', 'ID Document', 'Other'];
const TAG_COLORS = ['#e9730c', '#107e3e', '#0a6ed1', '#bb0000', '#6a6d70'];

export function FileManager({ entityType, entityId }: FileManagerProps) {
  const { tenant } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Metadata State for Selected File (simulated local save for demo)
  const [metaType, setMetaType] = useState('Other');
  const [metaTags, setMetaTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  const fetchFiles = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      
      const res = await fetch(`/api/storage/list?tenantId=${tenant.id}&entityType=${entityType}&entityId=${entityId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load files');
      
      // Inject dummy metadata if missing for demo purposes
      const mapped = (data.files || []).map((f: any) => ({
        ...f,
        metadata: f.metadata || { type: 'Other', tags: [] }
      }));
      setFiles(mapped);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [tenant?.id, entityType, entityId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !tenant?.id) return;

    setUploading(true);
    setError(null);
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      
      const formData = new FormData();
      formData.append('tenantId', tenant.id);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);
      formData.append('file', file);

      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      await fetchFiles(); // Refresh list after upload
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!tenant?.id || !confirm("Are you sure you want to permanently delete this file?")) return;
    try {
       const { getAuth } = await import('firebase/auth');
       const token = await getAuth().currentUser?.getIdToken();
       
       const res = await fetch(`/api/storage/delete?tenantId=${tenant.id}&fileId=${fileId}&entityType=${entityType}&entityId=${entityId}`, {
         method: 'DELETE',
         headers: { Authorization: `Bearer ${token}` }
       });
       
       if (!res.ok) throw new Error('Deletion failed');
       if (selectedFile?.id === fileId) setSelectedFile(null);
       await fetchFiles();
    } catch(err: any) {
       toast.error(err.message);
    }
  };
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, dm = 2, sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleSelectFile = (file: any) => {
    setSelectedFile(file);
    setMetaType(file.metadata?.type || 'Other');
    setMetaTags(file.metadata?.tags || []);
  };

  const saveMetadata = () => {
    // Optimistic UI update
    setFiles(prev => prev.map(f => f.id === selectedFile.id ? { ...f, metadata: { type: metaType, tags: metaTags } } : f));
    // In production, this would dispatch a call to update the db mapping for the file ID.
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTagInput.trim()) {
      if (!metaTags.includes(newTagInput.trim())) setMetaTags([...metaTags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setMetaTags(metaTags.filter(t => t !== tag));
  };

  return (
    <div className="flex w-full gap-4 items-start">
      {/* LEFT PORTION: FILE LIST */}
      <div className={`transition-all duration-300 flex-1 min-w-[400px]`}>
        <Card className="shadow-sm border-border flex flex-col h-full">
          <CardHeader className="py-4 border-b flex flex-row items-center justify-between space-y-0">
             <CardTitle className="text-lg font-semibold">Document Vault</CardTitle>
             <div className="flex gap-2 items-center">
              <Button 
                variant="secondary" 
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </Button>
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
             </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-[#ffebeb] border border-[#bb0000] text-[#bb0000] text-[0.875rem] rounded-[var(--radius-sm)] flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {loading ? (
            <div className="h-40 flex flex-col items-center justify-center text-[var(--text-secondary)] gap-2">
              <Loader2 size={24} className="animate-spin text-[var(--brand-primary)]" />
              <span className="text-[0.75rem] uppercase tracking-widest font-bold">Mounting Storage...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-[var(--text-secondary)] gap-2 border border-dashed border-[var(--border-strong)] bg-[var(--bg-canvas)] rounded-[var(--radius-sm)] mt-2">
              <File size={32} strokeWidth={1} className="text-[var(--text-tertiary)]" />
              <span className="text-[0.875rem] font-medium">No files have been uploaded yet.</span>
            </div>
          ) : (
            <div className="overflow-x-auto w-full border border-border rounded-lg">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Tags</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => {
                    const isSelected = selectedFile?.id === file.id;
                    return (
                      <tr key={file.id} onClick={() => handleSelectFile(file)} className={isSelected ? 'bg-[var(--brand-faint)]' : ''}>
                        <td className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                          <File size={16} className="text-[var(--text-tertiary)]" />
                          {file.name}
                        </td>
                        <td className="text-[var(--text-secondary)]">{file.size ? formatBytes(file.size) : '--'}</td>
                        <td>
                          <div className="flex gap-1 flex-wrap max-w-[150px]">
                            {file.metadata?.tags?.slice(0, 2).map((t: string, i: number) => (
                               <span key={i} className="text-[9px] bg-[var(--bg-elevated)] border border-[var(--border-strong)] px-1 py-0.5 rounded uppercase font-bold text-[var(--text-secondary)]">{t}</span>
                            ))}
                            {file.metadata?.tags?.length > 2 && <span className="text-[9px] font-bold text-[var(--text-tertiary)]">+{file.metadata.tags.length - 2}</span>}
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
                            {file['@microsoft.graph.downloadUrl'] && (
                              <button className="text-[var(--brand-primary)] hover:underline text-[0.875rem] font-bold" onClick={() => window.open(file['@microsoft.graph.downloadUrl'], '_blank')}>
                                DL
                              </button>
                            )}
                            <button className="text-[var(--color-red)] hover:bg-[#ffebeb] p-1 rounded transition-colors" onClick={() => handleDelete(file.id)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent></Card>
      </div>

      {/* RIGHT PORTION: INSPECTOR / METADATA PANEL (Flexible Column Layout Simulation) */}
      {selectedFile && (
        <div className="w-[320px] shrink-0 animate-fade-in">
           <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] overflow-hidden shadow-sm flex flex-col h-full sticky top-4">
              <div className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] px-4 py-3 flex justify-between items-start">
                 <div>
                    <h4 className="font-bold text-[0.875rem] text-[var(--text-primary)] break-all pr-4">{selectedFile.name}</h4>
                    <span className="text-[0.75rem] text-[var(--text-secondary)] mt-0.5 block">{formatBytes(selectedFile.size || 0)}</span>
                 </div>
                 <button onClick={() => setSelectedFile(null)} className="text-[var(--text-tertiary)] hover:text-[#bb0000]">
                    <X size={16} />
                 </button>
              </div>
              <div className="p-4 flex flex-col gap-5 flex-1 overflow-y-auto">
                 <div className="grid grid-cols-1 gap-6" >
                    <div className="flex flex-col gap-2"><label className="text-sm font-medium">Classification</label>
                       <select 
                         className="h-8 w-full px-2 text-[0.875rem] bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-sm)] focus:outline-none focus:border-[var(--brand-primary)]"
                         value={metaType}
                         onChange={e => setMetaType(e.target.value)}
                       >
                         {DOCUMENT_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                       </select>
                    </div>
                 </div>

                 <div>
                    <span className="text-[0.75rem] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2 flex items-center gap-1">
                      <Tag size={12} /> Tags
                    </span>
                    <div className="flex flex-wrap gap-2 mb-3">
                       {metaTags.map((tag, i) => (
                         <div key={i} className="flex items-center gap-1 bg-[#f4f5f6] border border-[#d9dbdc] text-[#32363a] text-[11px] font-bold uppercase px-2 py-1 rounded">
                           {tag}
                           <X size={12} className="cursor-pointer hover:text-red-600 opacity-60 ml-1" onClick={() => removeTag(tag)} />
                         </div>
                       ))}
                       {metaTags.length === 0 && <span className="text-[0.75rem] italic text-[var(--text-tertiary)]">No tags defined</span>}
                    </div>
                    <Input 
                      value={newTagInput} 
                      onChange={(e) => setNewTagInput(e.target.value)} 
                      placeholder="Type a tag & press Enter..." 
                      className="text-[12px]"
                      // @ts-ignore
                      onKeyDown={addTag}
                    />
                 </div>
              </div>
              <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-end">
                 <Button variant="default" onClick={saveMetadata}>Update Assets</Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
