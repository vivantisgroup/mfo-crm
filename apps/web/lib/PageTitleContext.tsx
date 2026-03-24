'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface PageTitleContextType {
  title: string;
  subtitle?: string;
  setTitle: (title: string, subtitle?: string) => void;
}

const PageTitleContext = createContext<PageTitleContextType>({
  title: '',
  subtitle: undefined,
  setTitle: () => {},
});

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title,    setTitleState]    = useState('');
  const [subtitle, setSubtitleState] = useState<string | undefined>(undefined);

  const setTitle = useCallback((t: string, s?: string) => {
    setTitleState(t);
    setSubtitleState(s);
  }, []);

  return (
    <PageTitleContext.Provider value={{ title, subtitle, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle(title?: string, subtitle?: string) {
  const ctx = useContext(PageTitleContext);

  // When called WITH a title argument, register it on mount
  React.useEffect(() => {
    if (title !== undefined) {
      ctx.setTitle(title, subtitle);
    }
    // Cleanup: reset on unmount so next page starts fresh
    return () => {
      if (title !== undefined) {
        ctx.setTitle('', undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle]);

  return ctx;
}
