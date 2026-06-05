import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { ApprovalsPage } from '@/pages/ApprovalsPage';

export default function ApprovalsRoute() {
  const { canApprove, can } = useAuth();
  const canWrite = can('approve_recommendations', 'write') || canApprove;
  return (
    <ProtectedScreen module="approve_recommendations">
      <ApprovalsPage canApprove={canApprove} canWrite={canWrite} />
    </ProtectedScreen>
  );
}
