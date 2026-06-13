import type { AppLocale } from './locales';
import type { I18nKey } from './en';

export type { AppLocale, I18nKey };
export { APP_LOCALES, KEEP_ENGLISH_KEYS, LOCALE_LABELS, isAppLocale } from './locales';
export { en } from './en';
export type { I18nAppScope, LanguagePack } from './language-pack';
export { applyLanguagePack, fetchLanguagePack, refreshLanguagePack } from './language-pack';
export { loadCachedLanguagePack, storeLanguagePack, syncLanguagePack } from './language-pack-cache';
export { t } from './translate';

export function formatDateInLocale(date: string | Date, locale: AppLocale = 'en'): string {
  const loc =
    locale === 'hi'
      ? 'hi-IN'
      : locale === 'ml'
        ? 'ml-IN'
        : locale === 'ta'
          ? 'ta-IN'
          : locale === 'kn'
            ? 'kn-IN'
            : 'en-IN';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
}

export type { LocaleState, LocaleProviderOptions } from './locale-context';
export { createLocaleProvider } from './locale-context';
