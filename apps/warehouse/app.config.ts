import type { ExpoConfig } from 'expo/config';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  name: 'Morbeez Pick & Pack',
  slug: 'morbeez-warehouse',
  scheme: 'morbeez-warehouse',
  plugins: ['expo-router', ['expo-camera', { cameraPermission: 'Scan product barcodes during packing.' }]],
});
