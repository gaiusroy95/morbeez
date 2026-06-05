import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { AgronomistHubPage } from '@/pages/AgronomistHubPage';

export default function AgronomistRoute() {
  const { can } = useAuth();
  return (
    <ProtectedScreen module="agronomist">
      <AgronomistHubPage canWrite={can('agronomist', 'write')} />
    </ProtectedScreen>
  );
}
