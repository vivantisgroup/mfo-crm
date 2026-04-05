'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { getVerticalNav, DEFAULT_VERTICAL } from '@/lib/verticalRegistry';
import type { IndustryVerticalId } from '@/lib/verticalRegistry';
import {
  LayoutDashboard, Inbox, BarChart2, Building2, Target,
  Ticket, Receipt, DollarSign, RotateCcw, CreditCard,
  LineChart, Bot, ShieldCheck, Settings2, Database,
  Server, Search, HardDrive, ChevronLeft, ChevronRight, ChevronDown,
  Mail, Users, Calendar, CheckSquare, FolderOpen, FileText,
  MessageSquare, TrendingUp, Briefcase, Settings, UserCog, Landmark, Tag, BookOpen,
  type LucideIcon,
} from 'lucide-react';

// ─── Href → Lucide icon map (used for vertical tenant navs) ────────────────────

const HREF_ICON_MAP: Record<string, LucideIcon> = {
  '/dashboard':          LayoutDashboard,
  '/inbox':              Mail,
  '/copilot':            Bot,
  '/families':           Users,
  '/clients':            Users,
  '/contacts':           Users,
  '/patients':           Users,
  '/activities':         MessageSquare,
  '/tasks':              CheckSquare,
  '/calendar':           Calendar,
  '/portfolio':          TrendingUp,
  '/financial-engineer': LineChart,
  '/documents':          FolderOpen,
  '/reports':            BarChart2,
  '/governance':         ShieldCheck,
  '/estate':             Briefcase,
  '/concierge':          Briefcase,
  '/cases':              Briefcase,
  '/contracts':          FileText,
  '/records':            FileText,
  '/prescriptions':      FileText,
  '/appointments':       Calendar,
  '/projects':           Briefcase,
  '/properties':         Building2,
  '/deals':              Target,
  '/listings':           Search,
  '/invoicing':          Receipt,
  '/finance':            Landmark,
  '/engagements':        Briefcase,
  '/deadlines':          CheckSquare,
  '/admin/users':        UserCog,
  '/admin':              Settings,
};

// ─── Platform-Admin nav — Lucide icons ─────────────────────────────────────────

