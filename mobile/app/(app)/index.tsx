import { useAuth } from '@/context/AuthContext';
import { roleHomeExpoRoute } from '@/lib/mobile-paths';
import { Redirect } from 'expo-router';

export default function AppIndex() {
  const { admin } = useAuth();
  return <Redirect href={roleHomeExpoRoute(admin?.role)} />;
}
