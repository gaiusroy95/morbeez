import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@morbeez/shared';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tokens.green800 },
        headerTintColor: '#fff',
        tabBarActiveTintColor: tokens.green700,
        tabBarInactiveTintColor: tokens.textMuted,
        tabBarStyle: { borderTopColor: tokens.border },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="advisory" options={{ title: 'Advisory', tabBarIcon: ({ color, size }) => <Ionicons name="leaf-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: ({ color, size }) => <Ionicons name="flask-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="support" options={{ title: 'Support', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="shop" options={{ href: null }} />
    </Tabs>
  );
}
