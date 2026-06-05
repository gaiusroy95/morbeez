import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { OpportunityDashboardPage } from '@/pages/OpportunityDashboardPage';

export default function OpportunityRoute() {
  const { can } = useAuth();
  return (
    <ProtectedScreen module="intelligence">
      <OpportunityDashboardPage canWrite={can('intelligence', 'write')} />
    </ProtectedScreen>
  );
}
