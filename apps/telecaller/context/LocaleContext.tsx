import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from '@morbeez/shared';
import { createLocaleProvider } from '@morbeez/shared/i18n/locale';

export const { LocaleProvider, useLocale, useT } = createLocaleProvider({
  storageKey: 'morbeez_telecaller_locale',
  appScope: 'all',
});

export { APP_LOCALES, LOCALE_LABELS };
export type { AppLocale };
