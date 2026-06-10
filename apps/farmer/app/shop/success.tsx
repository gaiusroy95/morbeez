import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { tokens } from '@morbeez/shared';
import { Btn, Panel } from '@morbeez/ui-native';

export default function CheckoutSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderName?: string; orderId?: string; paymentMethod?: string }>();
  const orderName = params.orderName ? String(params.orderName) : '';
  const isCod = params.paymentMethod === 'cod';

  return (
    <View style={styles.wrap}>
      <Panel title={isCod ? 'Order placed (COD)' : 'Payment successful'}>
        <Text style={styles.body}>
          Thank you! Your order{orderName ? ` ${orderName}` : ''} has been placed.
          {isCod ? ' Pay the delivery partner in cash when your order arrives.' : ''}
        </Text>
        <Text style={styles.hint}>
          Track delivery and leave product reviews from Orders once your order arrives.
        </Text>
      </Panel>
      <Btn label="View orders" onPress={() => router.replace('/orders')} accessibilityLabel="View orders" />
      <Btn label="Continue shopping" variant="secondary" onPress={() => router.replace('/(tabs)/shop')} accessibilityLabel="Continue shopping" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: tokens.bg, padding: 16, gap: 12, justifyContent: 'center' },
  body: { fontSize: 15, color: tokens.text, lineHeight: 22, marginBottom: 8 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 20 },
});
