import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchExpenseBook, formatInr, t, tokens, type ExpenseBookGroup } from '@morbeez/shared';
import { AlertBox, Loading } from '@morbeez/ui-native';
import { useRoiFilter } from '@/context/RoiFilterContext';
import { useLocale } from '@/context/LocaleContext';

export default function ExpenseBookScreen() {
  const { locale } = useLocale();
  const { filter } = useRoiFilter();
  const [groups, setGroups] = useState<ExpenseBookGroup[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      setGroups(await fetchExpenseBook(filter));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label={t('loading', locale)} />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      {groups.length === 0 ? (
        <Text style={styles.empty}>{t('noExpensesYet', locale)}</Text>
      ) : (
        groups.map((g) => (
          <View key={g.categoryId} style={styles.group}>
            <Pressable
              style={styles.header}
              onPress={() => setExpanded((e) => ({ ...e, [g.categoryId]: !e[g.categoryId] }))}
            >
              <Text style={styles.catName}>
                {g.icon ?? '•'} {g.categoryName}
              </Text>
              <Text style={styles.total}>{formatInr(g.totalInr)}</Text>
            </Pressable>
            {expanded[g.categoryId]
              ? g.lines.map((line) => (
                  <View key={line.id} style={styles.line}>
                    <Text style={styles.lineLabel}>{line.dateLabel}</Text>
                    <Text style={styles.lineNote}>{line.description || '—'}</Text>
                    <Text style={styles.lineAmt}>{formatInr(line.amountInr)}</Text>
                  </View>
                ))
              : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: 'center', color: tokens.textMuted, marginTop: 24 },
  group: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  catName: { fontSize: 15, fontWeight: '600', color: tokens.text, flex: 1 },
  total: { fontSize: 15, fontWeight: '700', color: tokens.green800 },
  line: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    gap: 8,
  },
  lineLabel: { width: 72, fontSize: 12, color: tokens.textMuted },
  lineNote: { flex: 1, fontSize: 13, color: tokens.text },
  lineAmt: { fontSize: 13, fontWeight: '600', color: tokens.text },
});
