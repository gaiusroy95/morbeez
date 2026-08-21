import type { ExpoConfig } from 'expo/config';

const defaultApiBaseUrl = 'https://morbeez-api-5hbx.onrender.com';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (config.extra?.apiBaseUrl as string | undefined) ??
    defaultApiBaseUrl;

  return {
    ...config,
    name: 'Morbeez Crop Advisor',
    slug: 'morbeez-crop-advisor',
    scheme: 'morbeez-crop-advisor',
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
