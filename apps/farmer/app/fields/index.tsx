import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchFieldBlocks, t, tokens, type FieldBlock } from '@morbeez/shared';
import { AlertBox, BlockCard, Btn, EmptyState, Loading } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { OfflineBanner } from '@/context/OfflineContext';

export default function BlocksListScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [blocks, setBlocks] = useState<FieldBlock[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setBlocks(await fetchFieldBlocks());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load blocks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = blocks.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${b.name} ${b.crop}`.toLowerCase().includes(q);
  });

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={filtered}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      ListHeaderComponent={
        <View>
          <OfflineBanner />
          {error ? <AlertBox>{error}</AlertBox> : null}
          <View style={styles.titleRow}>
            <View style={styles.titleCol}>
              <Text style={styles.title}>{t('myBlocks', locale)}</Text>
              <Text style={styles.subtitle}>{t('myFieldsSub', locale)}</Text>
            </View>
            <Btn label={`+ ${t('addBlock', locale)}`} onPress={() => router.push('/fields/form')} />
          </View>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder={t('searchBlocks', locale)}
            placeholderTextColor={tokens.textMuted}
          />
        </View>
      }
      ListFooterComponent={
        filtered.length ? (
          <View style={styles.tipBox}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipText}>{t('blocksTip', locale)}</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={<EmptyState>{t('noFields', locale)}</EmptyState>}
      renderItem={({ item }) => (
        <BlockCard
          name={item.name}
          crop={item.crop}
          acreage={item.acreage}
          dap={item.dap}
          plantingDateLabel={item.plantingDateLabel}
          statusLabel={t('activeStatus', locale)}
          healthStatus={item.healthStatus}
          onPress={() => router.push(`/fields/${item.id}`)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  titleCol: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: tokens.text },
  subtitle: { fontSize: 13, color: tokens.textMuted, marginTop: 4 },
  search: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: tokens.text,
    marginBottom: 12,
  },
  tipBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: tokens.green100,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  tipIcon: { fontSize: 18 },
  tipText: { flex: 1, fontSize: 13, color: tokens.green800, lineHeight: 18 },
});
