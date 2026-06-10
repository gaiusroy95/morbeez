import { t } from '@morbeez/shared';

describe('mockup i18n keys', () => {
  it('includes tab labels in all locales', () => {
    for (const locale of ['en', 'hi', 'ml'] as const) {
      expect(t('home', locale)).toBeTruthy();
      expect(t('market', locale)).toBeTruthy();
      expect(t('roi', locale)).toBeTruthy();
      expect(t('shop', locale)).toBeTruthy();
      expect(t('profile', locale)).toBeTruthy();
      expect(t('myFields', locale)).toBeTruthy();
    }
  });
});
