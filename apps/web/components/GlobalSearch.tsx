'use client';

import * as React from "react"
import {
  Calculator,
  Calendar,
  Settings,
  User,
  Building2,
  Bot
} from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from "next/navigation";
import { useAuth } from '@/lib/AuthContext';
import { subscribeToKnowledgeArticles, KnowledgeArticle } from '@/lib/knowledgeService';
import { FileText, Contact as ContactIcon } from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function GlobalSearch({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
  const router = useRouter();
  const { tenant } = useAuth();
  const [search, setSearch] = React.useState('');
  const [articles, setArticles] = React.useState<KnowledgeArticle[]>([]);
  const [contacts, setContacts] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!tenant?.id) return;
    const unsub = onSnapshot(query(collection(db, 'tenants', tenant.id, 'contacts')), snap => {
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [tenant?.id]);

  const filteredContacts = React.useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return contacts.filter(c => {
      const name = c.contactType === 'organization' ? c.companyName : `${c.firstName || ''} ${c.lastName || ''}`;
      return name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    }).slice(0, 10);
  }, [contacts, search]);

  React.useEffect(() => {
    if (!tenant?.id) return;
    const unsub = subscribeToKnowledgeArticles(tenant.id, setArticles);
    return () => unsub();
  }, [tenant?.id]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [setOpen])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[90vw] md:max-w-4xl w-full h-[85vh] p-0 overflow-hidden border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col bg-white dark:bg-zinc-950 shadow-2xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Global Search</DialogTitle>
        <Command className="flex-1 bg-transparent flex flex-col w-full h-full">
          <div className="border-b border-zinc-200 dark:border-zinc-800 flex-none px-4 py-2">
            <CommandInput 
              placeholder={`Search across your workspace, or ask ${tenant?.copilotConfig?.agentName || 'Advisory Copilot'}...`} 
              value={search} 
              onValueChange={setSearch} 
              className="text-xl h-14 border-none shadow-none outline-none ring-0 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium bg-transparent"
            />
          </div>
          <CommandList className="flex-1 overflow-y-auto max-h-none p-4 pb-20">
            <CommandEmpty>
              <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500">
                 {tenant?.copilotConfig?.logoUrl ? (
                   <img src={tenant.copilotConfig.logoUrl} alt="AI" className="w-16 h-16 mb-4 object-contain rounded opacity-80" />
                 ) : (
                   <Bot className="w-16 h-16 mb-4 text-indigo-400 opacity-80" />
                 )}
                 <p className="text-lg font-medium mb-3">No exact matches found.</p>
                 <button 
                   onClick={() => {
                     setOpen(false);
                     window.dispatchEvent(new CustomEvent('open-ai-agent', { detail: { query: search } }));
                   }}
                   className="text-sm text-indigo-600 hover:text-white font-bold bg-indigo-50 hover:bg-indigo-600 transition-colors px-6 py-3 rounded-full flex items-center justify-center gap-2 mx-auto"
                 >
                   Ask {tenant?.copilotConfig?.agentName || 'Advisory Copilot'}
                 </button>
              </div>
            </CommandEmpty>
            
            {search.trim().length > 0 && (
              <CommandGroup heading="AI Agent" className="mb-4">
                <CommandItem onSelect={() => { 
                    setOpen(false);
                    window.dispatchEvent(new CustomEvent('open-ai-agent', { detail: { query: search } }));
                 }}
                 className="p-4 rounded-xl cursor-pointer bg-indigo-50/50 hover:bg-indigo-100 dark:bg-indigo-950/20"
                >
                  {tenant?.copilotConfig?.logoUrl ? (
                    <img src={tenant.copilotConfig.logoUrl} alt="AI" className="mr-3 h-5 w-5 object-contain rounded" />
                  ) : (
                    <Bot className="mr-3 h-5 w-5 text-indigo-500" />
                  )}
                  <span className="text-indigo-700 dark:text-indigo-400 font-medium text-base">Ask {tenant?.copilotConfig?.agentName || 'Copilot'}: "{search}"</span>
                </CommandItem>
              </CommandGroup>
            )}

            {filteredContacts.length > 0 && search.trim().length > 0 && (
               <CommandGroup heading="Contacts" className="mb-4">
                  {filteredContacts.map(c => (
                     <CommandItem 
                        key={`contact-${c.id}`} 
                        value={`contact ${c.contactType === 'organization' ? c.companyName : `${c.firstName || ''} ${c.lastName || ''}`} ${c.email || ''}`} 
                        onSelect={() => { router.push(`/relationships/contacts/${c.id}`); setOpen(false); }} 
                        className="py-3 px-4 rounded-lg cursor-pointer"
                     >
                        {c.contactType === 'organization' ? <Building2 className="mr-3 h-5 w-5 text-zinc-400" /> : <ContactIcon className="mr-3 h-5 w-5 text-zinc-400" />}
                        <div className="flex flex-col">
                           <span className="text-base font-medium text-zinc-700 dark:text-zinc-300">
                             {c.contactType === 'organization' ? c.companyName : `${c.firstName || ''} ${c.lastName || ''}`.trim()}
                           </span>
                           {c.email && <span className="text-xs text-zinc-500">{c.email}</span>}
                        </div>
                     </CommandItem>
                  ))}
               </CommandGroup>
            )}

            {articles.length > 0 && search.trim().length > 0 && (
               <CommandGroup heading="Knowledge Base Articles" className="mb-4">
                  {articles.filter(art => 
                     art.title.toLowerCase().includes(search.toLowerCase()) || 
                     art.content.toLowerCase().includes(search.toLowerCase())
                  ).slice(0, 10).map(art => (
                     <CommandItem 
                        key={art.id} 
                        value={art.title + " " + art.id + " " + art.content.replace(/<[^>]*>?/gm, '')} 
                        onSelect={() => { router.push(`/knowledge?article=${art.id}`); setOpen(false); }} 
                        className="py-3 px-4 rounded-lg cursor-pointer"
                     >
                        <FileText className="mr-3 h-5 w-5 text-zinc-400" />
                        <div className="flex flex-col">
                           <span className="text-base font-medium text-zinc-700 dark:text-zinc-300">{art.title}</span>
                           <span className="text-xs text-zinc-500 line-clamp-1">{art.content.replace(/<[^>]*>?/gm, '').substring(0, 80)}...</span>
                        </div>
                     </CommandItem>
                  ))}
               </CommandGroup>
            )}

            <CommandGroup heading="Quick Links" className="mb-4">
              <CommandItem onSelect={() => { router.push('/calendar'); setOpen(false); }} className="py-3 px-4 rounded-lg cursor-pointer">
                <Calendar className="mr-3 h-5 w-5 text-zinc-400" />
                <span className="text-base text-zinc-700 dark:text-zinc-300">Calendar Dashboard</span>
              </CommandItem>
              <CommandItem onSelect={() => { router.push('/entities'); setOpen(false); }} className="py-3 px-4 rounded-lg cursor-pointer">
                <Building2 className="mr-3 h-5 w-5 text-zinc-400" />
                <span className="text-base text-zinc-700 dark:text-zinc-300">Entity Browser</span>
              </CommandItem>
              <CommandItem onSelect={() => { router.push('/knowledge'); setOpen(false); }} className="py-3 px-4 rounded-lg cursor-pointer">
                <Calculator className="mr-3 h-5 w-5 text-zinc-400" />
                <span className="text-base text-zinc-700 dark:text-zinc-300">Knowledge Base</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator className="my-4" />
            <CommandGroup heading="Settings">
              <CommandItem onSelect={() => { router.push('/settings'); setOpen(false); }} className="py-3 px-4 rounded-lg cursor-pointer">
                <User className="mr-3 h-5 w-5 text-zinc-400" />
                <span className="text-base text-zinc-700 dark:text-zinc-300">My Profile</span>
              </CommandItem>
              <CommandItem onSelect={() => { router.push('/admin'); setOpen(false); }} className="py-3 px-4 rounded-lg cursor-pointer">
                <Settings className="mr-3 h-5 w-5 text-zinc-400" />
                <span className="text-base text-zinc-700 dark:text-zinc-300">Admin Control Panel</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
