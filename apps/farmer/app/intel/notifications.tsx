import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchPortalNotifications, tokens, type PortalNotification } from '@morbeez/shared';
import { AlertBox, EmptyState, Loading } from '@morbeez/ui-native';

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchPortalNotifications()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load notifications'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading notifications…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
      ListEmptyComponent={<EmptyState>No notifications right now.</EmptyState>}
      renderItem={({ item }) => (
        <Text style={styles.row} onPress={() => {
          if (item.type === 'advisory') router.push('/recommendations');
          else if (item.type === 'delivery') router.push('/orders');
          else if (item.type === 'soil') router.push('/reports');
        }}>
          {item.message}
          {'\n'}
          <Text style={styles.meta}>{item.atLabel}</Text>
        </Text>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  row: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    marginBottom: 8,
    fontSize: 14,
    color: tokens.text,
    lineHeight: 20,
  },
  meta: { fontSize: 12, color: tokens.textMuted },
});
