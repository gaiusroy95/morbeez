import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { partnerClient, tokens, type PartnerFarmerListRow } from '@morbeez/shared';
import {AlertBox, EmptyState, Loading, stableRowKey } from '@morbeez/ui-native';

export default function FarmersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [farmers, setFarmers] = useState<PartnerFarmerListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setFarmers(await partnerClient.listFarmers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load farmers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return farmers;
    return farmers.filter((f) =>
      [f.name, f.phone, f.village, f.district, f.primaryCrop, f.suggestedActionLabel].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  }, [farmers, query]);

  if (loading && !farmers.length) return <Loading label="Loading farmers…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={filtered}
        keyExtractor={(f, i) => stableRowKey(f.id, i)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {error ? <AlertBox>{error}</AlertBox> : null}
            <TextInput
              style={styles.search}
              placeholder="Search name, crop, village…"
              placeholderTextColor={tokens.textMuted}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
          </>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/farmer/${item.id}`)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {[item.primaryCrop, item.totalAcreage != null ? `${item.totalAcreage} ac` : null]
                .filter(Boolean)
                .join(' · ') || '—'}
            </Text>
            <Text style={styles.meta}>
              {[item.village, item.district].filter(Boolean).join(', ') || '—'}
            </Text>
            {item.lastOrderDate ? (
              <Text style={styles.meta}>Last order: {item.lastOrderDate}</Text>
            ) : null}
            {item.suggestedAction !== 'none' ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{item.suggestedActionLabel}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState>
            {query.trim() ? 'No farmers match your search.' : 'No farmers enrolled yet.'}
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
    marginBottom: 12,
    color: tokens.text,
  },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    marginBottom: 10,
  },
  name: { fontSize: 16, fontWeight: '600', color: tokens.text },
  meta: { fontSize: 13, color: tokens.textMuted, marginTop: 4 },
  chip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: tokens.green100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radiusSm,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: tokens.green800 },
});
