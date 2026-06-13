import { createLocaleProvider } from '@morbeez/shared';

export const { LocaleProvider, useLocale, useT } = createLocaleProvider({
  storageKey: 'morbeez_partner_locale',
  appScope: 'all',
});
