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
  MessageSquare, TrendingUp, Briefcase, Settings, UserCog,
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
  '/billing':            Receipt,
  '/engagements':        Briefcase,
  '/deadlines':          CheckSquare,
  '/admin/users':        UserCog,
  '/admin':              Settings,
};

// ─── Platform-Admin nav — Lucide icons ─────────────────────────────────────────

const PLATFORM_NAV: { section: string; items: { href: string; icon: LucideIcon; label: string; badge?: string }[] }[] = [
  {
    section: 'Platform',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/inbox',     icon: Inbox,            label: 'Inbox' },
      { href: '/reports',   icon: BarChart2,         label: 'Reports' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { href: '/platform/tenants',  icon: Building2,  label: 'Tenants' },
      { href: '/platform/crm',      icon: Target,      label: 'CRM' },
      { href: '/platform/support',  icon: Ticket,      label: 'Support', badge: '12' },
      { href: '/platform/expenses', icon: Receipt,     label: 'Expenses' },
      { href: '/platform/billing',  icon: DollarSign,  label: 'Revenue' },
      { href: '/platform/renewals', icon: RotateCcw,   label: 'Renewals' },
      { href: '/platform/plans',    icon: CreditCard,  label: 'Plans' },
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
      { href: '/platform/db-settings',      icon: Database,  label: 'DB Settings' },
      { href: '/platform/infrastructure',   icon: Server,    label: 'Infra' },
      { href: '/platform/catalog-explorer', icon: Search,    label: 'Catalog' },
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
      className={`sidebar${collapsed ? ' collapsed' : ''}`}
      style={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        {companyLogoSmall
          ? <img src={companyLogoSmall} alt="logo" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'contain', flexShrink: 0 }} />
          : <div
              className="sidebar-logo-mark"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}
            >
              {(tenant?.name ?? 'M')[0]}
            </div>
        }

        {!collapsed && (
          <div className="sidebar-logo-text">
            <div style={{ fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tenant?.name ?? 'MFO Nexus'}
            </div>
            <div className="sidebar-logo-sub" style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
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
                  <div key={item.href} style={{ display: 'flex', flexDirection: 'column' }}>
                    <button
                      onClick={() => setExpanded(p => ({ ...p, [item.href]: !isExpanded }))}
                      className={`nav-item${active ? ' active' : ''}`}
                      title={collapsed ? item.label : undefined}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    >
                      <span className="nav-item-icon">
                        <IconComponent size={16} strokeWidth={active ? 2.2 : 1.8} />
                      </span>
                      {!collapsed && (
                        <>
                          <span className="nav-item-label">{item.label}</span>
                          <span style={{ marginLeft: 'auto', display: 'flex', color: 'var(--text-tertiary)' }}>
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
                  className={`nav-item${active ? ' active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="nav-item-icon">
                    <IconComponent size={16} strokeWidth={active ? 2.2 : 1.8} />
                  </span>
                  {!collapsed && <span className="nav-item-label">{item.label}</span>}
                  {!collapsed && item.badge && <span className="nav-badge">{item.badge}</span>}
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
