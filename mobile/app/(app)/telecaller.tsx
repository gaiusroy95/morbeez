import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { TelecallerCrmPage } from '@/pages/TelecallerCrmPage';

export default function TelecallerRoute() {
  const { can } = useAuth();
  return (
    <ProtectedScreen module="telecaller_crm">
      <TelecallerCrmPage canWrite={can('telecaller_crm', 'write')} />
    </ProtectedScreen>
  );
}
