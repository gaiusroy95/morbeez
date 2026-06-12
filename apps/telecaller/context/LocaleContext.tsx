import { createLocaleProvider, APP_LOCALES, LOCALE_LABELS, type AppLocale } from '@morbeez/shared';

export const { LocaleProvider, useLocale } = createLocaleProvider({
  storageKey: 'morbeez_telecaller_locale',
  appScope: 'all',
});

export { APP_LOCALES, LOCALE_LABELS };
export type { AppLocale };
