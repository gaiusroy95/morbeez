import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { StaffAuthProvider, useStaffAuth } from '@/context/StaffAuth';

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, authed } = useStaffAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!authed && !inAuth) router.replace('/(auth)/login');
    else if (authed && inAuth) router.replace('/(app)');
  }, [ready, authed, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.bg }}>
        <ActivityIndicator color={tokens.green700} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <StaffAuthProvider>
      <Gate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="visit"
            options={{
              headerShown: true,
              title: 'Field visit',
              headerStyle: { backgroundColor: tokens.green800 },
              headerTintColor: '#fff',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="finding/[id]"
            options={{
              headerShown: true,
              title: 'Review finding',
              headerStyle: { backgroundColor: tokens.green800 },
              headerTintColor: '#fff',
            }}
          />
        </Stack>
      </Gate>
    </StaffAuthProvider>
  );
}
