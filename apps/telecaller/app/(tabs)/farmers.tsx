import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { telecallerClient, t, tokens, type TelecallerOperationalLeadRow } from '@morbeez/shared';
import { AlertBox, EmptyState, Loading } from '@morbeez/ui-native';
import { FarmerCard } from '@/components/FarmerCard';
import { useLocale } from '@/context/LocaleContext';

const FILTER_IDS = [
  { id: 'all', smartFilter: 'all', label: 'All', sort: undefined as string | undefined },
  { id: 'active', smartFilter: 'pending', label: 'Active', sort: undefined },
  { id: 'follow_up', smartFilter: 'overdue', label: 'Need Follow-up', sort: undefined },
  { id: 'due_today', smartFilter: 'due_today', label: 'Due Today', sort: undefined },
  { id: 'visit', smartFilter: 'pending', label: 'Need Visit', sort: undefined },
  { id: 'high_value', smartFilter: 'hot_leads', label: 'High Value', sort: undefined },
  { id: 'recent', smartFilter: undefined, sort: 'recent_interaction', label: 'Recent Orders' },
  { id: 'bulk', smartFilter: 'high_acreage', label: 'Bulk Customers', sort: undefined },
] as const;

type FilterId = (typeof FILTER_IDS)[number]['id'];

export default function FarmersScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [farmers, setFarmers] = useState<TelecallerOperationalLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const activeFilter = useMemo(
    () => FILTER_IDS.find((f) => f.id === filter) ?? FILTER_IDS[0],
    [filter]
  );

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await telecallerClient.listOperationalLeads({
        scope: 'mine',
        search: query.trim() || undefined,
        smartFilter: activeFilter.smartFilter,
        sort: activeFilter.sort ?? 'priority',
        limit: 50,
      });
      setFarmers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadingFarmers', locale));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, activeFilter, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && farmers.length === 0) return <Loading label={t('loadingFarmers', locale)} />;

  return (
    <View style={styles.root}>
      <FlatList
        data={farmers}
        keyExtractor={(f) => f.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {error ? <AlertBox>{error}</AlertBox> : null}
            <TextInput
              style={styles.search}
              placeholder="Search name, phone, village…"
              placeholderTextColor={tokens.textMuted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void load()}
              returnKeyType="search"
            />
            <View style={styles.chips}>
              {FILTER_IDS.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={[styles.chip, filter === f.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <FarmerCard lead={item} onOpenWorkspace={() => router.push(`/lead/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState>
            {query.trim() || filter !== 'all' ? t('noFarmersMatch', locale) : t('noFarmersYet', locale)}
          </EmptyState>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  search: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
    color: tokens.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
  },
  chipActive: { backgroundColor: tokens.green100, borderColor: tokens.green500 },
  chipText: { fontSize: 13, color: tokens.textMuted },
  chipTextActive: { color: tokens.green800, fontWeight: '600' },
});
