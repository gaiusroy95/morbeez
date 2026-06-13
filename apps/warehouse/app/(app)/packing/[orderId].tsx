import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { computeFulfillmentGates, tokens, warehouseClient, buildFulfillmentGatesFromOrderDetail, type ShippingBox, type WarehouseOrderDetail } from '@morbeez/shared';
import { AlertBox, Btn, HubTabs, KeyValueRow, Loading, Panel, useDeviceBottomInset } from '@morbeez/ui-native';
import { ExceptionPanel } from '@/components/ExceptionPanel';
import { useStaffAuth } from '@/context/StaffAuth';
import { useWarehouseQueue } from '@/context/WarehouseQueueContext';

export default function PackOrderScreen() {
  const bottomPad = useDeviceBottomInset() + 16;
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { admin, canWrite } = useStaffAuth();
  const { refreshQueue, refreshStats } = useWarehouseQueue();
  const [detail, setDetail] = useState<WarehouseOrderDetail | null>(null);
  const [boxes, setBoxes] = useState<ShippingBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [boxCount, setBoxCount] = useState('1');
  const [shippingMethod, setShippingMethod] = useState<'shiprocket' | 'manual'>('shiprocket');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setError('');
    try {
      const [d, b] = await Promise.all([
        warehouseClient.getOrder(orderId),
        warehouseClient.getShippingBoxes().catch(() => []),
      ]);
      setDetail(d);
      const activeBoxes = b.filter((box) => box.code);
      setBoxes(activeBoxes);
      const pkg = d.package;
      const sm = d.shippingMethod ?? (d.order.shipping_method === 'manual' ? 'manual' : 'shiprocket');
      setShippingMethod(sm);
      if (pkg?.boxCount != null && pkg.boxCount > 0) {
        setBoxCount(String(pkg.boxCount));
      }
      const match = activeBoxes.find((x) => x.code === pkg?.suggestedBoxCode);
      if (match) setSelectedBoxId(match.id);
      else if (activeBoxes[0]) setSelectedBoxId(activeBoxes[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!orderId || !canWrite || loading || detail?.package?.billingWeightKg) return;
    void warehouseClient.packageEstimate(orderId).then(() => load());
  }, [orderId, canWrite, loading, detail?.package?.billingWeightKg, load]);

  async function applyPackage(boxId = selectedBoxId) {
    if (!orderId || !canWrite || !boxId) return;
    const count = Number(boxCount);
    if (!count || count < 1) {
      setError('Enter a valid number of boxes (1 or more)');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await warehouseClient.packageSelectBox(orderId, boxId, count);
      const box = boxes.find((b) => b.id === boxId);
      setMessage(`Package updated — ${count} × ${box?.code ?? 'box'}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not calculate package');
    } finally {
      setBusy(false);
    }
  }

  function pickBox(box: ShippingBox) {
    setSelectedBoxId(box.id);
    void applyPackage(box.id);
  }

  async function setMethod(method: 'shiprocket' | 'manual') {
    if (!orderId || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      await warehouseClient.setShippingMethod(orderId, method);
      setShippingMethod(method);
      setMessage(method === 'manual' ? 'Manual logistics selected' : 'Shiprocket selected');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update shipping method');
    } finally {
      setBusy(false);
    }
  }

  async function rebuildPickList() {
    if (!orderId || !canWrite) return;
    setBusy(true);
    try {
      await warehouseClient.rebuildPickList(orderId);
      setMessage('Pick list rebuilt');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rebuild failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmPackage() {
    if (!orderId || !canWrite) return;
    if (!selectedBoxId) {
      setError('Select a box and calculate package first');
      return;
    }
    setBusy(true);
    try {
      await applyPackage(selectedBoxId);
      await warehouseClient.packageConfirm(orderId, shippingMethod !== 'manual');
      const refreshed = await warehouseClient.getOrder(orderId);
      setDetail(refreshed);
      const refreshedGates = buildFulfillmentGatesFromOrderDetail(refreshed);
      if (refreshedGates.awbPending) {
        setMessage('Package confirmed — generating Shiprocket AWB…');
      } else if (refreshedGates.printEnabled) {
        setMessage('Package confirmed — ready to print documents');
      } else {
        setMessage('Package confirmed for courier');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm failed');
    } finally {
      setBusy(false);
    }
  }

  async function markPacked() {
    if (!orderId || !canWrite) return;
    setBusy(true);
    try {
      await warehouseClient.markPacked(orderId);
      void refreshQueue({ force: true });
      void refreshStats({ force: true });
      const refreshed = await warehouseClient.getOrder(orderId);
      const status = refreshed.order.oms_status;
      const refreshedGates = buildFulfillmentGatesFromOrderDetail(refreshed);
      if (status === 'awaiting_label_verification') {
        router.replace(`/(app)/packing/verify/${orderId}`);
      } else if (refreshedGates.printEnabled) {
        router.push(`/(app)/packing/print/${orderId}`);
      } else if (refreshedGates.shippingMethod === 'manual') {
        router.push(`/(app)/dispatch/lr-update/${orderId}`);
      } else {
        setDetail(refreshed);
        setMessage('Marked packed — complete AWB before printing label');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mark packed failed');
    } finally {
      setBusy(false);
    }
  }

  const gates = useMemo(() => {
    if (!detail) return null;
    return buildFulfillmentGatesFromOrderDetail(detail);
  }, [detail]);

  if (loading) return <Loading label="Loading pack details…" />;

  const order = detail?.order;
  const pkg = detail?.package;
  const needsPickSetup = !detail?.pickList?.id;
  const diag = detail?.shiprocketDiagnostics;
  const selectedBox = boxes.find((b) => b.id === selectedBoxId);
  const tareKg = selectedBox?.tareWeightKg ?? 0.1;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + bottomPad }]}
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      {diag && !diag.authOk ? (
        <AlertBox>
          Shiprocket: {diag.authError ?? 'Auth failed'}
          {diag.authHint ? `\n${diag.authHint}` : ''}
        </AlertBox>
      ) : null}

      {needsPickSetup ? (
        <Panel title="Pick list required">
          <Text style={styles.hint}>This order has no pick list. Rebuild before packing.</Text>
          <Btn label="Rebuild pick list" onPress={rebuildPickList} disabled={busy || !canWrite} />
        </Panel>
      ) : null}

      {!gates?.pickComplete ? (
        <Panel title="Picking not complete">
          <Text style={styles.hint}>Finish picking all racks before packing this order.</Text>
          <Btn
            label="Back to picking"
            onPress={() => router.push(`/(app)/picking/${orderId}`)}
            variant="secondary"
          />
        </Panel>
      ) : null}

      <Panel title={order?.order_name ?? 'Pack order'}>
        <KeyValueRow label="Status" value={order?.oms_status ?? '—'} />
        <KeyValueRow label="Packed by" value={admin?.fullName ?? admin?.email ?? '—'} />
      </Panel>

      <Panel title="Package">
        <Text style={styles.hint}>
          Box sizes and tare weights come from Warehouse → Packaging → Box types. Product unit
          weight and units-per-box come from Inventory → product packaging.
        </Text>

        {boxes.length > 0 ? (
          <>
            <Text style={styles.label}>Select box</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.boxRow}>
              {boxes.map((box) => (
                <Btn
                  key={box.id}
                  label={box.code}
                  onPress={() => pickBox(box)}
                  variant={selectedBoxId === box.id ? 'primary' : 'secondary'}
                  disabled={busy || !canWrite}
                />
              ))}
            </ScrollView>
            {selectedBox ? (
              <Text style={styles.boxMeta}>
                {selectedBox.name} · {selectedBox.lengthCm}×{selectedBox.breadthCm}×
                {selectedBox.heightCm} cm · max {selectedBox.maxWeightKg ?? '—'} kg · tare{' '}
                {tareKg} kg
              </Text>
            ) : null}
          </>
        ) : null}

        <Text style={styles.label}>Number of boxes</Text>
        <View style={styles.boxCountRow}>
          <TextInput
            style={styles.boxCountInput}
            value={boxCount}
            onChangeText={setBoxCount}
            keyboardType="number-pad"
            placeholder="e.g. 10"
            placeholderTextColor={tokens.textMuted}
            editable={canWrite && !busy}
          />
          <Btn
            label="Calculate"
            onPress={() => void applyPackage()}
            disabled={busy || !canWrite || !selectedBoxId}
            variant="secondary"
          />
        </View>
        <Text style={styles.formulaHint}>
          Gross weight = product weight + (number of boxes × box tare). Courier is told how many
          boxes to expect.
        </Text>

        {pkg ? (
          <View style={styles.summary}>
            <KeyValueRow label="Box" value={pkg.suggestedBoxName ?? pkg.suggestedBoxCode ?? '—'} />
            <KeyValueRow label="Boxes for courier" value={pkg.boxCount != null ? String(pkg.boxCount) : '—'} />
            <KeyValueRow
              label="Product weight"
              value={pkg.estimatedWeightKg != null ? `${pkg.estimatedWeightKg} kg` : '—'}
            />
            <KeyValueRow
              label="Gross weight"
              value={pkg.packageWeightKg != null ? `${pkg.packageWeightKg} kg` : '—'}
            />
            <KeyValueRow
              label="Billing weight"
              value={pkg.billingWeightKg != null ? `${pkg.billingWeightKg} kg` : '—'}
            />
          </View>
        ) : null}

        <Btn label="Confirm package" onPress={confirmPackage} disabled={busy || !canWrite || !gates?.pickComplete} />
        <Btn label="Mark packed" onPress={markPacked} disabled={busy || !canWrite || !gates?.packageConfirmed} />
      </Panel>

      <Panel title="Transport">
        <Text style={styles.hint}>Choose Shiprocket (auto AWB) or manual logistics (LR updated later).</Text>
        <HubTabs
          tabs={[
            { id: 'shiprocket' as const, label: 'Shiprocket' },
            { id: 'manual' as const, label: 'Manual LR' },
          ]}
          active={shippingMethod}
          onChange={(m) => void setMethod(m)}
        />
        {gates?.awbPending ? (
          <Text style={styles.warn}>AWB pending — confirm package to generate Shiprocket label.</Text>
        ) : null}
        {gates?.printEnabled ? (
          <Text style={styles.success}>Ready to print — open documents below.</Text>
        ) : null}
      </Panel>

      {gates?.printEnabled ? (
        <Btn
          label="Print documents"
          onPress={() => router.push(`/(app)/packing/print/${orderId}`)}
        />
      ) : gates?.pickComplete && gates.packageConfirmed && shippingMethod === 'shiprocket' && !order?.tracking_awb ? (
        <Panel title="AWB pending">
          <Text style={styles.hint}>
            Shiprocket AWB was not assigned yet. Retry from staff portal or confirm package again after
            fixing wallet/courier issues.
          </Text>
        </Panel>
      ) : null}

      {orderId ? (
        <ExceptionPanel
          orderId={orderId}
          canWrite={canWrite}
          busy={busy}
          setBusy={setBusy}
          onDone={setMessage}
          onError={setError}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 8 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
  warn: { color: tokens.warning, marginBottom: 8, fontSize: 13 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 10, lineHeight: 18 },
  formulaHint: { fontSize: 12, color: tokens.textMuted, marginBottom: 12, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 8 },
  boxRow: { marginBottom: 6, maxHeight: 48 },
  boxMeta: { fontSize: 12, color: tokens.textMuted, marginBottom: 12 },
  boxCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  boxCountInput: {
    flex: 1,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.text,
  },
  summary: {
    backgroundColor: tokens.green100,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.green500,
    padding: 12,
    marginBottom: 12,
  },
});
