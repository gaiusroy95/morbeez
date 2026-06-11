import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDate, tokens, type AgronomistTaskItem } from '@morbeez/shared';
import { AlertBox, EmptyState, HubTabs, ListCard, Loading } from '@morbeez/ui-native';
import { useAgronomistQueue } from '@/context/AgronomistQueueContext';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'visit', label: 'Visits' },
  { id: 'follow_up', label: 'Follow-ups' },
  { id: 'callback', label: 'Callbacks' },
  { id: 'escalation', label: 'Escalations' },
  { id: 'ai_review', label: 'AI review' },
  { id: 'finding_review', label: 'Findings' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

export default function TasksScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const initialFilter = (FILTERS.find((f) => f.id === params.filter)?.id ?? 'all') as FilterId;
  const [filter, setFilter] = useState<FilterId>(initialFilter);
  const { tasks, loading, refreshing, error, refresh } = useAgronomistQueue();

  useEffect(() => {
    const next = FILTERS.find((f) => f.id === params.filter)?.id;
    if (next) setFilter(next);
  }, [params.filter]);

  useEffect(() => {
    void refresh(filter === 'all' ? undefined : filter);
  }, [filter, refresh]);

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((t) => t.kind === filter);
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

  if (loading && tasks.length === 0) return <Loading label="Loading tasks…" />;

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <HubTabs tabs={[...FILTERS]} active={filter} onChange={setFilter} />
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
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
        ListEmptyComponent={<EmptyState>No tasks in this filter.</EmptyState>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  tabScroll: { maxHeight: 56, marginTop: 4 },
  content: { padding: 16, paddingBottom: 32 },
});
