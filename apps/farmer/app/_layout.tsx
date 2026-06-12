import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { t, tokens } from '@morbeez/shared';
import { MorbeezLogo } from '@morbeez/ui-native';
import { FarmerAuthProvider, useFarmerAuth } from '@/context/FarmerAuthContext';
import { LocaleProvider, useLocale } from '@/context/LocaleContext';
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

function AppStack() {
  const { locale } = useLocale();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="order/[id]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('orderTracking', locale)} /> }} />
      <Stack.Screen name="address" options={{ ...header, presentation: 'modal', headerTitle: () => <BrandedHeaderTitle title={t('deliveryAddress', locale)} /> }} />
      <Stack.Screen name="orders/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('orders', locale)} /> }} />
      <Stack.Screen name="reports/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('soilReports', locale)} /> }} />
      <Stack.Screen name="recommendations/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('recommendations', locale)} /> }} />
      <Stack.Screen name="recommendations/[id]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('recommendation', locale)} /> }} />
      <Stack.Screen name="fields/form" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('block', locale)} /> }} />
      <Stack.Screen name="fields/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('myBlocks', locale)} /> }} />
      <Stack.Screen name="fields/[blockId]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('block', locale)} /> }} />
      <Stack.Screen name="scan/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('aiScan', locale)} /> }} />
      <Stack.Screen name="scan/history" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('scanHistory', locale)} /> }} />
      <Stack.Screen name="scan/[sessionId]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('aiScan', locale)} /> }} />
      <Stack.Screen name="market/trends/[crop]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('trendAnalytics', locale)} /> }} />
      <Stack.Screen name="activities/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('activities', locale)} /> }} />
      <Stack.Screen name="activities/add" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('addActivity', locale)} /> }} />
      <Stack.Screen name="findings/add" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('addFieldFinding', locale)} /> }} />
      <Stack.Screen name="soil/add" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('addSoilTest', locale)} /> }} />
      <Stack.Screen name="recommendations/add" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('addRecommendation', locale)} /> }} />
      <Stack.Screen name="intel/roi-add" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('addExpenseHeader', locale)} /> }} />
      <Stack.Screen name="roi/quick-expense" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('addExpenseHeader', locale)} /> }} />
      <Stack.Screen name="roi/quick-expense/amount" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('enterAmount', locale)} /> }} />
      <Stack.Screen name="roi/labour-add" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('addLabour', locale)} /> }} />
      <Stack.Screen name="roi/harvest" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('harvest', locale)} /> }} />
      <Stack.Screen name="roi/transactions/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('transactions', locale)} /> }} />
      <Stack.Screen name="roi/transactions/add" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('addTransactionHeader', locale)} /> }} />
      <Stack.Screen name="roi/transactions/add-expense" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('addExpenseHeader', locale)} /> }} />
      <Stack.Screen name="roi/transactions/add-income" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('addIncomeHeader', locale)} /> }} />
      <Stack.Screen name="roi/transactions/edit/[id]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('editTransactionHeader', locale)} /> }} />
      <Stack.Screen name="roi/expense-book" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('expenseBook', locale)} /> }} />
      <Stack.Screen name="roi/analytics" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('analytics', locale)} /> }} />
      <Stack.Screen name="roi/start-cycle" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('startNewCycle', locale)} /> }} />
      <Stack.Screen name="roi/history/index" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('cropHistory', locale)} /> }} />
      <Stack.Screen name="roi/history/[seasonId]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('history', locale)} /> }} />
      <Stack.Screen name="intel/roi" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('roi', locale)} /> }} />
      <Stack.Screen name="intel/weather-market" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('weatherMarket', locale)} /> }} />
      <Stack.Screen name="intel/notifications" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('notifications', locale)} /> }} />
      <Stack.Screen name="shop/[id]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('shop', locale)} /> }} />
      <Stack.Screen name="shop/category/[slug]" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('shop', locale)} /> }} />
      <Stack.Screen name="shop/cart" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('cart', locale)} /> }} />
      <Stack.Screen name="shop/checkout" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('checkout', locale)} /> }} />
      <Stack.Screen name="shop/success" options={{ ...header, headerTitle: () => <BrandedHeaderTitle title={t('orderSuccess', locale)} />, headerBackVisible: false }} />
    </Stack>
  );
}

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
                    <AppStack />
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
