import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchActivities, tokens, type CultivationActivity } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, HubTabs, Loading } from '@morbeez/ui-native';

export default function ActivitiesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const [filter, setFilter] = useState<string>('all');
  const [items, setItems] = useState<CultivationActivity[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      setItems(
        await fetchActivities({
          blockId: params.blockId ? String(params.blockId) : undefined,
          type: filter === 'all' ? undefined : filter,
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load activities');
    } finally {
      setLoading(false);
    }
  }, [filter, params.blockId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading activities…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={
        <>
          {error ? <AlertBox>{error}</AlertBox> : null}
          <Btn label="Add activity" onPress={() => router.push({ pathname: '/activities/add', params: { blockId: params.blockId ?? '' } })} />
          <HubTabs
            tabs={[
              { id: 'all', label: 'All' },
              { id: 'spray_applied', label: 'Spray' },
              { id: 'fertigation', label: 'Fertigation' },
              { id: 'scouting', label: 'Scouting' },
            ]}
            active={filter}
            onChange={setFilter}
          />
        </>
      }
      ListEmptyComponent={<EmptyState>No activities recorded yet.</EmptyState>}
      renderItem={({ item }) => (
        <Text style={styles.row}>
          {item.dateLabel} · {item.activityLabel}
          {item.costInr ? ` · ₹${item.costInr}` : ''}
          {item.blockName ? ` · ${item.blockName}` : ''}
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
  },
});
