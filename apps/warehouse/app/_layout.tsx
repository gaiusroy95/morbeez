import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokens } from '@morbeez/shared';
import { LocaleProvider } from '@/context/LocaleContext';
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
    <SafeAreaProvider>
      <LocaleProvider>
        <StaffAuthProvider>
          <Gate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
            </Stack>
          </Gate>
        </StaffAuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
