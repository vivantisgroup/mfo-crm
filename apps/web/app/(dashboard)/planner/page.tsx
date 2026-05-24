'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { usePageTitle } from '@/lib/PageTitleContext';
import { useAuth } from '@/lib/AuthContext';
import { getAllMailConnections, formatLastSync } from '@/lib/emailIntegrationService';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval
} from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Plus, RefreshCcw, AlertCircle, X, Calendar as CalendarIcon,
  Briefcase, Landmark, Cake, ShieldAlert, ListTodo, Globe2, Network, Filter, Search,
  Clock, ArrowRight, FileText, CheckCircle2, Hourglass, Activity, Check
} from 'lucide-react';
import { getFirestore, collection, getDocs, query, addDoc } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n/context';

import EventComposer from './components/EventComposer';
import { DataTable } from '@/components/DataTable';

// ─── Interfaces ───

interface ConnectionStatus { microsoft?: any; google?: any; [key: string]: any; }
type EventCategory = 'task' | 'maturity' | 'birthday' | 'holiday' | 'compliance' | 'office';

interface PlannerEvent { 
  id: string; 
  title: string; 
  date: Date; 
  start?: string; 
  end?: string; 
  category: EventCategory; 
  priority?: 'high' | 'medium' | 'low'; 
  familyName?: string; 
  description?: string; 
  location?: string;
  amount?: number;
  currency?: string;
  jurisdiction?: string;
}

// ─── Constants & Styles ───

const CATEGORY_CONFIG: Record<EventCategory, { label: string; icon: any; colors: { bg: string, border: string, text: string } }> = {
  office: { 
     label: 'Office Calendar', icon: CalendarIcon, 
     colors: { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', text: '#2563eb' } 
  },
  maturity: { 
     label: 'Maturities', icon: Briefcase, 
     colors: { bg: 'rgba(16,185,129,0.12)', border: '#10b981', text: '#059669' } 
  },
  birthday: { 
     label: 'Birthdays', icon: Cake, 
     colors: { bg: 'rgba(236,72,153,0.12)', border: '#ec4899', text: '#db2777' } 
  },
  holiday: { 
     label: 'Holidays', icon: Globe2, 
     colors: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', text: '#d97706' } 
  },
  compliance: { 
     label: 'Compliance / Regulatory', icon: ShieldAlert, 
     colors: { bg: 'rgba(139,92,246,0.12)', border: '#8b5cf6', text: '#7c3aed' } 
  },
  task: { 
     label: 'To Dos', icon: ListTodo, 
     colors: { bg: 'rgba(99,102,241,0.12)', border: '#6366f1', text: '#4f46e5' } 
  },
};

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Failed to fetch');
  return r.json();
});

// ─── Mock Data Generators ───

function generateMockEvents(currentMonth: Date): PlannerEvent[] {
   const events: PlannerEvent[] = [];
   const year = currentMonth.getFullYear();
   const month = currentMonth.getMonth();
   
   // Maturities
   events.push({ id: 'm1', title: 'NTN-B Principal 2026 Maturity', date: new Date(year, month, 15), category: 'maturity', priority: 'high', familyName: 'Mendonça', amount: 4500000, currency: 'BRL' });
   events.push({ id: 'm2', title: 'LCI Itau - CDI', date: new Date(year, month, 22), category: 'maturity', familyName: 'Almeida', amount: 1200000, currency: 'BRL' });
   events.push({ id: 'm3', title: 'US Treasury Bill 3Mo', date: new Date(year, month, 5), category: 'maturity', familyName: 'Mendonça', amount: 850000, currency: 'USD' });

   // Birthdays
   events.push({ id: 'b1', title: 'Carlos Mendonça', date: new Date(year, month, 10), category: 'birthday', familyName: 'Mendonça' });
   events.push({ id: 'b2', title: 'Maria Almeida (Patriarch)', date: new Date(year, month, 28), category: 'birthday', priority: 'high', familyName: 'Almeida' });

   // Holidays
   events.push({ id: 'h1', title: 'Proclamação da República', date: new Date(year, month, 15), category: 'holiday', jurisdiction: 'BR' });
   events.push({ id: 'h2', title: 'Thanksgiving', date: new Date(year, month, 28), category: 'holiday', jurisdiction: 'USA' });
   events.push({ id: 'h3', title: 'Constitution Day', date: new Date(year, month, 4), category: 'holiday', jurisdiction: 'Cayman Islands' });

   // Compliance
   events.push({ id: 'c1', title: 'Declaração CBE (BACEN) Final Deadline', date: new Date(year, month, 5), category: 'compliance', priority: 'high' });
   events.push({ id: 'c2', title: 'CVM 358 Quarterly Report', date: new Date(year, month, 20), category: 'compliance', priority: 'high' });

   // Tasks
   events.push({ id: 't1', title: 'Rebalance Mendonça Offshore Portfolio', date: new Date(year, month, 12), category: 'task', priority: 'medium', familyName: 'Mendonça' });
   events.push({ id: 't2', title: 'Review Estate Planning structures', date: new Date(year, month, 18), category: 'task', priority: 'low', familyName: 'Almeida' });

   return events;
}

// ─── Main Component ───

