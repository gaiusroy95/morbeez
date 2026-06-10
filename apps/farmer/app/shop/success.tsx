import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { recordShopPurchaseExpense, t, tokens } from '@morbeez/shared';
import { Btn, Panel } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

export default function CheckoutSuccessScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{
    orderName?: string;
    orderId?: string;
    paymentMethod?: string;
    amountInr?: string;
    productSummary?: string;
  }>();
  const orderName = params.orderName ? String(params.orderName) : '';
  const isCod = params.paymentMethod === 'cod';

  useEffect(() => {
    const orderId = params.orderId ? String(params.orderId) : '';
    const amount = params.amountInr ? Number(params.amountInr) : 0;
    const summary = params.productSummary ? String(params.productSummary) : '';
    if (orderId && amount > 0 && summary) {
      void recordShopPurchaseExpense({ orderId, amount, productSummary: summary }).catch(() => {});
    }
  }, [params.orderId, params.amountInr, params.productSummary]);

  return (
    <View style={styles.wrap}>
      <Panel title={isCod ? 'Order placed (COD)' : 'Payment successful'}>
        <Text style={styles.body}>
          Thank you! Your order{orderName ? ` ${orderName}` : ''} has been placed.
          {isCod ? ' Pay the delivery partner in cash when your order arrives.' : ''}
        </Text>
        <Text style={styles.hint}>
          Purchase added to your ROI season automatically. Track delivery from Orders.
        </Text>
      </Panel>
      <Btn label={t('viewOrders', locale)} onPress={() => router.replace('/orders')} accessibilityLabel={t('viewOrders', locale)} />
      <Btn label={t('continueShopping', locale)} variant="secondary" onPress={() => router.replace('/(tabs)/shop')} accessibilityLabel={t('continueShopping', locale)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.bg, padding: 16, gap: 12, justifyContent: 'center' },
  body: { fontSize: 15, color: tokens.text, lineHeight: 22, marginBottom: 8 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 20 },
});
