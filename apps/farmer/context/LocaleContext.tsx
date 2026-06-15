import {
  APP_LOCALES,
  LOCALE_LABELS,
  updateFarmerPreferredLanguage,
  type AppLocale,
} from '@morbeez/shared';
import { createLocaleProvider } from '@morbeez/shared/i18n/locale';

export const { LocaleProvider, useLocale, useT } = createLocaleProvider({
  storageKey: 'morbeez_farmer_locale',
  appScope: 'farmer',
  onLocaleChange: (locale) => {
    void updateFarmerPreferredLanguage(locale).catch(() => {
      /* offline — local preference still saved */
    });
  },
});

export { APP_LOCALES, LOCALE_LABELS };
export type { AppLocale };
