import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { tokens } from '@morbeez/shared';
import type { CheckoutCreateResult } from '@morbeez/shared';
import { useRazorpayHtml } from '@/lib/razorpay-checkout';

type Props = {
  visible: boolean;
  order: CheckoutCreateResult | null;
  onSuccess: (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => void;
  onCancel: () => void;
  onError: (message: string) => void;
};

export function RazorpayCheckoutModal({ visible, order, onSuccess, onCancel, onError }: Props) {
  const html = useRazorpayHtml(order);

  function onMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        message?: string;
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
      };
      if (data.type === 'success' && data.razorpay_order_id && data.razorpay_payment_id && data.razorpay_signature) {
        onSuccess({
          razorpayOrderId: data.razorpay_order_id,
          razorpayPaymentId: data.razorpay_payment_id,
          razorpaySignature: data.razorpay_signature,
        });
        return;
      }
      if (data.type === 'cancel') {
        onCancel();
        return;
      }
      if (data.type === 'error') {
        onError(data.message || 'Payment failed');
      }
    } catch {
      onError('Unexpected payment response');
    }
  }

  if (!html) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Secure payment</Text>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Text style={styles.close}>Cancel</Text>
        </Pressable>
      </View>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: tokens.green800,
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  close: { color: '#fff', fontSize: 15, fontWeight: '600' },
  webview: { flex: 1, backgroundColor: tokens.bg },
});
