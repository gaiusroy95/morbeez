import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { tokens, warehouseClient, type WarehouseOrderDetail } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

export default function DispatchOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const [detail, setDetail] = useState<WarehouseOrderDetail | null>(null);
  const [rack, setRack] = useState('');
  const [dispatchScan, setDispatchScan] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setError('');
    try {
      const d = await warehouseClient.getOrder(orderId);
      setDetail(d);
      setRack(d.order.dispatch_rack ?? d.suggestedDispatchRack ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateAwb(forceRecreate = false) {
    if (!orderId || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      const r = await warehouseClient.generateAwb(orderId, forceRecreate);
      if (r.ok && r.shipment?.awb) {
        setMessage(`AWB: ${r.shipment.awb}`);
      } else if (r.ok) {
        setMessage('AWB assigned');
      } else {
        setError(r.error ?? 'AWB could not be assigned');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AWB failed');
    } finally {
      setBusy(false);
    }
  }

  async function assignRack() {
    if (!orderId || !canWrite || !rack.trim()) return;
    setBusy(true);
    try {
      await warehouseClient.assignDispatchRack(orderId, rack.trim());
      setMessage(`Rack ${rack.trim()} assigned`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assign rack failed');
    } finally {
      setBusy(false);
    }
  }

  async function startDispatchScan() {
    if (!orderId || !canWrite) return;
    setBusy(true);
    try {
      const r = await warehouseClient.startDispatchSession(orderId);
      setSessionId(r.session.id);
      setMessage('Dispatch session started — scan AWB');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start dispatch session');
    } finally {
      setBusy(false);
    }
  }

  async function scanDispatch() {
    if (!sessionId || !dispatchScan.trim()) return;
    setBusy(true);
    try {
      await warehouseClient.scanDispatchSession(sessionId, dispatchScan.trim());
      setDispatchScan('');
      setMessage('AWB scanned');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmShipped() {
    if (!orderId || !canWrite) return;
    setBusy(true);
    try {
      await warehouseClient.confirmDispatch(orderId);
      setMessage('Order marked shipped');
      router.replace('/(app)/(tabs)/dispatch');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm dispatch failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading dispatch…" />;

  const order = detail?.order;
  const isManual = detail?.shippingMethod === 'manual' || order?.shipping_method === 'manual';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {detail?.shiprocketErrorDisplay ? <AlertBox>{detail.shiprocketErrorDisplay}</AlertBox> : null}

      <Panel title={order?.order_name ?? 'Dispatch'}>
        <KeyValueRow label="Status" value={order?.oms_status ?? '—'} />
        <KeyValueRow label="Courier" value={order?.courier_name ?? '—'} />
        <KeyValueRow label="AWB" value={order?.tracking_awb ?? '—'} />
        <KeyValueRow label="Rack" value={order?.dispatch_rack ?? '—'} />
      </Panel>

      {!isManual && canWrite ? (
        <Panel title="Shiprocket">
          <Btn label="Generate AWB" onPress={() => generateAwb(false)} disabled={busy} />
          <Btn label="Retry AWB" onPress={() => generateAwb(true)} disabled={busy} variant="secondary" />
          {order?.label_url ? (
            <Btn label="Open label URL" onPress={() => void Linking.openURL(order.label_url!)} variant="secondary" />
          ) : null}
        </Panel>
      ) : null}

      {canWrite ? (
        <Panel title="Dispatch rack">
          <TextInput
            style={styles.input}
            value={rack}
            onChangeText={setRack}
            placeholder="Dispatch rack (D1, D2…)"
            placeholderTextColor={tokens.textMuted}
          />
          <Btn label="Assign rack" onPress={assignRack} disabled={busy} variant="secondary" />
        </Panel>
      ) : null}

      {canWrite ? (
        <Panel title="Handoff scan">
          {!sessionId ? (
            <Btn label="Start dispatch scan" onPress={startDispatchScan} disabled={busy} />
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={dispatchScan}
                onChangeText={setDispatchScan}
                placeholder="Scan AWB barcode"
                placeholderTextColor={tokens.textMuted}
                onSubmitEditing={scanDispatch}
              />
              <Btn label="Scan AWB" onPress={scanDispatch} disabled={busy} variant="secondary" />
              <Btn label="Confirm shipped" onPress={confirmShipped} disabled={busy} />
            </>
          )}
        </Panel>
      ) : null}

      <Btn label="Print documents" onPress={() => router.push(`/(app)/packing/print/${orderId}`)} variant="secondary" />
      <Btn label="Update LR" onPress={() => router.push(`/(app)/dispatch/lr-update/${orderId}`)} variant="secondary" />
      <Btn label="Order timeline" onPress={() => router.push(`/(app)/order/timeline/${orderId}`)} variant="secondary" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
  input: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginVertical: 6,
    color: tokens.text,
  },
});
