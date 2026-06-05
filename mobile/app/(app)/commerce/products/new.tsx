import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { ProductWizardPage } from '@/pages/ProductWizardPage';

export default function CommerceProductNewRoute() {
  const { can } = useAuth();
  return (
    <ProtectedScreen module="commerce" mode="write">
      <ProductWizardPage canWrite={can('commerce', 'write')} />
    </ProtectedScreen>
  );
}
