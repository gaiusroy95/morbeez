import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { CommerceHubPage } from '@/pages/CommerceHubPage';

export default function CommerceRoute() {
  const { can } = useAuth();
  return (
    <ProtectedScreen module="commerce">
      <CommerceHubPage canWrite={can('commerce', 'write')} />
    </ProtectedScreen>
  );
}