const PLATFORM_NAV: { section: string; items: { href: string; icon: LucideIcon; label: string; badge?: string; subItems?: { href: string; label: string }[] }[] }[] = [
  {
    section: 'Platform',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/communications', icon: MessageSquare, label: 'Communications' },
      { href: '/reports',   icon: BarChart2,         label: 'Reports' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { href: '/platform/tenants',  icon: Building2,  label: 'Tenants' },
      { href: '/platform/crm',      icon: Target,      label: 'CRM' },
      { href: '/platform/support',  icon: Ticket,      label: 'Support' },
      { href: '/platform/finance',  icon: Landmark,    label: 'Finance' },
      { href: '/platform/hr',       icon: Users,       label: 'HR' },
      { href: '/platform/tags',     icon: Tag,         label: 'Tags' },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { href: '/platform/analytics', icon: LineChart, label: 'Analytics' },
      { href: '/copilot',            icon: Bot,        label: 'Co-Pilot' },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { href: '/platform/audit', icon: ShieldCheck, label: 'Compliance' },
      { href: '/platform/roles', icon: ShieldCheck,  label: 'Roles' },
    ],
  },
  {
    section: 'Engineering',
    items: [
      { href: '/admin',                     icon: Settings2, label: 'Settings' },
      { 
        href: '/platform/metadata',       
        icon: Database,  
        label: 'Metadata',
        subItems: [
          { href: '/platform/db-settings',      label: 'DB Settings' },
          { href: '/platform/catalog-explorer', label: 'Catalog' },
        ]
      },
      { href: '/platform/infrastructure',   icon: Server,    label: 'Infra' },
      { href: '/platform/backups',          icon: HardDrive, label: 'Backups' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface SidebarProps { collapsed: boolean; toggle: () => void; }

export default function Sidebar({ collapsed, toggle }: SidebarProps) {
  const pathname = usePathname();
  const { tenant } = useAuth();
  const { companyLogoSmall } = useTheme();
  
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const nav = useMemo(() => {
    if (tenant?.isInternal) return PLATFORM_NAV;
    const verticalId = (tenant as any)?.industryVertical as IndustryVerticalId | undefined;
    const verticalNav = getVerticalNav(verticalId ?? DEFAULT_VERTICAL);
    return verticalNav.map(section => ({
      section: section.section,
      items: section.items.map((item: any) => ({
        href:  item.href,
        icon:  HREF_ICON_MAP[item.href as string] ?? LayoutDashboard,
        label: item.label ?? item.labelKey,
        badge: item.badge,
        subItems: item.subItems,
      })),
    }));
  }, [tenant]);

  return (
    <aside
      className={`sidebar flex flex-col h-full bg-surface border-r border-border transition-all duration-300 z-40 ${collapsed ? 'w-[var(--sidebar-collapsed)]' : 'w-[var(--sidebar-width)]'}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0 overflow-hidden">
        {companyLogoSmall
          ? <img src={companyLogoSmall} alt="logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
          : <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[13px] text-white shrink-0 bg-gradient-to-br from-brand-500 to-brand-600 shadow-sm"
            >
              {(tenant?.name ?? 'M')[0]}
            </div>
        }

        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <div className="font-extrabold tracking-tight text-primary text-[13px] truncate">
              {tenant?.name ?? 'MFO Nexus'}
            </div>
            <div className="text-[9px] tracking-widest uppercase text-tertiary truncate">
              {tenant?.isInternal ? 'Platform' : ((tenant as any)?.industryVertical ?? 'Platform')}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {nav.map(({ section, items }) => (
          <React.Fragment key={section}>
            {!collapsed && <div className="nav-section-label">{section}</div>}
            {items.map((item: any) => {
              const hasSub = item.subItems && item.subItems.length > 0;
              const isChildActive = hasSub && item.subItems.some((s: any) => pathname === s.href || pathname.startsWith(s.href));
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)) || isChildActive;
              const isExpanded = expanded[item.href] || active;

              const IconComponent: LucideIcon = item.icon;
              
              if (hasSub) {
                return (
                  <div key={item.href} className="flex flex-col">
                    <button
                      onClick={() => setExpanded(p => ({ ...p, [item.href]: !isExpanded }))}
                      className={`nav-item flex items-center gap-2.5 px-3 py-2 rounded-md font-medium text-[13px] cursor-pointer text-left w-full transition-all duration-200 group hover:bg-elevated hover:text-primary ${active ? 'bg-surface text-primary font-semibold shadow-sm border border-border' : 'text-secondary border border-transparent'}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="shrink-0 flex items-center justify-center w-5 h-5">
                        <IconComponent size={16} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-brand-500" : "group-hover:text-primary"} />
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          <span className="ml-auto flex text-tertiary">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                        </>
                      )}
                    </button>
                    {!collapsed && isExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 2, marginBottom: 4 }}>
                        {item.subItems.map((s: any) => {
                          const subActive = pathname === s.href || pathname.startsWith(s.href);
                          return (
                            <Link
                              key={s.href}
                              href={s.href}
                              className={`nav-item${subActive ? ' active' : ''}`}
                              style={{ minHeight: 32 }}
                            >
                              <span className="nav-item-icon" style={{ opacity: 0.3 }}>
                                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                              </span>
                              <span className="nav-item-label" style={{ fontSize: 13, color: subActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                {s.label}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item flex items-center gap-2.5 px-3 py-2 rounded-md font-medium text-[13px] transition-all duration-200 group hover:bg-elevated hover:text-primary ${active ? 'bg-surface text-primary font-semibold shadow-sm border border-border' : 'text-secondary border border-transparent'}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="shrink-0 flex items-center justify-center w-5 h-5">
                    <IconComponent size={16} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-brand-500" : "group-hover:text-primary"} />
                  </span>
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!collapsed && item.badge && <span className="px-1.5 py-px rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shrink-0">{item.badge}</span>}
                </Link>
              );
            })}
          </React.Fragment>
        ))}
      </nav>



      {/* Footer */}
      <div className="sidebar-footer">
        <button
          onClick={toggle}
          className="nav-item"
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="nav-item-icon">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </span>
          {!collapsed && <span className="nav-item-label" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export function SidebarDock({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="sidebar-footer-dock">
      <button 
        title="AI Insights"
        className="hover-lift"
        style={{ width: '100%', height: '100%', background: 'var(--brand-900)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-600)', fontSize: '14px' }}
      >
        ✨ {!collapsed && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700 }}>Insights</span>}
      </button>
      <div style={{ width: 1, height: '16px', background: 'var(--border)' }} />
      <button 
        title="Automated Flows"
        className="hover-lift"
        style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-500)', fontSize: '14px' }}
      >
        ⚡ {!collapsed && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600 }}>Flows</span>}
      </button>
    </div>
  );
}

