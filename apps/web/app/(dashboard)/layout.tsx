'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

// Core Contexts & Services
import { firebaseApp } from '@mfo-crm/config';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { useTheme, PRESET_THEMES, FONTS } from '@/lib/ThemeContext';
import { getVerticalNav, DEFAULT_VERTICAL, type IndustryVerticalId } from '@/lib/verticalRegistry';
import { useTranslation } from '@/lib/i18n/context';
import { useTaskQueue } from '@/lib/TaskQueueContext';
import { usePageTitle } from '@/lib/PageTitleContext';

import { NotificationPanel } from '@/components/NotificationPanel';
import { TenantSwitcher } from '@/components/Header';
import { Ticker } from '@/components/Ticker';
import { AgendaTab } from '@/components/AgendaTab';
import { Avatar } from '@/components/Avatar';
import { CommunicationsHub } from '@/components/CommunicationsHub';
import { DocumentVault } from '@/components/DocumentVault';
import { ThemeCustomizer } from '@/components/ThemeCustomizer';
import { GlobalTimeLogger } from '@/components/GlobalTimeLogger';

// Lucide React Iconography (Premium Tech/Finance Vibe)
import {
  LayoutDashboard, Mail, Bot, Users, MessageSquare, CheckSquare, Calendar, TrendingUp, LineChart, FolderOpen, ShieldCheck, Briefcase, FileText, Target, Building2, Search, Receipt, Landmark, UserCog, Settings, Settings2, Database, Server, HardDrive, Tag, ChevronLeft, ChevronRight, ChevronDown, Fingerprint, Zap, Globe, Radar, History, Headset
} from 'lucide-react';

// ─── NAV DEFS ───────────────────────────────────────────────────────────────

const HREF_ICON_MAP: Record<string, any> = {
  '/dashboard': LayoutDashboard, '/inbox': Mail, '/copilot': Bot,
  '/relationships': Users, '/families': Users, '/clients': Users, '/contacts': Users,
  '/activities': MessageSquare, '/tasks': CheckSquare, '/tarefas': CheckSquare, '/calendar': Calendar,
  '/platform/support': Headset,
  '/portfolio': TrendingUp, '/financial-engineer': LineChart, '/documents': FolderOpen,
  '/reports': Radar, '/governance': ShieldCheck, '/estate': Briefcase,
  '/concierge': Briefcase, '/finance': Landmark, '/admin': Settings
};

const PLATFORM_NAV = [
  { section: 'Platform', items: [{ href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }, { href: '/communications', icon: MessageSquare, label: 'Communications' }, { href: '/reports', icon: Radar, label: 'Reports' }] },
  { section: 'Operations', items: [{ href: '/platform/tenants', icon: Building2, label: 'Tenants' }, { href: '/platform/crm', icon: Target, label: 'CRM' }, { href: '/tarefas', icon: CheckSquare, label: 'Tarefas' }, { href: '/platform/support', icon: Headset, label: 'Support Center' }, { href: '/platform/finance', icon: Landmark, label: 'Finance' }, { href: '/platform/hr', icon: Users, label: 'HR' }] },
  { section: 'Intelligence', items: [{ href: '/platform/analytics', icon: LineChart, label: 'Analytics' }, { href: '/copilot', icon: Bot, label: 'Co-Pilot' }] },
  { section: 'Engineering', items: [{ href: '/admin', icon: Settings2, label: 'Settings' }] },
];

function buildAutoCrumbs(pathname: string, overrides: Record<string, string> = {}) {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    const mappedLabel = overrides[seg] || overrides[acc] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
    crumbs.push({ label: mappedLabel, href: acc });
  }
  return crumbs;
}

// ─── SUSPENSION GUARD ──────────────────────────────────────────────────────────

