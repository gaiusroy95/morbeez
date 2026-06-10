import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchCropHistory, formatInr, t, tokens, type CropSeasonSummary } from '@morbeez/shared';
import { AlertBox, EmptyState, Loading } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

export default function CropHistoryScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [seasons, setSeasons] = useState<CropSeasonSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchCropHistory()
      .then(setSeasons)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load history'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={seasons}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
      ListEmptyComponent={<EmptyState>No past seasons yet.</EmptyState>}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/roi/history/${item.id}`)}>
          <Text style={styles.title}>{item.seasonLabel}</Text>
          <Text style={styles.profit}>
            {t('profit', locale)}: {formatInr(item.netProfitInr)}
          </Text>
          <Text style={styles.meta}>
            {t('spent', locale)} {formatInr(item.totalExpenseInr)} · {t('expected', locale)}{' '}
            {formatInr(item.totalIncomeInr)}
          </Text>
        </Pressable>
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
  title: { fontSize: 16, fontWeight: '700', color: tokens.text },
  profit: { fontSize: 15, fontWeight: '600', color: tokens.green800, marginTop: 6 },
  meta: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
});
