import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, telecallerClient, tokens, type TelecallerNotification } from '@morbeez/shared';
import { AlertBox, EmptyState, Loading } from '@morbeez/ui-native';

function categoryLabel(category: string): string {
  switch (category) {
    case 'escalation':
      return 'Escalation';
    case 'order_update':
      return 'Order update';
    case 'due_today':
      return 'Due today';
    case 'overdue_task':
      return 'Overdue';
    case 'sales_opportunity':
      return 'Sales opportunity';
    case 'visit_completed':
      return 'Partner visit';
    default:
      return 'Reminder';
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<TelecallerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setItems(await telecallerClient.listNotifications());
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

  if (loading && !items.length) return <Loading label="Loading notifications…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              if (item.leadId) router.push(`/lead/${item.leadId}`);
              else if (item.taskId) router.push('/(tabs)/follow-ups');
            }}
          >
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
