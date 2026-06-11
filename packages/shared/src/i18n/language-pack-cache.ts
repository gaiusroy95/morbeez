import * as SecureStore from 'expo-secure-store';
import type { AppLocale } from './locales';
import type { I18nAppScope, LanguagePack } from './language-pack';
import { applyLanguagePack, fetchLanguagePack } from './language-pack';

function packStorageKey(locale: AppLocale, appScope: I18nAppScope): string {
  return `morbeez_i18n_pack_${appScope}_${locale}`;
}

function packVersionKey(locale: AppLocale, appScope: I18nAppScope): string {
  return `morbeez_i18n_pack_v_${appScope}_${locale}`;
}

export async function loadCachedLanguagePack(
  locale: AppLocale,
  appScope: I18nAppScope = 'all'
): Promise<{ version: number; pack: LanguagePack } | null> {
  try {
    const raw = await SecureStore.getItemAsync(packStorageKey(locale, appScope));
    const versionRaw = await SecureStore.getItemAsync(packVersionKey(locale, appScope));
    if (!raw || !versionRaw) return null;
    const pack = JSON.parse(raw) as LanguagePack;
    applyLanguagePack(pack);
    return { version: Number(versionRaw), pack };
  } catch {
    return null;
  }
}

export async function storeLanguagePack(pack: LanguagePack): Promise<void> {
  applyLanguagePack(pack);
  await SecureStore.setItemAsync(packStorageKey(pack.locale, pack.appScope), JSON.stringify(pack));
  await SecureStore.setItemAsync(packVersionKey(pack.locale, pack.appScope), String(pack.version));
}

/** Load cached pack first, then download from API if a newer pack exists. */
export async function syncLanguagePack(params: {
  locale: AppLocale;
  appScope?: I18nAppScope;
}): Promise<void> {
  const appScope = params.appScope ?? 'all';
  const cached = await loadCachedLanguagePack(params.locale, appScope);
  const pack = await fetchLanguagePack({
    locale: params.locale,
    appScope,
    cachedVersion: cached?.version,
  });
  if (pack) await storeLanguagePack(pack);
}
