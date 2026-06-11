import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MorbeezLogo } from '@morbeez/ui-native';
import { t, tokens } from '@morbeez/shared';
import { useWarehouseTabs } from '@/hooks/useWarehouseTabs';
import { useLocale } from '@/context/LocaleContext';

export default function TabsLayout() {
  const { visibleTabs } = useWarehouseTabs();
  const { locale } = useLocale();
  const hide = (tab: string) => (visibleTabs.includes(tab as never) ? undefined : null);

  return (
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
            title: t('dashboard', locale),
            href: hide('dashboard'),
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="picking"
          options={{
            title: t('picking', locale),
            href: hide('picking'),
            tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="packing"
          options={{
            title: t('packing', locale),
            href: hide('packing'),
            tabBarIcon: ({ color, size }) => <Ionicons name="archive-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="dispatch"
          options={{
            title: t('dispatch', locale),
            href: hide('dispatch'),
            tabBarIcon: ({ color, size }) => <Ionicons name="airplane-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: t('more', locale),
            href: hide('more'),
            tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
  );
}
