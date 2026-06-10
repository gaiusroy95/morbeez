import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  fetchOrderTracking,
  formatInr,
  submitOrderReview,
  tokens,
  type PortalTracking,
} from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { Badge } from '@/components/PortalHelpers';

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PortalTracking | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Record<string, { rating: number; text: string }>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        setData(await fetchOrderTracking(id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load tracking');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function submitReview(productKey: string) {
    if (!id) return;
    const r = reviews[productKey];
    if (!r?.rating) return;
    setBusy(true);
    try {
      await submitOrderReview(id, {
        productKey,
        rating: r.rating,
        reviewText: r.text.trim() || undefined,
      });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading tracking…" />;
  if (!data) return <AlertBox>{error || 'Order not found'}</AlertBox>;

  const order = data.order;
  const tracking = data.tracking as Record<string, string | null>;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title={order.orderNumber}>
        <Text style={styles.title}>{order.productTitle}</Text>
        <Badge label={order.statusLabel} tone={order.statusTone} />
        <KeyValueRow label="Amount" value={formatInr(order.amountInr)} />
        <KeyValueRow label="Ordered" value={order.orderedOn} />
      </Panel>

      <Panel title="Shipment">
        <KeyValueRow label="Courier" value={String(tracking.courier ?? '—')} />
        <KeyValueRow label="AWB" value={String(tracking.trackingAwb ?? 'Pending')} />
        <KeyValueRow label="Expected delivery" value={String(tracking.expectedDelivery ?? '—')} />
        <KeyValueRow label="Payment" value={String(tracking.paymentLabel ?? '—')} />
        {tracking.deliveryAddress ? (
          <Text style={styles.body}>{String(tracking.deliveryAddress)}</Text>
        ) : null}
        {tracking.trackingUrl ? (
          <Btn label="Track shipment ↗" onPress={() => Linking.openURL(String(tracking.trackingUrl))} />
        ) : null}
        {tracking.shiprocketNote ? (
          <Text style={styles.note}>Courier note: {String(tracking.shiprocketNote)}</Text>
        ) : null}
      </Panel>

      <Panel title="Timeline">
        {data.timeline.map((step) => (
          <View key={step.key} style={styles.step}>
            <Text style={[styles.stepLabel, step.done && styles.stepDone]}>
              {step.done ? '✓' : step.pending ? '○' : '·'} {step.label}
            </Text>
            {step.at ? <Text style={styles.meta}>{step.at}</Text> : null}
          </View>
        ))}
      </Panel>

      {data.lineItems?.length ? (
        <Panel title="Items">
          {data.lineItems.map((li, i) => (
            <Text key={i} style={styles.body}>{li.title} × {li.quantity}</Text>
          ))}
        </Panel>
      ) : null}

      {data.canReview && data.reviewLines?.length ? (
        <Panel title="Product reviews">
          {data.reviewLines.map((line) => (
            <View key={line.productKey} style={styles.reviewBlock}>
              <Text style={styles.body}>{line.title}</Text>
              <TextInput
                style={styles.input}
                placeholder="Rating 1-5"
                keyboardType="number-pad"
                value={reviews[line.productKey]?.rating ? String(reviews[line.productKey].rating) : ''}
                onChangeText={(v) =>
                  setReviews((r) => ({
                    ...r,
                    [line.productKey]: { rating: Number(v), text: r[line.productKey]?.text ?? '' },
                  }))
                }
              />
              <TextInput
                style={styles.input}
                placeholder="Review (optional)"
                value={reviews[line.productKey]?.text ?? ''}
                onChangeText={(v) =>
                  setReviews((r) => ({
                    ...r,
                    [line.productKey]: { rating: r[line.productKey]?.rating ?? 5, text: v },
                  }))
                }
              />
              <Btn
                label="Submit review"
                variant="secondary"
                disabled={busy}
                onPress={() => submitReview(line.productKey)}
              />
            </View>
          ))}
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 16, fontWeight: '600', color: tokens.text, marginBottom: 8 },
  body: { fontSize: 14, color: tokens.text, marginBottom: 4 },
  meta: { fontSize: 12, color: tokens.textMuted },
  note: { fontSize: 12, color: tokens.warning, marginTop: 8 },
  step: { marginBottom: 10 },
  stepLabel: { fontSize: 14, color: tokens.textMuted },
  stepDone: { color: tokens.green800, fontWeight: '600' },
  reviewBlock: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.border },
  input: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 10,
    marginVertical: 6,
    color: tokens.text,
  },
});
