'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { en, TranslationKey } from './en';
import { pt } from './pt';
import { useAuth } from '@/lib/AuthContext';

type LanguageCode = 'en-US' | 'pt-BR';

interface I18nContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en-US',
  setLanguage: () => {},
  t: (key) => en[key] || key,
});

const dictionaries = {
  'en-US': en,
  'pt-BR': pt,
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>('en-US');

  const { userProfile } = useAuth();
  
  useEffect(() => {
    // 1. Initial hydration from local storage
    const saved = localStorage.getItem('mfo_language') as LanguageCode;
    if (saved && (saved === 'en-US' || saved === 'pt-BR')) {
      setLanguage(saved);
    }
  }, []);

  useEffect(() => {
    // 2. Intelligent overlay: If the user logs in and their Firestore profile has a preferred language, use it.
    if (userProfile && (userProfile as any).language) {
       const profileLang = (userProfile as any).language;
       if (profileLang === 'en-US' || profileLang === 'pt-BR') {
          setLanguage(profileLang);
          localStorage.setItem('mfo_language', profileLang);
       }
    }
  }, [userProfile?.uid, (userProfile as any)?.language]);

  const handleSetLanguage = (lang: LanguageCode) => {
    setLanguage(lang);
    localStorage.setItem('mfo_language', lang);
  };

  const t = (key: TranslationKey): string => {
    const dict = dictionaries[language];
    return dict[key] || en[key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useTranslation = () => useContext(I18nContext);
