import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokens } from '@morbeez/shared';
import { BrandedHeaderTitle, NetworkProvider } from '@morbeez/ui-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
    <ErrorBoundary>
      <SafeAreaProvider>
        <LocaleProvider>
          <NetworkProvider>
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
                <Stack.Screen name="referral" options={{ headerTitle: () => <BrandedHeaderTitle title="Referral QR" /> }} />
                <Stack.Screen name="farmer/[farmerId]/index" options={{ headerTitle: () => <BrandedHeaderTitle title="Farmer" /> }} />
                <Stack.Screen name="visit/index" options={{ headerTitle: () => <BrandedHeaderTitle title="Field visit" /> }} />
                <Stack.Screen name="visit/detail/[findingId]" options={{ headerTitle: () => <BrandedHeaderTitle title="Visit detail" /> }} />
                <Stack.Screen name="visit/success" options={{ headerTitle: () => <BrandedHeaderTitle title="Visit saved" /> }} />
                <Stack.Screen name="route/index" options={{ headerTitle: () => <BrandedHeaderTitle title="Route planner" /> }} />
                <Stack.Screen name="route/[id]" options={{ headerTitle: () => <BrandedHeaderTitle title="Route detail" /> }} />
              </Stack>
            </Gate>
          </PartnerAuthProvider>
          </NetworkProvider>
        </LocaleProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
