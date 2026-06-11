import {
  APP_LOCALES,
  LOCALE_LABELS,
  createLocaleProvider,
  updateFarmerPreferredLanguage,
  type AppLocale,
} from '@morbeez/shared';

export const { LocaleProvider, useLocale } = createLocaleProvider({
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
