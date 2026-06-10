import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchActivities, formatInr, t, tokens, type CultivationActivity } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, HubTabs, Loading } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

export default function ActivitiesScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ blockId?: string }>();
  const [filter, setFilter] = useState<string>('all');
  const [items, setItems] = useState<CultivationActivity[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      setRefreshing(false);
    }
  }, [filter, params.blockId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.dateLabel < b.dateLabel ? 1 : -1)),
    [items]
  );

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={sorted}
      keyExtractor={(i) => i.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
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
        <View style={styles.card}>
          <Text style={styles.title}>{item.activityLabel}</Text>
          <Text style={styles.meta}>
            {item.dateLabel}
            {item.blockName ? ` · ${item.blockName}` : ''}
          </Text>
          {item.notes ? <Text style={styles.body}>{item.notes}</Text> : null}
          {item.costInr ? <Text style={styles.cost}>{formatInr(item.costInr)}</Text> : null}
        </View>
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
    marginBottom: 10,
  },
  title: { fontSize: 15, fontWeight: '600', color: tokens.text },
  meta: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  body: { fontSize: 13, color: tokens.text, marginTop: 6 },
  cost: { fontSize: 14, fontWeight: '700', color: tokens.green800, marginTop: 6 },
});
