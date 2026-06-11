import { createLocaleProvider, APP_LOCALES, LOCALE_LABELS, type AppLocale } from '@morbeez/shared';

export const { LocaleProvider, useLocale } = createLocaleProvider({
  storageKey: 'morbeez_agronomist_locale',
  appScope: 'agronomist',
});

export { APP_LOCALES, LOCALE_LABELS };
export type { AppLocale };
