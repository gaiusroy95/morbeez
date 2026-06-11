import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  tokens,
  warehouseClient,
  type OrderTimelineStep,
  type PrintableDoc,
  type WarehouseOrderDetail,
} from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

export default function OrderTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const [detail, setDetail] = useState<WarehouseOrderDetail | null>(null);
  const [timeline, setTimeline] = useState<OrderTimelineStep[]>([]);
  const [docs, setDocs] = useState<PrintableDoc[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const [d, t, docList] = await Promise.all([
        warehouseClient.getOrder(id),
        warehouseClient.getTimeline(id),
        warehouseClient.getOrderDocuments(id),
      ]);
      setDetail(d);
      setTimeline(t);
      setDocs(docList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateAwb() {
    if (!id || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      const r = await warehouseClient.generateAwb(id, false);
      if (r.ok && r.shipment?.awb) setMessage(`AWB: ${r.shipment.awb}`);
      else if (r.ok) setMessage('AWB assigned');
      else setError(r.error ?? 'AWB could not be assigned');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AWB failed');
    } finally {
      setBusy(false);
    }
  }

  async function assignRack() {
    if (!id || !canWrite || !detail?.suggestedDispatchRack) return;
    setBusy(true);
    try {
      await warehouseClient.assignDispatchRack(id, detail.suggestedDispatchRack);
      setMessage(`Dispatch rack ${detail.suggestedDispatchRack} assigned`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispatch rack failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading order timeline…" />;

  const order = detail?.order;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Panel title={order?.order_name ?? 'Order'}>
        <KeyValueRow label="Status" value={order?.oms_status ?? '—'} />
        <KeyValueRow label="Courier" value={order?.courier_name ?? '—'} />
        <KeyValueRow label="AWB" value={order?.tracking_awb ?? '—'} />
        <KeyValueRow label="Dispatch rack" value={order?.dispatch_rack ?? detail?.suggestedDispatchRack ?? '—'} />
      </Panel>

      <Panel title="Timeline">
        {timeline.map((step) => (
          <View key={step.key} style={styles.step}>
            <View
              style={[
                styles.dot,
                step.status === 'done' && styles.dotDone,
                step.status === 'current' && styles.dotCurrent,
              ]}
            />
            <View style={styles.stepBody}>
              <Text style={styles.stepLabel}>{step.label}</Text>
              {step.at ? <Text style={styles.stepMeta}>{step.at}</Text> : null}
              {step.detail ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
            </View>
          </View>
        ))}
      </Panel>

      {canWrite && order?.oms_status === 'ready_dispatch' ? (
        <Panel title="Dispatch actions">
          <Btn label="Open dispatch screen" onPress={() => router.push(`/(app)/dispatch/${id}`)} />
          <Btn label="Generate AWB" onPress={generateAwb} disabled={busy} variant="secondary" />
          {detail?.suggestedDispatchRack ? (
            <Btn
              label={`Assign rack ${detail.suggestedDispatchRack}`}
              onPress={assignRack}
              disabled={busy}
              variant="secondary"
            />
          ) : null}
        </Panel>
      ) : null}

      <Panel title="Documents">
        {docs.length === 0 ? <Text style={styles.muted}>No documents yet.</Text> : null}
        {docs.map((doc) => (
          <Btn
            key={`${doc.type}:${doc.id}`}
            label={doc.label}
            onPress={() => router.push(`/(app)/print/${doc.type}/${doc.id}`)}
            variant="secondary"
          />
        ))}
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
  muted: { fontSize: 13, color: tokens.textMuted },
  step: { flexDirection: 'row', marginBottom: 14 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.border,
    marginTop: 5,
    marginRight: 10,
  },
  dotDone: { backgroundColor: tokens.green500 },
  dotCurrent: { backgroundColor: tokens.green800 },
  stepBody: { flex: 1 },
  stepLabel: { fontSize: 15, fontWeight: '600', color: tokens.text },
  stepMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 2 },
  stepDetail: { fontSize: 13, color: tokens.text, marginTop: 2 },
});
