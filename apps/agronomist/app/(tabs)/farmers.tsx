import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { agronomistClient, type AgronomistFarmerSearchRow, tokens } from '@morbeez/shared';
import { AlertBox, EmptyState, Loading } from '@morbeez/ui-native';
import { FarmerCard } from '@/components/FarmerCard';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'follow_up_due', label: 'Follow-up' },
  { id: 'escalation_open', label: 'Escalations' },
  { id: 'recently_visited', label: 'Recent' },
  { id: 'nearby', label: 'Nearby' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

export default function FarmersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [farmers, setFarmers] = useState<AgronomistFarmerSearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await agronomistClient.listFarmers({
        q: query.trim() || undefined,
        filter: filter === 'all' ? undefined : filter,
        limit: 50,
      });
      setFarmers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load farmers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && farmers.length === 0) return <Loading label="Loading farmers…" />;

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
              {FILTERS.map((f) => (
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
          <FarmerCard
            farmer={item}
            onOpenWorkspace={() => router.push(`/farmer/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState>
            {query.trim() || filter !== 'all'
              ? 'No farmers match your search.'
              : 'No farmers registered yet. Try searching by name or phone.'}
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