export default function PlannerPage() { 
  const router = useRouter();
  usePageTitle('Planner');
  const { user, firebaseUser, tenant } = useAuth();
  const { t, language } = useTranslation();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeProvider, setActiveProvider] = useState<'microsoft' | 'google' | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'calendar' | 'expiring' | 'regulatory'>('calendar');

  // Expiring Assets State
  const [expiringAssets, setExpiringAssets] = useState<any[]>([]);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  
  // Reinvestment Modal State
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedAssetForRenew, setSelectedAssetForRenew] = useState<any>(null);
  const [renewOption, setRenewOption] = useState<'rollover_full' | 'rollover_partial' | 'cashout'>('rollover_full');
  const [renewAmount, setRenewAmount] = useState<number>(0);
  const [renewExecuting, setRenewExecuting] = useState(false);

  // Regulatory Expirations State
  const [regulatoryObligations, setRegulatoryObligations] = useState<any[]>([]);
  const [regSearchQuery, setRegSearchQuery] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState<string>('all');

  // Filters State
  const [activeFilters, setActiveFilters] = useState<Record<EventCategory, boolean>>({
     office: true, maturity: true, birthday: true, holiday: true, compliance: true, task: true
  });
  
  // Search & Advanced Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [familyFilter, setFamilyFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Composer State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerDate, setComposerDate] = useState<Date>(new Date());
  const [eventToEdit, setEventToEdit] = useState<PlannerEvent | null>(null);
  const [previewItem, setPreviewItem] = useState<PlannerEvent | null>(null);

  // Helper to log audit trail of decisions/actions in Firestore
  const logActivityToFirestore = async (subject: string, detail: string, linkedFamily: string) => {
    if (!tenant?.id || !user) return;
    try {
      const dbInstance = getFirestore(firebaseApp);
      await addDoc(collection(dbInstance, `tenants/${tenant.id}/activities`), {
        subject,
        snippet: detail,
        linkedFamilyName: linkedFamily,
        targetDate: format(new Date(), 'yyyy-MM-dd'),
        createdAt: new Date().toISOString(),
        createdBy: user.email || 'system',
        type: 'task',
        status: 'completed'
      });
    } catch (e) {
      console.error('Failed to log activity:', e);
    }
  };

  // Discover active provider integration
  useEffect(() => {
    if (user && tenant) {
       getAllMailConnections(tenant.id, user.uid).then(conns => {
          setConnectionStatus(conns);
          if (conns.microsoft) setActiveProvider('microsoft');
          else if (conns.google) setActiveProvider('google');
       });
    }
  }, [user, tenant]);

  const [idToken, setIdToken] = useState<string>('');
  useEffect(() => { firebaseUser?.getIdToken().then(setIdToken); }, [firebaseUser]);

  const apiQuery = user && idToken && activeProvider && tenant
    ? `/api/calendar/list?uid=${user.uid}&idToken=${idToken}&provider=${activeProvider}&tenantId=${tenant.id}`
    : null;
    
  const { data: calData, mutate, isValidating } = useSWR(apiQuery, fetcher, { revalidateOnFocus: false });

  const [crmActivities, setCrmActivities] = useState<any[]>([]);
  const [crmContacts, setCrmContacts] = useState<any[]>([]);
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    if (tenant?.id && user) {
       getDocs(query(collection(db, `tenants/${tenant.id}/activities`)))
         .then(snap => {
            setCrmActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
         })
         .catch(console.error);

       getDocs(query(collection(db, `tenants/${tenant.id}/contacts`)))
         .then(snap => {
            setCrmContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
         })
         .catch(console.error);
    }
  }, [tenant, user, db]);

  // Dynamic initialization for Expiring Assets & Regulatory Expirations
  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Find some family names from CRM contacts if available to make it feel integrated
    const crmFamilies = Array.from(new Set(crmContacts.map(c => c.lastName).filter(Boolean)));
    const getFamilyName = (idx: number, fallback: string) => {
      if (crmFamilies.length > idx) return crmFamilies[idx];
      return fallback;
    };

    setExpiringAssets([
      { id: 'exp-1', vehicle: 'NTN-B Principal 2026 Maturity', vehicleKey: 'planner.expiring.vehicle.ntnb', familyName: getFamilyName(0, 'Mendonça'), amount: 4500000, currency: 'BRL', date: new Date(year, month, 15), urgency: 'critical', status: 'pending' },
      { id: 'exp-2', vehicle: 'LCI Itaú - CDI (90 Days)', vehicleKey: 'planner.expiring.vehicle.lci', familyName: getFamilyName(1, 'Almeida'), amount: 1200000, currency: 'BRL', date: new Date(year, month, 22), urgency: 'imminent', status: 'pending' },
      { id: 'exp-3', vehicle: 'US Treasury Bill 3Mo', vehicleKey: 'planner.expiring.vehicle.tbill', familyName: getFamilyName(0, 'Mendonça'), amount: 850000, currency: 'USD', date: new Date(year, month, 5), urgency: 'planned', status: 'completed' },
      { id: 'exp-4', vehicle: 'Sequoia Global Growth Debenture', vehicleKey: 'planner.expiring.vehicle.debenture', familyName: getFamilyName(2, 'Soros'), amount: 2500000, currency: 'USD', date: new Date(year, month + 1, 10), urgency: 'planned', status: 'pending' },
      { id: 'exp-5', vehicle: 'Crescent HoldCo LLC Yield Bond', vehicleKey: 'planner.expiring.vehicle.bond', familyName: getFamilyName(1, 'Almeida'), amount: 350005, currency: 'USD', date: new Date(year, month, 19), urgency: 'critical', status: 'pending' },
    ]);

    setRegulatoryObligations([
      { id: 'reg-1', obligation: 'Declaração CBE (BACEN) Final Deadline', obligationKey: 'planner.regulatory.obligation.cbe', familyName: getFamilyName(0, 'Mendonça'), deadline: new Date(year, month, 5), status: 'expired', isSuitability: false },
      { id: 'reg-2', obligation: 'Suitability Questionnaire Renewal', obligationKey: 'planner.regulatory.obligation.suitability', familyName: getFamilyName(1, 'Almeida'), deadline: new Date(year, month, 22), status: 'warning', isSuitability: true, familyId: 'almeida_fam' },
      { id: 'reg-3', obligation: 'CVM 358 Quarterly Reporting', obligationKey: 'planner.regulatory.obligation.cvm', familyName: 'MFO Corporate', deadline: new Date(year, month, 28), status: 'valid', isSuitability: false },
      { id: 'reg-4', obligation: 'FATCA/CRS Reporting Compliance', obligationKey: 'planner.regulatory.obligation.fatca', familyName: getFamilyName(2, 'Soros'), deadline: new Date(year, month + 1, 15), status: 'valid', isSuitability: false },
      { id: 'reg-5', obligation: 'Suitability Questionnaire Renewal', obligationKey: 'planner.regulatory.obligation.suitability', familyName: getFamilyName(0, 'Mendonça'), deadline: new Date(year, month, 12), status: 'expired', isSuitability: true, familyId: 'mendonca_fam' },
      { id: 'reg-6', obligation: 'Plan of Accounts Compliance Reporting', obligationKey: 'planner.regulatory.obligation.planos', familyName: getFamilyName(1, 'Almeida'), deadline: new Date(year, month, 15), status: 'warning', isSuitability: false }
    ]);
  }, [currentDate, crmContacts]);

  // Consolidate Mock + Live Events + CRM Activities
  const events = useMemo(() => {
    let all = generateMockEvents(currentDate);

    // Map fetched Live Calendar events
    if (calData && calData.events) {
       calData.events.forEach((ev: any) => {
          all.push({
             ...ev,
             id: ev.id || Math.random().toString(),
             date: ev.start ? new Date(ev.start) : new Date(),
             category: 'office',
          });
       });
    }

    // Map CRM Activities
    crmActivities.forEach(act => {
      const dateStr = act.targetDate || act.createdAt;
      if (dateStr) {
        all.push({
          id: act.id,
          title: `[Activity] ${act.subject}`,
          date: new Date(dateStr),
          category: 'task',
          priority: 'medium',
          familyName: act.linkedFamilyName,
          description: act.snippet,
        });
      }
    });

    // Map CRM Contacts Birthdays
    crmContacts.forEach(contact => {
      if (contact.dateOfBirth && contact.contactType !== 'organization') {
        const [y, m, d] = contact.dateOfBirth.split('-');
        if (m && d) {
          const year = currentDate.getFullYear();
          const birthdayDate = new Date(year, Number(m) - 1, Number(d));
          all.push({
            id: `bday-${contact.id}-${year}`,
            title: `Aniversário: ${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            date: birthdayDate,
            category: 'birthday',
            priority: 'medium',
          });
        }
      }
    });

    // Apply Filters
    all = all.filter(e => activeFilters[e.category]);

    // Apply Search
    if (searchQuery) {
       const q = searchQuery.toLowerCase();
       all = all.filter(e => 
          e.title.toLowerCase().includes(q) || 
          e.description?.toLowerCase().includes(q) || 
          e.familyName?.toLowerCase().includes(q)
       );
    }

    // Apply Advanced Filters
    if (familyFilter) {
       all = all.filter(e => e.familyName?.toLowerCase().includes(familyFilter.toLowerCase()));
    }
    if (priorityFilter) {
       all = all.filter(e => e.priority === priorityFilter);
    }

    return all.sort((a,b) => a.date.getTime() - b.date.getTime());
  }, [calData, currentDate, activeFilters, searchQuery, familyFilter, priorityFilter, crmActivities]);

  // Grid mechanics
  const monthStart = startOfMonth(currentDate);
  const monthEnd   = endOfMonth(monthStart);
  
  let startDate = startOfWeek(monthStart);
  let endDate = endOfWeek(monthEnd);
  
  if (view === 'week') {
    startDate = startOfWeek(currentDate);
    endDate = endOfWeek(currentDate);
  } else if (view === 'list') {
    startDate = startOfMonth(currentDate);
    endDate = endOfMonth(currentDate);
  }

  const days       = eachDayOfInterval({ start: startDate, end: endDate });
  const weeks      = view === 'week' ? 1 : Math.ceil(days.length / 7);

  const nextMonth = () => setCurrentDate(view === 'week' ? new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000) : addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(view === 'week' ? new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000) : subMonths(currentDate, 1));
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Handlers
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user || !firebaseUser || !activeProvider) return;
      setIsSyncing(true);
      try {
        const activeTenant = JSON.parse(localStorage.getItem('mfo_active_tenant') || '{}');
        const res = await fetch('/api/mail/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, idToken: await firebaseUser.getIdToken(), tenantId: activeTenant.id, provider: activeProvider })
        });
        if (!res.ok) throw new Error(`Sync failed`);
        mutate();
      } catch (err: any) {
        toast.error(err.message || 'Error occurred during sync');
      } finally {
        setIsSyncing(false);
      }
  };

  const handleDayClick = (day: Date) => {
      setComposerDate(day);
      setEventToEdit(null);
      setIsComposerOpen(true);
  };

  const handleEventClick = (e: React.MouseEvent, ev: PlannerEvent) => {
      e.stopPropagation(); 
      setPreviewItem(ev);
  };

  const toggleFilter = (cat: EventCategory) => {
     setActiveFilters(prev => ({...prev, [cat]: !prev[cat]}));
  };

  return (
    <div className="absolute inset-4 lg:inset-6 flex bg-slate-50 overflow-hidden font-sans rounded-2xl border border-slate-200/60 shadow-sm z-0">
      
      {/* ── ITEM PREVIEW MODAL ── */}
      {previewItem && (
         <div className={`fixed inset-0 z-[200] flex items-center justify-center font-sans ${view === 'list' ? 'md:hidden' : ''}`}>
            <div onClick={() => setPreviewItem(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 cursor-pointer" />
            <div className="relative bg-white/90 backdrop-blur-2xl ring-1 ring-white/50 border border-slate-200/50 rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] w-full max-w-md p-8 animate-in zoom-in-95 duration-300">
               <button onClick={() => setPreviewItem(null)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 bg-slate-100/50 hover:bg-slate-200/80 backdrop-blur-sm rounded-full p-2 transition-all">
                  <X size={16} strokeWidth={2.5} />
               </button>
               <div className="flex items-center gap-4 mb-8 border-b border-slate-200/50 pb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner`} style={{ backgroundColor: CATEGORY_CONFIG[previewItem.category].colors.bg, color: CATEGORY_CONFIG[previewItem.category].colors.text }}>
                     {React.createElement(CATEGORY_CONFIG[previewItem.category].icon, { size: 28, strokeWidth: 2 })}
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest mb-1" style={{ color: CATEGORY_CONFIG[previewItem.category].colors.text }}>{t(`planner.category.${previewItem.category}`, CATEGORY_CONFIG[previewItem.category].label)}</div>
                    <h2 className="text-xl font-extrabold text-slate-800 leading-tight">{previewItem.title}</h2>
                  </div>
               </div>
               
               <div className="space-y-6">
                  <div>
                     <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5 flex items-center gap-2"><CalendarIcon size={12} className="text-slate-400"/> Scheduled Date</label>
                     <div className="text-sm font-semibold text-slate-700 bg-slate-50/50 border border-slate-100 rounded-xl p-3 shadow-sm">
                        {format(previewItem.date, 'EEEE, MMMM do, yyyy')}
                        {previewItem.start && ` at ${format(new Date(previewItem.start), 'HH:mm')}`}
                     </div>
                  </div>
                  {previewItem.familyName && (
                     <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Associated Entity</label>
                        <div className="text-sm font-semibold text-indigo-700 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex items-center gap-2 shadow-sm">🏛 {previewItem.familyName}</div>
                     </div>
                  )}
                  {previewItem.jurisdiction && (
                     <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Jurisdiction</label>
                        <div className="text-sm font-semibold text-amber-700 bg-amber-50/50 border border-amber-100 rounded-xl p-3 flex items-center gap-2 shadow-sm"><Globe2 size={16}/> {previewItem.jurisdiction}</div>
                     </div>
                  )}
                  {previewItem.amount && (
                     <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Financial Value</label>
                        <div className="text-sm font-semibold text-emerald-700 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2 shadow-sm">
                           💰 {new Intl.NumberFormat('en-US', { style: 'currency', currency: previewItem.currency || 'USD' }).format(previewItem.amount)}
                        </div>
                     </div>
                  )}
                  {previewItem.priority && (
                     <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Priority</label>
                        <div className={`text-xs font-bold px-3 py-1.5 rounded-lg inline-block shadow-sm border ${previewItem.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>{previewItem.priority.toUpperCase()}</div>
                     </div>
                  )}
               </div>

               <div className="mt-10 flex gap-3">
                  <button onClick={() => { setPreviewItem(null); if (previewItem.category === 'office') setIsComposerOpen(true); }} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-gradient-to-tr from-[var(--brand-600)] to-[var(--brand-500)] text-white shadow-xl shadow-[var(--brand-muted)] hover:shadow-lg hover:-translate-y-0.5 transition-all outline-none border border-transparent">
                     {previewItem.category === 'office' ? 'Edit Event' : 'View in Module'}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* ── Sidebar ── */}
      <div className="w-[300px] bg-white border-r border-slate-200 flex flex-col pt-6 pb-6 shadow-sm z-10 shrink-0">
        {activeTab === 'calendar' ? (
           <>
              <div className="px-6 mb-8">
                 <button className="w-full shadow-md inline-flex items-center justify-center rounded-xl text-sm font-bold transition-all bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)] h-11 px-4 py-2 gap-2 hover:-translate-y-0.5" onClick={() => handleDayClick(new Date())}>
                   <Plus size={18} />
                   {t('planner.addEvent', 'Add Event')}
                 </button>
              </div>

              {/* Global Filters */}
              <div className="px-6 mb-8 flex flex-col gap-3">
                 <div className="flex items-center justify-between mb-1">
                   <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('planner.themes', 'Themes & Topics')}</div>
                   <div className="flex items-center gap-2">
                      <button onClick={() => setActiveFilters({office:true, maturity:true, birthday:true, holiday:true, compliance:true, task:true})} className="text-[10px] font-bold uppercase text-slate-400 hover:text-indigo-600 transition-colors tracking-widest cursor-pointer">{t('common.all', 'ALL')}</button>
                      <span className="text-slate-200 text-xs">|</span>
                      <button onClick={() => setActiveFilters({office:false, maturity:false, birthday:false, holiday:false, compliance:false, task:false})} className="text-[10px] font-bold uppercase text-slate-400 hover:text-indigo-600 transition-colors tracking-widest cursor-pointer">NONE</button>
                   </div>
                 </div>
                 
                 <div className="flex flex-col gap-2">
                    {(Object.keys(CATEGORY_CONFIG) as EventCategory[]).map(cat => {
                       const config = CATEGORY_CONFIG[cat];
                       const isActive = activeFilters[cat];
                       return (
                          <button 
                             key={cat} 
                             onClick={() => toggleFilter(cat)}
                             className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${isActive ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-60 hover:opacity-100'}`}
                          >
                             <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center`} style={{ backgroundColor: isActive ? config.colors.bg : '#f1f5f9', color: isActive ? config.colors.text : '#94a3b8' }}>
                                   {React.createElement(config.icon, { size: 16 })}
                                </div>
                                <span className={`text-sm font-semibold ${isActive ? 'text-slate-700' : 'text-slate-400'}`}>{t(`planner.category.${cat}`, config.label)}</span>
                             </div>
                             <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                                {isActive && <span className="text-[10px] font-bold">✓</span>}
                             </div>
                          </button>
                       );
                    })}
                 </div>
              </div>

              {/* Sync Status area */}
              <div className="px-6 mt-auto flex flex-col gap-3 border-t border-slate-100 pt-6">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('planner.integration', 'Calendar Integration')}</div>
                
                {connectionStatus?.microsoft && (
                <div className={`bg-white shadow-sm rounded-xl border p-3 cursor-pointer border-l-4 transition-all ${activeProvider === 'microsoft' ? 'border-l-blue-500 border-slate-200' : 'border-l-transparent border-slate-100 hover:bg-slate-50'}`} onClick={() => setActiveProvider('microsoft')}>
                   <div className="flex items-center gap-2 w-full">
                      <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-xs shrink-0">🟦</div>
                      <div className="flex-1 flex items-center justify-between">
                         <div>
                            <div className="text-sm font-semibold text-slate-800">Microsoft 365</div>
                            <div className="flex items-center gap-1 mt-0.5">
                               <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus?.microsoft?.lastSyncResult === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                               <span className={`text-[10px] font-medium whitespace-nowrap ${connectionStatus?.microsoft?.lastSyncResult === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{connectionStatus?.microsoft?.lastSyncResult === 'error' ? 'Sync Failed' : `Synced ${formatLastSync(connectionStatus?.microsoft?.lastSyncAt)}`}</span>
                            </div>
                         </div>
                         <button onClick={handleManualSync} disabled={isSyncing} className="p-1.5 rounded-md hover:bg-blue-100 text-blue-500 transition-colors">
                            <RefreshCcw size={14} className={isSyncing && activeProvider === 'microsoft' ? 'animate-spin' : ''} />
                         </button>
                      </div>
                   </div>
                </div>
                )}

                {connectionStatus?.google && (
                <div className={`bg-white shadow-sm rounded-xl border p-3 cursor-pointer border-l-4 transition-all ${activeProvider === 'google' ? 'border-l-red-500 border-slate-200' : 'border-l-transparent border-slate-100 hover:bg-slate-50'}`} onClick={() => setActiveProvider('google')}>
                   <div className="flex items-center gap-2 w-full">
                      <div className="w-6 h-6 rounded bg-red-100 flex items-center justify-center text-xs shrink-0">🔴</div>
                      <div className="flex-1 flex items-center justify-between">
                         <div>
                            <div className="text-sm font-semibold text-slate-800">Google Workspace</div>
                            <div className="flex items-center gap-1 mt-0.5">
                               <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus?.google?.lastSyncResult === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                               <span className={`text-[10px] font-medium whitespace-nowrap ${connectionStatus?.google?.lastSyncResult === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{connectionStatus?.google?.lastSyncResult === 'error' ? 'Sync Failed' : `Synced ${formatLastSync(connectionStatus?.google?.lastSyncAt)}`}</span>
                            </div>
                         </div>
                         <button onClick={handleManualSync} disabled={isSyncing} className="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition-colors">
                            <RefreshCcw size={14} className={isSyncing && activeProvider === 'google' ? 'animate-spin' : ''} />
                         </button>
                      </div>
                   </div>
                </div>
                )}

                {!connectionStatus?.microsoft && !connectionStatus?.google && connectionStatus !== null && (
                    <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/60 rounded-xl p-4 flex flex-col items-center text-center gap-3 shadow-sm hover:shadow-md transition-all duration-300">
                       <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-blue-500/5 blur-xl pointer-events-none" />
                       <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />
                       
                       <div className="w-10 h-10 rounded-full bg-blue-50/80 border border-blue-100 flex items-center justify-center text-blue-500 shadow-inner">
                          <AlertCircle size={20} className="animate-pulse" />
                       </div>
                       
                       <div className="space-y-1 z-10">
                          <div className="text-xs font-bold text-slate-800 tracking-tight">
                             {t('planner.noIntegrations', 'No active calendar integrations.')}
                          </div>
                          <p className="text-[11px] font-medium text-slate-500 leading-relaxed max-w-[200px] mx-auto">
                             {t('planner.noIntegrationsDesc', 'Connect your Outlook or Google Workspace account to automatically synchronize events and maturities.')}
                          </p>
                       </div>
                       
                       <button 
                          onClick={() => router.push('/settings?tab=mail')}
                          className="w-full mt-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 z-10"
                       >
                          {t('planner.configureIntegration', 'Configure Connection')}
                       </button>
                    </div>
                 )}
              </div>
           </>
        ) : activeTab === 'expiring' ? (
           <>
              {/* Expiring Assets Filters */}
              <div className="px-6 mb-8 flex flex-col gap-3">
                 <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('planner.expiring.urgency', 'Urgency')}</div>
                 <div className="flex flex-col gap-2">
                    {[
                       { id: 'all', label: t('common.all', 'All'), count: expiringAssets.length },
                       { id: 'critical', label: t('planner.expiring.urgency.critical', 'Critical'), count: expiringAssets.filter(a => a.urgency === 'critical').length, color: 'text-red-500 bg-red-500/10' },
                       { id: 'imminent', label: t('planner.expiring.urgency.imminent', 'Imminent'), count: expiringAssets.filter(a => a.urgency === 'imminent').length, color: 'text-amber-500 bg-amber-500/10' },
                       { id: 'planned', label: t('planner.expiring.urgency.planned', 'Planned'), count: expiringAssets.filter(a => a.urgency === 'planned').length, color: 'text-blue-500 bg-blue-500/10' }
                    ].map(urg => (
                       <button
                          key={urg.id}
                          onClick={() => setUrgencyFilter(urg.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${urgencyFilter === urg.id ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-60 hover:opacity-100'}`}
                       >
                          <span className={`text-sm font-semibold ${urgencyFilter === urg.id ? 'text-slate-800' : 'text-slate-500'}`}>{urg.label}</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${urg.color || 'bg-slate-100 text-slate-600'}`}>{urg.count}</span>
                       </button>
                    ))}
                 </div>
              </div>

              {/* Expiring Quick Stats */}
              <div className="px-6 mt-auto border-t border-slate-100 pt-6 space-y-4">
                 <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Expiring Wealth Stats</div>
                 <div className="bg-slate-50 rounded-xl border border-slate-150 p-4 space-y-3.5 shadow-inner">
                    <div>
                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Assets Requiring Action</div>
                       <div className="text-xl font-black text-slate-800">{expiringAssets.filter(a => a.status === 'pending').length}</div>
                    </div>
                    <div>
                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Active Rollovers</div>
                       <div className="text-xl font-black text-slate-800">{expiringAssets.filter(a => a.status === 'processing').length}</div>
                    </div>
                 </div>
              </div>
           </>
        ) : (
           <>
              {/* Regulatory Filters */}
              <div className="px-6 mb-8 flex flex-col gap-3">
                 <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('planner.regulatory.status', 'Status')}</div>
                 <div className="flex flex-col gap-2">
                    {[
                       { id: 'all', label: t('common.all', 'All'), count: regulatoryObligations.length },
                       { id: 'expired', label: t('planner.regulatory.status.expired', 'Expired'), count: regulatoryObligations.filter(r => r.status === 'expired').length, color: 'text-red-500 bg-red-500/10' },
                       { id: 'warning', label: t('planner.regulatory.status.warning', 'Expiring Soon'), count: regulatoryObligations.filter(r => r.status === 'warning').length, color: 'text-amber-500 bg-amber-500/10' },
                       { id: 'valid', label: t('planner.regulatory.status.valid', 'Valid'), count: regulatoryObligations.filter(r => r.status === 'valid').length, color: 'text-emerald-500 bg-emerald-500/10' }
                    ].map(st => (
                       <button
                          key={st.id}
                          onClick={() => setRegStatusFilter(st.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${regStatusFilter === st.id ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-60 hover:opacity-100'}`}
                       >
                          <span className={`text-sm font-semibold ${regStatusFilter === st.id ? 'text-slate-800' : 'text-slate-500'}`}>{st.label}</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${st.color || 'bg-slate-100 text-slate-600'}`}>{st.count}</span>
                       </button>
                    ))}
                 </div>
              </div>

              {/* Regulatory Quick Stats */}
              <div className="px-6 mt-auto border-t border-slate-100 pt-6 space-y-4">
                 <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Compliance Audits</div>
                 <div className="bg-slate-50 rounded-xl border border-slate-150 p-4 space-y-3.5 shadow-inner">
                    <div>
                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Expired Suitabilities</div>
                       <div className="text-xl font-black text-rose-600">{regulatoryObligations.filter(r => r.isSuitability && r.status === 'expired').length}</div>
                    </div>
                    <div>
                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Upcoming Compliance Obligations</div>
                       <div className="text-xl font-black text-slate-800">{regulatoryObligations.filter(r => r.status === 'warning').length}</div>
                    </div>
                 </div>
              </div>
           </>
        )}
      </div>

      {/* ── Main Workspace ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
         
         {/* Header */}
         <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-8 py-4 flex flex-col md:flex-row md:items-center justify-between shrink-0 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] z-10 sticky top-0 gap-4">
            <div className="flex flex-col gap-1">
               <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight flex items-center gap-3">
                  {t('planner.pageTitle', 'Cockpit Planner')}
               </h3>
               <span className="text-xs font-semibold text-slate-400">Strategic Workspace</span>
            </div>
            
            {/* Elegant glassmorphic tabs */}
            <div className="bg-slate-100/80 p-1 rounded-xl flex shadow-inner border border-slate-200/50 self-start md:self-center">
               <button 
                  onClick={() => setActiveTab('calendar')}
                  className={`px-4 py-2 text-xs font-bold tracking-wide rounded-lg transition-all flex items-center gap-2 ${
                     activeTab === 'calendar' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                  }`}
               >
                  <CalendarIcon size={14} />
                  <span>{t('planner.tab.calendar', 'Calendar')}</span>
               </button>
               <button 
                  onClick={() => setActiveTab('expiring')}
                  className={`px-4 py-2 text-xs font-bold tracking-wide rounded-lg transition-all flex items-center gap-2 ${
                     activeTab === 'expiring' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                  }`}
               >
                  <Briefcase size={14} />
                  <span>{t('planner.tab.expiringAssets', 'Investment Maturities')}</span>
               </button>
               <button 
                  onClick={() => setActiveTab('regulatory')}
                  className={`px-4 py-2 text-xs font-bold tracking-wide rounded-lg transition-all flex items-center gap-2 ${
                     activeTab === 'regulatory' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                  }`}
               >
                  <ShieldAlert size={14} />
                  <span>{t('planner.tab.regulatory', 'Regulatory')}</span>
               </button>
            </div>
         </div>

         {/* Tab Content Display */}
         {activeTab === 'calendar' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
               {/* Calendar Controls */}
               <div className="bg-white/95 border-b border-slate-200/60 px-8 py-3.5 flex items-center justify-between shrink-0 z-10 gap-4 shadow-sm">
                  <div className="flex flex-col">
                     <h4 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-3">
                       {view === 'week' 
                          ? `${format(startOfWeek(currentDate), 'MMM d')} - ${format(endOfWeek(currentDate), 'MMM d, yyyy')}` 
                          : `${format(currentDate, 'MMMM')} ${format(currentDate, 'yyyy')}`
                       }
                       {isValidating && <RefreshCcw size={14} className="animate-spin text-indigo-500" />}
                     </h4>
                  </div>
                  
                  <div className="flex gap-4 items-center">
                     {/* Search Input */}
                     <div className="relative hidden md:block z-20">
                       <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 pointer-events-none">
                         <Search size={14} className="text-slate-400" />
                       </div>
                       <input 
                         type="text" 
                         placeholder={t('planner.searchPlaceholder', 'Search planner...')}
                         value={searchQuery}
                         onChange={e => setSearchQuery(e.target.value)}
                         className="pl-12 pr-4 py-2 bg-slate-100 border border-slate-200/50 rounded-xl text-sm w-48 lg:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all text-slate-800"
                       />
                     </div>

                     {/* Advanced Filters Popover */}
                     <div className="relative">
                       <button 
                         onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                         className={`p-2 rounded-xl border transition-all ${showAdvancedFilters || familyFilter || priorityFilter ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' : 'bg-slate-100 border-slate-200/50 text-slate-500 hover:bg-slate-200/50'}`}
                         title="Advanced Filters"
                       >
                         <Filter size={18} strokeWidth={2.5} />
                       </button>
                       
                       {showAdvancedFilters && (
                         <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] border border-slate-200/60 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                              <Filter size={14} className="text-indigo-600" />
                              Advanced Filters
                            </h4>
                            
                            <div className="space-y-4">
                              <div>
                                <label className="text-[11px] uppercase tracking-widest font-bold text-slate-500 mb-1.5 block">Family Name</label>
                                <input 
                                  type="text" 
                                  value={familyFilter}
                                  onChange={e => setFamilyFilter(e.target.value)}
                                  placeholder="e.g. Mendonça"
                                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                              </div>
                              
                              <div>
                                <label className="text-[11px] uppercase tracking-widest font-bold text-slate-500 mb-1.5 block">Priority</label>
                                <select 
                                  value={priorityFilter}
                                  onChange={e => setPriorityFilter(e.target.value)}
                                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
                                >
                                  <option value="">All Priorities</option>
                                  <option value="high">High Priority</option>
                                  <option value="medium">Medium Priority</option>
                                  <option value="low">Low Priority</option>
                                </select>
                              </div>
                              
                              {(familyFilter || priorityFilter) && (
                                <button 
                                  onClick={() => { setFamilyFilter(''); setPriorityFilter(''); }}
                                  className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors mt-2"
                                >
                                  Clear Filters
                                </button>
                              )}
                            </div>
                         </div>
                       )}
                     </div>

                     <div className="bg-slate-100 p-1 rounded-xl flex shadow-inner border border-slate-200/50">
                        <button onClick={() => setView('month')} className={`px-5 py-2 text-xs font-bold tracking-wide rounded-lg transition-all ${view === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Month</button>
                        <button onClick={() => setView('week')} className={`px-5 py-2 text-xs font-bold tracking-wide rounded-lg transition-all ${view === 'week' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Week</button>
                        <button onClick={() => setView('list')} className={`px-5 py-2 text-xs font-bold tracking-wide rounded-lg transition-all ${view === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Agenda</button>
                     </div>
                     <div className="flex items-center gap-1 pl-4 border-l border-slate-200/60">
                       <button onClick={prevMonth} className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"><ChevronLeft size={18} strokeWidth={3} /></button>
                       <button onClick={() => setCurrentDate(new Date())} className="px-5 py-2 text-xs font-extrabold tracking-wider uppercase bg-white border border-slate-200 shadow-sm rounded-xl text-slate-700 hover:text-indigo-600 hover:border-indigo-200 transition-all">Today</button>
                       <button onClick={nextMonth} className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"><ChevronRight size={18} strokeWidth={3} /></button>
                     </div>
                  </div>
               </div>

               {/* Calendar Workspace Grid */}
               {view === 'list' ? (
                  <div className="flex-1 flex overflow-hidden bg-slate-50 relative z-0 p-8">
                     <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col">
                        {events.filter(e => isSameMonth(e.date, monthStart) && e.title).length === 0 ? (
                           <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                 <CalendarIcon size={40} className="text-slate-300" />
                              </div>
                              <h3 className="text-xl font-bold text-slate-400 mb-2">No Events Scheduled</h3>
                              <p className="text-sm text-slate-400 max-w-xs leading-relaxed">There are no events matching your criteria for the selected period.</p>
                           </div>
                        ) : (
                           <div className="flex-1 overflow-y-auto">
                              <DataTable
                                 data={events
                                    .filter(e => isSameMonth(e.date, monthStart) && e.title)
                                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                 }
                                 columns={[
                                    {
                                       header: 'Date',
                                       accessor: (event: PlannerEvent) => (
                                          <div className="flex flex-col">
                                             <span className="font-bold text-slate-800">{format(new Date(event.date), 'MMM d, yyyy')}</span>
                                             {event.start && <span className="text-xs font-semibold text-slate-500 mt-0.5">{format(new Date(event.start), 'h:mm a')}</span>}
                                          </div>
                                       )
                                    },
                                    {
                                       header: 'Category',
                                       accessor: (event: PlannerEvent) => {
                                          const config = CATEGORY_CONFIG[event.category];
                                          if (!config) return null;
                                          const Icon = config.icon;
                                          return (
                                             <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: config.colors.bg, color: config.colors.text }}>
                                                   <Icon size={12} strokeWidth={2.5} />
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: config.colors.text }}>{config.label}</span>
                                             </div>
                                          );
                                       }
                                    },
                                    {
                                       header: 'Title',
                                       accessor: (event: PlannerEvent) => <span className="font-semibold text-slate-800">{event.title}</span>
                                    },
                                    {
                                       header: 'Family / Group',
                                       accessor: (event: PlannerEvent) => event.familyName ? (
                                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-xs font-bold text-slate-600 border border-slate-200">
                                             <Network size={10} className="text-slate-400" />
                                             {event.familyName}
                                          </span>
                                       ) : <span className="text-slate-400 text-xs">-</span>
                                    },
                                    {
                                       header: 'Priority',
                                       accessor: (event: PlannerEvent) => event.priority ? (
                                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${event.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' : event.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                             {event.priority}
                                          </span>
                                       ) : <span className="text-slate-400 text-xs">-</span>
                                    },
                                    {
                                       header: 'Actions',
                                       className: 'text-right',
                                       accessor: (event: PlannerEvent) => (
                                          <button 
                                             onClick={() => {
                                                setPreviewItem(null);
                                                setEventToEdit(event);
                                                setComposerDate(event.date);
                                                setIsComposerOpen(true);
                                             }}
                                             className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                          >
                                             Edit Event
                                          </button>
                                       )
                                    }
                                 ]}
                              />
                           </div>
                        )}
                     </div>
                  </div>
               ) : (
                  <div className="flex-1 flex flex-col relative z-0">
                     {/* Headers row */}
                     <div className="grid grid-cols-7 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm z-10">
                       {dayLabels.map(label => (
                         <div key={label} className="py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                           {label}
                         </div>
                       ))}
                     </div>
                     
                     {/* Cells container */}
                     <div 
                        className="flex-1 grid grid-cols-7 border-l border-slate-200 overflow-y-auto" 
                        style={{ gridTemplateRows: `repeat(${weeks}, minmax(140px, 1fr))` }}
                     >
                       {days.map((day, idx) => {
                          const dayEvents = events.filter(e => isSameDay(e.date, day));
                          const isCurrentMonth = isSameMonth(day, monthStart);
                          const isToday = isSameDay(day, new Date());
                          
                          return (
                             <div 
                               key={day.toISOString()}
                               onClick={() => handleDayClick(day)}
                               className={`flex flex-col p-2.5 border-r border-b border-slate-200/60 relative group cursor-pointer hover:bg-slate-50 hover:z-10 transition-all duration-300 ${!isCurrentMonth && view === 'month' ? 'bg-slate-50/50 opacity-60' : 'bg-white'} overflow-hidden`}
                             >
                               {/* Day numeric label */}
                               <div className="flex justify-between items-start mb-2">
                                  <span className={`text-[14px] font-extrabold w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isToday ? 'bg-[var(--brand-600)] text-white shadow-md' : 'text-slate-700 group-hover:bg-slate-100'}`}>
                                     {format(day, 'd')}
                                  </span>
                                  <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                     <Plus size={14}/>
                                  </div>
                               </div>

                               {/* Events render */}
                               <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar flex-1 pb-1">
                                  {dayEvents.slice(0, view === 'week' ? 20 : 4).map(event => {
                                     const c = CATEGORY_CONFIG[event.category].colors;
                                     const Icon = CATEGORY_CONFIG[event.category].icon;
                                     return (
                                        <div
                                          key={event.id}
                                          onClick={(e) => handleEventClick(e, event)}
                                          className="group/event w-full py-1.5 px-2 rounded-lg shadow-sm border truncate hover:shadow-md hover:scale-[1.02] transition-all shrink-0 flex items-center gap-1.5"
                                          style={{ backgroundColor: 'white', borderColor: c.border }}
                                          title={event.title}
                                        >
                                           <Icon size={12} style={{ color: c.text }} className="shrink-0" />
                                           <span className="text-[11px] font-bold text-slate-800 leading-tight truncate">
                                              {event.title}
                                           </span>
                                        </div>
                                     )
                                  })}
                                  {dayEvents.length > 4 && view === 'month' && (
                                     <div 
                                       className="text-[11px] font-bold text-slate-500 pl-1 mt-1 shrink-0 hover:text-indigo-600 cursor-pointer"
                                       onClick={(e) => {
                                          e.stopPropagation();
                                          setCurrentDate(day);
                                          setView('list');
                                       }}
                                     >
                                        +{dayEvents.length - 4} more
                                     </div>
                                  )}
                               </div>
                             </div>
                          );
                       })}
                     </div>
                  </div>
               )}
            </div>
         ) : activeTab === 'expiring' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
               {/* Expiring Assets controls */}
               <div className="bg-white/95 border-b border-slate-200/60 px-8 py-3.5 flex items-center justify-between shrink-0 z-10 gap-4 shadow-sm">
                  <div className="flex flex-col">
                     <h4 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <Briefcase className="text-indigo-600" size={20} />
                        {t('planner.tab.expiringAssets', 'Asset Maturities Portfolio')}
                     </h4>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="relative">
                        <Search size={14} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                           type="text"
                           placeholder={t('planner.searchAssetsPlaceholder', 'Search expiring assets...')}
                           value={assetSearchQuery}
                           onChange={e => setAssetSearchQuery(e.target.value)}
                           className="pl-9 pr-4 py-2 bg-slate-100 border border-slate-205 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-800 w-64 transition-all"
                        />
                     </div>
                  </div>
               </div>

               {/* Table content */}
               <div className="flex-1 overflow-auto bg-slate-50 p-8">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                     {expiringAssets.filter(asset => {
                        const matchesSearch = asset.vehicle.toLowerCase().includes(assetSearchQuery.toLowerCase()) || asset.familyName.toLowerCase().includes(assetSearchQuery.toLowerCase());
                        const matchesUrgency = urgencyFilter === 'all' || asset.urgency === urgencyFilter;
                        return matchesSearch && matchesUrgency;
                     }).length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                              <Briefcase size={24} className="text-slate-300" />
                           </div>
                           <h4 className="font-bold text-slate-600 mb-1">No maturing assets found</h4>
                           <p className="text-xs text-slate-400 max-w-xs">Try adjusting your filters or search query.</p>
                        </div>
                     ) : (
                        <DataTable
                           data={expiringAssets.filter(asset => {
                              const matchesSearch = asset.vehicle.toLowerCase().includes(assetSearchQuery.toLowerCase()) || asset.familyName.toLowerCase().includes(assetSearchQuery.toLowerCase());
                              const matchesUrgency = urgencyFilter === 'all' || asset.urgency === urgencyFilter;
                              return matchesSearch && matchesUrgency;
                           })}
                           columns={[
                              {
                                 header: t('planner.expiring.vehicle', 'Investment Vehicle'),
                                 accessor: (asset: any) => (
                                    <div className="flex items-center gap-3">
                                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                          asset.urgency === 'critical' ? 'bg-red-500/10 text-red-500' : asset.urgency === 'imminent' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                                       }`}>
                                          <Briefcase size={16} />
                                       </div>
                                       <span className="font-semibold text-slate-800">{t(asset.vehicleKey, asset.vehicle)}</span>
                                    </div>
                                 )
                              },
                              {
                                 header: t('planner.expiring.family', 'Family / Client'),
                                 accessor: (asset: any) => (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-xs font-bold text-slate-600 border border-slate-200">
                                       <Network size={10} className="text-slate-400" />
                                       {asset.familyName}
                                    </span>
                                 )
                              },
                              {
                                 header: t('planner.expiring.amount', 'Amount'),
                                 accessor: (asset: any) => (
                                    <span className="font-bold text-slate-800 font-mono">
                                       {new Intl.NumberFormat('en-US', { style: 'currency', currency: asset.currency || 'USD' }).format(asset.amount)}
                                    </span>
                                 )
                              },
                              {
                                 header: t('planner.expiring.date', 'Maturity Date'),
                                 accessor: (asset: any) => (
                                    <span className="font-semibold text-slate-600">{format(new Date(asset.date), 'MMM d, yyyy')}</span>
                                 )
                              },
                              {
                                 header: t('planner.expiring.urgency', 'Urgency'),
                                 accessor: (asset: any) => {
                                    const colors = {
                                       critical: 'bg-red-50 text-red-700 border-red-150',
                                       imminent: 'bg-amber-50 text-amber-700 border-amber-150',
                                       planned: 'bg-blue-50 text-blue-700 border-blue-150'
                                    };
                                    return (
                                       <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${colors[asset.urgency as keyof typeof colors]}`}>
                                          {t(`planner.expiring.urgency.${asset.urgency}`, asset.urgency)}
                                       </span>
                                    );
                                 }
                              },
                              {
                                 header: t('planner.regulatory.status', 'Status'),
                                 accessor: (asset: any) => {
                                    const colors = {
                                       pending: 'bg-slate-100 text-slate-600 border-slate-200',
                                       processing: 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse',
                                       completed: 'bg-emerald-50 text-emerald-600 border-emerald-250'
                                    };
                                    return (
                                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${colors[asset.status as keyof typeof colors]}`}>
                                          {asset.status.toUpperCase()}
                                       </span>
                                    );
                                 }
                              },
                              {
                                 header: t('planner.expiring.actions', 'Actions'),
                                 className: 'text-right',
                                 accessor: (asset: any) => (
                                    <div className="flex gap-2 justify-end">
                                       {asset.status === 'pending' && (
                                          <button
                                             onClick={() => {
                                                setSelectedAssetForRenew(asset);
                                                setRenewAmount(asset.amount);
                                                setRenewOption('rollover_full');
                                                setRenewModalOpen(true);
                                             }}
                                             className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                          >
                                             {t('planner.expiring.renew', 'Renew')}
                                          </button>
                                       )}
                                       <button
                                          onClick={() => router.push('/cio-office/allocation')}
                                          className="text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-200"
                                       >
                                          {t('planner.expiring.rebalance', 'Rebalance')}
                                       </button>
                                       <button
                                          onClick={async () => {
                                             const reminderText = `Reminder: Expiring maturity on ${asset.vehicle} for ${asset.familyName} Family.`;
                                             await logActivityToFirestore(`Reminder: ${asset.vehicle}`, reminderText, asset.familyName);
                                             toast.success(t('planner.expiring.reminder', 'Reminder logged in activity.'));
                                          }}
                                          className="text-xs font-semibold text-slate-500 hover:text-indigo-600 p-1.5 rounded-lg transition-colors"
                                          title={t('planner.expiring.reminder', 'Create Reminder')}
                                       >
                                          <Clock size={14} />
                                       </button>
                                    </div>
                                 )
                              }
                           ]}
                        />
                     )}
                  </div>
               </div>
            </div>
         ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
               {/* Regulatory Expirations controls */}
               <div className="bg-white/95 border-b border-slate-200/60 px-8 py-3.5 flex items-center justify-between shrink-0 z-10 gap-4 shadow-sm">
                  <div className="flex flex-col">
                     <h4 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <ShieldAlert className="text-amber-500" size={20} />
                        {t('planner.tab.regulatory', 'Regulatory & Compliance Deadlines')}
                     </h4>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="relative">
                        <Search size={14} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                           type="text"
                           placeholder={t('planner.searchRegPlaceholder', 'Search regulatory obligations...')}
                           value={regSearchQuery}
                           onChange={e => setRegSearchQuery(e.target.value)}
                           className="pl-9 pr-4 py-2 bg-slate-100 border border-slate-205 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-800 w-64 transition-all"
                        />
                     </div>
                  </div>
               </div>

               {/* Table content */}
               <div className="flex-1 overflow-auto bg-slate-50 p-8">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                     {regulatoryObligations.filter(reg => {
                        const matchesSearch = reg.obligation.toLowerCase().includes(regSearchQuery.toLowerCase()) || reg.familyName.toLowerCase().includes(regSearchQuery.toLowerCase());
                        const matchesStatus = regStatusFilter === 'all' || reg.status === regStatusFilter;
                        return matchesSearch && matchesStatus;
                     }).length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                              <ShieldAlert size={24} className="text-slate-300" />
                           </div>
                           <h4 className="font-bold text-slate-600 mb-1">No regulatory deadlines found</h4>
                           <p className="text-xs text-slate-400 max-w-xs">Try adjusting your filters or search query.</p>
                        </div>
                     ) : (
                        <DataTable
                           data={regulatoryObligations.filter(reg => {
                              const matchesSearch = reg.obligation.toLowerCase().includes(regSearchQuery.toLowerCase()) || reg.familyName.toLowerCase().includes(regSearchQuery.toLowerCase());
                              const matchesStatus = regStatusFilter === 'all' || reg.status === regStatusFilter;
                              return matchesSearch && matchesStatus;
                           })}
                           columns={[
                              {
                                 header: t('planner.regulatory.obligation', 'Obligation / Document'),
                                 accessor: (reg: any) => (
                                    <div className="flex items-center gap-3">
                                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                          reg.status === 'expired' ? 'bg-red-500/10 text-red-500' : reg.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                                       }`}>
                                          <ShieldAlert size={16} />
                                       </div>
                                       <span className="font-semibold text-slate-800">{t(reg.obligationKey, reg.obligation)}</span>
                                    </div>
                                 )
                              },
                              {
                                 header: t('planner.regulatory.family', 'Family / Client'),
                                 accessor: (reg: any) => (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-xs font-bold text-slate-600 border border-slate-200">
                                       <Network size={10} className="text-slate-400" />
                                       {reg.familyName}
                                    </span>
                                 )
                              },
                              {
                                 header: t('planner.regulatory.deadline', 'Deadline'),
                                 accessor: (reg: any) => (
                                    <span className="font-semibold text-slate-600">{format(new Date(reg.deadline), 'MMM d, yyyy')}</span>
                                 )
                              },
                              {
                                 header: t('planner.regulatory.status', 'Status'),
                                 accessor: (reg: any) => {
                                    const colors = {
                                       expired: 'bg-red-50 text-red-700 border-red-150',
                                       warning: 'bg-amber-50 text-amber-700 border-amber-150',
                                       valid: 'bg-emerald-50 text-emerald-700 border-emerald-150'
                                    };
                                    return (
                                       <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${colors[reg.status as keyof typeof colors]}`}>
                                          {t(`planner.regulatory.status.${reg.status}`, reg.status)}
                                       </span>
                                    );
                                 }
                              },
                              {
                                 header: t('planner.expiring.actions', 'Actions'),
                                 className: 'text-right',
                                 accessor: (reg: any) => (
                                    <div className="flex gap-2 justify-end">
                                       {reg.isSuitability && reg.status !== 'valid' && (
                                          <button
                                             onClick={async () => {
                                                const requestText = `Suitability Profile Renewal requested for the ${reg.familyName} family.`;
                                                await logActivityToFirestore(`Suitability Request: ${reg.familyName}`, requestText, reg.familyName);
                                                
                                                // Update local state to simulate suitability request dispatch
                                                setRegulatoryObligations(prev => prev.map(o => o.id === reg.id ? { ...o, status: 'valid' } : o));
                                                
                                                toast.success(t('planner.regulatory.suitabilityRequestSent', 'Suitability update request sent to client.'));
                                             }}
                                             className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                          >
                                             {t('planner.regulatory.renewSuitability', 'Request Suitability')}
                                          </button>
                                       )}
                                       <button
                                          onClick={() => {
                                             if (reg.familyId) {
                                                router.push(`/families/${reg.familyId}`);
                                             } else {
                                                router.push('/families');
                                             }
                                          }}
                                          className="text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-200"
                                       >
                                          {t('planner.regulatory.viewDetails', 'View Details')}
                                       </button>
                                    </div>
                                 )
                              }
                           ]}
                        />
                     )}
                  </div>
               </div>
            </div>
         )}
      </div>

      {/* RENEW / REINVEST CONFIRMATION MODAL */}
      {renewModalOpen && selectedAssetForRenew && (
         <div className="fixed inset-0 z-[200] flex items-center justify-center font-sans p-4">
            <div onClick={() => setRenewModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer animate-in fade-in duration-205" />
            <div className="relative bg-white border border-slate-200 rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] w-full max-w-md p-6 animate-in zoom-in-95 duration-205">
               <button onClick={() => setRenewModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 transition-all">
                  <X size={16} />
               </button>
               <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Briefcase className="text-indigo-600" size={20} />
                  {t('planner.expiring.renewConfirm', 'Execute Renewal Request')}
               </h3>
               <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  {t('planner.expiring.renewConfirmDesc', 'Are you sure you want to request a renewal for this asset? The client will be notified.')}
               </p>

               <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-4 mb-5 text-sm space-y-2">
                  <div className="flex justify-between">
                     <span className="text-slate-400">{t('planner.expiring.vehicle', 'Asset')}</span>
                     <span className="font-semibold text-slate-700">{t(selectedAssetForRenew.vehicleKey, selectedAssetForRenew.vehicle)}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-slate-400">{t('planner.regulatory.family', 'Family')}</span>
                     <span className="font-semibold text-slate-700">{selectedAssetForRenew.familyName}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-slate-400">{t('planner.expiring.date', 'Maturity Date')}</span>
                     <span className="font-semibold text-slate-700">{format(new Date(selectedAssetForRenew.date), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-slate-400">{t('planner.expiring.amount', 'Total Value')}</span>
                     <span className="font-bold text-emerald-600 font-mono">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedAssetForRenew.currency || 'USD' }).format(selectedAssetForRenew.amount)}
                     </span>
                  </div>
               </div>

               <div className="space-y-4 mb-6">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">{t('planner.expiring.renew.selectOption', 'Select Rollover Option')}</label>
                  <div className="grid grid-cols-3 gap-2">
                     {[
                        { id: 'rollover_full', label: t('planner.expiring.renew.rolloverFull', '100% Rollover') },
                        { id: 'rollover_partial', label: t('planner.expiring.renew.rolloverPartial', 'Custom Amount') },
                        { id: 'cashout', label: t('planner.expiring.renew.cashout', 'Cash Out') }
                     ].map(opt => (
                        <button
                           key={opt.id}
                           type="button"
                           onClick={() => {
                              setRenewOption(opt.id as any);
                              if (opt.id === 'rollover_full') setRenewAmount(selectedAssetForRenew.amount);
                              else if (opt.id === 'cashout') setRenewAmount(0);
                           }}
                           className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${renewOption === opt.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                           {opt.label}
                        </button>
                     ))}
                  </div>

                  {renewOption === 'rollover_partial' && (
                     <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">{t('planner.expiring.renew.rolloverPartial', 'Custom Amount')} ({selectedAssetForRenew.currency})</label>
                        <input
                           type="number"
                           value={renewAmount}
                           onChange={(e) => setRenewAmount(Number(e.target.value))}
                           className="w-full px-3 py-2 border border-slate-250 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                           placeholder="Enter amount"
                           max={selectedAssetForRenew.amount}
                        />
                     </div>
                  )}
               </div>

               <div className="flex gap-3">
                  <button
                     onClick={() => setRenewModalOpen(false)}
                     className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                  >
                     {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                     onClick={async () => {
                        setRenewExecuting(true);
                        try {
                           const vehicleName = t(selectedAssetForRenew.vehicleKey, selectedAssetForRenew.vehicle);
                           const mockActivityText = `Requested rollover renewal for asset "${vehicleName}" (${renewOption === 'rollover_full' ? 'Full Rollover' : renewOption === 'cashout' ? 'Cash Out' : `Partial Rollover of ${renewAmount}`})`;
                           await logActivityToFirestore(`Rollover Request: ${vehicleName}`, mockActivityText, selectedAssetForRenew.familyName);
                           
                           setExpiringAssets(prev => prev.map(a => a.id === selectedAssetForRenew.id ? { ...a, status: 'processing' } : a));
                           
                           toast.success(t('planner.expiring.renewSuccess', 'Asset renewal request submitted successfully.'));
                           setRenewModalOpen(false);
                        } catch (err) {
                           toast.error('Failed to execute renewal request.');
                        } finally {
                           setRenewExecuting(false);
                        }
                      }}
                     disabled={renewExecuting}
                     className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-750 text-white shadow-lg shadow-indigo-100 hover:shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                     {renewExecuting ? 'Executing...' : t('common.confirm', 'Confirm')}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Sync Composer rendering */}
      {isComposerOpen && (
         <EventComposer 
            isOpen={isComposerOpen} 
            onClose={() => setIsComposerOpen(false)} 
            eventToEdit={eventToEdit}
            selectedDate={composerDate}
            provider={activeProvider || 'microsoft'}
            onSaved={() => {
               mutate();
            }}
         />
      )}
    </div>
  );
}
