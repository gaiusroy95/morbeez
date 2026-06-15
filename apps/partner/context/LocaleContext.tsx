import { createLocaleProvider } from '@morbeez/shared/i18n/locale';

export const { LocaleProvider, useLocale, useT } = createLocaleProvider({
  storageKey: 'morbeez_partner_locale',
  appScope: 'all',
});
