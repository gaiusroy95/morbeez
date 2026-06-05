import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { EmployeesPage } from '@/pages/EmployeesPage';

export default function EmployeesRoute() {
  const { can } = useAuth();
  return (
    <ProtectedScreen module="settings">
      <EmployeesPage canWrite={can('settings', 'write')} />
    </ProtectedScreen>
  );
}
