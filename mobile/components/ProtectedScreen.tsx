import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getRoleHomePath } from '@/lib/role-home';
import { webPathToExpoRoute } from '@/lib/mobile-paths';

export function ProtectedScreen({
  module,
  mode = 'read',
  children,
}: {
  module: string;
  mode?: 'read' | 'write';
  children: ReactNode;
}) {
  const { can, admin } = useAuth();

  if (!can(module, mode)) {
    return <Redirect href={webPathToExpoRoute(getRoleHomePath(admin?.role))} />;
  }

  return <>{children}</>;
}
