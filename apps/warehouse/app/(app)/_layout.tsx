import { Stack } from 'expo-router';
import { tokens } from '@morbeez/shared';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.green800 },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Fulfillment queue' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Pick & pack' }} />
    </Stack>
  );
}
