import { en, type I18nKey } from './en';
import { hi } from './hi';
import { ml } from './ml';
import { ta } from './ta';
import { kn } from './kn';
import { APP_LOCALES, KEEP_ENGLISH_KEYS, LOCALE_LABELS, type AppLocale } from './locales';
import { getRuntimeOverlay, isRuntimeKeepEnglish } from './language-pack';

export type { AppLocale, I18nKey };
export { APP_LOCALES, KEEP_ENGLISH_KEYS, LOCALE_LABELS, isAppLocale } from './locales';
export { en } from './en';
export type { I18nAppScope, LanguagePack } from './language-pack';
export { applyLanguagePack, fetchLanguagePack, refreshLanguagePack } from './language-pack';
export { loadCachedLanguagePack, storeLanguagePack, syncLanguagePack } from './language-pack-cache';

const strings: Record<AppLocale, Partial<Record<I18nKey, string>>> = {
  en,
  hi,
  ml,
  ta,
  kn,
};

/** Farmer-friendly UI label for key + locale. Bundled strings + server pack overlay. */
export function t(key: I18nKey | string, locale: AppLocale = 'en'): string {
  const k = key as I18nKey;
  const overlay = getRuntimeOverlay(locale)?.[key];
  if (overlay) return overlay;

  if (locale === 'en' || KEEP_ENGLISH_KEYS.has(key) || isRuntimeKeepEnglish(key)) {
    return en[k] ?? key;
  }
  return strings[locale][k] ?? en[k] ?? key;
}

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

export { createLocaleProvider } from './locale-context';
export type { LocaleState, LocaleProviderOptions } from './locale-context';
