'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/context';
import { TranslationKey } from '@/lib/i18n/en';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

type NavItem = { href: string; icon: string; labelKey: TranslationKey; badge?: string };
type NavSection = { section: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    section: 'Main',
    items: [
      { href: '/dashboard',  icon: '◉', labelKey: 'nav.dashboard' },
      { href: '/inbox',      icon: '📬', labelKey: 'nav.inbox' as TranslationKey },
      { href: '/families',   icon: '👥', labelKey: 'nav.families' },
      { href: '/activities', icon: '💬', labelKey: 'nav.activities', badge: '5' },
      { href: '/tasks',      icon: '✓',  labelKey: 'nav.tasks',      badge: '5' },
      { href: '/calendar',   icon: '📅', labelKey: 'nav.calendar' },
    ],
  },
  {
    section: 'Wealth',
    items: [
      { href: '/portfolio',  icon: '📊', labelKey: 'nav.portfolio' },
      { href: '/documents',  icon: '🗄', labelKey: 'nav.documents' },
      { href: '/reports',    icon: '📈', labelKey: 'nav.reports' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { href: '/governance', icon: '🏛', labelKey: 'nav.governance' },
      { href: '/estate',     icon: '⚖', labelKey: 'nav.estate' },
      { href: '/concierge',  icon: '🛎', labelKey: 'nav.concierge',    badge: '4' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { href: '/admin/users', icon: '👤', labelKey: 'nav.users' as TranslationKey },
      { href: '/admin',       icon: '⚙', labelKey: 'nav.admin' },
    ],
  },
];

interface SidebarProps { collapsed: boolean; toggle: () => void; }

export default function Sidebar({ collapsed, toggle }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { tenant } = useAuth();
  const { companyLogoSmall, theme } = useTheme();

  const filteredNav = useMemo(() => {
    if (!tenant?.isInternal) return NAV;
    
    // Internal (Platform Admin) Tenant — SaaS Management Suite
    return [
      {
        section: 'Platform',
        items: [
          { href: '/dashboard', icon: '◉', labelKey: 'nav.dashboard' as TranslationKey },
          { href: '/inbox',     icon: '📬', labelKey: 'nav.inbox'     as TranslationKey },
          { href: '/reports',   icon: '📈', labelKey: 'nav.reports'   as TranslationKey },
        ],
      },
      {
        section: 'SaaS Operations',
        items: [
          { href: '/platform/tenants',  icon: '🏢', labelKey: 'nav.tenants'  as TranslationKey },
          { href: '/platform/users',    icon: '👤', labelKey: 'nav.users'    as TranslationKey },
          { href: '/platform/plans',    icon: '📋', labelKey: 'nav.plans'    as TranslationKey },
          { href: '/platform/billing',  icon: '💳', labelKey: 'nav.billing'  as TranslationKey },
          { href: '/platform/renewals', icon: '🔁', labelKey: 'nav.renewals' as TranslationKey },
          { href: '/platform/expenses', icon: '💸', labelKey: 'nav.expenses' as TranslationKey },
          { href: '/platform/crm',      icon: '🎯', labelKey: 'nav.crm'      as TranslationKey },
          { href: '/platform/support',  icon: '🎫', labelKey: 'nav.support'  as TranslationKey, badge: '12' },
        ],
      },
      {
        section: 'Intelligence',
        items: [
          { href: '/platform/analytics', icon: '📊', labelKey: 'nav.analytics' as TranslationKey },
        ],
      },
      {
        section: 'Compliance',
        items: [
          { href: '/platform/audit', icon: '🔍', labelKey: 'nav.audit' as TranslationKey },
        ],
      },
      {
        section: 'Configuration',
        items: [
          { href: '/admin', icon: '⚙', labelKey: 'nav.admin' as TranslationKey },
        ],
      },
    ];
  }, [tenant]);

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} style={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}>
      {/* Logo */}
      <div className="sidebar-logo">
        {/* Logo mark / icon */}
        {companyLogoSmall
          ? <img src={companyLogoSmall} alt="logo" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', flexShrink: 0 }} />
          : <div
              className="sidebar-logo-mark"
              style={{ background: `linear-gradient(135deg, ${theme.vars['--brand-500']}, ${theme.vars['--brand-400']})`, color: 'white', fontWeight: 900, boxShadow: `0 0 15px ${theme.vars['--brand-500']}66` }}
            >
              {(tenant?.name ?? 'M')[0]}
            </div>
        }

        {!collapsed && (
          <div className="sidebar-logo-text">
            <div style={{ fontWeight: 900, letterSpacing: '0.05em', color: 'var(--text-primary)' }}>{tenant?.name ?? 'MFO Nexus'}</div>
            <div className="sidebar-logo-sub" style={{ fontSize: 9, letterSpacing: '0.15em', opacity: 0.5 }}>PLATFORM</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {filteredNav.map(({ section, items }) => (
          <React.Fragment key={section}>
            {!collapsed && <div className="nav-section-label">{section}</div>}
            {items.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              const translatedLabel = t(item.labelKey as any);
              return (
                <Link key={item.href} href={item.href} className={`nav-item${active ? ' active' : ''}`} title={collapsed ? translatedLabel : undefined}>
                  <span className="nav-item-icon">{item.icon}</span>
                  {!collapsed && <span className="nav-item-label">{translatedLabel}</span>}
                  {!collapsed && (item as any).badge && <span className="nav-badge">{(item as any).badge}</span>}
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
          <span className="nav-item-icon">{collapsed ? '▶' : '◀'}</span>
          {!collapsed && <span className="nav-item-label">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
