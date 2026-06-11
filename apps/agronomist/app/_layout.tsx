import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { MorbeezLogo } from '@morbeez/ui-native';
import { AgronomistDashboardProvider } from '@/context/AgronomistDashboardContext';
import { AgronomistQueueProvider } from '@/context/AgronomistQueueContext';
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

export default function RootLayout() {
  return (
    <StaffAuthProvider>
      <AgronomistDashboardProvider>
        <AgronomistQueueProvider>
          <Gate>
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
                  headerTitle: () => <BrandedHeaderTitle title="Field visit" />,
                  presentation: 'modal',
                }}
              />
              <Stack.Screen
                name="visit/success"
                options={{
                  headerTitle: () => <BrandedHeaderTitle title="Visit saved" />,
                  headerBackVisible: false,
                }}
              />
              <Stack.Screen
                name="finding/[id]"
                options={{ headerTitle: () => <BrandedHeaderTitle title="Review finding" /> }}
              />
              <Stack.Screen
                name="case/[id]"
                options={{ headerTitle: () => <BrandedHeaderTitle title="AI case review" /> }}
              />
              <Stack.Screen
                name="farmer/[farmerId]/index"
                options={{ headerTitle: () => <BrandedHeaderTitle title="Farmer workspace" /> }}
              />
              <Stack.Screen
                name="route/index"
                options={{ headerTitle: () => <BrandedHeaderTitle title="Route planner" /> }}
              />
              <Stack.Screen
                name="route/[id]"
                options={{ headerTitle: () => <BrandedHeaderTitle title="Route detail" /> }}
              />
              <Stack.Screen name="map" options={{ headerTitle: () => <BrandedHeaderTitle title="Farmer map" /> }} />
            </Stack>
          </Gate>
        </AgronomistQueueProvider>
      </AgronomistDashboardProvider>
    </StaffAuthProvider>
  );
}
