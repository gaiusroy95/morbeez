import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { OperationsCenterPage } from '@/pages/OperationsCenterPage';

export default function OperationsRoute() {
  const { can } = useAuth();
  return (
    <ProtectedScreen module="operations">
      <OperationsCenterPage canWrite={can('operations', 'write')} />
    </ProtectedScreen>
  );
}
