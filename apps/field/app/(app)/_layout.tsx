import { Tabs } from 'expo-router';
import { tokens } from '@morbeez/shared';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tokens.green800 },
        headerTintColor: '#fff',
        tabBarActiveTintColor: tokens.green700,
      }}
    >
      <Tabs.Screen name="visits" options={{ title: 'Field visits', headerTitle: 'Find farmer' }} />
      <Tabs.Screen name="queue" options={{ title: 'Review queue', headerTitle: 'Field findings' }} />
    </Tabs>
  );
}
