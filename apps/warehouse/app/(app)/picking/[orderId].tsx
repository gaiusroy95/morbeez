import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { tokens, warehouseClient, type PickLookup, type WarehouseOrderDetail } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { ExceptionPanel } from '@/components/ExceptionPanel';
import { useStaffAuth } from '@/context/StaffAuth';

export default function PickOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const id = orderId;
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const [detail, setDetail] = useState<WarehouseOrderDetail | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [pickLookup, setPickLookup] = useState<PickLookup | null>(null);
  const [pickQty, setPickQty] = useState('1');
  const [scanMsg, setScanMsg] = useState('');
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

  const workflow = detail?.workflow;
  const racks = workflow?.racks ?? [];
  const currentRackIndex = useMemo(() => {
    if (!workflow?.currentRack) return 0;
    const idx = racks.findIndex((r) => r.rack === workflow.currentRack);
    return idx >= 0 ? idx : 0;
  }, [workflow, racks]);

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
      setMessage(r.message ?? (r.stage === 'print' ? 'All racks complete' : 'Picked'));
      await load();
      const refreshed = await warehouseClient.getOrder(id!);
      const wf = refreshed.workflow;
      const rackDone = wf?.currentRackLines?.every((l) => l.complete) ?? false;
      if (rackDone && wf?.currentRack) {
        router.push({
          pathname: '/(app)/picking/rack-complete',
          params: {
            orderId: id,
            rack: wf.currentRack,
            nextRack: wf.racks.find((x) => !x.complete && x.rack !== wf.currentRack)?.rack ?? '',
            allDone: r.stage === 'print' ? '1' : '0',
          },
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm pick failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading pick session…" />;

  const lines = workflow?.currentRackLines ?? [];
  const order = detail?.order;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {scanMsg ? <Text style={styles.warn}>{scanMsg}</Text> : null}

      {detail?.assignment?.batchId ? (
        <Panel title="Label batch">
          <Text style={styles.hint}>
            Labels assigned — verify from tray QR after packing (batch {detail.assignment.batchId.slice(0, 8)}).
          </Text>
        </Panel>
      ) : null}

      {!detail?.pickList?.id && canWrite ? (
        <Panel title="Pick list missing">
          <Btn
            label="Rebuild pick list"
            onPress={async () => {
              if (!id) return;
              setBusy(true);
              try {
                await warehouseClient.rebuildPickList(id);
                setMessage('Pick list rebuilt');
                await load(true);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Rebuild failed');
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          />
        </Panel>
      ) : null}

      <Panel title={order?.order_name ?? 'Order'}>
        <KeyValueRow label="Status" value={order?.oms_status ?? '—'} />
        {racks.length > 0 ? (
          <>
            <Text style={styles.rackHeader}>
              Rack {currentRackIndex + 1} of {racks.length}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(((currentRackIndex + 1) / Math.max(racks.length, 1)) * 100)}%` },
                ]}
              />
            </View>
            {workflow?.currentRack ? (
              <Text style={styles.rackCode}>{workflow.currentRack}</Text>
            ) : null}
          </>
        ) : null}
      </Panel>

      <Panel title="Scan & pick">
        {!sessionId ? (
          <Btn
            label="Start pick session"
            onPress={() => void load(true)}
            disabled={busy || !detail?.pickList?.id || !canWrite}
          />
        ) : (
          <>
            <BarcodeScanner onScan={(code) => void lookupBarcode(code)} disabled={busy} hint="Or use BT scanner wedge below" />
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
              Required {pickLookup.qtyRequired} · Picked {pickLookup.qtyPicked} · Remaining {pickLookup.remaining}
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
        {lines.map((line) => (
          <View key={line.id} style={styles.line}>
            <Text style={styles.lineTitle}>{line.productTitle}</Text>
            <Text style={styles.lineMeta}>
              Batch {line.batchCode ?? '—'} · {line.qtyPicked}/{line.qtyRequired}
              {line.complete ? ' · done' : ''}
            </Text>
          </View>
        ))}
      </Panel>

      {detail?.printEnabled ? (
        <Btn label="Go to packing" onPress={() => router.replace(`/(app)/packing/${id}`)} />
      ) : null}

      {id ? (
        <ExceptionPanel
          orderId={id}
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
  content: { padding: 16, paddingBottom: 32 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
  warn: { color: tokens.warning, marginBottom: 8, fontSize: 13 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  rackHeader: { fontSize: 14, fontWeight: '600', color: tokens.text, marginTop: 8 },
  rackCode: {
    fontSize: 28,
    fontWeight: '700',
    color: tokens.green800,
    marginTop: 8,
    letterSpacing: 1,
  },
  progressTrack: {
    height: 8,
    backgroundColor: tokens.border,
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: tokens.green500 },
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
});
