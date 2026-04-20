'use client';

import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import suggestion from './mention/suggestion';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { 
  Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered, Quote, Link as LinkIcon, Unlink, Sparkles, Loader2, X,
  AlignLeft, AlignCenter, AlignRight, CheckSquare, Table as TableIcon, Image as ImageIcon, Highlighter,
  Trash, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Merge, Split, MonitorPlay, Maximize, Minimize,
  PanelTop, PanelBottom, FileType, PenTool
} from 'lucide-react';
import { useCallback, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PromptDialog, PromptOptions } from '@/components/PromptDialog';
import { cn } from '@/lib/utils';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { Iframe } from '@/lib/tiptap-iframe-extension';
import { ExcalidrawNode } from '../ExcalidrawNode';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  tenantId?: string;
  contextRecord?: { id: string; type: string };
  allowIframeEmbeds?: boolean;
  enableCollaboration?: boolean;
}

function RichTextEditorInner({ value, onChange, placeholder, className, tenantId, contextRecord, allowIframeEmbeds = true, enableCollaboration = false, ydoc, provider }: RichTextEditorProps & { ydoc?: Y.Doc, provider?: WebrtcProvider }) {
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<{id: string, name: string, content: string}[]>([]);
  const [promptState, setPromptState] = useState<PromptOptions | null>(null);

  // Esc key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const [currentUser] = useState(() => {
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    return {
      name: `User ${Math.floor(Math.random() * 1000)}`,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { HTMLAttributes: { class: "font-semibold mb-2 mt-4 text-slate-800" } },
        bulletList: { HTMLAttributes: { class: "list-disc pl-5 mb-3 text-slate-700" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-5 mb-3 text-slate-700" } },
        blockquote: { HTMLAttributes: { class: "border-l-4 border-indigo-200 pl-4 py-1 italic text-slate-600 mb-3 bg-slate-50" } },
        // The Collaboration extension comes with its own history handling, so disable here if collaboration is enabled
        history: enableCollaboration ? false : undefined,
      }),
      ...(enableCollaboration && ydoc ? [
        Collaboration.configure({
          document: ydoc,
        }),
      ] : []),
      ...(enableCollaboration && provider ? [
        CollaborationCursor.configure({
          provider,
          user: currentUser
        }),
      ] : []),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 underline decoration-indigo-300 underline-offset-2',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write something...',
        emptyEditorClass: 'is-editor-empty',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      ...(allowIframeEmbeds ? [Iframe] : []),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'crm-mention',
        },
        suggestion,
        renderLabel({ options, node }) {
          return `${options.suggestion.char}${node.attrs.label ?? node.attrs.id}`
        },
        renderHTML({ options, node }) {
          return [
            'span',
            {
              class: `crm-mention crm-mention-${node.attrs.type ?? 'unknown'}`,
              'data-type': node.attrs.type,
              'data-id': node.attrs.id,
            },
            `@${node.attrs.label}`,
          ]
        },
      }),
      ExcalidrawNode,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-slate max-w-none focus:outline-none min-h-[120px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href || '';
    setPromptState({
      title: 'Insert Link',
      message: 'Enter URL for the link',
      defaultValue: previousUrl,
      onConfirm: (url) => {
        if (!url) {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
          editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }
      },
      onCancel: () => setPromptState(null)
    });
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    setPromptState({
       title: 'Insert Image',
       message: 'Enter URL for the image',
       onConfirm: (url) => {
         if (url) editor.chain().focus().setImage({ src: url }).run();
       },
       onCancel: () => setPromptState(null)
    });
  }, [editor]);

  const addIframe = useCallback(() => {
    if (!editor) return;
    setPromptState({
       title: 'Embed Iframe',
       message: 'Enter URL to embed (e.g. YouTube)',
       onConfirm: (url) => {
         if (url) editor.chain().focus().setIframe({ src: url }).run();
       },
       onCancel: () => setPromptState(null)
    });
  }, [editor]);

  const addTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertHeader = useCallback(() => {
    if (!editor) return;
    const headerHtml = `
      <div style="width: 100%; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2 style="margin: 0; color: #0f172a; font-family: sans-serif;">Organization Name</h2>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 12px; font-family: sans-serif;">123 Wealth Avenue<br/>Financial District, NY 10004</p>
        </div>
        <div style="background: #f1f5f9; padding: 10px; border-radius: 4px; color: #475569; font-weight: bold; font-family: sans-serif;">LOGO</div>
      </div>
      <p></p>
    `;
    editor.commands.insertContentAt(0, headerHtml);
  }, [editor]);

  const insertFooter = useCallback(() => {
    if (!editor) return;
    const footerHtml = `
      <div style="width: 100%; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; text-align: center; clear: both;">
        <p style="margin: 0; color: #94a3b8; font-size: 10px; font-family: sans-serif;">Confidential & Proprietary. Do not distribute without authorization.</p>
        <p style="margin: 4px 0 0; color: #94a3b8; font-size: 10px; font-family: sans-serif;">© ${new Date().getFullYear()} Organization Name. All rights reserved.</p>
      </div>
    `;
    editor.chain().focus().insertContent(footerHtml).run();
  }, [editor]);

  const handleOpenTemplates = async () => {
    setIsTemplatesOpen(true);
    // Fetch templates from tenant settings if available, else use defaults
    try {
      const activeT = tenantId || JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}')?.id;
      if (activeT) {
         const { getFirestore, collection, getDocs, query, where } = await import('firebase/firestore');
         const { firebaseApp } = await import('@mfo-crm/config');
         const db = getFirestore(firebaseApp);
         const q = query(collection(db, 'tenants', activeT, 'knowledgeArticles'), where('isTemplate', '==', true));
         const snap = await getDocs(q);
         if (!snap.empty) {
            setAvailableTemplates(snap.docs.map(d => ({ id: d.id, name: d.data().title || 'Untitled', content: d.data().content })));
            return;
         }
      }
    } catch(e) {}
    
    // Fallback Mock Templates
    setAvailableTemplates([
      { id: 't1', name: 'Standard Letterhead', content: '<h1>Official Document</h1><p>Date: ${new Date().toLocaleDateString()}</p><p>Dear Client,</p><p></p><p>Sincerely,</p>' },
      { id: 't2', name: 'Meeting Minutes', content: '<h2>Meeting Minutes</h2><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><h3>Agenda</h3><ul><li>Item 1</li></ul><h3>Action Items</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Task 1</p></div></li></ul>' },
      { id: 't3', name: 'Quarterly Summary', content: '<h2>Quarterly Summary Report</h2><p>Overview of the quarter...</p>' },
    ]);
  };

  const handleAiSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiPrompt.trim() || !editor) return;
    
    let activeTenantId = tenantId;
    if (!activeTenantId) {
      try {
        const t = JSON.parse(localStorage.getItem('mfo_active_tenant') ?? '{}');
        if (t?.id) activeTenantId = t.id;
      } catch { /* ignore */ }
    }

    if (!activeTenantId) {
       toast.error("Error: No tenant context found for AI.");
       return;
    }

    setIsAiLoading(true);
    try {
      const selection = editor.state.selection;
      const selectedText = selection.empty ? '' : editor.state.doc.textBetween(selection.from, selection.to, ' ');
      
      const res = await fetch('/api/ai/editor-magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: activeTenantId,
          htmlContent: editor.getHTML(),
          prompt: aiPrompt,
          selection: selectedText,
          contextRecord
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      editor.commands.setContent(data.html, false);
      onChange(data.html);
      
      setShowAi(false);
      setAiPrompt('');
    } catch (err: any) {
      toast.error("AI Failed: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!editor) {
    return null;
  }

  const activeBtn = "bg-slate-200 text-slate-900";
  const defaultBtn = "text-slate-500 hover:bg-slate-100 hover:text-slate-900";

  return (
    <>
      {isFullscreen && <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" aria-hidden="true" onClick={() => setIsFullscreen(false)} />}
      <div className={cn(
        "flex flex-col border border-slate-200 rounded-md overflow-hidden bg-white transition-all duration-200", 
        isFullscreen ? "fixed inset-4 md:inset-10 z-50 shadow-2xl" : className
      )}>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 p-1 bg-slate-50/50">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive('bold') ? activeBtn : defaultBtn)}
          title="Bold"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive('italic') ? activeBtn : defaultBtn)}
          title="Italic"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive('strike') ? activeBtn : defaultBtn)}
          title="Strikethrough"
        >
          <Strikethrough size={15} />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive('heading', { level: 1 }) ? activeBtn : defaultBtn)}
          title="Heading 1"
        >
          <Heading1 size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive('heading', { level: 2 }) ? activeBtn : defaultBtn)}
          title="Heading 2"
        >
          <Heading2 size={15} />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive('bulletList') ? activeBtn : defaultBtn)}
          title="Bullet List"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive('orderedList') ? activeBtn : defaultBtn)}
          title="Numbered List"
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive('blockquote') ? activeBtn : defaultBtn)}
          title="Quote"
        >
          <Quote size={15} />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />
        
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive('taskList') ? activeBtn : defaultBtn)}
          title="Task List"
        >
          <CheckSquare size={15} />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive({ textAlign: 'left' }) ? activeBtn : defaultBtn)}
          title="Align Left"
        >
          <AlignLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive({ textAlign: 'center' }) ? activeBtn : defaultBtn)}
          title="Align Center"
        >
          <AlignCenter size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive({ textAlign: 'right' }) ? activeBtn : defaultBtn)}
          title="Align Right"
        >
          <AlignRight size={15} />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight({ color: '#ffcc00' }).run()}
          className={cn("p-1.5 rounded transition-colors", editor.isActive('highlight') ? activeBtn : defaultBtn)}
          title="Highlight"
        >
          <Highlighter size={15} />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => {
            const id = uuidv4();
            editor.chain().focus().insertContent({ type: 'excalidraw', attrs: { drawingId: id } }).run();
          }}
          className={cn("p-1.5 rounded transition-colors", defaultBtn)}
          title="Insert Diagram / Whiteboard"
        >
          <PenTool size={15} />
        </button>

        <button
          type="button"
          onClick={addTable}
          className={cn("p-1.5 rounded transition-colors", defaultBtn)}
          title="Insert Table"
        >
          <TableIcon size={15} />
        </button>

        <button
          type="button"
          onClick={addImage}
          className={cn("p-1.5 rounded transition-colors", defaultBtn)}
          title="Insert Image"
        >
          <ImageIcon size={15} />
        </button>

        {allowIframeEmbeds && (
          <button
            type="button"
            onClick={addIframe}
            className={cn("p-1.5 rounded transition-colors", defaultBtn)}
            title="Embed Dashboard / Media"
          >
            <MonitorPlay size={15} />
          </button>
        )}

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />

        <button type="button" onClick={insertHeader} className={cn("p-1.5 rounded transition-colors", defaultBtn)} title="Insert Header Letterhead">
          <PanelTop size={15} />
        </button>
        <button type="button" onClick={insertFooter} className={cn("p-1.5 rounded transition-colors", defaultBtn)} title="Insert Footer">
          <PanelBottom size={15} />
        </button>
        <button type="button" onClick={handleOpenTemplates} className={cn("p-1.5 rounded transition-colors text-indigo-600 hover:bg-indigo-50", defaultBtn)} title="Insert Template">
          <FileType size={15} />
        </button>

        <div className="w-[1px] h-4 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={setLink}
          className={cn("p-1.5 rounded transition-colors", editor.isActive('link') ? activeBtn : defaultBtn)}
          title="Add Link"
        >
          <LinkIcon size={15} />
        </button>
        {editor.isActive('link') && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className={cn("p-1.5 rounded transition-colors", defaultBtn)}
            title="Remove Link"
          >
            <Unlink size={15} />
          </button>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className={cn("p-1.5 rounded transition-colors ml-auto", defaultBtn)}
          title={isFullscreen ? "Exit Fullscreen" : "Maximize"}
        >
          {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
        </button>
      </div>

      {/* Stable container to prevent React DOM reconciliation errors (insertBefore NotFoundError) when toggling table menu */}
      <div className="empty:hidden">
        {editor.isActive('table') && (
          <div className="flex flex-wrap items-center gap-1 border-b border-indigo-100 p-1 bg-indigo-50/50">
            <span className="text-xs font-semibold text-indigo-700 px-2">Table:</span>
            
            <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} className={cn("p-1 rounded transition-colors text-indigo-600 hover:bg-indigo-100")} title="Add Column Before">
              <ArrowLeft size={14} />
            </button>
            <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={cn("p-1 rounded transition-colors text-indigo-600 hover:bg-indigo-100")} title="Add Column After">
              <ArrowRight size={14} />
            </button>
            <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className={cn("p-1 rounded transition-colors text-red-600 hover:bg-red-100")} title="Delete Column">
              <Trash size={14} />
            </button>
  
            <div className="w-[1px] h-4 bg-indigo-200 mx-1" />
  
            <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()} className={cn("p-1 rounded transition-colors text-indigo-600 hover:bg-indigo-100")} title="Add Row Above">
              <ArrowUp size={14} />
            </button>
            <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={cn("p-1 rounded transition-colors text-indigo-600 hover:bg-indigo-100")} title="Add Row Below">
              <ArrowDown size={14} />
            </button>
            <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className={cn("p-1 rounded transition-colors text-red-600 hover:bg-red-100")} title="Delete Row">
              <Trash size={14} />
            </button>
  
            <div className="w-[1px] h-4 bg-indigo-200 mx-1" />
  
            <button type="button" onClick={() => editor.chain().focus().mergeCells().run()} disabled={!editor.can().mergeCells()} className={cn("p-1 rounded transition-colors text-indigo-600 hover:bg-indigo-100 disabled:opacity-30 disabled:hover:bg-transparent")} title="Merge Cells">
              <Merge size={14} />
            </button>
            <button type="button" onClick={() => editor.chain().focus().splitCell().run()} disabled={!editor.can().splitCell()} className={cn("p-1 rounded transition-colors text-indigo-600 hover:bg-indigo-100 disabled:opacity-30 disabled:hover:bg-transparent")} title="Split Cell">
              <Split size={14} />
            </button>
  
            <div className="w-[1px] h-4 bg-indigo-200 mx-1 ml-auto" />
  
            <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className={cn("p-1.5 rounded transition-colors text-red-600 hover:bg-red-100 flex items-center gap-1 text-xs font-semibold")} title="Delete Entire Table">
              <Trash size={12} /> Delete Table
            </button>
          </div>
        )}
      </div>

      <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Insert Document Template</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-4 max-h-[300px] overflow-y-auto">
             {availableTemplates.length === 0 ? (
                <div className="text-center text-slate-500 py-8 text-sm">No templates available. Create them in the Knowledge base.</div>
             ) : (
                availableTemplates.map(t => (
                  <button 
                     key={t.id} 
                     className="flex items-center gap-3 p-3 text-left border border-slate-200 rounded hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
                     onClick={() => {
                        editor.chain().focus().insertContent(t.content).run();
                        setIsTemplatesOpen(false);
                     }}
                  >
                     <FileType size={20} className="text-indigo-500 shrink-0" />
                     <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-slate-800 text-sm">{t.name}</span>
                        <span className="text-xs text-slate-500 truncate w-full">Click to inject this template structure</span>
                     </div>
                  </button>
                ))
             )}
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsTemplatesOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100, placement: 'top' }} className="flex bg-white shadow-2xl border border-indigo-100 rounded-lg items-center px-1.5 py-1.5 gap-1 animate-in fade-in zoom-in-95 z-50">
          {showAi ? (
            <form onSubmit={handleAiSubmit} className="flex gap-2 items-center min-w-[280px]">
               <Sparkles size={15} className="text-indigo-500 ml-1" />
               <input
                 autoFocus
                 className="flex-1 text-sm border-0 bg-transparent rounded px-1 py-1 focus:outline-none placeholder-indigo-300 text-indigo-900"
                 placeholder="Tell AI what to do..."
                 value={aiPrompt}
                 onChange={(e) => setAiPrompt(e.target.value)}
                 disabled={isAiLoading}
               />
               <button type="submit" disabled={isAiLoading || !aiPrompt.trim()} className="p-1.5 bg-indigo-500 hover:bg-indigo-600 rounded text-white disabled:opacity-50 transition-colors">
                 {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
               </button>
               <button type="button" onClick={() => setShowAi(false)} className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                 <X size={15} />
               </button>
            </form>
          ) : (
            <>
              <button type="button" onClick={() => setShowAi(true)} className="px-2.5 py-1.5 rounded transition-colors text-indigo-600 hover:bg-indigo-50 text-xs font-bold flex items-center gap-1.5">
                <Sparkles size={14} />
                Ask AI
              </button>
              
              <div className="w-[1px] h-5 bg-slate-200 mx-1" />
              
              <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={cn("p-1.5 rounded transition-colors relative group", editor.isActive('bold') ? activeBtn : defaultBtn)} title="Bold">
                <Bold size={15} />
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={cn("p-1.5 rounded transition-colors relative group", editor.isActive('italic') ? activeBtn : defaultBtn)} title="Italic">
                <Italic size={15} />
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={cn("p-1.5 rounded transition-colors relative group", editor.isActive('strike') ? activeBtn : defaultBtn)} title="Strikethrough">
                <Strikethrough size={15} />
              </button>
              <button type="button" onClick={setLink} className={cn("p-1.5 rounded transition-colors relative group", editor.isActive('link') ? activeBtn : defaultBtn)} title="Add Link">
                <LinkIcon size={15} />
              </button>
            </>
          )}
        </BubbleMenu>
      )}

      {editor && (
        <FloatingMenu editor={editor} tippyOptions={{ duration: 100 }} className="flex bg-white shadow-lg border border-slate-200 rounded-lg overflow-hidden items-center p-1 gap-1 animate-in fade-in slide-in-from-left-2 z-40">
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={cn("px-2 py-1.5 rounded transition-colors text-slate-600 hover:bg-slate-100 text-xs font-semibold")} title="Heading 1">
            H1
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cn("px-2 py-1.5 rounded transition-colors text-slate-600 hover:bg-slate-100 text-xs font-semibold")} title="Heading 2">
            H2
          </button>
          <div className="w-[1px] h-4 bg-slate-200 mx-1" />
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn("px-2 py-1.5 rounded transition-colors text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1")} title="Bullet List">
            <List size={13} /> List
          </button>
          <div className="w-[1px] h-4 bg-slate-200 mx-1" />
          <button type="button" onClick={addTable} className={cn("px-2 py-1.5 rounded transition-colors text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1")} title="Table">
            <TableIcon size={13} /> Table
          </button>
        </FloatingMenu>
      )}

      <EditorContent editor={editor} className="flex-1 max-h-[500px] overflow-y-auto" />
      
      {promptState && <PromptDialog {...promptState} />}

      <style dangerouslySetInnerHTML={{__html: `
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #94a3b8;
          pointer-events: none;
          height: 0;
        }
        .tiptap table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 0; overflow: hidden; }
        .tiptap td, .tiptap th {
          min-width: 1em; border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; box-sizing: border-box; position: relative;
        }
        .tiptap th { font-weight: 600; text-align: left; background-color: #f8fafc; }
        .tiptap .selectedCell:after { z-index: 2; position: absolute; content: ""; left: 0; right: 0; top: 0; bottom: 0; background: rgba(200, 200, 255, 0.4); pointer-events: none; }
        .tiptap .column-resize-handle { position: absolute; right: -2px; top: 0; bottom: -2px; width: 4px; background-color: #6366f1; pointer-events: none; }
        
        .collaboration-cursor__label { position: absolute; top: -1.4em; left: -1px; font-size: 11px; font-weight: 600; padding: 1px 4px; border-radius: 4px 4px 4px 0; color: white; white-space: nowrap; pointer-events: none; z-index: 50; }
        .tiptap:focus { outline: none; }
      `}} />
    </div>
    </>
  );
}

