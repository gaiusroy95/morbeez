import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MorbeezLogo } from '@morbeez/ui-native';
import { t, tokens } from '@morbeez/shared';
import { useShopCart } from '@/context/ShopCartContext';
import { useLocale } from '@/context/LocaleContext';

export default function TabsLayout() {
  const { count } = useShopCart();
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
        name="home"
        options={{
          title: t('home', locale),
          tabBarAccessibilityLabel: t('home', locale),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: t('market', locale),
          headerTitle: t('market', locale),
          tabBarAccessibilityLabel: t('market', locale),
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="roi"
        options={{
          title: t('roi', locale),
          headerTitle: t('roi', locale),
          tabBarAccessibilityLabel: t('roi', locale),
          tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: t('shop', locale),
          headerTitle: t('shop', locale),
          tabBarAccessibilityLabel: t('shop', locale),
          tabBarIcon: ({ color, size }) => <Ionicons name="bag-outline" size={size} color={color} />,
          tabBarBadge: count > 0 ? (count > 99 ? '99+' : count) : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile', locale),
          tabBarAccessibilityLabel: t('profile', locale),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="fields" options={{ href: null }} />
      <Tabs.Screen name="scan" options={{ href: null }} />
    </Tabs>
  );
}
