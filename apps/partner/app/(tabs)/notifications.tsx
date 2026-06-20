import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, partnerClient, tokens, type PartnerNotification } from '@morbeez/shared';
import {AlertBox, EmptyState, Loading, stableRowKey } from '@morbeez/ui-native';

function categoryLabel(category: string): string {
  switch (category) {
    case 'lead_offer':
      return 'Lead offer';
    case 'new_task':
      return 'New task';
    default:
      return 'Update';
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PartnerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await partnerClient.listNotifications();
      setItems(
        rows.map((n) => ({
          id: String(n.id),
          category: String(n.category),
          title: String(n.title),
          detail: n.detail ? String(n.detail) : null,
          at: String(n.at),
          farmerId: n.farmerId ? String(n.farmerId) : undefined,
          taskId: n.taskId ? String(n.taskId) : undefined,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openItem = (item: PartnerNotification) => {
    if (item.farmerId) router.push(`/farmer/${item.farmerId}`);
    else if (item.taskId) router.push('/(tabs)/tasks');
    else if (item.category === 'lead_offer') router.push('/(tabs)/leads');
  };

  if (loading && !items.length) return <Loading label="Loading notifications…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(n, i) => stableRowKey(n.id, i)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => openItem(item)}>
            <View style={styles.row}>
              <Text style={styles.category}>{categoryLabel(item.category)}</Text>
              <Text style={styles.time}>{formatDate(item.at)}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState>No notifications right now.</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  category: { fontSize: 11, fontWeight: '700', color: tokens.green700, textTransform: 'uppercase' },
  time: { fontSize: 11, color: tokens.textMuted },
  title: { fontSize: 15, fontWeight: '600', color: tokens.text },
  detail: { fontSize: 13, color: tokens.textMuted, marginTop: 4 },
});
