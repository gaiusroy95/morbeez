import { Redirect } from 'expo-router';

/** @deprecated Use /(tabs)/roi */
export default function LegacyRoiRedirect() {
  return <Redirect href="/(tabs)/roi" />;
}
