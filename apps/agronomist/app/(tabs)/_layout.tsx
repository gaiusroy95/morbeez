import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MorbeezLogo } from '@morbeez/ui-native';
import { t, tokens } from '@morbeez/shared';
import { useLocale } from '@/context/LocaleContext';

export default function TabsLayout() {
  const { locale } = useLocale();

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
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="farmers"
        options={{
          title: t('farmers', locale),
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          title: t('visits', locale),
          headerTitle: t('visits', locale),
          tabBarIcon: ({ color, size }) => <Ionicons name="leaf-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t('tasks', locale),
          tabBarIcon: ({ color, size }) => <Ionicons name="checkbox-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile', locale),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
