import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchRoiHistoryV2, formatInr, t, tokens, type CropSeasonSummary } from '@morbeez/shared';
import { AlertBox, EmptyState, HubTabs, Loading, Panel } from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';

type ActiveSeason = CropSeasonSummary & {
  blockName: string | null;
  dap: number | null;
  stageLabel: string | null;
};

type HistoryTab = 'active' | 'completed';

export default function CropHistoryScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const [tab, setTab] = useState<HistoryTab>('active');
  const [active, setActive] = useState<ActiveSeason[]>([]);
  const [completed, setCompleted] = useState<CropSeasonSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchRoiHistoryV2()
      .then((h) => {
        setActive(h.active);
        setCompleted(h.completed);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load history'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <HubTabs
        tabs={[
          { id: 'active', label: t('activeCycles', locale) },
          { id: 'completed', label: t('completedCycles', locale) },
        ]}
        active={tab}
        onChange={(id) => setTab(id as HistoryTab)}
      />
      {tab === 'active' ? (
        active.length ? (
          <Panel title={t('activeCycles', locale)}>
            {active.map((item) => (
              <Pressable key={item.id} style={styles.card} onPress={() => router.push(`/roi/history/${item.id}`)}>
                <Text style={styles.title}>{item.seasonLabel}</Text>
                {item.blockName ? <Text style={styles.meta}>{item.blockName}</Text> : null}
                {item.dap != null ? (
                  <Text style={styles.meta}>
                    DAP {item.dap}
                    {item.stageLabel ? ` · ${item.stageLabel}` : ''}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  {t('spent', locale)} {formatInr(item.totalExpenseInr)} · {t('totalIncome', locale)}{' '}
                  {formatInr(item.totalIncomeInr)}
                </Text>
              </Pressable>
            ))}
          </Panel>
        ) : (
          <EmptyState>{t('noPastSeasons', locale)}</EmptyState>
        )
      ) : (
        <FlatList
          data={completed}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyState>{t('noPastSeasons', locale)}</EmptyState>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/roi/history/${item.id}`)}>
              <Text style={styles.title}>{item.seasonLabel}</Text>
              <View style={styles.statsRow}>
                <Text style={styles.stat}>
                  {t('spent', locale)}: {formatInr(item.totalExpenseInr)}
                </Text>
                <Text style={styles.stat}>
                  {t('totalIncome', locale)}: {formatInr(item.totalIncomeInr)}
                </Text>
              </View>
              <Text style={styles.profit}>
                {t('profit', locale)}: {formatInr(item.netProfitInr)}
                {item.roiPercent != null ? ` · ${item.roiPercent}% ${t('roi', locale)}` : ''}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg, padding: 16 },
  listContent: { paddingBottom: 32 },
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
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  stat: { fontSize: 13, color: tokens.textMuted },
});
