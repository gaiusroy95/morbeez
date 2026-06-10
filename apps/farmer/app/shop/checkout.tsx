import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
  createCheckout,
  createCodCheckout,
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

const CHECKOUT_DRAFT_KEY = 'morbeez_checkout_draft';

type CheckoutDraft = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
};

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
        const draftRaw = await SecureStore.getItemAsync(CHECKOUT_DRAFT_KEY);
        const draft = draftRaw ? (JSON.parse(draftRaw) as CheckoutDraft) : null;
        const p = await fetchPortalProfile();
        setEmail(draft?.email || p.email || '');
        setPhone(draft?.phone || phoneForCheckout(p.phone ?? ''));
        setFirstName(draft?.firstName || p.firstName || '');
        setLastName(draft?.lastName || p.lastName || '');
        setAddress1(draft?.address1 || p.shippingAddress || '');
        setAddress2(draft?.address2 || '');
        setCity(draft?.city || p.city || p.district || '');
        setStateVal(draft?.state || p.state || '');
        setZip(draft?.zip || p.deliveryPincode || '');
        if (p.village && !p.shippingAddress && !draft?.address1) setAddress1(p.village);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [items.length, router]);

  useEffect(() => {
    const draft: CheckoutDraft = { email, phone, firstName, lastName, address1, address2, city, state, zip };
    void SecureStore.setItemAsync(CHECKOUT_DRAFT_KEY, JSON.stringify(draft)).catch(() => undefined);
  }, [email, phone, firstName, lastName, address1, address2, city, state, zip]);

  function checkoutPayload() {
    return {
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
        country: 'IN' as const,
      },
    };
  }

  async function startPayment() {
    setError('');
    setPaying(true);
    try {
      if (paymentMethod === 'cod') {
        const result = await createCodCheckout(checkoutPayload());
        clearCart();
        await SecureStore.deleteItemAsync(CHECKOUT_DRAFT_KEY).catch(() => undefined);
        router.replace({
          pathname: '/shop/success',
          params: {
            orderName: result.orderName ?? '',
            orderId: result.shopifyOrderId ?? '',
            paymentMethod: 'cod',
            amountInr: String(Math.round(totalPaise / 100)),
            productSummary: items.map((i) => i.title).join(', ').slice(0, 200),
          },
        });
        return;
      }
      const order = await createCheckout(checkoutPayload());
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
      await SecureStore.deleteItemAsync(CHECKOUT_DRAFT_KEY).catch(() => undefined);
      router.replace({
        pathname: '/shop/success',
        params: {
          orderName: result.orderName ?? '',
          orderId: result.shopifyOrderId ?? '',
          paymentMethod: 'online',
          amountInr: String(Math.round(totalPaise / 100)),
          productSummary: items.map((i) => i.title).join(', ').slice(0, 200),
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
          label={
            paying
              ? 'Please wait…'
              : paymentMethod === 'cod'
                ? `Place COD order · ${formatPaise(totalPaise)}`
                : `Pay ${formatPaise(totalPaise)} with Razorpay`
          }
          onPress={() => void startPayment()}
          disabled={paying}
          accessibilityLabel="Complete checkout"
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
