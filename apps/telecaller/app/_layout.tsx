import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokens } from '@morbeez/shared';
import { LocaleProvider, useLocale } from '@/context/LocaleContext';
import { StaffAuthProvider, useStaffAuth } from '@/context/StaffAuth';
import { TelecallerDashboardProvider } from '@/context/TelecallerDashboardContext';

function Gate({ children }: { children: React.ReactNode }) {
  const { ready: authReady, authed } = useStaffAuth();
  const { ready: localeReady } = useLocale();
  const segments = useSegments();
  const router = useRouter();
  const ready = authReady && localeReady;

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!authed && !inAuth) router.replace('/(auth)/login');
    else if (authed && inAuth) router.replace('/(tabs)/dashboard');
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

function RootStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.green800 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: tokens.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="lead/[leadId]/index" options={{ title: 'Farmer workspace' }} />
      <Stack.Screen name="lead/[leadId]/call/[callId]" options={{ title: 'Call detail' }} />
      <Stack.Screen name="lead/[leadId]/block/[blockId]" options={{ title: 'Block workspace' }} />
      <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <StaffAuthProvider>
          <TelecallerDashboardProvider>
            <Gate>
              <RootStack />
            </Gate>
          </TelecallerDashboardProvider>
        </StaffAuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
