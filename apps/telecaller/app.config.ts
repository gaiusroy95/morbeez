import type { ExpoConfig } from 'expo/config';

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  name: 'Morbeez Telecaller',
  slug: 'morbeez-telecaller',
  scheme: 'morbeez-telecaller',
});
