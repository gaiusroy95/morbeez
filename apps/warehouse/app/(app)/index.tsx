import { Redirect } from 'expo-router';
import { useWarehouseTabs } from '@/hooks/useWarehouseTabs';

export default function AppIndex() {
  const { defaultTab } = useWarehouseTabs();
  return <Redirect href={`/(app)/(tabs)/${defaultTab}`} />;
}
