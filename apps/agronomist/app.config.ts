import type { ExpoConfig } from 'expo/config';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  name: 'Morbeez Agronomist',
  slug: 'morbeez-agronomist',
  scheme: 'morbeez-agronomist',
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
});
