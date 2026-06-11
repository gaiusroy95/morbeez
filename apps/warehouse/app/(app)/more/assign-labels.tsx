import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  isWarehouseManagerRole,
  tokens,
  warehouseClient,
  type AssignableOrder,
  type LabelBatch,
  type LabelStackItem,
  type WarehouseEmployee,
} from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, Loading, Panel } from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

export default function AssignLabelsScreen() {
  const router = useRouter();
  const { admin, canWrite } = useStaffAuth();
  const [employees, setEmployees] = useState<WarehouseEmployee[]>([]);
  const [orders, setOrders] = useState<AssignableOrder[]>([]);
  const [batches, setBatches] = useState<LabelBatch[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [stack, setStack] = useState<LabelStackItem[]>([]);
  const [trayNote, setTrayNote] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const manager = isWarehouseManagerRole(admin?.role);

  const load = useCallback(async () => {
    setError('');
    const [emp, ord, bat] = await Promise.all([
      warehouseClient.getEmployees(),
      warehouseClient.getAssignableOrders(),
      warehouseClient.getLabelBatches(),
    ]);
    setEmployees(emp);
    setOrders(ord);
    setBatches(bat);
  }, []);

  useEffect(() => {
    void load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  function toggleOrder(id: string) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function assignBatch() {
    const employee = employees.find((e) => e.id === selectedEmployeeId);
    if (!canWrite || !employee) return;
    const orderIds = [...selectedOrderIds];
    if (!orderIds.length) {
      setError('Select at least one order');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const batch = await warehouseClient.assignBatch(employee.id, employee.fullName, orderIds);
      setMessage(`Batch ${batch.batch_number} assigned to ${employee.fullName}`);
      setSelectedOrderIds(new Set());
      await load();
      await openBatch(batch.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  }

  async function openBatch(batchId: string) {
    try {
      const { labels } = await warehouseClient.getLabelBatchDetail(batchId);
      setStack(labels);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load batch');
    }
  }

  async function printBatch(batchId: string) {
    if (!canWrite) return;
    setBusy(true);
    setError('');
    try {
      const r = await warehouseClient.printLabelBatch(batchId);
      setStack(r.stack);
      setTrayNote(r.trayNote);
      setMessage(`Printed ${r.stack.length} labels — tap each label below to print`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Batch print failed');
    } finally {
      setBusy(false);
    }
  }

  if (!manager) {
    return (
      <View style={styles.root}>
        <EmptyState>Manager access required for label batch assignment.</EmptyState>
      </View>
    );
  }

  if (loading) return <Loading label="Loading assignment…" />;

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Panel title="1 — Assign orders">
        <Text style={styles.label}>Employee</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {employees.map((e) => (
            <Btn
              key={e.id}
              label={e.fullName}
              onPress={() => setSelectedEmployeeId(e.id)}
              variant={selectedEmployeeId === e.id ? 'primary' : 'secondary'}
            />
          ))}
        </ScrollView>
        {orders.length === 0 ? (
          <EmptyState>No unassigned orders.</EmptyState>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(o) => o.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Btn
                label={`${selectedOrderIds.has(item.id) ? '✓ ' : ''}${item.orderName}`}
                onPress={() => toggleOrder(item.id)}
                disabled={!selectedEmployeeId}
                variant={selectedOrderIds.has(item.id) ? 'primary' : 'secondary'}
              />
            )}
          />
        )}
        {canWrite ? (
          <Btn
            label={busy ? 'Working…' : `Create batch (${selectedOrderIds.size})`}
            onPress={assignBatch}
            disabled={busy || !selectedEmployee || selectedOrderIds.size === 0}
          />
        ) : null}
      </Panel>

      <Panel title="2 — Print batches">
        {batches.length === 0 ? (
          <EmptyState>No label batches yet.</EmptyState>
        ) : (
          batches.map((b) => (
            <View key={b.id} style={styles.batchRow}>
              <Btn label={`${b.batch_number} · ${b.assigned_employee_name}`} onPress={() => void openBatch(b.id)} variant="secondary" />
              {canWrite && b.batch_status !== 'printed' && b.batch_status !== 'completed' ? (
                <Btn label="Print stack" onPress={() => void printBatch(b.id)} disabled={busy} />
              ) : null}
            </View>
          ))
        )}
      </Panel>

      {stack.length > 0 ? (
        <Panel title="Label stack (tray order)">
          {trayNote ? <Text style={styles.hint}>{trayNote}</Text> : null}
          {[...stack].reverse().map((item) => (
            <View key={item.labelId} style={styles.stackItem}>
              <Text style={styles.stackTitle}>#{item.printSequence} {item.orderName}</Text>
              <Text style={styles.mono}>{item.qrCode}</Text>
              <Btn label="Open label" onPress={() => router.push(`/(app)/print/courier_label/${item.commerceOrderId}`)} variant="secondary" />
            </View>
          ))}
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  success: { color: tokens.green700, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, color: tokens.text },
  chips: { marginBottom: 8, maxHeight: 48 },
  batchRow: { gap: 8, marginBottom: 8 },
  stackItem: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.border },
  stackTitle: { fontWeight: '600', color: tokens.text },
  mono: { fontFamily: 'monospace', fontSize: 12, color: tokens.textMuted, marginVertical: 4 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
});
