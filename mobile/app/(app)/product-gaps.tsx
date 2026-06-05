import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { ProductGapsPage } from '@/pages/ProductGapsPage';

export default function ProductGapsRoute() {
  const { can } = useAuth();
  return (
    <ProtectedScreen module="intelligence">
      <ProductGapsPage canWrite={can('intelligence', 'write')} />
    </ProtectedScreen>
  );
}
