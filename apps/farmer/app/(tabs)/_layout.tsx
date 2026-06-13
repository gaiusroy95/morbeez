import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@morbeez/shared';
import { useMobileTabScreenOptions } from '@morbeez/ui-native';
import { useShopCart } from '@/context/ShopCartContext';
import { useLocale } from '@/context/LocaleContext';

export default function TabsLayout() {
  const { count } = useShopCart();
  const { locale } = useLocale();
  const screenOptions = useMobileTabScreenOptions();

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="home"
        options={{
          title: t('home', locale),
          tabBarAccessibilityLabel: t('home', locale),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="market" options={{ href: null }} />
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
