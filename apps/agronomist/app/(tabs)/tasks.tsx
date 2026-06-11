import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDate, t, tokens, type AgronomistTaskItem } from '@morbeez/shared';
import { AlertBox, EmptyState, HubTabs, ListCard, Loading } from '@morbeez/ui-native';
import { useAgronomistQueue } from '@/context/AgronomistQueueContext';
import { useLocale } from '@/context/LocaleContext';

const FILTER_IDS = [
  'all',
  'visit',
  'follow_up',
  'callback',
  'escalation',
  'ai_review',
  'finding_review',
] as const;

type FilterId = (typeof FILTER_IDS)[number];

function filterLabel(id: FilterId, locale: ReturnType<typeof useLocale>['locale']) {
  switch (id) {
    case 'all':
      return t('filterAll', locale);
    case 'visit':
      return t('filterVisits', locale);
    case 'follow_up':
      return t('filterFollowUp', locale);
    case 'callback':
      return t('callbacks', locale);
    case 'escalation':
      return t('filterEscalations', locale);
    case 'ai_review':
      return t('aiReview', locale);
    case 'finding_review':
      return t('findingReview', locale);
  }
}

export default function TasksScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ filter?: string }>();
  const initialFilter = (FILTER_IDS.find((f) => f === params.filter) ?? 'all') as FilterId;
  const [filter, setFilter] = useState<FilterId>(initialFilter);
  const { tasks, loading, refreshing, error, refresh } = useAgronomistQueue();

  const filters = useMemo(
    () => FILTER_IDS.map((id) => ({ id, label: filterLabel(id, locale) })),
    [locale]
  );

  useEffect(() => {
    const next = FILTER_IDS.find((f) => f === params.filter);
    if (next) setFilter(next);
  }, [params.filter]);

  useEffect(() => {
    void refresh(filter === 'all' ? undefined : filter);
  }, [filter, refresh]);

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((task) => task.kind === filter);
  }, [tasks, filter]);

  const openTask = useCallback(
    (task: AgronomistTaskItem) => {
      if (task.kind === 'finding_review' && task.refId) {
        router.push(`/finding/${task.refId}`);
        return;
      }
      if (task.kind === 'ai_review' && task.refId) {
        router.push(`/case/${task.refId}`);
        return;
      }
      if (task.farmerId) {
        router.push(`/farmer/${task.farmerId}`);
        return;
      }
      if (task.kind === 'visit') {
        router.push('/(tabs)/visits');
      }
    },
    [router]
  );

  if (loading && tasks.length === 0) return <Loading label={t('loadingTasks', locale)} />;

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <HubTabs tabs={filters} active={filter} onChange={setFilter} />
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={(task) => task.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh(filter === 'all' ? undefined : filter)}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={error ? <AlertBox>{error}</AlertBox> : null}
        renderItem={({ item }) => (
          <ListCard
            title={item.title}
            subtitle={item.subtitle}
            meta={item.dueAt ? formatDate(item.dueAt) : item.status}
            onPress={() => openTask(item)}
          />
        )}
        ListEmptyComponent={<EmptyState>{t('noTasksInFilter', locale)}</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  tabScroll: { maxHeight: 56, marginTop: 4 },
  content: { padding: 16, paddingBottom: 32 },
});
