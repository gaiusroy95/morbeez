import { ProtectedScreen } from '@/components/ProtectedScreen';
import { DashboardPage } from '@/pages/DashboardPage';

export default function DashboardRoute() {
  return (
    <ProtectedScreen module="dashboard">
      <DashboardPage />
    </ProtectedScreen>
  );
}
