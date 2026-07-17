import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  agronomistClient,
  formatDate,
  t,
  tokens,
  type AgronomistTaskItem,
  type ExpertCaseAvailability,
  type ExpertCaseQueue,
  type ExpertCaseQueueItem,
} from '@morbeez/shared';
import { AlertBox, EmptyState, HubTabs, ListCard, Loading, stableRowKey } from '@morbeez/ui-native';
import { openEscalationVisit } from '@/lib/open-escalation-visit';
import { buildVisitRouteParams } from '@/lib/farmer-workspace-routing';
import { enabledExpertQueue } from '@/lib/expert-copilot';
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
type ExpertBucket = 'my_work' | 'available' | 'at_risk';

const EXPERT_TABS: Array<{ id: ExpertBucket; label: string }> = [
  { id: 'my_work', label: 'My work' },
  { id: 'available', label: 'Available' },
  { id: 'at_risk', label: 'At risk' },
];

const CAPACITY_OPTIONS: ExpertCaseAvailability[] = ['accepting', 'paused', 'draining', 'offline'];

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
  const [expertQueue, setExpertQueue] = useState<ExpertCaseQueue | null>(null);
  const [expertBucket, setExpertBucket] = useState<ExpertBucket>('my_work');
  const [expertRefreshing, setExpertRefreshing] = useState(false);
  const [expertBusy, setExpertBusy] = useState('');
  const [expertError, setExpertError] = useState('');

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

  const refreshExpertQueue = useCallback(async (background = false) => {
    if (background) setExpertRefreshing(true);
    try {
      const queue = await agronomistClient.getExpertCaseQueue();
      setExpertQueue(enabledExpertQueue(queue));
      setExpertError('');
    } catch {
      // Progressive enhancement: unavailable/unknown expert routes retain the legacy task queue.
      setExpertQueue(null);
    } finally {
      setExpertRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshExpertQueue();
  }, [refreshExpertQueue]);

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((task) => task.kind === filter);
  }, [tasks, filter]);

  const [openingEscalation, setOpeningEscalation] = useState<string | null>(null);
  const [taskError, setTaskError] = useState('');

  const openExpertCase = useCallback(
    async (item: ExpertCaseQueueItem) => {
      if (expertBusy) return;
      setExpertBusy(item.id);
      setExpertError('');
      try {
        if (expertBucket !== 'my_work') {
          await agronomistClient.claimExpertCase(item.id, `mobile_${expertBucket}`);
        }
        router.push(`/case/${item.id}`);
      } catch (e) {
        setExpertError(e instanceof Error ? e.message : 'Could not open expert case');
        await refreshExpertQueue(true);
      } finally {
        setExpertBusy('');
      }
    },
    [expertBucket, expertBusy, refreshExpertQueue, router]
  );

  const updateCapacity = useCallback(
    async (availability: ExpertCaseAvailability) => {
      if (expertBusy || expertQueue?.capacity?.availability === availability) return;
      setExpertBusy(`capacity:${availability}`);
      setExpertError('');
      try {
        await agronomistClient.updateExpertCapacity({ availability });
        await refreshExpertQueue(true);
      } catch (e) {
        setExpertError(e instanceof Error ? e.message : 'Could not update capacity');
      } finally {
        setExpertBusy('');
      }
    },
    [expertBusy, expertQueue?.capacity?.availability, refreshExpertQueue]
  );

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

  if (expertQueue) {
    const expertCases = expertQueue.buckets[expertBucket];
    const capacity = expertQueue.capacity;
    return (
      <View style={styles.root}>
        <View style={styles.capacityPanel}>
          <View style={styles.capacityHeading}>
            <Text style={styles.capacityTitle}>Capacity</Text>
            {capacity ? (
              <Text style={styles.capacityMeta}>
                {capacity.active_case_count}/{capacity.max_active_cases} cases ·{' '}
                {Number(capacity.active_weight).toFixed(1)}/{Number(capacity.max_active_weight).toFixed(1)} load
              </Text>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.capacityRow}>
              {CAPACITY_OPTIONS.map((availability) => {
                const active = capacity?.availability === availability;
                return (
                  <Pressable
                    key={availability}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: Boolean(expertBusy) }}
                    disabled={Boolean(expertBusy)}
                    onPress={() => void updateCapacity(availability)}
                    style={[styles.capacityChip, active && styles.capacityChipActive]}
                  >
                    <Text style={[styles.capacityChipText, active && styles.capacityChipTextActive]}>
                      {availability[0].toUpperCase() + availability.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          <HubTabs tabs={EXPERT_TABS} active={expertBucket} onChange={setExpertBucket} />
        </ScrollView>
        <FlatList
          data={expertCases}
          keyExtractor={(item, i) => stableRowKey(item.id, i)}
          refreshControl={
            <RefreshControl
              refreshing={expertRefreshing}
              onRefresh={() => void refreshExpertQueue(true)}
            />
          }
          contentContainerStyle={styles.content}
          ListHeaderComponent={expertError ? <AlertBox>{expertError}</AlertBox> : null}
          renderItem={({ item }) => (
            <ListCard
              title={item.primary_issue_label || `${item.crop_type || 'Crop'} expert case`}
              subtitle={[
                item.crop_type,
                item.queue_route === 'field' ? 'Field review' : 'Desk review',
                expertBucket === 'my_work' ? item.assignment_status.replaceAll('_', ' ') : 'Tap to claim',
              ]
                .filter(Boolean)
                .join(' · ')}
              meta={
                expertBusy === item.id
                  ? 'Opening…'
                  : item.sla_due_at
                    ? `${item.priority_tier === 'emergency' ? 'Emergency · ' : ''}Due ${formatDate(item.sla_due_at)}`
                    : item.priority
              }
              onPress={() => void openExpertCase(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState>
              {expertBucket === 'my_work'
                ? 'No cases assigned to you.'
                : expertBucket === 'at_risk'
                  ? 'No cases are nearing SLA.'
                  : 'No cases are available.'}
            </EmptyState>
          }
        />
      </View>
    );
  }

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
  capacityPanel: {
    backgroundColor: tokens.card,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  capacityHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  capacityTitle: { color: tokens.text, fontSize: 15, fontWeight: '700' },
  capacityMeta: { color: tokens.textMuted, fontSize: 12 },
  capacityRow: { flexDirection: 'row', gap: 8, paddingTop: 10 },
  capacityChip: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusFull,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: tokens.cardMuted,
  },
  capacityChipActive: { borderColor: tokens.green500, backgroundColor: tokens.green100 },
  capacityChipText: { color: tokens.textMuted, fontSize: 12, fontWeight: '600' },
  capacityChipTextActive: { color: tokens.green800 },
});
