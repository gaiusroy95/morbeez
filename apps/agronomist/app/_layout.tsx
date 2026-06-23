import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { t, tokens } from '@morbeez/shared';
import { BrandedHeaderTitle, NetworkProvider } from '@morbeez/ui-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AgronomistDashboardProvider } from '@/context/AgronomistDashboardContext';
import { AgronomistQueueProvider } from '@/context/AgronomistQueueContext';
import { LocaleProvider, useLocale } from '@/context/LocaleContext';
import { StaffAuthProvider, useStaffAuth } from '@/context/StaffAuth';
import { initAgronomistApiConfig } from '@/lib/api-config';

initAgronomistApiConfig();

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
  const { locale } = useLocale();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tokens.green800 },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="visit/index"
        options={{
          headerTitle: () => <BrandedHeaderTitle title={t('farmVisit', locale)} />,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="visit/success"
        options={{
          headerTitle: () => <BrandedHeaderTitle title={t('visitSaved', locale)} />,
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="visit/[findingId]"
        options={{ headerTitle: () => <BrandedHeaderTitle title="Visit detail" /> }}
      />
      <Stack.Screen
        name="change-password"
        options={{ headerTitle: () => <BrandedHeaderTitle title="Change password" /> }}
      />
      <Stack.Screen
        name="finding/[id]"
        options={{ headerTitle: () => <BrandedHeaderTitle title={t('reviewFinding', locale)} /> }}
      />
      <Stack.Screen
        name="case/[id]"
        options={{ headerTitle: () => <BrandedHeaderTitle title={t('aiCaseReview', locale)} /> }}
      />
      <Stack.Screen
        name="farmer/[farmerId]/index"
        options={{ headerTitle: () => <BrandedHeaderTitle title={t('farmerWorkspace', locale)} /> }}
      />
      <Stack.Screen
        name="route/index"
        options={{ headerTitle: () => <BrandedHeaderTitle title={t('routePlanner', locale)} /> }}
      />
      <Stack.Screen
        name="route/[id]"
        options={{ headerTitle: () => <BrandedHeaderTitle title={t('routeDetail', locale)} /> }}
      />
      <Stack.Screen
        name="block/[blockId]"
        options={{ headerTitle: () => <BrandedHeaderTitle title="Block" /> }}
      />
      <Stack.Screen
        name="recommendation/add"
        options={{ headerTitle: () => <BrandedHeaderTitle title="Add recommendation" /> }}
      />
      <Stack.Screen
        name="activity/add"
        options={{ headerTitle: () => <BrandedHeaderTitle title="Add activity" /> }}
      />
      <Stack.Screen
        name="soil/add"
        options={{ headerTitle: () => <BrandedHeaderTitle title="Add soil test" /> }}
      />
      <Stack.Screen
        name="visit-command"
        options={{ headerTitle: () => <BrandedHeaderTitle title="Command center" /> }}
      />
      <Stack.Screen
        name="map" options={{ headerTitle: () => <BrandedHeaderTitle title={t('farmerMap', locale)} /> }} />
    </Stack>
  );
}

function RootLayoutInner() {
  const { locale } = useLocale();

  return (
    <NetworkProvider locale={locale}>
      <AgronomistDashboardProvider>
        <AgronomistQueueProvider>
          <Gate>
            <RootStack />
          </Gate>
        </AgronomistQueueProvider>
      </AgronomistDashboardProvider>
    </NetworkProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <LocaleProvider>
          <StaffAuthProvider>
            <RootLayoutInner />
          </StaffAuthProvider>
        </LocaleProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
