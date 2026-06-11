import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { tokens, warehouseClient, type ShippingBox, type WarehouseOrderDetail } from '@morbeez/shared';
import { AlertBox, Btn, HubTabs, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { ExceptionPanel } from '@/components/ExceptionPanel';
import { useStaffAuth } from '@/context/StaffAuth';
import { useWarehouseQueue } from '@/context/WarehouseQueueContext';

export default function PackOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { admin, canWrite } = useStaffAuth();
  const { refreshQueue, refreshStats } = useWarehouseQueue();
  const [detail, setDetail] = useState<WarehouseOrderDetail | null>(null);
  const [boxes, setBoxes] = useState<ShippingBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [breadthCm, setBreadthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weight, setWeight] = useState('');
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
      setBoxes(b);
      const pkg = d.package;
      const sm = d.shippingMethod ?? (d.order.shipping_method === 'manual' ? 'manual' : 'shiprocket');
      setShippingMethod(sm);
      if (pkg?.lengthCm) setLengthCm(String(pkg.lengthCm));
      if (pkg?.breadthCm) setBreadthCm(String(pkg.breadthCm));
      if (pkg?.heightCm) setHeightCm(String(pkg.heightCm));
      if (pkg?.packageWeightKg) setWeight(String(pkg.packageWeightKg));
      else if (pkg?.estimatedWeightKg) setWeight(String(pkg.estimatedWeightKg));
      const match = b.find((x) => x.code === pkg?.suggestedBoxCode);
      if (match) setSelectedBoxId(match.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectBox(box: ShippingBox) {
    setSelectedBoxId(box.id);
    setLengthCm(String(box.length_cm));
    setBreadthCm(String(box.breadth_cm));
    setHeightCm(String(box.height_cm));
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

  async function estimatePackage() {
    if (!orderId || !canWrite) return;
    setBusy(true);
    try {
      await warehouseClient.packageEstimate(orderId);
      setMessage('Package estimate updated');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Estimate failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveOverride() {
    if (!orderId || !canWrite) return;
    const l = Number(lengthCm);
    const b = Number(breadthCm);
    const h = Number(heightCm);
    const w = Number(weight);
    if (!l || !b || !h || !w) {
      setError('Enter valid length, breadth, height, and weight');
      return;
    }
    setBusy(true);
    try {
      await warehouseClient.packageOverride(orderId, {
        boxId: selectedBoxId || undefined,
        lengthCm: l,
        breadthCm: b,
        heightCm: h,
        weightKg: w,
      });
      setMessage('Package dimensions saved');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Override failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmPackage() {
    if (!orderId || !canWrite) return;
    setBusy(true);
    try {
      await warehouseClient.packageConfirm(orderId, shippingMethod !== 'manual');
      setMessage('Package confirmed');
      await load();
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
      if (status === 'awaiting_label_verification') {
        router.replace(`/(app)/packing/verify/${orderId}`);
      } else {
        router.push(`/(app)/packing/print/${orderId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mark packed failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading pack details…" />;

  const order = detail?.order;
  const pkg = detail?.package;
  const needsPickSetup = !detail?.pickList?.id;
  const diag = detail?.shiprocketDiagnostics;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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

      <Panel title={order?.order_name ?? 'Pack order'}>
        <KeyValueRow label="Status" value={order?.oms_status ?? '—'} />
        <KeyValueRow label="Packed by" value={admin?.fullName ?? admin?.email ?? '—'} />
        {detail?.assignment?.batchId ? (
          <KeyValueRow label="Label batch" value={detail.assignment.batchId.slice(0, 8)} />
        ) : null}
      </Panel>

      <Panel title="Shipping method">
        <HubTabs
          tabs={[
            { id: 'shiprocket' as const, label: 'Shiprocket' },
            { id: 'manual' as const, label: 'Manual LR' },
          ]}
          active={shippingMethod}
          onChange={(m) => void setMethod(m)}
        />
      </Panel>

      <Panel title="Package">
        {pkg ? (
          <>
            <KeyValueRow label="Box" value={pkg.suggestedBoxName ?? pkg.suggestedBoxCode ?? '—'} />
            <KeyValueRow label="Category" value={pkg.packagingCategoryName ?? '—'} />
            <KeyValueRow label="Billing weight" value={pkg.billingWeightKg ? `${pkg.billingWeightKg} kg` : '—'} />
          </>
        ) : null}
        {boxes.length > 0 ? (
          <>
            <Text style={styles.label}>Select box</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.boxRow}>
              {boxes.map((box) => (
                <Btn
                  key={box.id}
                  label={box.code}
                  onPress={() => selectBox(box)}
                  variant={selectedBoxId === box.id ? 'primary' : 'secondary'}
                />
              ))}
            </ScrollView>
          </>
        ) : null}
        <TextInput style={styles.input} value={lengthCm} onChangeText={setLengthCm} keyboardType="decimal-pad" placeholder="Length (cm)" placeholderTextColor={tokens.textMuted} />
        <TextInput style={styles.input} value={breadthCm} onChangeText={setBreadthCm} keyboardType="decimal-pad" placeholder="Breadth (cm)" placeholderTextColor={tokens.textMuted} />
        <TextInput style={styles.input} value={heightCm} onChangeText={setHeightCm} keyboardType="decimal-pad" placeholder="Height (cm)" placeholderTextColor={tokens.textMuted} />
        <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Weight (kg)" placeholderTextColor={tokens.textMuted} />
        <Btn label="Save dimensions" onPress={saveOverride} disabled={busy || !canWrite} variant="secondary" />
        <Btn label="Recalculate estimate" onPress={estimatePackage} disabled={busy || !canWrite} variant="secondary" />
        <Btn label="Confirm package" onPress={confirmPackage} disabled={busy || !canWrite} />
        <Btn label="Mark packed" onPress={markPacked} disabled={busy || !canWrite} />
      </Panel>

      <Btn label="Print documents" onPress={() => router.push(`/(app)/packing/print/${orderId}`)} variant="secondary" />

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
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 8 },
  boxRow: { marginBottom: 8, maxHeight: 48 },
  input: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginVertical: 4,
    color: tokens.text,
  },
});
