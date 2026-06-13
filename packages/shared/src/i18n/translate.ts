import { en, type I18nKey } from './en';
import { hi } from './hi';
import { ml } from './ml';
import { ta } from './ta';
import { kn } from './kn';
import { APP_LOCALES, KEEP_ENGLISH_KEYS, LOCALE_LABELS, type AppLocale } from './locales';
import { getRuntimeOverlay, isRuntimeKeepEnglish } from './language-pack';

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

export { APP_LOCALES, KEEP_ENGLISH_KEYS, LOCALE_LABELS, type AppLocale, type I18nKey };
