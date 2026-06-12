import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { computeFulfillmentGates, tokens, warehouseClient, type PrintableDoc, type WarehouseOrderDetail } from '@morbeez/shared';
import { AlertBox, Btn, Loading, Panel } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';
import { useWarehouseQueue } from '@/context/WarehouseQueueContext';

const DOC_CHECKLIST = [
  { key: 'tax_invoice', label: 'Invoice' },
  { key: 'packing_slip', label: 'Packing slip' },
  { key: 'picking_slip', label: 'Picking slip' },
  { key: 'courier_label', label: 'Shipping label' },
] as const;

export default function PrintDocumentsScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const { refreshQueue, refreshStats } = useWarehouseQueue();
  const [detail, setDetail] = useState<WarehouseOrderDetail | null>(null);
  const [docs, setDocs] = useState<PrintableDoc[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [printed, setPrinted] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!orderId) return;
    setError('');
    try {
      const [d, list] = await Promise.all([
        warehouseClient.getOrder(orderId),
        warehouseClient.getOrderDocuments(orderId),
      ]);
      setDetail(d);
      setDocs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const gates = detail
    ? detail.fulfillmentGates ??
      computeFulfillmentGates({
        pickComplete: Boolean(detail.pickComplete ?? detail.packSession?.scan_complete),
        packageStatus: detail.package?.status,
        shippingMethod: detail.shippingMethod ?? detail.order.shipping_method,
        trackingAwb: detail.order.tracking_awb,
      })
    : null;

  useEffect(() => {
    if (loading || !orderId || !detail || !gates) return;
    if (gates.printEnabled) return;
    if (gates.pickComplete && gates.packRequired) {
      router.replace(`/(app)/packing/${orderId}`);
    } else if (gates.pickComplete && !gates.packageConfirmed) {
      router.replace(`/(app)/packing/${orderId}`);
    } else if (!gates.pickComplete) {
      router.replace(`/(app)/picking/${orderId}`);
    }
  }, [loading, orderId, detail, gates, router]);

  const shippingMethod = detail?.shippingMethod ?? detail?.order.shipping_method;
  const isManual = shippingMethod === 'manual';
  const hasAwb = Boolean(detail?.order.tracking_awb);
  const canMarkPrinted = hasAwb && !isManual;
  const printReady = gates?.printEnabled ?? false;

  function openDoc(type: string, id: string) {
    setPrinted((p) => ({ ...p, [`${type}:${id}`]: true }));
    router.push(`/(app)/print/${type}/${id}`);
  }

  async function markLabelPrinted() {
    if (!orderId || !canWrite || !canMarkPrinted) return;
    setBusy(true);
    setError('');
    try {
      await warehouseClient.markLabelPrinted(orderId);
      void refreshQueue({ force: true });
      void refreshStats({ force: true });
      setMessage('Labels marked printed');
      router.push('/(app)/packing/complete');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark printed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading documents…" />;
  if (!printReady) {
    return (
      <View style={styles.blocked}>
        <Loading label="Redirecting to pack step…" />
      </View>
    );
  }

  const findDoc = (type: string) => docs.find((d) => d.type === type);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      {detail?.order.label_url ? (
        <Btn
          label="Open Shiprocket label URL"
          onPress={() => void Linking.openURL(detail.order.label_url!)}
          variant="secondary"
        />
      ) : null}

      <Panel title="Print checklist">
        {DOC_CHECKLIST.map((item) => {
          const doc = findDoc(item.key);
          const done = doc ? printed[`${doc.type}:${doc.id}`] : false;
          return (
            <View key={item.key} style={styles.row}>
              <Text style={styles.rowLabel}>
                {done ? '✓ ' : '○ '}
                {item.label}
              </Text>
              {doc ? (
                <Btn label="View & print" onPress={() => openDoc(doc.type, doc.id)} variant="secondary" />
              ) : (
                <Text style={styles.missing}>Not ready</Text>
              )}
            </View>
          );
        })}
      </Panel>

      {canWrite ? (
        <>
          {canMarkPrinted ? (
            <Btn label="Mark labels printed" onPress={markLabelPrinted} disabled={busy} />
          ) : isManual ? (
            <>
              <Btn
                label="Continue to LR update"
                onPress={() => router.push(`/(app)/dispatch/lr-update/${orderId}`)}
              />
              <Btn
                label="Mark packed & dispatch staging"
                onPress={() => router.push('/(app)/packing/complete')}
                variant="secondary"
              />
            </>
          ) : (
            <Text style={styles.hint}>Generate AWB before marking labels printed.</Text>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  blocked: { flex: 1, backgroundColor: tokens.bg },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
  hint: { fontSize: 13, color: tokens.textMuted, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  rowLabel: { fontSize: 15, color: tokens.text, flex: 1 },
  missing: { fontSize: 12, color: tokens.textMuted },
});
