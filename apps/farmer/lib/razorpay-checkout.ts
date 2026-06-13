import { useMemo } from 'react';
import type { CheckoutCreateResult } from '@morbeez/shared';
import { API_BASE_URL } from '@/lib/config';

/** Trusted origin for inline HTML so Razorpay scripts and bank redirects resolve correctly. */
export const RAZORPAY_CHECKOUT_BASE_URL = 'https://api.razorpay.com';

export const RAZORPAY_MOBILE_RETURN_PATH = '/api/v1/checkout/razorpay/mobile-return';

export function razorpayMobileReturnUrl(): string {
  return `${API_BASE_URL}${RAZORPAY_MOBILE_RETURN_PATH}`;
}

function escapeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildRazorpayCheckoutHtml(order: CheckoutCreateResult): string {
  const callbackUrl = razorpayMobileReturnUrl();
  const payload = escapeJson({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency || 'INR',
    name: 'Morbeez',
    description: 'Agriculture products order',
    order_id: order.razorpayOrderId,
    prefill: order.prefill,
    theme: { color: '#34B35E' },
    retry: { enabled: true, max_count: 3 },
    redirect: true,
    callback_url: callbackUrl,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <script src="https://checkout.razorpay.com/v1/checkout.js"><\/script>
  <style>
    body { margin: 0; background: #f5f5f5; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #333; }
    .status { text-align: center; padding: 24px; max-width: 280px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="status">
    <p id="status">Opening secure payment…</p>
  </div>
  <script>
    (function () {
      var statusEl = document.getElementById('status');
      var paymentSettled = false;

      function post(payload) {
        if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
      }

      var originalOpen = window.open;
      window.open = function (url, target, features) {
        if (url && /^https?:/i.test(String(url))) {
          post({ type: 'openWindow', url: String(url) });
        }
        if (originalOpen) return originalOpen.call(window, url, target, features);
        return null;
      };

      var options = ${payload};
      options.handler = function (response) {
        paymentSettled = true;
        post({
          type: 'success',
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature
        });
      };
      options.modal = {
        confirm_close: true,
        ondismiss: function () {
          if (paymentSettled) return;
          post({ type: 'dismiss' });
        }
      };

      function openCheckout() {
        if (!window.Razorpay) {
          post({ type: 'error', message: 'Razorpay failed to load. Check your connection and try again.' });
          return;
        }
        setStatus('Complete payment in the Razorpay window.');
        var rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          paymentSettled = true;
          post({
            type: 'error',
            message: (resp.error && resp.error.description) || 'Payment failed'
          });
        });
        rzp.open();
      }

      if (document.readyState === 'complete') openCheckout();
      else window.addEventListener('load', openCheckout);
    })();
  <\/script>
</body>
</html>`;
}

export function useRazorpayHtml(order: CheckoutCreateResult | null): string | null {
  return useMemo(() => (order ? buildRazorpayCheckoutHtml(order) : null), [order]);
}

/** Razorpay / partner bank hosts opened during net banking. */
export function isRazorpayCheckoutUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'razorpay.com' ||
      host.endsWith('.razorpay.com') ||
      host === 'api.razorpay.com' ||
      host.endsWith('.razorpay.in')
    );
  } catch {
    return false;
  }
}

/** Bank and wallet hosts that must not load inside the main Razorpay WebView. */
export function isExternalPaymentUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false;
  if (isRazorpayCheckoutUrl(url)) return false;
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    const host = hostname.toLowerCase();
    return host !== 'checkout.razorpay.com';
  } catch {
    return false;
  }
}

/** Razorpay netbanking auth step — opens in a popup before redirecting to the bank. */
export function isRazorpayAuthUrl(url: string): boolean {
  if (!isRazorpayCheckoutUrl(url)) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.includes('/authenticate') || path.includes('/authorize') || path.includes('/payments/');
  } catch {
    return false;
  }
}

/** URLs that must open in the bank/payment popup WebView (not the main checkout frame). */
export function shouldOpenPaymentPopup(url: string | undefined): boolean {
  if (!url || url === 'about:blank') return false;
  if (isExternalPaymentUrl(url) || isRazorpayAuthUrl(url)) return true;
  return false;
}

export function parseRazorpayReturnUrl(url: string): {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
} | null {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.includes(RAZORPAY_MOBILE_RETURN_PATH)) return null;
    const razorpayPaymentId = parsed.searchParams.get('razorpay_payment_id') ?? '';
    const razorpayOrderId = parsed.searchParams.get('razorpay_order_id') ?? '';
    const razorpaySignature = parsed.searchParams.get('razorpay_signature') ?? '';
    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) return null;
    return { razorpayOrderId, razorpayPaymentId, razorpaySignature };
  } catch {
    return null;
  }
}

export const RAZORPAY_WEBVIEW_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
