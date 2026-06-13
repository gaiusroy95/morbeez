import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { agronomistClient, formatDate, tokens, type FarmerOrderRow } from '@morbeez/shared';
import { AlertBox, ListCard, Loading, Panel } from '@morbeez/ui-native';

type Props = {
  farmerId: string;
};

function formatAmount(amount?: number | null) {
  if (amount == null) return null;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function FarmerOrdersPanel({ farmerId }: Props) {
  const [orders, setOrders] = useState<FarmerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await agronomistClient.listFarmerOrders(farmerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading orders…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Purchase history">
        <Text style={styles.hint}>
          Compare what the farmer bought against recommendations issued in the field.
        </Text>
      </Panel>
      <View style={styles.list}>
        {orders.map((item) => {
          const lines = (item.lineItems ?? [])
            .map((li) => [li.title, li.quantity != null ? `×${li.quantity}` : null].filter(Boolean).join(' '))
            .filter(Boolean)
            .join(', ');
          return (
            <ListCard
              key={item.id}
              title={item.orderNumber ? `#${item.orderNumber}` : 'Order'}
              subtitle={lines || '—'}
              meta={[item.status, formatAmount(item.totalAmount), item.createdAt ? formatDate(item.createdAt) : null]
                .filter(Boolean)
                .join(' · ')}
            />
          );
        })}
        {!orders.length ? <Text style={styles.empty}>No orders linked to this farmer yet.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, paddingBottom: 8 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  list: { gap: 8 },
  empty: { padding: 24, color: tokens.textMuted, textAlign: 'center' },
});
