import { isExternalPaymentUrl, isRazorpayAuthUrl, isRazorpayCheckoutUrl, shouldOpenPaymentPopup } from '@/lib/razorpay-checkout';

describe('razorpay checkout url helpers', () => {
  it('detects Razorpay hosts', () => {
    expect(isRazorpayCheckoutUrl('https://api.razorpay.com/v1/checkout')).toBe(true);
    expect(isRazorpayCheckoutUrl('https://checkout.razorpay.com/v1/payments')).toBe(true);
  });

  it('treats bank portals as external payment urls', () => {
    expect(isExternalPaymentUrl('https://netbanking.hdfcbank.com/netbanking')).toBe(true);
    expect(isExternalPaymentUrl('https://api.razorpay.com/v1/payments/abc/authenticate')).toBe(false);
  });

  it('opens popups for netbanking auth urls', () => {
    expect(
      shouldOpenPaymentPopup('https://api.razorpay.com/v1/payments/pay_abc/authenticate')
    ).toBe(true);
    expect(isRazorpayAuthUrl('https://api.razorpay.com/v1/payments/pay_abc/authenticate')).toBe(true);
  });
});
