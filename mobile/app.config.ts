import type { ExpoConfig } from 'expo/config';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  name: 'Morbeez Staff',
  slug: 'morbeez-staff',
  scheme: 'morbeez-staff',
  extra: {
    apiBaseUrl,
  },
});
