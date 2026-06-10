import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { FarmerAuthProvider, useFarmerAuth } from '@/context/FarmerAuthContext';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authed } = useFarmerAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!authed && !inAuth) {
      router.replace('/(auth)/login');
    } else if (authed && inAuth) {
      router.replace('/(tabs)/home');
    }
  }, [ready, authed, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.bg }}>
        <ActivityIndicator size="large" color={tokens.green700} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <FarmerAuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="order/[id]"
            options={{
              headerShown: true,
              title: 'Order tracking',
              headerStyle: { backgroundColor: tokens.green800 },
              headerTintColor: '#fff',
            }}
          />
          <Stack.Screen
            name="address"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Delivery address',
              headerStyle: { backgroundColor: tokens.green800 },
              headerTintColor: '#fff',
            }}
          />
        </Stack>
      </AuthGate>
    </FarmerAuthProvider>
  );
}
