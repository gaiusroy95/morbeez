import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { MorbeezLogo } from '@morbeez/ui-native';
import { tokens } from '@morbeez/shared';

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
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.green800 },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Fulfillment queue',
          headerTitle: 'Queue',
          headerLeft: () => <MorbeezLogo variant="onDark" height={22} style={{ marginLeft: 12 }} />,
        }}
      />
      <Stack.Screen
        name="order/[id]"
        options={{
          headerTitle: () => <BrandedHeaderTitle title="Pick & pack" />,
        }}
      />
    </Stack>
  );
}
