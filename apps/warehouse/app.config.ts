import type { ExpoConfig } from 'expo/config';

const defaultApiBaseUrl = 'https://morbeez-api-5hbx.onrender.com';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (config.extra?.apiBaseUrl as string | undefined) ??
    defaultApiBaseUrl;

  return {
    ...config,
    name: 'Morbeez Pick & Pack',
    slug: 'morbeez-warehouse',
    scheme: 'morbeez-warehouse',
    owner: 'kok-expo',
    plugins: [
      'expo-router',
      'expo-sharing',
      ['expo-camera', { cameraPermission: 'Scan product barcodes during picking and packing.' }],
    ],
    extra: {
      ...config.extra,
      apiBaseUrl,
      eas: {
        ...config.extra?.eas,
      },
    },
  };
};
