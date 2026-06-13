import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate, telecallerClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, ListCard, Loading, Panel, TextField } from '@morbeez/ui-native';

type Props = {
  leadId: string;
};

function formatAmount(amount?: unknown) {
  if (amount == null) return null;
  const n = Number(amount);
  if (Number.isNaN(n)) return null;
  return `₹${n.toLocaleString('en-IN')}`;
}

export function LeadOrdersPanel({ leadId }: Props) {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await telecallerClient.listLeadOrders(leadId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createOrderFollowUp = async () => {
    if (!note.trim()) return;
    setCreating(true);
    try {
      await telecallerClient.createLeadTask(leadId, {
        title: `Order follow-up: ${note.trim()}`,
        taskCategory: 'other',
        notes: note.trim(),
      });
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create order follow-up');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <Loading label="Loading orders…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Orders">
        <Text style={styles.hint}>
          Full order creation is available in staff web CRM. Use follow-up below to track order conversations on mobile.
        </Text>
      </Panel>
      {orders.map((order) => (
        <ListCard
          key={String(order.id)}
          title={String(order.orderNumber ?? order.order_name ?? order.id).slice(0, 40)}
          subtitle={String(order.status ?? '—')}
          meta={[
            formatAmount(order.totalAmount ?? order.total_amount),
            order.createdAt || order.created_at ? formatDate(String(order.createdAt ?? order.created_at)) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      ))}
      {!orders.length ? <Text style={styles.empty}>No orders linked to this lead yet.</Text> : null}
      <Panel title="Create order follow-up">
        <TextField label="Notes" value={note} onChangeText={setNote} placeholder="Notes for order follow-up" />
        <Btn label={creating ? 'Saving…' : 'Create follow-up'} onPress={() => void createOrderFollowUp()} disabled={creating} />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, paddingBottom: 24 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
