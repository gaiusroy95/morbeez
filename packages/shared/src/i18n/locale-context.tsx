import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import type { AppLocale } from './locales';
import { isAppLocale } from './locales';
import type { I18nAppScope } from './language-pack';
import { syncLanguagePack } from './language-pack-cache';

export type LocaleProviderOptions = {
  storageKey: string;
  /** App scope for server language pack (farmer, agronomist, warehouse). */
  appScope?: I18nAppScope;
  /** Called when user picks a language (e.g. sync to farmer profile). */
  onLocaleChange?: (locale: AppLocale) => void | Promise<void>;
  /** Initial locale from server profile on login. */
  initialLocale?: AppLocale | null;
};

export type LocaleState = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  ready: boolean;
};

export function createLocaleProvider(options: LocaleProviderOptions) {
  const LocaleContext = createContext<LocaleState | null>(null);

  function LocaleProvider({
    children,
    initialLocale: initialFromProps,
  }: {
    children: ReactNode;
    initialLocale?: AppLocale | null;
  }) {
    const [locale, setLocaleState] = useState<AppLocale>('en');
    const [ready, setReady] = useState(false);
    const resolvedInitial = initialFromProps ?? options.initialLocale;

    useEffect(() => {
      let cancelled = false;
      void (async () => {
        try {
          const stored = await SecureStore.getItemAsync(options.storageKey);
          let next: AppLocale = 'en';
          if (isAppLocale(stored)) {
            next = stored;
          } else if (isAppLocale(resolvedInitial ?? undefined)) {
            next = resolvedInitial!;
          }
          if (cancelled) return;
          setLocaleState(next);
          await syncLanguagePack({ locale: next, appScope: options.appScope });
        } catch {
          // Offline or API unavailable — bundled strings still work.
        } finally {
          if (!cancelled) setReady(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [resolvedInitial]);

    const setLocale = useCallback(
      (next: AppLocale) => {
        setLocaleState(next);
        void SecureStore.setItemAsync(options.storageKey, next);
        void syncLanguagePack({ locale: next, appScope: options.appScope });
        void options.onLocaleChange?.(next);
      },
      []
    );

    const value = useMemo(
      () => ({ locale, setLocale, ready }),
      [locale, setLocale, ready]
    );

    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
  }

  function useLocale(): LocaleState {
    const ctx = useContext(LocaleContext);
    if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
    return ctx;
  }

  return { LocaleProvider, useLocale };
}
