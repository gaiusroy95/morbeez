import type { ExpoConfig } from 'expo/config';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const shopUrl = process.env.EXPO_PUBLIC_SHOP_URL ?? 'https://morbeez-india.myshopify.com';
const shopifyThemeId = process.env.EXPO_PUBLIC_SHOPIFY_THEME_ID ?? '186108281150';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  name: 'Morbeez Farmer',
  slug: 'morbeez-farmer',
  scheme: 'morbeez-farmer',
  extra: {
    apiBaseUrl,
    shopUrl,
    shopifyThemeId,
  },
});
