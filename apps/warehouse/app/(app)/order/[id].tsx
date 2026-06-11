import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { tokens, warehouseClient, type PickLookup, type WarehouseOrderDetail } from '@morbeez/shared';
import { AlertBox, Btn, HubTabs, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { useStaffAuth } from '@/context/StaffAuth';

const EXCEPTIONS = [
  { type: 'stock_missing', label: 'Stock missing' },
  { type: 'wrong_barcode', label: 'Wrong barcode' },
  { type: 'reprint_label', label: 'Reprint label' },
  { type: 'courier_failed', label: 'Courier failed' },
  { type: 'weight_mismatch', label: 'Weight mismatch' },
] as const;

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canWrite } = useStaffAuth();
  const [detail, setDetail] = useState<WarehouseOrderDetail | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [labelScanCode, setLabelScanCode] = useState('');
  const [pickLookup, setPickLookup] = useState<PickLookup | null>(null);
  const [pickQty, setPickQty] = useState('1');
  const [scanMsg, setScanMsg] = useState('');
  const [wrongLabel, setWrongLabel] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (startSession = false) => {
      if (!id) return;
      setError('');
      try {
        const data = await warehouseClient.getOrder(id);
        setDetail(data);
        if (data.packSession?.id) {
          setSessionId(data.packSession.id);
        } else if (canWrite && startSession && data.pickList) {
          try {
            const sid = await warehouseClient.startPackSession(id);
            setSessionId(sid);
            const refreshed = await warehouseClient.getOrder(id);
            setDetail(refreshed);
          } catch (e) {
            setSessionId('');
            setError(e instanceof Error ? e.message : 'Could not start pick session');
          }
        } else {
          setSessionId('');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load order');
      } finally {
        setLoading(false);
      }
    },
    [id, canWrite]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  async function lookupBarcode(code?: string) {
    const value = (code ?? scanCode).trim();
    if (!sessionId || !value) return;
    setScanMsg('');
    setError('');
    try {
      const r = await warehouseClient.lookupBarcode(sessionId, value);
      if (r.ok && r.lineId) {
        setPickLookup({
          lineId: r.lineId,
          productTitle: r.productTitle ?? value,
          sku: r.sku ?? null,
          batchCode: r.batchCode ?? null,
          qtyRequired: r.qtyRequired ?? 1,
          qtyPicked: r.qtyPicked ?? 0,
          remaining: r.remaining ?? 1,
          defaultQty: r.defaultQty ?? 1,
        });
        setPickQty(String(r.defaultQty ?? 1));
        setScanCode('');
      } else {
        setScanMsg(r.error ?? 'Scan failed');
      }
    } catch (e) {
      setScanMsg(e instanceof Error ? e.message : 'Lookup failed');
    }
  }

  async function confirmPick() {
    if (!sessionId || !pickLookup) return;
    const qty = Number(pickQty);
    if (!qty || qty < 1) {
      setError('Enter a valid quantity');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await warehouseClient.confirmPick(sessionId, pickLookup.lineId, qty);
      setPickLookup(null);
      setMessage(r.message ?? (r.stage === 'print' ? 'All racks complete — ready to print' : 'Picked'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm pick failed');
    } finally {
      setBusy(false);
    }
  }

  async function verifyLabel(code?: string) {
    const value = (code ?? labelScanCode).trim();
    if (!id || !value || !canWrite) return;
    setBusy(true);
    setWrongLabel('');
    setError('');
    try {
      const r = await warehouseClient.verifyLabel(id, value);
      if (r.matched) {
        setLabelScanCode('');
        setMessage(r.message ?? 'Label verified');
        await load();
      } else {
        setWrongLabel(r.error ?? 'Wrong label — scan the next label from your tray');
      }
    } catch (e) {
      setWrongLabel(e instanceof Error ? e.message : 'Label verification failed');
    } finally {
      setBusy(false);
    }
  }

  async function runAction(okMsg: string, fn: () => Promise<unknown>) {
    if (!id || !canWrite) return;
    setBusy(true);
    setError('');
    try {
      await fn();
      setMessage(okMsg);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function reportException(type: string) {
    await runAction('Exception logged', () =>
      warehouseClient.reportException(id!, type, `Reported from mobile: ${type}`)
    );
  }

  if (loading) return <Loading label="Loading order…" />;

  const order = detail?.order;
  const workflow = detail?.workflow;
  const lines = workflow?.currentRackLines ?? [];
  const printStage = workflow?.stage === 'print' || detail?.printEnabled;
  const customer = detail?.customerSummary;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {scanMsg ? <Text style={styles.warn}>{scanMsg}</Text> : null}
      {wrongLabel ? <AlertBox>{wrongLabel}</AlertBox> : null}

      <Panel title={order?.order_name ?? 'Order'}>
        <KeyValueRow label="Status" value={order?.oms_status ?? '—'} />
        <KeyValueRow label="Courier" value={order?.courier_name ?? '—'} />
        <KeyValueRow label="AWB" value={order?.tracking_awb ?? '—'} />
        {customer ? (
          <>
            <KeyValueRow label="Customer" value={customer.phone ?? '—'} />
            <KeyValueRow
              label="Amount"
              value={customer.isCod ? `COD ₹${customer.totalAmount}` : `₹${customer.totalAmount}`}
            />
          </>
        ) : null}
        {order?.shiprocket_error ? <KeyValueRow label="Shiprocket" value={order.shiprocket_error} /> : null}
      </Panel>

      {workflow?.racks?.length ? (
        <Panel title="Rack progress">
          <HubTabs
            tabs={workflow.racks.map((r) => ({
              id: r.rack,
              label: `${r.rack}${r.complete ? ' ✓' : r.active ? ' •' : ''}`,
            }))}
            active={workflow.currentRack ?? workflow.racks[0]!.rack}
            onChange={() => {}}
          />
          <Text style={styles.muted}>
            Stage: {workflow.stage} · Step {workflow.step}
            {workflow.currentRack ? ` · Rack ${workflow.currentRack}` : ''}
          </Text>
        </Panel>
      ) : null}

      {!printStage ? (
        <Panel title="Barcode pick">
          {!sessionId ? (
            <Btn
              label="Start pack session"
              onPress={() => void load(true)}
              disabled={busy || !detail?.pickList?.id || !canWrite}
            />
          ) : (
            <>
              <BarcodeScanner onScan={(code) => void lookupBarcode(code)} disabled={busy} />
              <TextInput
                style={styles.input}
                placeholder="Scan or enter barcode / SKU"
                placeholderTextColor={tokens.textMuted}
                value={scanCode}
                onChangeText={setScanCode}
                onSubmitEditing={() => void lookupBarcode()}
                autoCapitalize="none"
              />
              <Btn label="Lookup barcode" onPress={() => void lookupBarcode()} disabled={busy} variant="secondary" />
            </>
          )}
          {pickLookup ? (
            <View style={styles.lookupBox}>
              <Text style={styles.lineTitle}>{pickLookup.productTitle}</Text>
              <Text style={styles.lineMeta}>
                SKU {pickLookup.sku ?? '—'} · Batch {pickLookup.batchCode ?? '—'}
              </Text>
              <Text style={styles.lineMeta}>
                {pickLookup.qtyPicked}/{pickLookup.qtyRequired} picked · {pickLookup.remaining} remaining
              </Text>
              <TextInput
                style={styles.input}
                value={pickQty}
                onChangeText={setPickQty}
                keyboardType="numeric"
                placeholder="Qty to pick"
                placeholderTextColor={tokens.textMuted}
              />
              <Btn label={`Confirm pick (${pickQty})`} onPress={confirmPick} disabled={busy} />
              <Btn label="Cancel" onPress={() => setPickLookup(null)} variant="secondary" />
            </View>
          ) : null}
          {lines.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Current rack lines</Text>
              {lines.map((line) => (
                <View key={line.id} style={styles.line}>
                  <Text style={styles.lineTitle}>{line.productTitle}</Text>
                  <Text style={styles.lineMeta}>
                    Batch {line.batchCode ?? '—'} · {line.qtyPicked}/{line.qtyRequired}
                    {line.complete ? ' · done' : ''}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
        </Panel>
      ) : (
        <Panel title="Print & label">
          <Text style={styles.muted}>Picking complete — verify shipping label before dispatch.</Text>
          <BarcodeScanner onScan={(code) => void verifyLabel(code)} disabled={busy} />
          <TextInput
            style={styles.input}
            placeholder="Scan label QR / barcode"
            placeholderTextColor={tokens.textMuted}
            value={labelScanCode}
            onChangeText={setLabelScanCode}
            onSubmitEditing={() => void verifyLabel()}
            autoCapitalize="none"
          />
          <Btn label="Verify label" onPress={() => void verifyLabel()} disabled={busy || !canWrite} />
          {detail?.shippingLabel?.labelVerified ? (
            <Text style={styles.success}>Label already verified</Text>
          ) : null}
          <Btn
            label="Mark packed"
            onPress={() => runAction('Order marked packed', () => warehouseClient.markPacked(id!))}
            disabled={busy || !canWrite}
          />
          <Btn
            label="Generate AWB"
            onPress={() =>
              runAction('AWB request sent', () => warehouseClient.generateAwb(id!, false))
            }
            disabled={busy || !canWrite}
            variant="secondary"
          />
        </Panel>
      )}

      {canWrite ? (
        <Panel title="Exceptions">
          <View style={styles.exceptionRow}>
            {EXCEPTIONS.map((ex) => (
              <Btn
                key={ex.type}
                label={ex.label}
                onPress={() => reportException(ex.type)}
                disabled={busy}
                variant="secondary"
              />
            ))}
          </View>
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
  warn: { color: tokens.warning, marginBottom: 8, fontSize: 13 },
  muted: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: tokens.text, marginTop: 12, marginBottom: 8 },
  line: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  lineTitle: { fontSize: 14, fontWeight: '600', color: tokens.text },
  lineMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  lookupBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.green500,
    backgroundColor: tokens.green100,
  },
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
  exceptionRow: { gap: 8 },
});
