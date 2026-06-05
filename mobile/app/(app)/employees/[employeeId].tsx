import { ProtectedScreen } from '@/components/ProtectedScreen';
import { EmployeeDetailPage } from '@/pages/EmployeesPage';
import { useLocalSearchParams } from 'expo-router';

export default function EmployeeDetailRoute() {
  const { employeeId } = useLocalSearchParams<{ employeeId: string }>();
  return (
    <ProtectedScreen module="settings">
      <EmployeeDetailPage employeeId={employeeId} />
    </ProtectedScreen>
  );
}
