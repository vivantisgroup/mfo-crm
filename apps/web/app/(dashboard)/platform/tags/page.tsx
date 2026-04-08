'use client';

import React, { useState, useEffect } from 'react';
import { Title, Text, Button } from '@tremor/react';
import { Tag, getAllTags, createTag, updateTag, deleteTag } from '@/lib/tagService';
import { Plus, LayoutGrid, List } from 'lucide-react';
import TagWheel from './components/TagWheel';
import TagList from './components/TagList';
import TagEditorPanel from './components/TagEditorPanel';
import { useAuth } from '@/lib/AuthContext';

export default function TagsPage() {
  const { tenant, user } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'wheel' | 'list'>('wheel');
  
  const [selectedTag, setSelectedTag] = useState<Tag | Partial<Tag> | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const load = React.useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const data = await getAllTags(tenant.id);
    setTags(data);
    if (data.length > 30) setViewMode('list');
    setLoading(false);
  }, [tenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (tagData: Partial<Tag>) => {
    if (!tenant?.id) return;
    if (tagData.id && tags.find(t => t.id === tagData.id)) {
      await updateTag(tagData.id, tagData, tenant.id);
    } else {
      await createTag(tagData.name || 'New Tag', tagData.color || 'slate', tenant.id);
    }
    setIsEditorOpen(false);
    setSelectedTag(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!tenant?.id) return;
    await deleteTag(id, tenant.id);
    setIsEditorOpen(false);
    setSelectedTag(null);
    load();
  };

  const startNewTag = () => {
    setSelectedTag({ name: '', color: 'blue' });
    setIsEditorOpen(true);
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50/50 animate-fade-in relative z-0 overflow-hidden">
      <div className="flex justify-between items-end p-6 lg:px-8 border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-sm flex-shrink-0 relative z-20">
        <div>
          <Title className="text-2xl font-black text-slate-900 tracking-tight">Tag Management</Title>
          <Text className="text-slate-500 mt-1">Organize and coordinate global platform tagging contexts.</Text>
        </div>
        <div className="flex items-center gap-4 border border-slate-200 p-1 rounded-xl bg-slate-50 shadow-sm">
          <button 
             onClick={() => setViewMode('wheel')}
             className={`p-2 rounded-lg flex items-center justify-center transition-all ${viewMode === 'wheel' ? 'bg-white shadow-sm text-blue-600 ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
          >
             <LayoutGrid size={16} />
          </button>
          <button 
             onClick={() => setViewMode('list')}
             className={`p-2 rounded-lg flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600 ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
          >
             <List size={16} />
          </button>
        </div>
        <Button onClick={startNewTag} size="md" className="shadow-lg shadow-blue-500/20" icon={() => <Plus size={16} className="mr-2 inline" />}>
          New Tag
        </Button>
      </div>
      
      <div className="flex-1 w-full relative overflow-hidden bg-slate-900 flex items-center justify-center">
        {loading ? (
          <div className="text-slate-400 font-medium animate-pulse flex items-center gap-3">
             <div className="w-5 h-5 rounded-full border-2 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent animate-spin" />
             Loading Tags...
          </div>
        ) : viewMode === 'list' ? (
           <TagList 
             tags={tags} 
             onTagClick={(tag) => { setSelectedTag(tag); setIsEditorOpen(true); }}
             uid={user?.uid ?? ''}
           />
        ) : (
          <TagWheel 
             tags={tags} 
             onTagClick={(tag) => { setSelectedTag(tag); setIsEditorOpen(true); }}
             onAddTag={startNewTag}
          />
        )}
      </div>

      <TagEditorPanel 
         isOpen={isEditorOpen}
         tag={selectedTag}
         onClose={() => { setIsEditorOpen(false); setSelectedTag(null); }}
         onSave={handleSave}
         onDelete={handleDelete}
         uid={user?.uid}
         userRole={user?.role || 'user'}
      />
    </div>
  );
}
