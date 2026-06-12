import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { tokens } from '@morbeez/shared';
import type { CheckoutCreateResult } from '@morbeez/shared';
import {
  isRazorpayCheckoutUrl,
  RAZORPAY_CHECKOUT_BASE_URL,
  useRazorpayHtml,
} from '@/lib/razorpay-checkout';

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

const DISMISS_GRACE_MS = 900;

export function RazorpayCheckoutModal({ visible, order, onSuccess, onCancel, onError }: Props) {
  const html = useRazorpayHtml(order);
  const [bankUrl, setBankUrl] = useState<string | null>(null);
  const [loadingMain, setLoadingMain] = useState(true);
  const [loadingBank, setLoadingBank] = useState(false);
  const bankFlowRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      setBankUrl(null);
      setLoadingMain(true);
      setLoadingBank(false);
      bankFlowRef.current = false;
      clearDismissTimer();
    }
  }, [visible, clearDismissTimer]);

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  const finishCancel = useCallback(() => {
    clearDismissTimer();
    setBankUrl(null);
    bankFlowRef.current = false;
    onCancel();
  }, [clearDismissTimer, onCancel]);

  const scheduleDismissIfIdle = useCallback(() => {
    clearDismissTimer();
    dismissTimerRef.current = setTimeout(() => {
      if (!bankFlowRef.current) finishCancel();
    }, DISMISS_GRACE_MS);
  }, [clearDismissTimer, finishCancel]);

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
        clearDismissTimer();
        bankFlowRef.current = false;
        setBankUrl(null);
        onSuccess({
          razorpayOrderId: data.razorpay_order_id,
          razorpayPaymentId: data.razorpay_payment_id,
          razorpaySignature: data.razorpay_signature,
        });
        return;
      }

      if (data.type === 'dismiss') {
        scheduleDismissIfIdle();
        return;
      }

      if (data.type === 'error') {
        clearDismissTimer();
        bankFlowRef.current = false;
        setBankUrl(null);
        onError(data.message || 'Payment failed');
      }
    } catch {
      onError('Unexpected payment response');
    }
  }

  function onOpenBankWindow(targetUrl: string | undefined) {
    if (!targetUrl) return;
    clearDismissTimer();
    bankFlowRef.current = true;
    setBankUrl(targetUrl);
    setLoadingBank(true);
  }

  function onBankNavigation(nav: WebViewNavigation) {
    const url = nav.url || '';
    if (!url || url === 'about:blank') return;

    // Bank step finished — Razorpay callback usually lands on a Razorpay host.
    if (isRazorpayCheckoutUrl(url)) {
      bankFlowRef.current = false;
      setBankUrl(null);
      setLoadingBank(false);
    }
  }

  function closeBankStep() {
    bankFlowRef.current = false;
    setBankUrl(null);
    setLoadingBank(false);
  }

  if (!html) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={finishCancel}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{bankUrl ? 'Bank payment' : 'Secure payment'}</Text>
          <Pressable
            onPress={bankUrl ? closeBankStep : finishCancel}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={bankUrl ? 'Back to Razorpay' : 'Cancel payment'}
          >
            <Text style={styles.close}>{bankUrl ? 'Back' : 'Cancel'}</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <WebView
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            setSupportMultipleWindows
            javaScriptCanOpenWindowsAutomatically
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mixedContentMode={Platform.OS === 'android' ? 'always' : undefined}
            allowFileAccess={Platform.OS === 'android'}
            setBuiltInZoomControls={Platform.OS === 'android'}
            displayZoomControls={false}
            allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
            source={{ html, baseUrl: RAZORPAY_CHECKOUT_BASE_URL }}
            onMessage={onMessage}
            onLoadStart={() => setLoadingMain(true)}
            onLoadEnd={() => setLoadingMain(false)}
            onOpenWindow={(event) => onOpenBankWindow(event.nativeEvent.targetUrl)}
            style={styles.webview}
          />

          {bankUrl ? (
            <View style={styles.bankOverlay}>
              <WebView
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                thirdPartyCookiesEnabled
                sharedCookiesEnabled
                setSupportMultipleWindows
                javaScriptCanOpenWindowsAutomatically
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                mixedContentMode={Platform.OS === 'android' ? 'always' : undefined}
                allowFileAccess={Platform.OS === 'android'}
                setBuiltInZoomControls={Platform.OS === 'android'}
                displayZoomControls={false}
                allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
                source={{ uri: bankUrl }}
                onLoadStart={() => setLoadingBank(true)}
                onLoadEnd={() => setLoadingBank(false)}
                onNavigationStateChange={onBankNavigation}
                style={styles.webview}
              />
              {loadingBank ? (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={tokens.green700} />
                  <Text style={styles.loadingText}>Connecting to your bank…</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {loadingMain && !bankUrl ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={tokens.green700} />
              <Text style={styles.loadingText}>Loading Razorpay…</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.bg },
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
  body: { flex: 1 },
  webview: { flex: 1, backgroundColor: tokens.bg },
  bankOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: tokens.bg,
    zIndex: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,245,245,0.92)',
    zIndex: 3,
    gap: 12,
  },
  loadingText: { fontSize: 14, color: tokens.textMuted, textAlign: 'center', paddingHorizontal: 24 },
});
