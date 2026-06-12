import type { ExpoConfig } from 'expo/config';

const defaultApiBaseUrl = 'https://morbeez-api-5hbx.onrender.com';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (config.extra?.apiBaseUrl as string | undefined) ??
    defaultApiBaseUrl;

  return {
    ...config,
    name: 'Morbeez Telecaller',
    slug: 'morbeez-telecaller',
    scheme: 'morbeez-telecaller',
    owner: 'kok-expo',
    plugins: ['expo-router'],
    extra: {
      ...config.extra,
      apiBaseUrl,
      eas: {
        ...config.extra?.eas,
      },
    },
  };
};
