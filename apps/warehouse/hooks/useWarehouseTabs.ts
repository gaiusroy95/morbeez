import { warehouseModulesForRole, type WarehouseMobileModule } from '@morbeez/shared';
import { useStaffAuth } from '@/context/StaffAuth';

export function useWarehouseTabs(): {
  visibleTabs: WarehouseMobileModule[];
  defaultTab: WarehouseMobileModule;
  canSeeDashboard: boolean;
  canSync: boolean;
} {
  const { admin } = useStaffAuth();
  const visibleTabs = warehouseModulesForRole(admin?.role);
  const defaultTab = visibleTabs[0] ?? 'more';
  return {
    visibleTabs,
    defaultTab,
    canSeeDashboard: visibleTabs.includes('dashboard'),
    canSync: visibleTabs.includes('dashboard') || visibleTabs.includes('more'),
  };
}
