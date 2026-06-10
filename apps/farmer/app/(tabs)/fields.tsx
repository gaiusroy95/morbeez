import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createFieldBlock, fetchFieldBlocks, tokens, type FieldBlock } from '@morbeez/shared';
import { AlertBox, Btn, EmptyState, FieldCard, Loading } from '@morbeez/ui-native';

export default function FieldsTabScreen() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<FieldBlock[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setBlocks(await fetchFieldBlocks());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load fields');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addField() {
    setAdding(true);
    setError('');
    try {
      await createFieldBlock({ name: 'New field', cropType: 'ginger' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add field');
    } finally {
      setAdding(false);
    }
  }

  const filtered = blocks.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${b.name} ${b.crop}`.toLowerCase().includes(q);
  });

  if (loading) return <Loading label="Loading fields…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={filtered}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListHeaderComponent={
        <View>
          {error ? <AlertBox>{error}</AlertBox> : null}
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search fields…"
            placeholderTextColor={tokens.textMuted}
          />
          <Btn label={adding ? 'Adding…' : 'Add field'} onPress={() => void addField()} disabled={adding} variant="secondary" />
        </View>
      }
      ListEmptyComponent={<EmptyState>No fields yet. Add your first crop block.</EmptyState>}
      renderItem={({ item }) => (
        <FieldCard
          name={item.name}
          crop={item.crop}
          acreage={item.acreage}
          dap={item.dap}
          healthStatus={item.healthStatus}
          healthLabel={item.healthLabel}
          lastActivity={item.lastActivity}
          currentAlert={item.currentAlert}
          onPress={() => router.push(`/fields/${item.id}`)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  search: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: tokens.text,
    marginBottom: 10,
  },
});
