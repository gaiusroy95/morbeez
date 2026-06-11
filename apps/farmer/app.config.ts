import type { ExpoConfig } from 'expo/config';

const defaultApiBaseUrl = 'https://morbeez-api-5hbx.onrender.com';
const defaultShopUrl = 'https://morbeez-india.myshopify.com';
const defaultShopifyThemeId = '186108281150';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (config.extra?.apiBaseUrl as string | undefined) ??
    defaultApiBaseUrl;
  const shopUrl = process.env.EXPO_PUBLIC_SHOP_URL ?? (config.extra?.shopUrl as string | undefined) ?? defaultShopUrl;
  const shopifyThemeId =
    process.env.EXPO_PUBLIC_SHOPIFY_THEME_ID ??
    (config.extra?.shopifyThemeId as string | undefined) ??
    defaultShopifyThemeId;

  return {
    ...config,
    name: 'Morbeez Farmer',
    slug: 'morbeez-farmer',
    scheme: 'morbeez-farmer',
    owner: 'kok-expo',
    extra: {
      ...config.extra,
      apiBaseUrl,
      shopUrl,
      shopifyThemeId,
      eas: {
        ...config.extra?.eas,
      },
    },
  };
};
