import type { ExpoConfig } from 'expo/config';

const defaultApiBaseUrl = 'https://morbeez-api-5hbx.onrender.com';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (config.extra?.apiBaseUrl as string | undefined) ??
    defaultApiBaseUrl;

  return {
    ...config,
    name: 'Morbeez Agronomist',
    slug: 'morbeez-agronomist',
    scheme: 'morbeez-agronomist',
    owner: 'kok-expo',
    plugins: [
      'expo-router',
      [
        'expo-location',
        { locationWhenInUsePermission: 'Capture GPS during farm visits and route planning.' },
      ],
      [
        'expo-image-picker',
        { photosPermission: 'Attach crop photos to visit records.', cameraPermission: 'Capture visit photos.' },
      ],
    ],
    android: {
      ...config.android,
      permissions: [
        ...(config.android?.permissions ?? []),
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'CAMERA',
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
