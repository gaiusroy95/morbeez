import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MorbeezLogo } from '@morbeez/ui-native';
import { tokens } from '@morbeez/shared';
import { useWarehouseTabs } from '@/hooks/useWarehouseTabs';
import { WarehouseQueueProvider } from '@/context/WarehouseQueueContext';

export default function TabsLayout() {
  const { visibleTabs } = useWarehouseTabs();
  const hide = (tab: string) => (visibleTabs.includes(tab as never) ? undefined : null);

  return (
    <WarehouseQueueProvider>
      <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tokens.green800 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        headerLeft: () => <MorbeezLogo variant="onDark" height={22} style={{ marginLeft: 12 }} />,
        tabBarActiveTintColor: tokens.green700,
        tabBarInactiveTintColor: tokens.textMuted,
        tabBarStyle: { borderTopColor: tokens.border },
        sceneStyle: { flex: 1, backgroundColor: tokens.bg },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: hide('dashboard'),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="picking"
        options={{
          title: 'Picking',
          href: hide('picking'),
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="packing"
        options={{
          title: 'Packing',
          href: hide('packing'),
          tabBarIcon: ({ color, size }) => <Ionicons name="archive-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dispatch"
        options={{
          title: 'Dispatch',
          href: hide('dispatch'),
          tabBarIcon: ({ color, size }) => <Ionicons name="airplane-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          href: hide('more'),
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
    </WarehouseQueueProvider>
  );
}
