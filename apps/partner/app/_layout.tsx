import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokens } from '@morbeez/shared';
import { LocaleProvider, useLocale } from '@/context/LocaleContext';
import { PartnerAuthProvider, usePartnerAuth } from '@/context/PartnerAuth';

function Gate({ children }: { children: React.ReactNode }) {
  const { ready: authReady, authed } = usePartnerAuth();
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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <PartnerAuthProvider>
          <Gate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: tokens.green800 },
                headerTintColor: '#fff',
                contentStyle: { backgroundColor: tokens.bg },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="referral" options={{ title: 'Referral QR' }} />
              <Stack.Screen name="farmer/[farmerId]/index" options={{ title: 'Farmer' }} />
              <Stack.Screen name="visit/index" options={{ title: 'Field visit' }} />
            </Stack>
          </Gate>
        </PartnerAuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
