import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  agronomistClient,
  formatDate,
  t,
  tokens,
  type AgronomistTaskItem,
} from '@morbeez/shared';
import { AlertBox, EmptyState, HubTabs, ListCard, Loading, stableRowKey } from '@morbeez/ui-native';
import { openEscalationVisit } from '@/lib/open-escalation-visit';
import { buildVisitRouteParams } from '@/lib/farmer-workspace-routing';
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

async function openScheduledVisit(
  task: AgronomistTaskItem,
  router: ReturnType<typeof useRouter>
): Promise<void> {
  if (!task.farmerId) {
    router.push('/(tabs)/visits');
    return;
  }

  const blocks = await agronomistClient.getFarmerBlocks(task.farmerId);
  const match =
    (task.blockId ? blocks.find((b) => b.id === task.blockId) : null) ?? blocks[0];
  if (!match) {
    throw new Error('No farm block found for this farmer. Add a block before starting a visit.');
  }

  router.push(
    buildVisitRouteParams({
      farmerId: task.farmerId,
      farmerName: task.title?.replace(/^Visit:\s*/i, '') || 'Farmer',
      leadId: task.leadId,
      block: { id: match.id, name: match.name, cropType: match.cropType || '_default' },
    })
  );
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

  const [openingEscalation, setOpeningEscalation] = useState<string | null>(null);
  const [taskError, setTaskError] = useState('');

  const openTask = useCallback(
    async (task: AgronomistTaskItem) => {
      setTaskError('');
      // Site-visit work (escalations + field-routed AI cases) → real visit wizard.
      if ((task.kind === 'escalation' || task.needsSiteVisit) && task.refId) {
        if (openingEscalation) return;
        setOpeningEscalation(task.refId);
        try {
          await openEscalationVisit(task.refId, { router });
        } catch (e) {
          setTaskError(e instanceof Error ? e.message : 'Could not open visit');
        } finally {
          setOpeningEscalation(null);
        }
        return;
      }
      if (task.kind === 'finding_review' && task.refId) {
        router.push(`/finding/${task.refId}`);
        return;
      }
      // Mobile field app: AI cases open the site visit form (desk Approve/Modify stays on web).
      if (task.kind === 'ai_review' && task.refId) {
        if (openingEscalation) return;
        setOpeningEscalation(task.refId);
        try {
          await openEscalationVisit(task.refId, { router });
        } catch {
          // Visit context missing — fall back to case screen (has Start site visit + soil/weather).
          router.push(`/case/${task.refId}`);
        } finally {
          setOpeningEscalation(null);
        }
        return;
      }
      if (task.kind === 'visit') {
        if (openingEscalation) return;
        setOpeningEscalation(task.refId ?? task.id);
        try {
          await openScheduledVisit(task, router);
        } catch (e) {
          setTaskError(e instanceof Error ? e.message : 'Could not open visit');
        } finally {
          setOpeningEscalation(null);
        }
        return;
      }
      if (task.farmerId) {
        router.push(`/farmer/${task.farmerId}`);
      }
    },
    [router, openingEscalation]
  );

  if (loading && tasks.length === 0) return <Loading label={t('loadingTasks', locale)} />;

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <HubTabs tabs={filters} active={filter} onChange={setFilter} />
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={(task, i) => stableRowKey(task.id, i)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh(filter === 'all' ? undefined : filter)}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          error || taskError ? <AlertBox>{taskError || error}</AlertBox> : null
        }
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
