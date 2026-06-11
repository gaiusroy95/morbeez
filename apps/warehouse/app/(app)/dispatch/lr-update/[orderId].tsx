import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { tokens, warehouseClient, type WarehouseMaster, type WarehouseOrderDetail } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

export default function LrUpdateScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const [detail, setDetail] = useState<WarehouseOrderDetail | null>(null);
  const [couriers, setCouriers] = useState<WarehouseMaster[]>([]);
  const [search, setSearch] = useState('');
  const [courierName, setCourierName] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setError('');
    try {
      const [d, masters] = await Promise.all([
        warehouseClient.getOrder(orderId),
        warehouseClient.getMasters('manual_courier'),
      ]);
      setDetail(d);
      setCouriers(masters);
      if (d.order.courier_name) setCourierName(d.order.courier_name);
      if (d.order.tracking_awb) setLrNumber(d.order.tracking_awb);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCouriers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return couriers;
    return couriers.filter((c) => c.name.toLowerCase().includes(q));
  }, [couriers, search]);

  async function save(notifyCustomer: boolean) {
    if (!orderId || !canWrite) return;
    if (!courierName.trim() || !lrNumber.trim()) {
      setError('Courier and LR number are required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await warehouseClient.saveManualLogistics(orderId, {
        courierName: courierName.trim(),
        trackingAwb: lrNumber.trim(),
        trackingUrl: trackingUrl.trim() || null,
        notifyCustomer,
      });
      setMessage(notifyCustomer ? 'LR saved — customer notified via WhatsApp' : 'LR saved — order ready for dispatch');
      router.replace('/(app)/(tabs)/dispatch');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading LR form…" />;

  const order = detail?.order;
  const customer = detail?.customerSummary;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Panel title={order?.order_name ?? 'LR update'}>
        <KeyValueRow label="Status" value={order?.oms_status ?? '—'} />
        <KeyValueRow label="Customer" value={customer?.phone ?? '—'} />
      </Panel>

      <Panel title="Logistics">
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Search courier (VRL, AKG, KNR…)"
          placeholderTextColor={tokens.textMuted}
        />
        <View style={styles.chips}>
          {filteredCouriers.slice(0, 12).map((c) => (
            <Btn
              key={c.id}
              label={c.name}
              onPress={() => setCourierName(c.name)}
              variant={courierName === c.name ? 'primary' : 'secondary'}
            />
          ))}
        </View>
        <TextInput style={styles.input} value={courierName} onChangeText={setCourierName} placeholder="Courier name" placeholderTextColor={tokens.textMuted} />
        <TextInput style={styles.input} value={lrNumber} onChangeText={setLrNumber} placeholder="LR / tracking number" placeholderTextColor={tokens.textMuted} autoCapitalize="characters" />
        <TextInput style={styles.input} value={trackingUrl} onChangeText={setTrackingUrl} placeholder="Tracking URL (optional)" placeholderTextColor={tokens.textMuted} autoCapitalize="none" />
        <Btn label={busy ? 'Saving…' : 'Save LR'} onPress={() => void save(false)} disabled={busy || !canWrite} />
        <Btn label="Save & notify customer" onPress={() => void save(true)} disabled={busy || !canWrite} variant="secondary" />
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
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
