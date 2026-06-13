import { NativeModules, Platform } from 'react-native';
import type { CheckoutCreateResult } from '@morbeez/shared';
import RazorpayCheckout from 'react-native-razorpay';

export class PaymentCancelledError extends Error {
  constructor() {
    super('Payment cancelled');
    this.name = 'PaymentCancelledError';
  }
}

export function isNativeRazorpayAvailable(): boolean {
  return Platform.OS !== 'web' && !!NativeModules.RNRazorpayCheckout;
}

type RazorpayNativeSuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayNativeFailure = {
  code?: number;
  description?: string;
};

function parseNativeFailure(err: RazorpayNativeFailure): never {
  if (err.code === 0) throw new PaymentCancelledError();
  const raw = err.description ?? 'Payment failed';
  try {
    const parsed = JSON.parse(raw) as { error?: { description?: string } };
    throw new Error(parsed.error?.description || raw);
  } catch (e) {
    if (e instanceof PaymentCancelledError || e instanceof Error) throw e;
    throw new Error(raw);
  }
}

/** Opens Razorpay with the native SDK (net banking, UPI, cards). Requires a dev/production build. */
export async function openNativeRazorpayCheckout(order: CheckoutCreateResult): Promise<{
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}> {
  if (!isNativeRazorpayAvailable()) {
    throw new Error('Native Razorpay is not available in this build');
  }

  try {
    const data = (await RazorpayCheckout.open({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'Morbeez',
      description: 'Agriculture products order',
      order_id: order.razorpayOrderId,
      prefill: order.prefill,
      theme: { color: '#34B35E' },
      retry: { enabled: true, max_count: 3 },
    })) as RazorpayNativeSuccess;

    return {
      razorpayOrderId: data.razorpay_order_id,
      razorpayPaymentId: data.razorpay_payment_id,
      razorpaySignature: data.razorpay_signature,
    };
  } catch (err) {
    if (err instanceof PaymentCancelledError) throw err;
    if (typeof err === 'object' && err && ('code' in err || 'description' in err)) {
      parseNativeFailure(err as RazorpayNativeFailure);
    }
    throw err instanceof Error ? err : new Error('Payment failed');
  }
}
