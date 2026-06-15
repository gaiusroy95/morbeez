import type { ExpoConfig } from 'expo/config';

const defaultApiBaseUrl = 'https://morbeez-api-5hbx.onrender.com';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (config.extra?.apiBaseUrl as string | undefined) ??
    defaultApiBaseUrl;

  return {
    ...config,
    name: 'Morbeez Partner',
    slug: 'morbeez-partner',
    scheme: 'morbeez-partner',
    owner: 'kok-expo',
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-location',
        { locationWhenInUsePermission: 'Capture GPS during partner farm visits.' },
      ],
    ],
    android: {
      ...config.android,
      permissions: [
        ...(config.android?.permissions ?? []),
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
      ],
    },
    extra: {
      ...config.extra,
      apiBaseUrl,
      eas: {
        ...config.extra?.eas,
      },
    },
  };
};
