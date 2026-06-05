import { ProtectedScreen } from '@/components/ProtectedScreen';
import { AnalyticsHubPage } from '@/pages/AnalyticsHubPage';

export default function AnalyticsRoute() {
  return (
    <ProtectedScreen module="analytics">
      <AnalyticsHubPage />
    </ProtectedScreen>
  );
}
