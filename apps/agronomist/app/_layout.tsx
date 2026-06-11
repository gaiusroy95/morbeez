import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { t, tokens } from '@morbeez/shared';
import { MorbeezLogo } from '@morbeez/ui-native';
import { AgronomistDashboardProvider } from '@/context/AgronomistDashboardContext';
import { AgronomistQueueProvider } from '@/context/AgronomistQueueContext';
import { LocaleProvider, useLocale } from '@/context/LocaleContext';
import { StaffAuthProvider, useStaffAuth } from '@/context/StaffAuth';

function BrandedHeaderTitle({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <MorbeezLogo variant="onDark" height={20} />
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>{title}</Text>
    </View>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { ready, authed } = useStaffAuth();
  const segments = useSegments();
  const router = useRouter();

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
      <Stack.Screen name="map" options={{ headerTitle: () => <BrandedHeaderTitle title={t('farmerMap', locale)} /> }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <LocaleProvider>
      <StaffAuthProvider>
        <AgronomistDashboardProvider>
          <AgronomistQueueProvider>
            <Gate>
              <RootStack />
            </Gate>
          </AgronomistQueueProvider>
        </AgronomistDashboardProvider>
      </StaffAuthProvider>
    </LocaleProvider>
  );
}
