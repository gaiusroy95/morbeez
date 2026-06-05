import { ProtectedScreen } from '@/components/ProtectedScreen';
import { useAuth } from '@/context/AuthContext';
import { SettingsPage } from '@/pages/SettingsPage';

export default function SettingsRoute() {
  const { can } = useAuth();
  return (
    <ProtectedScreen module="settings">
      <SettingsPage canRead={can('settings', 'read')} canWrite={can('settings', 'write')} />
    </ProtectedScreen>
  );
}
