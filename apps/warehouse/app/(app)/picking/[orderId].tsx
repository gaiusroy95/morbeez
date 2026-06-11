import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  tokens,
  warehouseClient,
  type PickLookup,
  type RackLine,
  type WarehouseOrderDetail,
} from '@morbeez/shared';
import { AlertBox, Btn, Loading } from '@morbeez/ui-native';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { ExceptionPanel } from '@/components/ExceptionPanel';
import { useStaffAuth } from '@/context/StaffAuth';

const FOOTER_BASE_HEIGHT = 168;
const FOOTER_CONFIRM_EXTRA = 72;

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? styles.statAccent : null]}>{value}</Text>
    </View>
  );
}

export default function PickOrderScreen() {
  const insets = useSafeAreaInsets();
  const footerBottomPad =
    Platform.OS === 'android' ? Math.max(insets.bottom, 28) : Math.max(insets.bottom, 12);
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const id = orderId;
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const wedgeRef = useRef<TextInput>(null);
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
  const [scannerOpen, setScannerOpen] = useState(false);

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
  const lines = workflow?.currentRackLines ?? [];

  const currentRackIndex = useMemo(() => {
    if (!workflow?.currentRack) return 0;
    const idx = racks.findIndex((r) => r.rack === workflow.currentRack);
    return idx >= 0 ? idx : 0;
  }, [workflow, racks]);

  const activeRack = useMemo(
    () => racks.find((r) => r.active) ?? racks[currentRackIndex] ?? null,
    [racks, currentRackIndex]
  );

  const rackPercent = useMemo(() => {
    if (!activeRack?.totalQty) return 0;
    return Math.round((activeRack.pickedQty / activeRack.totalQty) * 100);
  }, [activeRack]);

  const nextRack = useMemo(() => {
    if (!workflow?.currentRack) return null;
    const idx = racks.findIndex((r) => r.rack === workflow.currentRack);
    for (let i = idx + 1; i < racks.length; i += 1) {
      if (!racks[i]?.complete) return racks[i]?.rack ?? null;
    }
    return racks.find((r) => !r.complete && r.rack !== workflow.currentRack)?.rack ?? null;
  }, [racks, workflow?.currentRack]);

  const currentRackComplete = useMemo(() => {
    if (!lines.length) return activeRack?.complete ?? false;
    return lines.every((l) => l.complete);
  }, [lines, activeRack]);

  const allRacksComplete = useMemo(
    () => Boolean(detail?.printEnabled || workflow?.stage === 'print'),
    [detail?.printEnabled, workflow?.stage]
  );

  const focusLine: RackLine | PickLookup | null = useMemo(() => {
    if (pickLookup) return pickLookup;
    return lines.find((l) => !l.complete) ?? lines[0] ?? null;
  }, [pickLookup, lines]);

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
      setMessage(
        r.message ??
          (r.printEnabled || r.stage === 'print'
            ? 'All racks complete — open printables'
            : r.rackComplete
              ? 'Rack complete — tap Next rack'
              : 'Picked')
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirm pick failed');
    } finally {
      setBusy(false);
    }
  }

  async function goNextRack() {
    if (!sessionId) return;
    setBusy(true);
    setError('');
    try {
      const r = await warehouseClient.advanceToNextRack(sessionId);
      setMessage(
        r.message ??
          (r.printEnabled || r.stage === 'print'
            ? 'All racks complete — open printables'
            : 'Next rack ready')
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not advance rack');
    } finally {
      setBusy(false);
    }
  }

  function openPrintables() {
    if (!id) return;
    router.push(`/(app)/packing/print/${id}`);
  }

  if (loading) return <Loading label="Loading pick session…" />;

  const order = detail?.order;
  const canScan = Boolean(sessionId && canWrite && !busy && !currentRackComplete && !allRacksComplete);
  const canAdvance = Boolean(sessionId && canWrite && !busy && currentRackComplete && !allRacksComplete);
  const canPrint = Boolean(id && canWrite && !busy && allRacksComplete);
  const hasManualCode = scanCode.trim().length > 0;
  const footerHeight =
    FOOTER_BASE_HEIGHT + footerBottomPad + (pickLookup ? FOOTER_CONFIRM_EXTRA : 0);
  const productTitle = focusLine ? ('productTitle' in focusLine ? focusLine.productTitle : '') : '';
  const qtyRequired = focusLine?.qtyRequired ?? 0;
  const qtyPicked = focusLine?.qtyPicked ?? 0;
  const qtyRemaining = focusLine?.remaining ?? Math.max(0, qtyRequired - qtyPicked);
  const batchCode = focusLine && 'batchCode' in focusLine ? focusLine.batchCode : null;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: footerHeight + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <AlertBox>{error}</AlertBox> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        {scanMsg ? <Text style={styles.warn}>{scanMsg}</Text> : null}

        {!detail?.pickList?.id && canWrite ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Pick list missing</Text>
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
          </View>
        ) : null}

        <View style={styles.rackHeaderCard}>
          <View style={styles.rackTopRow}>
            <Text style={styles.rackCount}>
              Rack {currentRackIndex + 1} of {Math.max(racks.length, 1)}
            </Text>
            <Text style={styles.rackLocation}>{workflow?.currentRack ?? '—'}</Text>
            <Text style={styles.rackPercent}>{rackPercent}% Completed</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${rackPercent}%` }]} />
          </View>
          {nextRack ? (
            <View style={styles.nextRackRow}>
              <Text style={styles.nextRackLabel}>Next rack →</Text>
              <View style={styles.nextRackChip}>
                <Text style={styles.nextRackChipText}>{nextRack}</Text>
              </View>
            </View>
          ) : null}
          <Text style={styles.orderMeta}>{order?.order_name ?? 'Order'}</Text>
        </View>

        {!sessionId ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Session</Text>
            <Btn
              label="Start pick session"
              onPress={() => void load(true)}
              disabled={busy || !detail?.pickList?.id || !canWrite}
            />
          </View>
        ) : focusLine ? (
          <View style={styles.productCard}>
            <View style={styles.productCardHeader}>
              <Text style={styles.cardEyebrow}>Current product</Text>
              {!pickLookup && qtyRemaining > 0 ? (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredBadgeText}>Required</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.productRow}>
              <View style={styles.productThumb}>
                <Ionicons name="cube-outline" size={36} color={tokens.green700} />
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productTitle}>{productTitle}</Text>
                <Text style={styles.productMeta}>Batch: {batchCode ?? '—'}</Text>
                {focusLine && 'sku' in focusLine && focusLine.sku ? (
                  <Text style={styles.productMeta}>SKU: {focusLine.sku}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.statsRow}>
              <StatBox label="Required" value={String(qtyRequired)} />
              <StatBox label="Picked" value={String(qtyPicked)} />
              <StatBox label="Remaining" value={String(qtyRemaining)} accent={qtyRemaining > 0} />
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.muted}>No products on this rack.</Text>
          </View>
        )}

        {pickLookup ? (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Barcode matched</Text>
            <Text style={styles.productMeta}>
              {pickLookup.productTitle} — confirm quantity in the bar below
            </Text>
          </View>
        ) : null}

        {lines.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Items in this rack ({lines.length})</Text>
            {lines.map((line) => (
              <View key={line.id} style={styles.lineRow}>
                <View style={styles.lineRowMain}>
                  <Text style={[styles.lineTitle, line.complete ? styles.lineDone : null]} numberOfLines={1}>
                    {line.productTitle}
                  </Text>
                  <View
                    style={[
                      styles.lineStatusBadge,
                      line.complete ? styles.lineStatusDone : styles.lineStatusPending,
                    ]}
                  >
                    <Ionicons
                      name={line.complete ? 'checkmark-circle' : 'time-outline'}
                      size={14}
                      color={line.complete ? tokens.green700 : tokens.warning}
                    />
                    <Text
                      style={[
                        styles.lineStatusText,
                        line.complete ? styles.lineStatusTextDone : styles.lineStatusTextPending,
                      ]}
                    >
                      {line.complete ? 'Completed' : 'Pending'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.lineMeta}>
                  Required: {line.qtyRequired} · Picked: {line.qtyPicked}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {currentRackComplete && !allRacksComplete ? (
          <View style={styles.rackCompleteBanner}>
            <Ionicons name="checkmark-circle" size={20} color={tokens.green700} />
            <Text style={styles.rackCompleteText}>This rack is complete. Tap Next rack to continue.</Text>
          </View>
        ) : null}

        {allRacksComplete ? (
          <View style={styles.rackCompleteBanner}>
            <Ionicons name="print-outline" size={20} color={tokens.green700} />
            <Text style={styles.rackCompleteText}>All racks picked. Open printables to finish.</Text>
          </View>
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

      {sessionId ? (
        <>
          <BarcodeScanner
            hideTrigger
            open={scannerOpen}
            onOpenChange={setScannerOpen}
            onScan={(code) => void lookupBarcode(code)}
            disabled={!canScan}
            hint="Point at product barcode"
          />
          <View style={[styles.footer, { paddingBottom: footerBottomPad }]}>
            {pickLookup ? (
              <>
                <Text style={styles.footerConfirmLabel} numberOfLines={2}>
                  Pick {pickQty} of {pickLookup.remaining} remaining · {pickLookup.productTitle}
                </Text>
                <TextInput
                  style={styles.qtyInput}
                  value={pickQty}
                  onChangeText={setPickQty}
                  keyboardType="numeric"
                  placeholder="Qty to pick"
                  placeholderTextColor={tokens.textMuted}
                />
                <Pressable
                  style={[styles.primaryFooterBtn, busy ? styles.footerBtnDisabled : null]}
                  onPress={() => void confirmPick()}
                  disabled={busy}
                >
                  <Ionicons name="checkmark-circle" size={22} color={tokens.card} />
                  <View style={styles.footerBtnTextWrap}>
                    <Text style={styles.primaryFooterTitle}>CONFIRM PICK ({pickQty})</Text>
                    <Text style={styles.primaryFooterSub}>Add picked quantity to this rack</Text>
                  </View>
                </Pressable>
                <Pressable style={styles.cancelLink} onPress={() => setPickLookup(null)} disabled={busy}>
                  <Text style={styles.cancelLinkText}>Cancel</Text>
                </Pressable>
              </>
            ) : !currentRackComplete && !allRacksComplete ? (
              <>
                <View style={styles.barcodeRow}>
                  <TextInput
                    ref={wedgeRef}
                    style={styles.barcodeInput}
                    placeholder="Enter or scan barcode"
                    placeholderTextColor={tokens.textMuted}
                    value={scanCode}
                    onChangeText={setScanCode}
                    onSubmitEditing={() => void lookupBarcode()}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={canScan}
                    returnKeyType="done"
                  />
                  <Pressable
                    style={[
                      styles.lookupBtn,
                      !canScan || !hasManualCode ? styles.footerBtnDisabled : null,
                    ]}
                    onPress={() => void lookupBarcode()}
                    disabled={!canScan || !hasManualCode}
                    accessibilityLabel="Look up barcode"
                  >
                    <Ionicons name="arrow-forward" size={22} color={tokens.card} />
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.primaryFooterBtn, !canScan ? styles.footerBtnDisabled : null]}
                  onPress={() => {
                    if (hasManualCode) void lookupBarcode();
                    else setScannerOpen(true);
                  }}
                  disabled={!canScan}
                >
                  <Ionicons
                    name={hasManualCode ? 'search' : 'barcode-outline'}
                    size={22}
                    color={tokens.card}
                  />
                  <View style={styles.footerBtnTextWrap}>
                    <Text style={styles.primaryFooterTitle}>
                      {hasManualCode ? 'LOOK UP BARCODE' : 'SCAN PRODUCT'}
                    </Text>
                    <Text style={styles.primaryFooterSub}>
                      {hasManualCode
                        ? 'Use the barcode you entered'
                        : 'Scan barcode with camera'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={tokens.card} />
                </Pressable>
              </>
            ) : allRacksComplete ? (
              <View style={styles.hintBar}>
                <Ionicons name="print-outline" size={18} color={tokens.green700} />
                <Text style={styles.hintBarText}>Picking complete — print documents</Text>
              </View>
            ) : (
              <View style={styles.hintBar}>
                <Ionicons name="arrow-forward-circle" size={18} color={tokens.green700} />
                <Text style={styles.hintBarText}>All items picked on this rack</Text>
              </View>
            )}

            {!pickLookup && allRacksComplete ? (
              <Pressable
                style={[styles.primaryFooterBtn, !canPrint ? styles.footerBtnDisabled : null]}
                onPress={openPrintables}
                disabled={!canPrint}
              >
                <Ionicons name="print-outline" size={22} color={tokens.card} />
                <View style={styles.footerBtnTextWrap}>
                  <Text style={styles.primaryFooterTitle}>OPEN PRINTABLES</Text>
                  <Text style={styles.primaryFooterSub}>Labels, invoice & packing slip</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={tokens.card} />
              </Pressable>
            ) : !pickLookup && currentRackComplete ? (
              <Pressable
                style={[styles.primaryFooterBtn, !canAdvance ? styles.footerBtnDisabled : null]}
                onPress={() => void goNextRack()}
                disabled={!canAdvance}
              >
                <Ionicons name="arrow-forward-circle" size={22} color={tokens.card} />
                <View style={styles.footerBtnTextWrap}>
                  <Text style={styles.primaryFooterTitle}>NEXT RACK</Text>
                  <Text style={styles.primaryFooterSub}>
                    {nextRack ? `Continue to ${nextRack}` : 'Advance to next rack'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={tokens.card} />
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16 },
  success: { color: tokens.green700, marginBottom: 8, fontSize: 14 },
  warn: { color: tokens.warning, marginBottom: 8, fontSize: 13 },
  muted: { fontSize: 14, color: tokens.textMuted },
  rackHeaderCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    marginBottom: 12,
  },
  rackTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  rackCount: { fontSize: 13, color: tokens.textMuted, flex: 1 },
  rackLocation: {
    fontSize: 22,
    fontWeight: '800',
    color: tokens.text,
    letterSpacing: 0.5,
    flex: 2,
    textAlign: 'center',
  },
  rackPercent: { fontSize: 13, color: tokens.textMuted, flex: 1, textAlign: 'right' },
  progressTrack: {
    height: 10,
    backgroundColor: tokens.border,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: { height: 10, backgroundColor: tokens.green500 },
  nextRackRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  nextRackLabel: { fontSize: 13, color: tokens.textMuted },
  nextRackChip: {
    borderWidth: 1,
    borderColor: tokens.green500,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  nextRackChipText: { fontSize: 13, fontWeight: '700', color: tokens.green800 },
  orderMeta: { fontSize: 12, color: tokens.textMuted },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    marginBottom: 12,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  productCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  productCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requiredBadge: {
    backgroundColor: tokens.green100,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  requiredBadgeText: { fontSize: 11, fontWeight: '700', color: tokens.green800 },
  productRow: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  productThumb: {
    width: 72,
    height: 72,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: { flex: 1 },
  productTitle: { fontSize: 17, fontWeight: '700', color: tokens.text, marginBottom: 6 },
  productMeta: { fontSize: 13, color: tokens.textMuted, marginBottom: 2 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: tokens.bg,
  },
  statLabel: { fontSize: 11, color: tokens.textMuted, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: tokens.text },
  statAccent: { color: tokens.warning },
  confirmCard: {
    backgroundColor: tokens.green100,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.green500,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  confirmTitle: { fontSize: 16, fontWeight: '700', color: tokens.green800 },
  qtyInput: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: tokens.text,
  },
  lineRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  lineRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  lineTitle: { fontSize: 14, fontWeight: '600', color: tokens.text, flex: 1 },
  lineDone: { color: tokens.textMuted },
  lineMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  lineStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lineStatusDone: { backgroundColor: tokens.green100 },
  lineStatusPending: { backgroundColor: '#FFF4E5' },
  lineStatusText: { fontSize: 11, fontWeight: '700' },
  lineStatusTextDone: { color: tokens.green800 },
  lineStatusTextPending: { color: tokens.warning },
  rackCompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tokens.green100,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.green500,
    padding: 12,
    marginBottom: 12,
  },
  rackCompleteText: { flex: 1, fontSize: 13, fontWeight: '600', color: tokens.green800 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 12,
    backgroundColor: tokens.card,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barcodeInput: {
    flex: 1,
    backgroundColor: tokens.bg,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tokens.text,
  },
  lookupBtn: {
    width: 48,
    height: 48,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.green700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerConfirmLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.green800,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  cancelLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.textMuted,
  },
  footerBtnDisabled: { opacity: 0.5 },
  primaryFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tokens.green700,
    borderRadius: tokens.radius,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  footerBtnTextWrap: { flex: 1 },
  primaryFooterTitle: { fontSize: 16, fontWeight: '800', color: tokens.card, letterSpacing: 0.5 },
  primaryFooterSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tokens.green100,
    borderRadius: tokens.radiusSm,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  hintBarText: { fontSize: 13, fontWeight: '600', color: tokens.green800 },
});
