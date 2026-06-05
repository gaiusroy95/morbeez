import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { ProductWizardPage } from '@/pages/ProductWizardPage';
import { useLocalSearchParams } from 'expo-router';

export default function CommerceProductEditRoute() {
  const { can } = useAuth();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  return (
    <ProtectedScreen module="commerce">
      <ProductWizardPage canWrite={can('commerce', 'write')} productId={productId} />
    </ProtectedScreen>
  );
}
