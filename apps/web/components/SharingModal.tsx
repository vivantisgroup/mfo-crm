import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { KnowledgeArticle, saveKnowledgeArticle } from '@/lib/knowledgeService';
import { Link as LinkIcon, UserPlus, Globe, Building2, Lock, Eye, Edit2, Copy, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface SharingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: KnowledgeArticle;
  onUpdate: () => void;
}

export function SharingModal({ open, onOpenChange, article, onUpdate }: SharingModalProps) {
  const { tenant } = useAuth();
  const [visibility, setVisibility] = useState<'private' | 'tenant' | 'shared'>(article.visibility || 'private');
  const [permissions, setPermissions] = useState<{ [key: string]: 'viewer' | 'editor' }>(article.permissions || {});
  
  const [organizations, setOrganizations] = useState<{ id: string, name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && tenant?.id) {
       setVisibility(article.visibility || 'private');
       setPermissions(article.permissions || {});
       
       // Load organizations to allow portal sharing
       const loadOrgs = async () => {
          const snap = await getDocs(collection(db, 'tenants', tenant.id, 'organizations'));
          setOrganizations(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
       };
       loadOrgs();
    }
  }, [open, article, tenant]);

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      await saveKnowledgeArticle(tenant.id, {
         ...article,
         visibility,
         permissions
      });
      onUpdate();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update sharing settings');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
     const url = `${window.location.origin}/shared/doc/${article.id}?tenant=${tenant?.id}`;
     navigator.clipboard.writeText(url);
     setCopied(true);
     setTimeout(() => setCopied(false), 2000);
  };

  const toggleOrgPermission = (orgId: string) => {
     setPermissions(prev => {
        const next = { ...prev };
        if (next[orgId]) {
           delete next[orgId];
        } else {
           next[orgId] = 'viewer';
        }
        return next;
     });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden">
        <div className="bg-slate-50 p-6 border-b border-slate-100">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2 text-xl">
                <Globe className="text-indigo-500" size={24} />
                Share Document
             </DialogTitle>
             <DialogDescription>
                Manage who can view and edit this document.
             </DialogDescription>
           </DialogHeader>
        </div>
        
        <div className="p-6 space-y-6">
           {/* Global Visibility Setting */}
           <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">General Access</h4>
              
              <div className="flex flex-col gap-2">
                 <button 
                    onClick={() => setVisibility('private')}
                    className={`flex items-start gap-4 p-3 rounded-lg border text-left transition-colors ${visibility === 'private' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'}`}
                 >
                    <Lock size={20} className={`mt-0.5 ${visibility === 'private' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                       <div className={`font-medium ${visibility === 'private' ? 'text-indigo-900' : 'text-slate-700'}`}>Restricted</div>
                       <div className="text-sm text-slate-500">Only authorized users and the owner can access.</div>
                    </div>
                 </button>

                 <button 
                    onClick={() => setVisibility('tenant')}
                    className={`flex items-start gap-4 p-3 rounded-lg border text-left transition-colors ${visibility === 'tenant' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'}`}
                 >
                    <Building2 size={20} className={`mt-0.5 ${visibility === 'tenant' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                       <div className={`font-medium ${visibility === 'tenant' ? 'text-indigo-900' : 'text-slate-700'}`}>Internal Team</div>
                       <div className="text-sm text-slate-500">Anyone within your internal CRM tenant can view.</div>
                    </div>
                 </button>

                 <button 
                    onClick={() => setVisibility('shared')}
                    className={`flex items-start gap-4 p-3 rounded-lg border text-left transition-colors ${visibility === 'shared' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'}`}
                 >
                    <LinkIcon size={20} className={`mt-0.5 ${visibility === 'shared' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div className="flex-1">
                       <div className={`font-medium ${visibility === 'shared' ? 'text-indigo-900' : 'text-slate-700'}`}>Anyone with the link</div>
                       <div className="text-sm text-slate-500">Document is publicly accessible to anyone with the exact URL.</div>
                    </div>
                 </button>
              </div>

              {visibility === 'shared' && (
                 <div className="mt-3 flex items-center gap-2">
                    <input 
                       readOnly 
                       value={`${window.location.origin}/shared/doc/${article.id}?tenant=${tenant?.id}`}
                       className="flex-1 px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded text-slate-600 outline-none"
                    />
                    <Button variant="outline" onClick={copyLink} className="shrink-0 gap-2">
                       {copied ? <Check size={16} className="text-green-600"/> : <Copy size={16} />} 
                       {copied ? 'Copied' : 'Copy'}
                    </Button>
                 </div>
              )}
           </div>

           {/* Client Portal Sharing Settings */}
           <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                 Client Portal Access
                 <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full">BETA</span>
              </h4>
              <p className="text-sm text-slate-500">Grant specific organizations access to this document via their Client Portal vault.</p>
              
              <div className="max-h-[160px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                 {organizations.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">No client organizations found.</div>
                 ) : (
                    organizations.map(org => {
                       const hasAccess = !!permissions[org.id];
                       return (
                          <label key={org.id} className="flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                             <div className="flex items-center gap-3">
                                <Building2 size={16} className={hasAccess ? 'text-indigo-600' : 'text-slate-400'} />
                                <span className={`text-sm ${hasAccess ? 'font-medium text-slate-900' : 'text-slate-600'}`}>{org.name}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                {hasAccess && <span className="text-[10px] font-bold text-indigo-600 uppercase">Viewer</span>}
                                <input 
                                   type="checkbox" 
                                   checked={hasAccess} 
                                   onChange={() => toggleOrgPermission(org.id)}
                                   className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                                />
                             </div>
                          </label>
                       );
                    })
                 )}
              </div>
           </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
           <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
           <Button variant="default" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? 'Saving...' : 'Save Settings'}
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
