import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { AppLocale } from '@morbeez/shared';

const LOCALE_KEY = 'morbeez_farmer_locale';

type LocaleState = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
};

const LocaleContext = createContext<LocaleState | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('en');

  useEffect(() => {
    void SecureStore.getItemAsync(LOCALE_KEY).then((v) => {
      if (v === 'en' || v === 'hi') setLocaleState(v);
    });
  }, []);

  const setLocale = (next: AppLocale) => {
    setLocaleState(next);
    void SecureStore.setItemAsync(LOCALE_KEY, next);
  };

  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleState {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
