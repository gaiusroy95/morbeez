import { t } from '@morbeez/shared';

describe('mockup i18n keys', () => {
  it('includes tab labels in all locales', () => {
    for (const locale of ['en', 'hi', 'ml', 'ta', 'kn'] as const) {
      expect(t('home', locale)).toBeTruthy();
      expect(t('market', locale)).toBeTruthy();
      expect(t('roi', locale)).toBeTruthy();
      expect(t('shop', locale)).toBeTruthy();
      expect(t('profile', locale)).toBeTruthy();
      expect(t('myFields', locale)).toBeTruthy();
    }
  });

  it('uses farmer-friendly Hindi for overview', () => {
    expect(t('overview', 'hi')).toBe('सारांश');
    expect(t('overview', 'hi')).not.toBe('अवलोकन');
  });

  it('keeps hybrid English terms in Hindi', () => {
    expect(t('roi', 'hi')).toBe('ROI');
    expect(t('dashboard', 'hi')).toBe('Dashboard');
    expect(t('followUp', 'hi')).toBe('Follow-up');
  });
});
