import { Tabs } from 'expo-router';
import { MorbeezLogo } from '@morbeez/ui-native';
import { tokens } from '@morbeez/shared';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tokens.green800 },
        headerTintColor: '#fff',
        tabBarActiveTintColor: tokens.green700,
        headerLeft: () => <MorbeezLogo variant="onDark" height={22} style={{ marginLeft: 12 }} />,
      }}
    >
      <Tabs.Screen name="visits" options={{ title: 'Field visits', headerTitle: 'Find farmer' }} />
      <Tabs.Screen name="queue" options={{ title: 'Review queue', headerTitle: 'Field findings' }} />
    </Tabs>
  );
}
