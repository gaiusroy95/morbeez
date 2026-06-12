import { useMemo } from 'react';
import type { CheckoutCreateResult } from '@morbeez/shared';

/** Trusted origin for inline HTML so Razorpay scripts and bank redirects resolve correctly. */
export const RAZORPAY_CHECKOUT_BASE_URL = 'https://api.razorpay.com';

function escapeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildRazorpayCheckoutHtml(order: CheckoutCreateResult): string {
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
