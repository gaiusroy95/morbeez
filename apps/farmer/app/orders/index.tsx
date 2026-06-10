import { useEffect, useState } from 'react';
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchPortalOrders, formatInr, tokens, type PortalOrder } from '@morbeez/shared';
import { AlertBox, EmptyState, Loading } from '@morbeez/ui-native';
import { Badge } from '@/components/PortalHelpers';
import { whatsAppUrl } from '@/lib/config';

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setOrders(await fetchPortalOrders());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load orders');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loading label="Loading orders…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={orders}
      keyExtractor={(o) => o.id}
      ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
      ListEmptyComponent={<EmptyState>No orders yet. Browse the Shop tab to place your first order.</EmptyState>}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
          <View style={styles.row}>
            {item.productImageUrl ? (
              <Image source={{ uri: item.productImageUrl }} style={styles.img} />
            ) : (
              <View style={[styles.img, styles.imgPh]} />
            )}
            <View style={styles.main}>
              <Text style={styles.title}>{item.productTitle}</Text>
              <Badge label={item.statusLabel} tone={item.statusTone} />
              <Text style={styles.meta}>
                {item.orderNumber} · Qty {item.quantity} · {formatInr(item.amountInr)}
              </Text>
              <Text style={styles.meta}>{item.orderedOn}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Text style={styles.link} onPress={() => router.push(`/order/${item.id}`)}>Track order →</Text>
            <Text
              style={styles.link}
              onPress={() => router.push({ pathname: '/(tabs)/shop', params: { q: item.productTitle } })}
            >
              Reorder
            </Text>
            <Text style={styles.link} onPress={() => Linking.openURL(whatsAppUrl(`Invoice for order ${item.orderNumber}`))}>
              Get invoice via WhatsApp
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 12 },
  img: { width: 72, height: 72, borderRadius: 8 },
  imgPh: { backgroundColor: tokens.border },
  main: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: tokens.text, marginBottom: 4 },
  meta: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  actions: { marginTop: 12, gap: 6 },
  link: { fontSize: 13, color: tokens.green700, fontWeight: '600' },
});
