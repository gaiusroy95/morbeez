import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { MorbeezLogo } from '@morbeez/ui-native';
import { tokens } from '@morbeez/shared';
import { WarehouseQueueProvider } from '@/context/WarehouseQueueContext';

function BrandedHeaderTitle({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <MorbeezLogo variant="onDark" height={20} />
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>{title}</Text>
    </View>
  );
}

export default function AppLayout() {
  return (
    <WarehouseQueueProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: tokens.green800 },
          headerTintColor: '#fff',
        }}
      >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="print/[type]/[id]" options={{ headerTitle: () => <BrandedHeaderTitle title="Print document" /> }} />
      <Stack.Screen name="picking/[orderId]" options={{ headerTitle: () => <BrandedHeaderTitle title="Pick rack" /> }} />
      <Stack.Screen name="picking/rack-complete" options={{ headerTitle: () => <BrandedHeaderTitle title="Rack complete" /> }} />
      <Stack.Screen name="packing/[orderId]" options={{ headerTitle: () => <BrandedHeaderTitle title="Pack order" /> }} />
      <Stack.Screen name="packing/verify/[orderId]" options={{ headerTitle: () => <BrandedHeaderTitle title="Verify label" /> }} />
      <Stack.Screen name="packing/print/[orderId]" options={{ headerTitle: () => <BrandedHeaderTitle title="Print documents" /> }} />
      <Stack.Screen name="packing/complete" options={{ headerTitle: () => <BrandedHeaderTitle title="Packing complete" /> }} />
      <Stack.Screen name="dispatch/[orderId]" options={{ headerTitle: () => <BrandedHeaderTitle title="Dispatch order" /> }} />
      <Stack.Screen name="dispatch/lr-pending" options={{ headerTitle: () => <BrandedHeaderTitle title="LR pending" /> }} />
      <Stack.Screen name="dispatch/lr-update/[orderId]" options={{ headerTitle: () => <BrandedHeaderTitle title="LR update" /> }} />
      <Stack.Screen name="more/assign-labels" options={{ headerTitle: () => <BrandedHeaderTitle title="Assign labels" /> }} />
      <Stack.Screen name="order/[id]" options={{ headerTitle: () => <BrandedHeaderTitle title="Pick & pack" /> }} />
      <Stack.Screen name="order/timeline/[id]" options={{ headerTitle: () => <BrandedHeaderTitle title="Order timeline" /> }} />
      <Stack.Screen name="change-password" options={{ headerTitle: () => <BrandedHeaderTitle title="Change password" /> }} />
      </Stack>
    </WarehouseQueueProvider>
  );
}