function SuspensionGuard({ children }: { children: React.ReactNode }) {
  const { tenant, user, logout } = useAuth();
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    if (!tenant?.id || !user?.uid || tenant.isInternal) return;

    const db = getFirestore(firebaseApp);
    const unsub = onSnapshot(doc(db, 'tenants', tenant.id, 'members', user.uid), snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'suspended') {
          setSuspended(true);
        } else {
          setSuspended(false);
        }
      }
    });

    return unsub;
  }, [tenant?.id, user?.uid]);

  if (suspended) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[var(--bg-background)]/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-600" />
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-red-500/5">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-xl font-extrabold text-[var(--text-primary)] mb-2 tracking-tight">Access Suspended</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-8">
            Your access to this workspace has been temporarily suspended. Please contact your tenant administrator for reinstatement.
          </p>
          <button 
            onClick={() => {
              logout().then(() => {
                window.location.href = '/login';
              });
            }}
            className="w-full bg-[var(--brand-primary)] text-white font-bold py-3 px-4 rounded-xl hover:bg-[var(--brand-emphasis)] transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 tracking-wide text-[13px] uppercase tracking-wider"
          >
            Acknowledge & Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── MAIN BOXED LAYOUT COMPONENT ─────────────────────────────────────────────

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { tenant, isAuthenticated, isHydrated, stage, user, logout } = useAuth();
  const { companyLogoSmall } = useTheme();
  const { title, crumbs: contextCrumbs, crumbOverrides } = usePageTitle() as any;
  const { unreadCount } = useTaskQueue();
  const pathname = usePathname();
  const router = useRouter();

  // Boxed UI State
  const [leftWidth, setLeftWidth] = useState(260); // Sidebar (160 - 400px)
  const [rightWidth, setRightWidth] = useState(320); // Intelligence (200 - 500px)
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // Widget States
  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({});
  const [activeOpsTab, setActiveOpsTab] = useState<'comms' | 'vault' | 'agenda' | 'tasks'>('comms');
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Auth routing locks
  useEffect(() => {
    if (!isHydrated) return;
    if (stage === 'unauthenticated') router.push('/login');
    if (stage === 'needs_setup') router.push('/setup');
    if (stage === 'select_tenant') router.push('/select-tenant');
  }, [isHydrated, stage, router]);

  // Handle Resize Physics
  const startResizeLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
    if (leftCollapsed) setLeftCollapsed(false);
    const startX = e.clientX;
    const startW = leftWidth;
    const onMove = (me: MouseEvent) => setLeftWidth(Math.max(160, Math.min(400, startW + (me.clientX - startX))));
    const onUp = () => { setIsResizingLeft(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startResizeRight = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
    if (rightCollapsed) setRightCollapsed(false);
    const startX = e.clientX;
    const startW = rightWidth;
    const onMove = (me: MouseEvent) => setRightWidth(Math.max(200, Math.min(500, startW - (me.clientX - startX))));
    const onUp = () => { setIsResizingRight(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Build Nav
  const nav = useMemo(() => {
    if (tenant?.isInternal) return PLATFORM_NAV;
    const verticalId = (tenant as any)?.industryVertical as IndustryVerticalId | undefined;
    return getVerticalNav(verticalId ?? DEFAULT_VERTICAL).map(s => ({
      section: s.section,
      items: s.items.map((i: any) => ({
        href: i.href, icon: HREF_ICON_MAP[i.href] ?? LayoutDashboard, label: i.label ?? i.labelKey, subItems: i.subItems
      }))
    }));
  }, [tenant]);

  if (!isHydrated || stage === 'loading') return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#f8fafc]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-slate-400 font-bold text-[10px] tracking-widest uppercase">Initializing...</div>
      </div>
    </div>
  );

  // Global breadcrumb evaluation logic
  const autoCrumbs = buildAutoCrumbs(pathname || '', crumbOverrides || {});
  const resolvedCrumbs = [...autoCrumbs, ...(contextCrumbs || [])];
  const effectiveLeftW = leftCollapsed ? 64 : leftWidth;
  const effectiveRightW = rightCollapsed ? 64 : rightWidth;

  const PrimaryColor = '#004b44'; // Deep Emerald theme

  return (
    <>
    
    <div className="fixed inset-0 bg-[var(--bg-background)] flex font-sans font-medium text-[13px] z-0 overflow-hidden">
      
      {/* ─── COLUMN 1: SIDEBAR ─── */}
      <div style={{ width: effectiveLeftW }} className="flex flex-col shrink-0 bg-[var(--bg-surface)] text-[var(--text-primary)] transition-all duration-300 overflow-hidden border-r border-[var(--border-subtle)] z-10">
        {/* Col 1 Header (h-16) */}
        <div className="h-16 flex items-center justify-start px-4 shrink-0 border-b border-[var(--border-subtle)]">
          <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center bg-[#004b44] text-white shadow-sm font-bold text-sm">
            {tenant?.name?.[0] || 'M'}
          </div>
          {!leftCollapsed && (
             <div className="ml-3 flex flex-col min-w-0">
               <span className="truncate font-bold text-[14px] text-[var(--text-primary)] leading-tight">{tenant?.name ?? 'MFO Nexus'}</span>
               <span className="truncate text-[9.5px] font-bold uppercase tracking-widest text-[var(--brand-primary)]">{tenant?.isInternal ? 'Platform' : 'Terminal'}</span>
             </div>
          )}
        </div>

        {/* Col 1 Workspace/Nav (flex-1) */}
        <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-1">
          {nav.map(({ section, items }) => (
            <React.Fragment key={section}>
              {!leftCollapsed && <div className="px-3 pt-4 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)]">{section}</div>}
              {items.map((item: any) => {
                const isDashboard = item.href === '/dashboard';
                // Active if direct match OR if a subItem is active OR if the pathname starts with one of the hrefs
                const childActive = item.subItems?.some((si: any) => pathname === si.href || pathname.startsWith(si.href + '/'));
                const active = pathname === item.href || (!isDashboard && pathname.startsWith(item.href + '/')) || childActive;
                
                const IconLine = item.icon || LayoutDashboard;
                const hasSub = item.subItems && item.subItems.length > 0;
                // Auto-expand if active, otherwise use state
                const isExpanded = expandedNav[item.href] ?? active;

                const toggleSub = (e: React.MouseEvent) => {
                  e.preventDefault();
                  if (leftCollapsed) {
                    setLeftCollapsed(false);
                    setExpandedNav(prev => ({ ...prev, [item.href]: true }));
                  } else {
                    setExpandedNav(prev => ({ ...prev, [item.href]: !isExpanded }));
                  }
                };

                return (
                  <div key={item.href} className="flex flex-col gap-[2px]">
                    {hasSub ? (
                      <button onClick={toggleSub} className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${active ? 'bg-[var(--brand-faint)] text-[var(--brand-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'}`} title={leftCollapsed ? item.label : undefined}>
                        <div className="flex items-center gap-3 truncate">
                          <IconLine size={16} strokeWidth={active ? 2.5 : 1.8} className="shrink-0" />
                          {!leftCollapsed && <span className={`truncate flex-1 text-left ${active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>}
                        </div>
                        {!leftCollapsed && (
                          <span className="shrink-0 text-current opacity-50">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                        )}
                      </button>
                    ) : (
                      <Link href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${active ? 'bg-[var(--brand-faint)] text-[var(--brand-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'}`} title={leftCollapsed ? item.label : undefined}>
                        <IconLine size={16} strokeWidth={active ? 2.5 : 1.8} className="shrink-0" />
                        {!leftCollapsed && <span className={`truncate flex-1 ${active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>}
                      </Link>
                    )}

                    {hasSub && isExpanded && !leftCollapsed && (
                      <div className="flex flex-col gap-1 pl-[38px] pr-2 pt-1 pb-1 animate-fade-in">
                        {item.subItems.map((sub: any) => {
                          const subActive = pathname === sub.href || pathname.startsWith(sub.href + '/');
                          return (
                            <Link key={sub.href} href={sub.href} className={`flex items-center px-3 py-1.5 rounded-md text-[12px] transition-colors ${subActive ? 'bg-[var(--brand-faint)] text-[var(--brand-primary)] font-bold shadow-sm ring-1 ring-[var(--brand-primary)]/10' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)] font-medium border border-transparent'}`}>
                              <span className="truncate">{sub.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* Col 1 Footer Dock (h-9) */}
        <div className="h-9 flex items-center shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] justify-center">
          <button onClick={() => setLeftCollapsed(!leftCollapsed)} className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] transition-colors">
            {leftCollapsed ? <ChevronRight size={14} /> : <div className="flex items-center gap-2"><ChevronLeft size={14} /><span className="text-[11px] font-bold">Collapse</span></div>}
          </button>
        </div>
      </div>

      {/* ─── RESIZER 1 ─── */}
      <div className="w-[4px] group relative flex flex-col justify-center cursor-col-resize shrink-0 z-50 hover:bg-[var(--brand-muted)] transition-colors" onMouseDown={startResizeLeft}>
        <div className={`absolute inset-y-0 right-0 w-[1px] transition-all ${isResizingLeft ? 'bg-[var(--brand-primary)]' : 'bg-transparent group-hover:bg-[var(--brand-primary)]'}`}></div>
        <button
          onClick={(e) => { e.stopPropagation(); setLeftCollapsed(!leftCollapsed); }}
          className="absolute -right-[10px] top-1/2 -translate-y-1/2 w-[20px] h-[40px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--brand-primary)] hover:border-[var(--brand-muted)] shadow-sm z-[60] transition-all cursor-pointer"
          title={leftCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {leftCollapsed ? <ChevronRight size={12} strokeWidth={2.5} /> : <ChevronLeft size={12} strokeWidth={2.5} />}
        </button>
      </div>

      {/* ─── COLUMN 2: WORKSPACE ─── */}
      <div className="flex-1 flex flex-col shrink min-w-0 bg-[var(--bg-surface)] text-[var(--text-primary)] z-20 overflow-hidden">
        {/* Col 2 Header (h-16) */}
        <div className="h-16 flex items-center px-6 shrink-0 border-b border-[var(--border-subtle)] justify-between">
           {/* Breadcrumbs */}
           <div className="flex items-center gap-2 max-w-lg truncate">
             {resolvedCrumbs.map((c: any, i: number) => (
               <React.Fragment key={i}>
                 {i > 0 && <span className="text-[var(--text-tertiary)] opacity-30 flex items-center">{c.separator || '/'}</span>}
                 {c.href ? (
                   <Link href={c.href} className="text-[var(--text-tertiary)] font-medium hover:text-[var(--brand-primary)] transition-colors flex items-center gap-1.5">
                     {c.icon && c.icon}
                     {c.label}
                   </Link>
                 ) : c.onClick ? (
                   <button onClick={c.onClick} className="text-[var(--text-tertiary)] font-medium hover:text-[var(--brand-primary)] transition-colors flex items-center gap-1.5 cursor-pointer">
                     {c.icon && c.icon}
                     {c.label}
                   </button>
                 ) : (
                   <span className={`flex items-center gap-1.5 ${i === resolvedCrumbs.length - 1 ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] font-medium'}`}>
                     {c.icon && c.icon}
                     {c.label}
                   </span>
                 )}
               </React.Fragment>
             ))}
           </div>
           
           {/* Controls */}
           <div className="flex items-center gap-3 shrink-0">
             <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-secondary)] hover:border-[var(--border-strong)] cursor-pointer transition-colors w-48">
               <Search size={14} />
               <input placeholder="Terminal Search..." className="bg-transparent border-none outline-none text-[12px] text-[var(--text-primary)] w-full" readOnly />
               <span className="text-[9px] font-bold bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-1 py-0.5 rounded shadow-sm text-[var(--text-secondary)]">⌘K</span>
             </div>

             <GlobalTimeLogger />

             <div className="relative">
               <button onClick={() => setNotifOpen(!notifOpen)} className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-faint)] hover:border-[var(--brand-muted)] transition-all">
                  <Globe size={16} />
                  {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 shadow-sm border border-[var(--bg-surface)]"></span>}
               </button>
               {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
             </div>

             <TenantSwitcher />

             <div className="relative">
               <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg cursor-pointer hover:bg-[var(--bg-muted)] transition-colors">
                  <Avatar id={`u-${user?.id}`} name={user?.name} size="sm" />
               </button>
               {menuOpen && (
                 <div className="absolute top-14 right-2 w-48 bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-lg rounded-xl p-2 flex flex-col z-50 animate-fade-in text-[var(--text-primary)]">
                   <div className="px-2 pb-2 mb-2 border-b border-[var(--border-subtle)]">
                     <div className="font-bold">{user?.name}</div>
                     <div className="text-[11px] text-[var(--text-secondary)]">{user?.email}</div>
                   </div>
                   <button onClick={() => { setMenuOpen(false); router.push('/settings'); }} className="text-left px-2 py-1.5 hover:bg-[var(--bg-elevated)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium flex gap-2"><Settings size={14}/> Settings</button>
                   <button onClick={() => logout()} className="text-left px-2 py-1.5 hover:bg-red-50 text-red-600 rounded font-medium flex gap-2 mt-1"><Zap size={14}/> Sign Out</button>
                 </div>
               )}
             </div>
           </div>
        </div>

        {/* Col 2 Workspace Boxed Content (flex-1) */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[var(--bg-surface)] relative">
           {children}
        </div>

        {/* Action Dock (h-11) */}
        <div className="h-11 shrink-0 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] flex items-center justify-between">
           <div className="flex items-center w-full h-full">
              <div className="flex-1 overflow-hidden h-full"><Ticker /></div>
           </div>
        </div>

        {/* Base Dock (h-9) */}
        <div className="h-9 shrink-0 bg-[var(--bg-muted)] border-t border-[var(--border-subtle)] px-4 flex items-center justify-between text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-widest z-10">
           <div className="flex items-center gap-2"><Fingerprint size={12} className="text-[var(--brand-emphasis)]" /> Terminal Secured</div>
           <div>System Status <span className="text-[var(--brand-primary)] ml-1">● Online</span></div>
        </div>
      </div>

      {/* ─── RESIZER 2 ─── */}
      <div className="w-[4px] group relative flex flex-col justify-center cursor-col-resize shrink-0 z-50 hover:bg-[var(--brand-muted)] transition-colors" onMouseDown={startResizeRight}>
        <div className={`absolute inset-y-0 left-0 w-[1px] transition-all ${isResizingRight ? 'bg-[var(--brand-primary)]' : 'bg-transparent group-hover:bg-[var(--brand-primary)]'}`}></div>
        <button
          onClick={(e) => { e.stopPropagation(); setRightCollapsed(!rightCollapsed); }}
          className="absolute -left-[10px] top-1/2 -translate-y-1/2 w-[20px] h-[40px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--brand-primary)] hover:border-[var(--brand-muted)] shadow-sm z-[60] transition-all cursor-pointer"
          title={rightCollapsed ? "Expand Intelligence" : "Collapse Intelligence"}
        >
          {rightCollapsed ? <ChevronLeft size={12} strokeWidth={2.5} /> : <ChevronRight size={12} strokeWidth={2.5} />}
        </button>
      </div>

      {/* ─── COLUMN 3: INTELLIGENCE ─── */}
      <div style={{ width: effectiveRightW }} className="flex flex-col shrink-0 bg-[var(--bg-surface)] text-[var(--text-primary)] transition-all duration-300 overflow-hidden border-l border-[var(--border-subtle)] z-30">
        
        {/* Col 3 Header (h-16) - Intelligence Tabs */}
        {!rightCollapsed ? (
          <div className="h-16 flex items-center px-2 shrink-0 border-b border-[var(--border-subtle)] gap-1 bg-[var(--bg-elevated)]">
             {[
               { id: 'comms',  icon: <MessageSquare size={14} />,  label: 'Comms' },
               { id: 'vault',  icon: <FolderOpen size={14} />,     label: 'Vault' },
               { id: 'agenda', icon: <Calendar size={14} />,       label: 'Agenda' },
               { id: 'tasks',  icon: <History size={14} />,        label: 'Logs' }
             ].map(tab => (
               <button key={tab.id} onClick={() => setActiveOpsTab(tab.id as any)} className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-all ${activeOpsTab === tab.id ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--brand-primary)] font-bold border border-[var(--border-subtle)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] font-medium'}`}>
                  {tab.icon}
                  <span className="text-[9px] uppercase tracking-wider">{tab.label}</span>
               </button>
             ))}
          </div>
        ) : (
          <div className="h-16 flex items-center shrink-0 border-b border-[var(--border-subtle)] justify-center bg-[var(--bg-elevated)]">
             <Bot size={18} className="text-[var(--brand-emphasis)]" />
          </div>
        )}

        {/* Col 3 Workspace (flex-1) */}
        {!rightCollapsed ? (
          <div className="flex-1 overflow-y-auto bg-[var(--bg-background)] relative">
             <div className="absolute inset-0">
                {activeOpsTab === 'comms' && <div className="p-3"><CommunicationsHub /></div>}
                {activeOpsTab === 'vault' && <div className="p-3"><DocumentVault /></div>}
                {activeOpsTab === 'agenda' && <div className="p-3"><AgendaTab /></div>}
                {activeOpsTab === 'tasks' && (
                  <div className="p-6 text-center text-[var(--text-tertiary)] text-xs">
                     <History size={24} className="mx-auto mb-2 opacity-50" />
                     All caught up. Terminal logs clean.
                  </div>
                )}
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center pt-4 gap-4 bg-[var(--bg-background)]">
             <button onClick={() => {setRightCollapsed(false); setActiveOpsTab('comms');}} className="w-8 h-8 flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-tertiary)] hover:text-[var(--brand-primary)] shadow-sm"><MessageSquare size={14}/></button>
             <button onClick={() => {setRightCollapsed(false); setActiveOpsTab('vault');}} className="w-8 h-8 flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-tertiary)] hover:text-[var(--brand-primary)] shadow-sm"><FolderOpen size={14}/></button>
             <button onClick={() => {setRightCollapsed(false); setActiveOpsTab('agenda');}} className="w-8 h-8 flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-tertiary)] hover:text-[var(--brand-primary)] shadow-sm"><Calendar size={14}/></button>
             <button onClick={() => {setRightCollapsed(false); setActiveOpsTab('tasks');}} className="w-8 h-8 flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-tertiary)] hover:text-[var(--brand-primary)] shadow-sm"><History size={14}/></button>
          </div>
        )}

        {/* Col 3 Footer Dock (h-9) */}
        <div className="h-9 flex items-center shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] justify-center">
          <button onClick={() => setRightCollapsed(!rightCollapsed)} className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] transition-colors">
            {rightCollapsed ? <ChevronLeft size={14} /> : <div className="flex items-center gap-2"><span className="text-[11px] font-bold">Collapse</span><ChevronRight size={14} /></div>}
          </button>
        </div>
      </div>
      
      <ThemeCustomizer />
    </div>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuspensionGuard>
      <DashboardInner>{children}</DashboardInner>
    </SuspensionGuard>
  );
}
