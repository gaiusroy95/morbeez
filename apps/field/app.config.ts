import type { ExpoConfig } from 'expo/config';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  name: 'Morbeez Field Pro',
  slug: 'morbeez-field',
  scheme: 'morbeez-field',
  plugins: [
    'expo-router',
    [
      'expo-location',
      { locationWhenInUsePermission: 'Capture plot GPS during field visits.' },
    ],
    [
      'expo-image-picker',
      { photosPermission: 'Attach crop photos to field findings.' },
    ],
  ],
});
