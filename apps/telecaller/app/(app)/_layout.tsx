import { Stack } from 'expo-router';
import { tokens } from '@morbeez/shared';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.green800 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Telecaller CRM' }} />
      <Stack.Screen name="lead/[id]" options={{ title: 'Lead detail' }} />
    </Stack>
  );
}
