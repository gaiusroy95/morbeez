import { Redirect } from 'expo-router';

/** Deep link / cold start — app shell picks role default tab after auth. */
export default function Index() {
  return <Redirect href="/(app)" />;
}
