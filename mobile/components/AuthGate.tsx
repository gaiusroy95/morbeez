import { useAuth } from '@/context/AuthContext';
import { roleHomeExpoRoute } from '@/lib/mobile-paths';
import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authed, admin } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const group = segments[0];
    const inAuth = group === '(auth)';

    if (!authed && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }
    if (authed && inAuth) {
      router.replace(roleHomeExpoRoute(admin?.role));
    }
  }, [ready, authed, admin?.role, segments, router]);

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1b5e20" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
});
