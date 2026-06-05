import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { IntelligenceHubPage } from '@/pages/IntelligenceHubPage';

export default function IntelligenceRoute() {
  const { can } = useAuth();
  return (
    <ProtectedScreen module="intelligence">
      <IntelligenceHubPage canWrite={can('intelligence', 'write')} />
    </ProtectedScreen>
  );
}
