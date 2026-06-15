import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { partnerClient, tokens, type PartnerFarmerOrderRow } from '@morbeez/shared';
import { AlertBox, ListCard, Loading } from '@morbeez/ui-native';

type Props = { farmerId: string };

export function PartnerOrdersPanel({ farmerId }: Props) {
  const [orders, setOrders] = useState<PartnerFarmerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void partnerClient
      .getFarmerOrders(farmerId)
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, [farmerId]);

  if (loading) return <Loading label="Loading orders…" />;
  if (error) return <AlertBox>{error}</AlertBox>;

  return (
    <View style={styles.root}>
      {orders.map((o) => (
        <ListCard
          key={o.id}
          title={o.products}
          subtitle={`Qty ${o.quantity} · ${o.deliveryStatus}`}
          meta={o.orderDate}
        />
      ))}
      {!orders.length ? <Text style={styles.empty}>No orders yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
