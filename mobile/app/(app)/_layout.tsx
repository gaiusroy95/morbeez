import { AppDrawerContent } from '@/components/layout/AppDrawerContent';
import { theme } from '@/lib/theme';
import { Drawer } from 'expo-router/drawer';

export default function AppDrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => (
        <AppDrawerContent navigation={{ closeDrawer: () => props.navigation.closeDrawer() }} />
      )}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: { width: 300, backgroundColor: theme.surface },
        overlayColor: 'rgba(0,0,0,0.35)',
      }}
    >
      <Drawer.Screen name="index" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="telecaller" options={{ title: 'Telecaller CRM' }} />
      <Drawer.Screen name="operations" options={{ title: 'Operations' }} />
      <Drawer.Screen name="intelligence" options={{ title: 'Intelligence' }} />
      <Drawer.Screen name="opportunity" options={{ title: 'Opportunity' }} />
      <Drawer.Screen name="product-gaps" options={{ title: 'Product Gaps' }} />
      <Drawer.Screen name="agronomist" options={{ title: 'Agronomist' }} />
      <Drawer.Screen name="approvals" options={{ title: 'Approvals' }} />
      <Drawer.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Drawer.Screen name="commerce" options={{ title: 'Commerce' }} />
      <Drawer.Screen name="employees" options={{ title: 'Employees' }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
    </Drawer>
  );
}
