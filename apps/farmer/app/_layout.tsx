import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { MorbeezLogo } from '@morbeez/ui-native';
import { FarmerAuthProvider, useFarmerAuth } from '@/context/FarmerAuthContext';
import { LocaleProvider } from '@/context/LocaleContext';
import { OfflineProvider } from '@/context/OfflineContext';
import { ShopCartProvider } from '@/context/ShopCartContext';
import { RoiFilterProvider } from '@/context/RoiFilterContext';
import { HomeDashboardProvider } from '@/context/HomeDashboardContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function BrandedHeaderTitle({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <MorbeezLogo variant="onDark" height={20} />
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>{title}</Text>
    </View>
  );
}

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.bg, gap: 16 }}>
        <MorbeezLogo height={40} />
        <ActivityIndicator size="large" color={tokens.green700} />
      </View>
    );
  }

  return <>{children}</>;
}

const header = {
  headerShown: true as const,
  headerStyle: { backgroundColor: tokens.green800 },
  headerTintColor: '#fff' as const,
};

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <LocaleProvider>
        <OfflineProvider>
          <FarmerAuthProvider>
            <RoiFilterProvider>
            <HomeDashboardProvider>
            <ShopCartProvider>
              <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="order/[id]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Order tracking" /> }} />
              <Stack.Screen name="address" options={{ ...header, presentation: 'modal', headerTitle: () => <BrandedHeaderTitle title="Delivery address" /> }} />
              <Stack.Screen name="orders/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Orders" /> }} />
              <Stack.Screen name="reports/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Soil reports" /> }} />
              <Stack.Screen name="recommendations/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Recommendations" /> }} />
              <Stack.Screen name="recommendations/[id]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Recommendation" /> }} />
              <Stack.Screen name="fields/form" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Block" /> }} />
              <Stack.Screen name="fields/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="My blocks" /> }} />
              <Stack.Screen name="fields/[blockId]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Block" /> }} />
              <Stack.Screen name="scan/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="AI crop scan" /> }} />
              <Stack.Screen name="scan/history" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Scan history" /> }} />
              <Stack.Screen name="scan/[sessionId]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="AI scan result" /> }} />
              <Stack.Screen name="market/trends/[crop]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Market trends" /> }} />
              <Stack.Screen name="activities/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Activities" /> }} />
              <Stack.Screen name="activities/add" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Add activity" /> }} />
              <Stack.Screen name="intel/roi-add" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Add expense" /> }} />
              <Stack.Screen name="roi/quick-expense" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Add expense" /> }} />
              <Stack.Screen name="roi/quick-expense/amount" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Enter amount" /> }} />
              <Stack.Screen name="roi/labour-add" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Add labour" /> }} />
              <Stack.Screen name="roi/harvest" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Harvest" /> }} />
              <Stack.Screen name="roi/transactions/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Transactions" /> }} />
              <Stack.Screen name="roi/transactions/add" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Add transaction" /> }} />
              <Stack.Screen name="roi/transactions/add-expense" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Add expense" /> }} />
              <Stack.Screen name="roi/transactions/add-income" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Add income" /> }} />
              <Stack.Screen name="roi/transactions/edit/[id]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Edit transaction" /> }} />
              <Stack.Screen name="roi/expense-book" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Expense book" /> }} />
              <Stack.Screen name="roi/analytics" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="ROI analytics" /> }} />
              <Stack.Screen name="roi/start-cycle" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Start crop cycle" /> }} />
              <Stack.Screen name="roi/history/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Crop history" /> }} />
              <Stack.Screen name="roi/history/[seasonId]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Season details" /> }} />
              <Stack.Screen name="intel/roi" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="ROI dashboard" /> }} />
              <Stack.Screen name="intel/weather-market" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Weather & market" /> }} />
              <Stack.Screen name="intel/notifications" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Notifications" /> }} />
              <Stack.Screen name="shop/[id]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Product" /> }} />
              <Stack.Screen name="shop/category/[slug]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Products" /> }} />
              <Stack.Screen name="shop/cart" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Smart cart" /> }} />
              <Stack.Screen name="shop/checkout" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Checkout" /> }} />
              <Stack.Screen name="shop/success" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title="Order placed" />, headerBackVisible: false }} />
            </Stack>
          </AuthGate>
        </ShopCartProvider>
            </HomeDashboardProvider>
            </RoiFilterProvider>
      </FarmerAuthProvider>
        </OfflineProvider>
    </LocaleProvider>
    </ErrorBoundary>
  );
}
