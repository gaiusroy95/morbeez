import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createCheckout,
  fetchPortalProfile,
  formatPaise,
  phoneForCheckout,
  tokens,
  verifyCheckout,
  type CheckoutCreateResult,
} from '@morbeez/shared';
import { AlertBox, Btn, HubTabs, Loading, Panel, TextField } from '@morbeez/ui-native';
import { RazorpayCheckoutModal } from '@/components/RazorpayCheckoutModal';
import { useShopCart } from '@/context/ShopCartContext';

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, totalPaise, clearCart } = useShopCart();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setStateVal] = useState('');
  const [zip, setZip] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [razorpayOrder, setRazorpayOrder] = useState<CheckoutCreateResult | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    if (!items.length) {
      router.replace('/shop/cart');
      return;
    }
    void (async () => {
      try {
        const p = await fetchPortalProfile();
        setEmail(p.email ?? '');
        setPhone(phoneForCheckout(p.phone ?? ''));
        setFirstName(p.firstName ?? '');
        setLastName(p.lastName ?? '');
        setAddress1(p.shippingAddress ?? '');
        setCity(p.city ?? p.district ?? '');
        setStateVal(p.state ?? '');
        setZip(p.deliveryPincode ?? '');
        if (p.village && !p.shippingAddress) setAddress1(p.village);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [items.length, router]);

  async function startPayment() {
    setError('');
    if (paymentMethod === 'cod') {
      setError('Cash on delivery will be available in the next update. Please use online payment.');
      return;
    }
    setPaying(true);
    try {
      const order = await createCheckout({
        lineItems: items.map((item) => ({
          variantId: Number(item.variantId),
          quantity: item.quantity,
          title: `${item.title}${item.variantTitle ? ` — ${item.variantTitle}` : ''}`,
          price: item.pricePaise,
        })),
        customer: {
          email: email.trim(),
          phone: phoneForCheckout(phone),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        },
        shipping: {
          address1: address1.trim(),
          address2: address2.trim() || undefined,
          city: city.trim(),
          province: state.trim(),
          zip: zip.trim(),
          country: 'IN',
        },
      });
      setRazorpayOrder(order);
      setShowPayment(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout');
    } finally {
      setPaying(false);
    }
  }

  async function onPaymentSuccess(payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    setShowPayment(false);
    setPaying(true);
    setError('');
    try {
      const result = await verifyCheckout(payload);
      clearCart();
      router.replace({
        pathname: '/shop/success',
        params: {
          orderName: result.orderName ?? '',
          orderId: result.shopifyOrderId ?? '',
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment verification failed');
    } finally {
      setPaying(false);
      setRazorpayOrder(null);
    }
  }

  if (loading) return <Loading label="Preparing checkout…" />;

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error ? <AlertBox>{error}</AlertBox> : null}

        <Panel title={`Order total · ${formatPaise(totalPaise)}`}>
          {items.map((item) => (
            <Text key={item.key} style={styles.line}>
              {item.quantity} × {item.title}
              {item.variantTitle ? ` (${item.variantTitle})` : ''} — {formatPaise(item.pricePaise * item.quantity)}
            </Text>
          ))}
        </Panel>

        <Panel title="Contact">
          <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
          <TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        </Panel>

        <Panel title="Delivery address">
          <TextField label="Address line 1" value={address1} onChangeText={setAddress1} autoCapitalize="words" />
          <TextField label="Address line 2" value={address2} onChangeText={setAddress2} autoCapitalize="words" />
          <TextField label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
          <TextField label="State" value={state} onChangeText={setStateVal} autoCapitalize="words" />
          <TextField label="PIN code" value={zip} onChangeText={setZip} keyboardType="numeric" />
        </Panel>

        <Panel title="Payment">
          <HubTabs
            tabs={[
              { id: 'online' as const, label: 'UPI / Card / Net banking' },
              { id: 'cod' as const, label: 'Cash on delivery' },
            ]}
            active={paymentMethod}
            onChange={setPaymentMethod}
          />
          <Text style={styles.note}>GST invoice will be shared on WhatsApp after delivery.</Text>
        </Panel>

        <Btn
          label={paying ? 'Please wait…' : `Pay ${formatPaise(totalPaise)} with Razorpay`}
          onPress={() => void startPayment()}
          disabled={paying}
        />
      </ScrollView>

      <RazorpayCheckoutModal
        visible={showPayment}
        order={razorpayOrder}
        onSuccess={(payload) => void onPaymentSuccess(payload)}
        onCancel={() => {
          setShowPayment(false);
          setRazorpayOrder(null);
        }}
        onError={(message) => {
          setShowPayment(false);
          setRazorpayOrder(null);
          setError(message);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  line: { fontSize: 13, color: tokens.text, marginBottom: 6, lineHeight: 18 },
  note: { fontSize: 12, color: tokens.textMuted, marginTop: 8 },
});
