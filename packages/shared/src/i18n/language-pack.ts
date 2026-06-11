import { resolveApiUrl } from '../api/config';
import type { AppLocale } from './locales';

export type I18nAppScope = 'all' | 'farmer' | 'agronomist' | 'warehouse';

export type LanguagePack = {
  version: number;
  locale: AppLocale;
  appScope: I18nAppScope;
  publishedAt?: string;
  strings: Record<string, string>;
  keepEnglish: string[];
};

type PackResponse =
  | { ok: true; unchanged: true; version: number; locale: AppLocale; appScope: I18nAppScope }
  | {
      ok: true;
      unchanged: false;
      version: number;
      locale: AppLocale;
      appScope: I18nAppScope;
      publishedAt?: string;
      strings: Record<string, string>;
      keepEnglish: string[];
    };

/** In-memory overlay from server packs (merged over bundled locale files). */
const runtimeOverlays: Partial<Record<AppLocale, Record<string, string>>> = {};
const runtimeKeepEnglish = new Set<string>();

export function getRuntimeOverlay(locale: AppLocale): Record<string, string> | undefined {
  return runtimeOverlays[locale];
}

export function applyLanguagePack(pack: LanguagePack): void {
  runtimeOverlays[pack.locale] = {
    ...(runtimeOverlays[pack.locale] ?? {}),
    ...pack.strings,
  };
  for (const key of pack.keepEnglish) {
    runtimeKeepEnglish.add(key);
  }
}

export function isRuntimeKeepEnglish(key: string): boolean {
  return runtimeKeepEnglish.has(key);
}

export async function fetchLanguagePack(params: {
  locale: AppLocale;
  appScope?: I18nAppScope;
  cachedVersion?: number;
}): Promise<LanguagePack | null> {
  const appScope = params.appScope ?? 'all';
  const qs = new URLSearchParams({ app: appScope });
  if (params.cachedVersion && params.cachedVersion > 0) {
    qs.set('version', String(params.cachedVersion));
  }
  const url = resolveApiUrl(`/api/v1/i18n/packs/${params.locale}?${qs.toString()}`);
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as PackResponse;
  if (data.unchanged) return null;
  return {
    version: data.version,
    locale: data.locale,
    appScope: data.appScope,
    publishedAt: data.publishedAt,
    strings: data.strings,
    keepEnglish: data.keepEnglish ?? [],
  };
}

/** Fetch from API and apply to runtime overlay. Returns new version if updated. */
export async function refreshLanguagePack(params: {
  locale: AppLocale;
  appScope?: I18nAppScope;
  cachedVersion?: number;
}): Promise<number | null> {
  try {
    const pack = await fetchLanguagePack(params);
    if (!pack) return params.cachedVersion ?? null;
    applyLanguagePack(pack);
    return pack.version;
  } catch {
    return null;
  }
}
