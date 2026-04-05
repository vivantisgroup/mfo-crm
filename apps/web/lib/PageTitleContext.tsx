'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  separator?: React.ReactNode;
}

interface PageTitleContextType {
  title: string;
  subtitle?: string;
  crumbs?: BreadcrumbCrumb[];
  crumbOverrides: Record<string, string>;
  setTitle: (title: string, subtitle?: string, crumbs?: BreadcrumbCrumb[]) => void;
  setCrumbOverrides: (overrides: Record<string, string>) => void;
}

const PageTitleContext = createContext<PageTitleContextType>({
  title: '',
  subtitle: undefined,
  crumbs: undefined,
  crumbOverrides: {},
  setTitle: () => {},
  setCrumbOverrides: () => {},
});

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title,    setTitleState]    = useState('');
  const [subtitle, setSubtitleState] = useState<string | undefined>(undefined);
  const [crumbs,   setCrumbsState]   = useState<BreadcrumbCrumb[] | undefined>(undefined);
  const [crumbOverrides, setCrumbOverrides] = useState<Record<string, string>>({});

  const setTitle = useCallback((t: string, s?: string, c?: BreadcrumbCrumb[]) => {
    setTitleState(t);
    setSubtitleState(s);
    setCrumbsState(c);
  }, []);

  return (
    <PageTitleContext.Provider value={{ title, subtitle, crumbs, setTitle, crumbOverrides, setCrumbOverrides }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle(title?: string, subtitle?: string, crumbs?: BreadcrumbCrumb[]) {
  const ctx = useContext(PageTitleContext);

  React.useEffect(() => {
    if (title !== undefined) {
      ctx.setTitle(title, subtitle, crumbs);
    }
    return () => {
      if (title !== undefined) {
        ctx.setTitle('', undefined, undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, crumbs]);

  return ctx;
}

/**
 * [DEPRECATED] useBreadcrumb
 * The Breadcrumb pattern has been globally purged from the Antigravity OS framework.
 * This hook remains as a no-op simply to prevent immediate cascade build failures in legacy pages. 
 * Please do not implement this. UI context is now served exclusively through the SecondaryDock component.
 */
export function useBreadcrumb(crumbs?: any) {
  // Navigation crumbs have been eradicated.
}
