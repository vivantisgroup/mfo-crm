'use client';

import React, { useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Dropcursor from '@tiptap/extension-dropcursor';
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Image as ImageIcon } from 'lucide-react';

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: Props) {
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true }),
      Dropcursor.configure({ color: '#6366f1', width: 2 })
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4 text-[13px] text-slate-700 font-sans'
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          if (file.type.includes('image/')) {
            const reader = new FileReader();
            reader.onload = e => {
              if (typeof e.target?.result === 'string') {
                const node = view.state.schema.nodes.image.create({ src: e.target.result });
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      }
    }
  });

  const confirmLink = () => {
    if (editor) {
       if (linkUrl.trim() === '') {
         editor.chain().focus().extendMarkRange('link').unsetLink().run();
       } else {
         editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
       }
    }
    setShowLinkPrompt(false);
  };

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    setLinkUrl(previousUrl || '');
    setShowLinkPrompt(true);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all relative">
      <div className="flex flex-wrap items-center gap-1 p-1.5 border-b border-slate-100 bg-slate-50/50">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors ${editor.isActive('bold') ? 'bg-slate-200 text-slate-900' : ''}`}
          title="Bold"
        ><Bold size={14} /></button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors ${editor.isActive('italic') ? 'bg-slate-200 text-slate-900' : ''}`}
          title="Italic"
        ><Italic size={14} /></button>
        <div className="w-px h-4 bg-slate-300 mx-1"></div>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors ${editor.isActive('bulletList') ? 'bg-slate-200 text-slate-900' : ''}`}
          title="Bullet List"
        ><List size={14} /></button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors ${editor.isActive('orderedList') ? 'bg-slate-200 text-slate-900' : ''}`}
          title="Ordered List"
        ><ListOrdered size={14} /></button>
        <div className="w-px h-4 bg-slate-300 mx-1"></div>
        <button
          onClick={setLink}
          className={`p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors ${editor.isActive('link') ? 'bg-slate-200 text-slate-900' : ''}`}
          title="Add Link"
        ><LinkIcon size={14} /></button>
      </div>

      {showLinkPrompt && (
        <div className="absolute top-10 left-4 z-10 bg-white border border-slate-200 shadow-xl rounded-md p-2 flex gap-2">
           <input 
             autoFocus
             value={linkUrl}
             onChange={e => setLinkUrl(e.target.value)}
             onKeyDown={e => e.key === 'Enter' && confirmLink()}
             placeholder="https://..."
             className="text-xs px-2 py-1 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 w-48"
           />
           <button onClick={confirmLink} className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded px-2 py-1">Save</button>
           <button onClick={() => setShowLinkPrompt(false)} className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-2 py-1">Cancel</button>
        </div>
      )}

      <div className="relative">
        {editor.isEmpty && (
          <div className="absolute top-4 left-4 text-[13px] text-slate-400 pointer-events-none">
            {placeholder || 'Compose your message... (Try dragging an image here)'}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
