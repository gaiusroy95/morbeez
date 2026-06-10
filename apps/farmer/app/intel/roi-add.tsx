import { Redirect } from 'expo-router';

/** Legacy route — redirects to farmer-first quick expense flow. */
export default function RoiAddRedirect() {
  return <Redirect href="/roi/quick-expense" />;
}
