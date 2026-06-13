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
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview';
import { tokens } from '@morbeez/shared';
import type { CheckoutCreateResult } from '@morbeez/shared';
import {
  isExternalPaymentUrl,
  isRazorpayCheckoutUrl,
  parseRazorpayReturnUrl,
  RAZORPAY_CHECKOUT_BASE_URL,
  RAZORPAY_WEBVIEW_USER_AGENT,
  shouldOpenPaymentPopup,
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
  const bankVisitedExternalRef = useRef(false);
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
      bankVisitedExternalRef.current = false;
      clearDismissTimer();
    }
  }, [visible, clearDismissTimer]);

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  const finishCancel = useCallback(() => {
    clearDismissTimer();
    setBankUrl(null);
    bankFlowRef.current = false;
    bankVisitedExternalRef.current = false;
    onCancel();
  }, [clearDismissTimer, onCancel]);

  const scheduleDismissIfIdle = useCallback(() => {
    clearDismissTimer();
    dismissTimerRef.current = setTimeout(() => {
      if (!bankFlowRef.current) finishCancel();
    }, DISMISS_GRACE_MS);
  }, [clearDismissTimer, finishCancel]);

  const openBankWindow = useCallback(
    (targetUrl: string | undefined) => {
      if (!shouldOpenPaymentPopup(targetUrl)) return;
      clearDismissTimer();
      bankFlowRef.current = true;
      bankVisitedExternalRef.current = false;
      setBankUrl(targetUrl!);
      setLoadingBank(true);
    },
    [clearDismissTimer]
  );

  const completeFromReturnUrl = useCallback(
    (url: string) => {
      const payment = parseRazorpayReturnUrl(url);
      if (!payment) return false;
      clearDismissTimer();
      bankFlowRef.current = false;
      bankVisitedExternalRef.current = false;
      setBankUrl(null);
      onSuccess(payment);
      return true;
    },
    [clearDismissTimer, onSuccess]
  );

  function onMessage(event: WebViewMessageEvent) {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type: string;
        message?: string;
        url?: string;
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
      };

      if (data.type === 'openWindow' && data.url) {
        openBankWindow(data.url);
        return;
      }

      if (data.type === 'success' && data.razorpay_order_id && data.razorpay_payment_id && data.razorpay_signature) {
        clearDismissTimer();
        bankFlowRef.current = false;
        bankVisitedExternalRef.current = false;
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
        bankVisitedExternalRef.current = false;
        setBankUrl(null);
        onError(data.message || 'Payment failed');
      }
    } catch {
      onError('Unexpected payment response');
    }
  }

  function onMainNavigation(nav: WebViewNavigation) {
    const url = nav.url || '';
    if (completeFromReturnUrl(url)) return;
    if (shouldOpenPaymentPopup(url)) openBankWindow(url);
  }

  function onBankNavigation(nav: WebViewNavigation) {
    const url = nav.url || '';
    if (!url || url === 'about:blank') return;

    if (isExternalPaymentUrl(url)) {
      bankVisitedExternalRef.current = true;
      return;
    }

    // Razorpay auth URLs load before the bank page — only close after visiting the bank.
    if (isRazorpayCheckoutUrl(url) && bankVisitedExternalRef.current) {
      bankFlowRef.current = false;
      bankVisitedExternalRef.current = false;
      setBankUrl(null);
      setLoadingBank(false);
    }
  }

  function closeBankStep() {
    bankFlowRef.current = false;
    bankVisitedExternalRef.current = false;
    setBankUrl(null);
    setLoadingBank(false);
  }

  function onMainShouldStartLoadWithRequest(request: { url: string; isTopFrame?: boolean }) {
    const url = request.url;
    if (!url || url === 'about:blank') return true;
    if (completeFromReturnUrl(url)) return false;
    if (request.isTopFrame === false) return true;
    if (shouldOpenPaymentPopup(url)) {
      openBankWindow(url);
      return false;
    }
    return true;
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
            userAgent={RAZORPAY_WEBVIEW_USER_AGENT}
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
            onNavigationStateChange={onMainNavigation}
            onOpenWindow={(event) => openBankWindow(event.nativeEvent.targetUrl)}
            onShouldStartLoadWithRequest={onMainShouldStartLoadWithRequest}
            style={styles.webview}
          />

          {bankUrl ? (
            <View style={styles.bankOverlay}>
              <WebView
                originWhitelist={['*']}
                userAgent={RAZORPAY_WEBVIEW_USER_AGENT}
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
                onNavigationStateChange={(nav) => {
                  const url = nav.url || '';
                  if (completeFromReturnUrl(url)) return;
                  onBankNavigation(nav);
                }}
                onOpenWindow={(event) => openBankWindow(event.nativeEvent.targetUrl)}
                onShouldStartLoadWithRequest={(request) => {
                  if (request.isTopFrame === false) return true;
                  if (isExternalPaymentUrl(request.url)) {
                    bankVisitedExternalRef.current = true;
                    return true;
                  }
                  return true;
                }}
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
