import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { partnerClient, tokens } from '@morbeez/shared';
import { AlertBox, EmptyState, Loading } from '@morbeez/ui-native';

type FarmerRow = {
  id: string;
  name: string;
  phone?: string;
  village?: string;
  district?: string;
};

function parseFarmer(raw: Record<string, unknown>): FarmerRow {
  return {
    id: String(raw.id),
    name: String(raw.name ?? 'Farmer'),
    phone: raw.phone ? String(raw.phone) : undefined,
    village: raw.village ? String(raw.village) : undefined,
    district: raw.district ? String(raw.district) : undefined,
  };
}

export default function FarmersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [farmers, setFarmers] = useState<FarmerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await partnerClient.listFarmers();
      setFarmers(rows.map((r) => parseFarmer(r)));
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
      [f.name, f.phone, f.village, f.district].some((v) => v?.toLowerCase().includes(q))
    );
  }, [farmers, query]);

  if (loading && !farmers.length) return <Loading label="Loading farmers…" />;

  return (
    <View style={styles.root}>
      <FlatList
        data={filtered}
        keyExtractor={(f) => f.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
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
              returnKeyType="search"
            />
          </>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/farmer/${item.id}`)}>
            <Text style={styles.name}>{item.name}</Text>
            {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
            <Text style={styles.meta}>
              {[item.village, item.district].filter(Boolean).join(', ') || '—'}
            </Text>
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
});
