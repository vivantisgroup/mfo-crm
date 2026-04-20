'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, Folder, Plus, MoreVertical, Search, FileText, Share2, Download, Trash2, Save, Maximize, Minimize, ChevronRight, History
} from 'lucide-react';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { SharingModal } from '@/components/SharingModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PromptDialog, PromptOptions } from '@/components/PromptDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  KnowledgeFolder, 
  KnowledgeArticle, 
  subscribeToKnowledgeFolders, 
  subscribeToKnowledgeArticles, 
  saveKnowledgeArticle, 
  deleteKnowledgeArticle, 
  saveKnowledgeFolder,
  saveArticleVersion,
  getArticleVersions,
  type KnowledgeArticleVersion
} from '@/lib/knowledgeService';

export default function KnowledgeBase() {
  usePageTitle('Knowledge Base');
  const { tenant } = useAuth();
  
  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isSop, setIsSop] = useState(false);
  const [isTemplate, setIsTemplate] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isWider, setIsWider] = useState(false);
  const [isSharingModalOpen, setIsSharingModalOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);
  const [promptState, setPromptState] = useState<PromptOptions | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<KnowledgeArticleVersion[]>([]);
  
  const [allowIframeEmbeds, setAllowIframeEmbeds] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    
    const tenantId = tenant.id;
    const unsubFolders = subscribeToKnowledgeFolders(tenantId, setFolders);
    const unsubArticles = subscribeToKnowledgeArticles(tenantId, setArticles);
    
    // Load config
    async function loadConfig() {
      try {
        const { getAuth } = await import('firebase/auth');
        const token = await getAuth().currentUser?.getIdToken();
        const res = await fetch(`/api/admin/tenant-config?tenantId=${tenantId}&type=knowledgeArticles`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
           const data = await res.json();
           setAllowIframeEmbeds(data.knowledgeArticlesConfig?.allowIframeEmbeds !== false);
        }
      } catch (err) {}
    }
    loadConfig();

    return () => {
      unsubFolders();
      unsubArticles();
    };
  }, [tenant?.id]);

  useEffect(() => {
    if (selectedArticleId) {
      const art = articles.find(a => a.id === selectedArticleId);
      if (art) {
        setTitle(art.title);
        setContent(art.content);
        setIsSop(art.isSop);
        setIsTemplate(art.isTemplate || false);
        setIsPublished(art.isPublished);
      }
    } else {
      setTitle('');
      setContent('');
      setIsSop(false);
      setIsTemplate(false);
      setIsPublished(false);
    }
  }, [selectedArticleId, articles]);

  const handleSave = async () => {
    if (!tenant?.id) return;
    const articleId = selectedArticleId || Math.random().toString(36).substring(2, 9);
    const folderId = articles.find(a => a.id === selectedArticleId)?.folderId || (folders.length > 0 ? folders[0].id : null);
    
    await saveKnowledgeArticle(tenant.id, {
      id: articleId,
      folderId,
      title: title || 'Untitled Document',
      content,
      isSop,
      isTemplate,
      isPublished,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: 0
    });
    
    // Create a snapshot version
    const userEmail = (await import('firebase/auth')).getAuth().currentUser?.email || 'Unknown';
    await saveArticleVersion(tenant.id, articleId, title || 'Untitled Document', content, tenant.id, userEmail);
    
    setSelectedArticleId(articleId);
  };
  
  const handleViewHistory = async () => {
     if (!tenant?.id || !selectedArticleId) return;
     const v = await getArticleVersions(tenant.id, selectedArticleId);
     setVersions(v);
     setIsHistoryOpen(true);
  };
  
  const handleRestoreVersion = (v: KnowledgeArticleVersion) => {
     setContent(v.content);
     setTitle(v.title);
     setIsHistoryOpen(false);
  };

  const handleDelete = async () => {
    if (!tenant?.id || !selectedArticleId) return;
    setConfirmState({
      title: "Delete Article",
      message: "Are you sure you want to delete this article?",
      onConfirm: async () => {
        await deleteKnowledgeArticle(tenant.id, selectedArticleId);
        setSelectedArticleId(null);
      }
    });
  };

  const handleCreateFolder = async () => {
    if (!tenant?.id) return;
    setPromptState({
      title: "Create Folder",
      placeholder: "New folder name...",
      onConfirm: async (name) => {
        if (name) {
          const id = Math.random().toString(36).substring(2, 9);
          await saveKnowledgeFolder(tenant.id, { id, name, order: folders.length, parentId: null });
        }
      },
      onCancel: () => setPromptState(null)
    });
  };

  const handleCreateArticle = async (folderId: string | null) => {
    if (!tenant?.id) return;
    const id = Math.random().toString(36).substring(2, 9);
    await saveKnowledgeArticle(tenant.id, {
      id,
      folderId,
      title: 'New Article',
      content: '<p>Start typing...</p>',
      isSop: false,
      isTemplate: false,
      isPublished: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: articles.length
    });
    setSelectedArticleId(id);
  };

  const handleShare = async () => {
    setIsSharingModalOpen(true);
  };

  const handleSavePDF = async () => {
    if (typeof window === 'undefined') return;
    // Dynamically load html2pdf
    const html2pdf = (await import('html2pdf.js')).default;
    
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="font-family: Inter, sans-serif; padding: 40px; color: #333;">
        <h1 style="font-size: 32px; font-weight: bold; margin-bottom: 24px; color: #111;">${title || 'Document'}</h1>
        <div style="line-height: 1.6; font-size: 14px;">${content}</div>
      </div>
    `;

    const opt = {
      margin:       1,
      filename:     `${title || 'article'}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt as any).from(element).save();
  };

  const handleExportHTML = () => {
    const htmlData = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; }</style>
      </head>
      <body>
        <h1>${title}</h1>
        ${content}
      </body>
      </html>
    `;
    const blob = new Blob([htmlData], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'article'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedArticle = articles.find(a => a.id === selectedArticleId);

  // Calculate breadcrumbs
  const buildBreadcrumbs = (folderId: string | null): KnowledgeFolder[] => {
    if (!folderId) return [];
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];
    return [...buildBreadcrumbs(folder.parentId || null), folder];
  };

  const breadcrumbPath = selectedArticle ? buildBreadcrumbs(selectedArticle.folderId) : [];

  // Build tree
  const buildFolderTree = (parentId: string | null): any[] => {
    return folders
      .filter(f => (f.parentId || null) === parentId)
      .map(f => ({
        ...f,
        subfolders: buildFolderTree(f.id),
        children: articles.filter(a => a.folderId === f.id)
      }));
  };

  const tree = buildFolderTree(null);
  const unassigned = articles.filter(a => !a.folderId);

  // Drag and Drop Handlers
  const handleDragStartArticle = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('articleId', id);
  };

  const handleDragStartFolder = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('folderId', id);
  };

  const handleDropToFolder = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!tenant?.id) return;
    const articleId = e.dataTransfer.getData('articleId');
    const folderId = e.dataTransfer.getData('folderId');

    if (articleId) {
       const article = articles.find(a => a.id === articleId);
       if (article && article.folderId !== targetFolderId) {
          await saveKnowledgeArticle(tenant.id, { ...article, folderId: targetFolderId });
       }
    } else if (folderId) {
       if (folderId === targetFolderId) return;
       const folder = folders.find(f => f.id === folderId);
       // Simple check to prevent basic circular (can't drop a folder into itself)
       if (folder && folder.parentId !== targetFolderId) {
          await saveKnowledgeFolder(tenant.id, { ...folder, parentId: targetFolderId });
       }
    }
  };

  const renderFolder = (folder: any) => (
    <div 
      key={folder.id} 
      className="mb-2"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => handleDropToFolder(e, folder.id)}
    >
       <div 
         className="flex items-center justify-between text-[var(--text-secondary)] font-bold text-[0.75rem] uppercase tracking-wider mb-1 px-1 group cursor-grab active:cursor-grabbing hover:bg-[var(--bg-elevated)] rounded transition-colors"
         draggable
         onDragStart={(e) => handleDragStartFolder(e, folder.id)}
       >
          <div className="flex items-center gap-2 pointer-events-none py-1">
            <Folder size={12} /> {folder.name}
          </div>
          <button onClick={(e) => { e.stopPropagation(); handleCreateArticle(folder.id); }} className="opacity-0 group-hover:opacity-100 hover:text-[var(--brand-primary)] transition-opacity px-1">
            <Plus size={12} />
          </button>
       </div>
       <div className="flex flex-col ml-3 border-l px-2 border-[var(--border-subtle)] min-h-[10px]">
          {folder.subfolders.map((sf: any) => renderFolder(sf))}
          {folder.children
            .filter((a: any) => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((art: any) => (
             <button 
               key={art.id}
               draggable
               onDragStart={(e) => handleDragStartArticle(e, art.id)}
               onClick={() => setSelectedArticleId(art.id)}
               className={`text-left text-[0.875rem] py-1.5 px-2 rounded-[var(--radius-sm)] transition-colors flex items-center gap-2 cursor-grab active:cursor-grabbing
                 ${selectedArticleId === art.id ? 'bg-[var(--brand-faint)] text-[var(--brand-primary)] font-semibold' : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'}`}
             >
                <FileText size={14} className={selectedArticleId === art.id ? 'text-[var(--brand-primary)] pointer-events-none' : 'text-[var(--text-tertiary)] pointer-events-none'} />
                <span className="truncate pointer-events-none">{art.title}</span>
             </button>
          ))}
       </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[var(--bg-canvas)] w-full overflow-hidden">
       {/* MASTER COLUMN: Tree / Registry */}
       <div className="w-[280px] shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col z-10 shadow-sm">
          <div className="p-4 border-b border-[var(--border-subtle)]">
             <div className="flex items-center justify-between mb-4">
                <h2 className="text-[1.125rem] font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <BookOpen size={18} className="text-[#0a6ed1]" /> Knowledge
                </h2>
                <button onClick={handleCreateFolder} className="text-[var(--text-tertiary)] hover:text-[#0a6ed1]"><Plus size={18}/></button>
             </div>
             <div className="flex items-center gap-2 bg-[var(--bg-canvas)] border border-[var(--border-strong)] px-2 py-1.5 rounded-[var(--radius-sm)] focus-within:ring-1 focus-within:border-[var(--brand-primary)]">
               <Search size={14} className="text-[var(--text-tertiary)]" />
               <input 
                 type="text" 
                 placeholder="Search articles..."
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="bg-transparent border-none outline-none text-[0.8125rem] w-full text-[var(--text-primary)]"
               />
             </div>
          </div>
          
          <div 
             className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 min-h-[50%]"
             onDragOver={(e) => e.preventDefault()}
             onDrop={(e) => handleDropToFolder(e, null)}
          >
             {tree.map(folder => renderFolder(folder))}

             {unassigned.length > 0 && (
               <div className="mb-2 mt-4">
                   <div className="flex items-center gap-2 text-[var(--text-secondary)] font-bold text-[0.75rem] uppercase tracking-wider mb-1 px-1">
                      <Folder size={12} /> Unassigned
                   </div>
                   <div className="flex flex-col ml-3 border-l px-2 border-[var(--border-subtle)]">
                      {unassigned
                         .filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
                         .map(art => (
                         <button 
                           key={art.id}
                           draggable
                           onDragStart={(e) => handleDragStartArticle(e, art.id)}
                           onClick={() => setSelectedArticleId(art.id)}
                           className={`text-left text-[0.875rem] py-1.5 px-2 rounded-[var(--radius-sm)] transition-colors flex items-center gap-2 cursor-grab active:cursor-grabbing
                             ${selectedArticleId === art.id ? 'bg-[var(--brand-faint)] text-[var(--brand-primary)] font-semibold' : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'}`}
                         >
                            <FileText size={14} className={selectedArticleId === art.id ? 'text-[var(--brand-primary)] pointer-events-none' : 'text-[var(--text-tertiary)] pointer-events-none'} />
                            <span className="truncate pointer-events-none">{art.title}</span>
                         </button>
                      ))}
                   </div>
               </div>
             )}
          </div>
       </div>

       {/* DETAIL COLUMN: Multi-Rich Text Editor (Novel.js Odoo-like) */}
       <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
          {selectedArticleId ? (
            <>
              <div className="flex justify-between items-center px-4 lg:px-8 pt-6 pb-4 border-b border-border z-10 w-full mb-6 relative">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center text-[0.75rem] text-[var(--text-tertiary)] gap-1.5 mb-1 bg-[var(--bg-elevated)] px-2 py-1 rounded w-fit border border-[var(--border-subtle)]">
                    <BookOpen size={12} className="text-[#0a6ed1]" />
                    <span>Knowledge</span>
                    {breadcrumbPath.map(folder => (
                      <React.Fragment key={folder.id}>
                        <ChevronRight size={12} className="opacity-50" />
                        <span className="font-medium text-[var(--text-secondary)]">{folder.name}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">Article Writer</h1>
                </div>
                <div className="flex items-center gap-2">
                     <Button variant="ghost" size="sm" onClick={() => setIsWider(!isWider)}>
                        {isWider ? <><Minimize size={14} className="mr-2"/> Default View</> : <><Maximize size={14} className="mr-2"/> Wide View</>}
                     </Button>
                     <Button variant="ghost" size="sm" onClick={handleShare}><Share2 size={14} className="mr-2"/> Share</Button>
                     <Button variant="ghost" size="sm" onClick={handleExportHTML}><Download size={14} className="mr-2"/> HTML</Button>
                     <Button variant="ghost" size="sm" onClick={handleSavePDF}><Download size={14} className="mr-2"/> PDF</Button>
                     <Button variant="ghost" size="sm" onClick={handleViewHistory}><History size={14} className="mr-2"/> History</Button>
                     <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleDelete}><Trash2 size={14} /></Button>
                     <Button variant="default" size="sm" onClick={handleSave}><Save size={14} className="mr-2"/> Save</Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-10 py-12" ref={printRef}>
                 <div className={`mx-auto novel-wrapper transition-all duration-300 ${isWider ? 'max-w-[1200px]' : 'max-w-[800px]'}`}>
                    <div className="mb-8">
                       <input 
                         value={title}
                         onChange={(e) => setTitle(e.target.value)}
                         placeholder="Article Title..."
                         className="text-[2.5rem] font-bold text-[#32363a] tracking-tight leading-none bg-transparent outline-none w-full placeholder:text-gray-300"
                       />
                       <div className="flex gap-2 mt-4 items-center">
                         <button 
                            onClick={() => setIsSop(!isSop)}
                            className={`cursor-pointer text-[11px] font-bold uppercase px-2 py-1 rounded ${isSop ? 'bg-[#eef6fe] text-[#0a6ed1]' : 'bg-[#f4f5f6] text-[#6a6d70]'}`}
                         >
                           SOP
                         </button>
                         <button 
                            onClick={() => setIsTemplate(!isTemplate)}
                            className={`cursor-pointer text-[11px] font-bold uppercase px-2 py-1 rounded ${isTemplate ? 'bg-purple-100 text-purple-700' : 'bg-[#f4f5f6] text-[#6a6d70]'}`}
                            title="Mark as Reusable Template"
                         >
                           Template
                         </button>
                         <button 
                            onClick={() => setIsPublished(!isPublished)}
                            className={`cursor-pointer text-[11px] font-bold uppercase px-2 py-1 rounded ${isPublished ? 'bg-green-100 text-green-700' : 'bg-[#f4f5f6] text-[#6a6d70]'}`}
                         >
                           {isPublished ? 'Published' : 'Draft'}
                         </button>
                       </div>
                    </div>
                    
                    <div className="border border-[var(--border-subtle)] rounded-lg min-h-[300px] bg-[var(--bg-canvas)] shadow-sm">
                       <RichTextEditor 
                         className="prose prose-sm max-w-none min-h-[300px] w-full p-4 focus:outline-none" 
                         value={content} 
                         onChange={setContent} 
                         placeholder="Start typing your article here..." 
                         allowIframeEmbeds={allowIframeEmbeds} 
                         enableCollaboration={true}
                         contextRecord={{ id: selectedArticleId, type: 'knowledge' }}
                       />
                    </div>
                 </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
               <BookOpen size={48} className="mb-4 opacity-50" />
               <p className="text-lg">Select or create an article to start exploring</p>
               <Button onClick={() => handleCreateArticle(null)} className="mt-4" variant="outline">
                 <Plus size={16} className="mr-2" /> New Article
               </Button>
            </div>
          )}
       </div>

       {isSharingModalOpen && selectedArticleId && articles.find(a => a.id === selectedArticleId) && (
          <SharingModal
            open={true}
            onOpenChange={(open) => !open && setIsSharingModalOpen(false)}
            article={articles.find(a => a.id === selectedArticleId)!}
            onUpdate={() => {
              // The update is handled by Firestore real-time listener if active, or requires a refetch
            }}
          />
       )}
       
       {isHistoryOpen && (
          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
             <DialogContent className="max-w-2xl bg-white dark:bg-zinc-950">
                <DialogHeader>
                   <DialogTitle className="flex items-center gap-2">
                     <History size={18} className="text-primary" />
                     Version History
                   </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
                   {versions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No historical versions saved yet. Click 'Save' to create a snapshot.</p>
                   ) : (
                      versions.map(v => (
                         <div key={v.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 border rounded border-gray-100 hover:bg-gray-50 transition-colors">
                            <div className="mb-2 md:mb-0">
                               <p className="text-sm font-semibold">{v.title || 'Untitled'}</p>
                               <p className="text-xs text-gray-500">
                                  Saved {new Date(v.savedAt).toLocaleString()} by {v.savedByUserName}
                               </p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleRestoreVersion(v)}>
                               Restore Snapshot
                            </Button>
                         </div>
                      ))
                   )}
                </div>
                <DialogFooter>
                   <Button variant="ghost" onClick={() => setIsHistoryOpen(false)}>Close</Button>
                </DialogFooter>
             </DialogContent>
          </Dialog>
       )}

       {confirmState && (
         <ConfirmDialog 
           title={confirmState.title} 
           message={confirmState.message} 
           onConfirm={confirmState.onConfirm} 
           onCancel={() => setConfirmState(null)} 
         />
       )}
       {promptState && <PromptDialog {...promptState} />}
    </div>
  );
}
