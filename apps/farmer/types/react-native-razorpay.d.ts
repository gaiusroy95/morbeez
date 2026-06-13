declare module 'react-native-razorpay' {
  type RazorpayOpenOptions = {
    key: string;
    amount: number;
    currency?: string;
    name?: string;
    description?: string;
    order_id?: string;
    prefill?: { name?: string; email?: string; contact?: string };
    theme?: { color?: string };
    retry?: { enabled?: boolean; max_count?: number };
  };

  export default class RazorpayCheckout {
    static open(options: RazorpayOpenOptions): Promise<Record<string, string>>;
  }
}
