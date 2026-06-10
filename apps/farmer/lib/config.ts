import Constants from 'expo-constants';

export const SHOP_URL =
  (Constants.expoConfig?.extra?.shopUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_SHOP_URL ||
  'https://morbeez-india.myshopify.com';

/** Unpublished/dev themes require ?preview_theme_id=… — matches theme/shopify.theme.toml */
export const SHOPIFY_THEME_ID =
  (Constants.expoConfig?.extra?.shopifyThemeId as string | undefined) ||
  process.env.EXPO_PUBLIC_SHOPIFY_THEME_ID ||
  '186108281150';

export const API_BASE_URL = (
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  ''
).replace(/\/$/, '');

export const WHATSAPP_PHONE =
  process.env.EXPO_PUBLIC_WHATSAPP_PHONE || '917676026318';

export function whatsAppUrl(message?: string): string {
  const phone = WHATSAPP_PHONE.replace(/\D/g, '');
  const text = encodeURIComponent(message || 'Hi Morbeez, I need help with my farm.');
  return `https://wa.me/${phone}?text=${text}`;
}

/** Append preview_theme_id so the Morbeez theme (not the default live theme) loads. */
export function withShopThemePreview(url: string): string {
  if (!SHOPIFY_THEME_ID) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('preview_theme_id')) {
      parsed.searchParams.set('preview_theme_id', SHOPIFY_THEME_ID);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function shopPageUrl(path = '/collections/all'): string {
  const base = SHOP_URL.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return withShopThemePreview(new URL(normalized, `${base}/`).toString());
}

export function shopSearchUrl(query: string): string {
  return shopPageUrl(`/search?q=${encodeURIComponent(query.trim())}`);
}
