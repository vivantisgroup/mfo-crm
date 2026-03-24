'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface BreadcrumbCrumb {
  label: string;
  onClick?: () => void;
}

interface PageTitleContextType {
  title: string;
  subtitle?: string;
  crumbs: BreadcrumbCrumb[];
  setTitle: (title: string, subtitle?: string) => void;
  setCrumbs: (crumbs: BreadcrumbCrumb[]) => void;
}

const PageTitleContext = createContext<PageTitleContextType>({
  title: '',
  subtitle: undefined,
  crumbs: [],
  setTitle: () => {},
  setCrumbs: () => {},
});

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title,    setTitleState]    = useState('');
  const [subtitle, setSubtitleState] = useState<string | undefined>(undefined);
  const [crumbs,   setCrumbsState]   = useState<BreadcrumbCrumb[]>([]);

  const setTitle = useCallback((t: string, s?: string) => {
    setTitleState(t);
    setSubtitleState(s);
    setCrumbsState([]); // reset crumbs when title changes
  }, []);

  const setCrumbs = useCallback((c: BreadcrumbCrumb[]) => {
    setCrumbsState(c);
  }, []);

  return (
    <PageTitleContext.Provider value={{ title, subtitle, crumbs, setTitle, setCrumbs }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle(title?: string, subtitle?: string) {
  const ctx = useContext(PageTitleContext);

  React.useEffect(() => {
    if (title !== undefined) {
      ctx.setTitle(title, subtitle);
    }
    return () => {
      if (title !== undefined) {
        ctx.setTitle('', undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle]);

  return ctx;
}

/**
 * useBreadcrumb — call at the top of a sub-view to push crumbs to the header bar.
 * The crumbs are reset automatically when the component unmounts.
 *
 * Example:
 *   useBreadcrumb([{ label: 'Expenses', onClick: goList }, { label: 'New Expense' }]);
 */
export function useBreadcrumb(crumbs: BreadcrumbCrumb[]) {
  const { setCrumbs } = useContext(PageTitleContext);

  // Serialize to a stable string to prevent infinite effect loops
  const key = crumbs.map(c => c.label).join('|');

  React.useEffect(() => {
    setCrumbs(crumbs);
    return () => setCrumbs([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
