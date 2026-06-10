import { useMemo } from 'react';
import type { CheckoutCreateResult } from '@morbeez/shared';

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
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://checkout.razorpay.com/v1/checkout.js"><\/script>
  <style>body{margin:0;background:#f5f5f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#333}</style>
</head>
<body>
  <p>Opening secure payment…</p>
  <script>
    (function () {
      var options = ${payload};
      options.handler = function (response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', razorpay_payment_id: response.razorpay_payment_id, razorpay_order_id: response.razorpay_order_id, razorpay_signature: response.razorpay_signature }));
      };
      options.modal = {
        ondismiss: function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cancel' }));
        }
      };
      function openCheckout() {
        if (!window.Razorpay) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'Razorpay failed to load' }));
          return;
        }
        var rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: (resp.error && resp.error.description) || 'Payment failed' }));
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