const globalYjsCache = new Map<string, { ydoc: Y.Doc, provider: WebrtcProvider, count: number }>();

export function RichTextEditor(props: RichTextEditorProps) {
  const [yjsState, setYjsState] = useState<{ydoc: Y.Doc, provider: WebrtcProvider} | null>(null);

  useEffect(() => {
    if (!props.enableCollaboration) return;

    const roomParts = [];
    if (typeof window !== 'undefined') {
       roomParts.push(window.location.pathname.replace(/\//g, '-'));
    } else {
       roomParts.push('global');
    }
    if (props.contextRecord?.id) {
       roomParts.push(props.contextRecord.id);
    }
    
    // Fallback trailing random to avoid collisions if multiple anonymous editors open on same page (e.g. settings)
    if (!props.contextRecord?.id) {
       roomParts.push(Math.random().toString(36).slice(2, 9));
    }

    const roomName = `mfo-crm-${roomParts.join('-')}`;
    
    let cached = globalYjsCache.get(roomName);
    if (!cached) {
       const ydoc = new Y.Doc();
       const provider = new WebrtcProvider(roomName, ydoc, { signaling: ['wss://signaling.yjs.dev'] });
       cached = { ydoc, provider, count: 0 };
       globalYjsCache.set(roomName, cached);
    }
    cached.count++;
    
    setYjsState({ ydoc: cached.ydoc, provider: cached.provider });

    return () => {
      const current = globalYjsCache.get(roomName);
      if (current) {
         current.count--;
         setTimeout(() => {
            const cacheEntry = globalYjsCache.get(roomName);
            if (cacheEntry && cacheEntry.count <= 0) {
               current.provider.destroy();
               current.ydoc.destroy();
               globalYjsCache.delete(roomName);
            }
         }, 100);
      }
    };
  }, [props.contextRecord?.id, props.enableCollaboration]);

  if (props.enableCollaboration && !yjsState) {
    return <div className={cn("animate-pulse bg-slate-50 min-h-[300px] w-full rounded border border-slate-200", props.className)} />;
  }

  return <RichTextEditorInner {...props} ydoc={yjsState?.ydoc} provider={yjsState?.provider} />;
}
