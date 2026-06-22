import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  agronomistClient,
  formatDate,
  tokens,
  type AgronomistBlockRow,
  type BlockFieldFinding,
  type BlockRecommendationItem,
  type CultivationActivity,
  type FieldOverview,
  type PortalSoilReport,
} from '@morbeez/shared';
import {
  ActivityTimeline,
  AlertBox,
  BlockRecommendationsPanel,
  BlockSummaryCard,
  Btn,
  FieldFindingsPanel,
  Loading,
  ScrollableUnderlineTabs,
  SoilTestsPanel,
  StickyScreenFooter,
  useStickyFooterScrollPadding,
} from '@morbeez/ui-native';
import { SegmentedChips } from '@/components/field-findings/SegmentedChips';

type BlockTab = 'activities' | 'soilTests' | 'fieldFindings' | 'recommendations' | 'plotIntel';

const REC_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'completed', label: 'Completed' },
  { value: 'escalated', label: 'Escalated' },
] as const;

function searchParam(value: string | string[] | undefined): string {
  if (value == null) return '';
  return String(Array.isArray(value) ? value[0] : value);
}

function blockToOverview(block: AgronomistBlockRow): FieldOverview {
  return {
    id: block.id,
    name: block.name,
    crop: block.cropType,
    acreage: block.acreage ?? null,
    dap: block.dap ?? null,
    plantingDate: block.plantingDate ?? null,
    plantingDateLabel: block.plantingDate ? formatDate(block.plantingDate) : null,
    healthStatus: (block.cropHealthStatus as FieldOverview['healthStatus']) ?? 'monitor',
    healthLabel: block.cropHealthLabel ?? '—',
    lastActivity: block.latestFieldActivity ?? null,
    currentAlert: block.latestFindingLabel ?? null,
    stage: null,
    isPrimary: false,
    spad: null,
    shootCount: null,
    soilMoisture: null,
    irrigationType: null,
    healthScore: null,
  };
}

function recStatusBucket(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('escalat')) return 'escalated';
  if (s.includes('complete') || s.includes('applied') || s.includes('resolved')) return 'completed';
  if (s.includes('monitor')) return 'monitoring';
  if (s.includes('draft') || s.includes('pending') || s.includes('approved') || s.includes('communicated')) {
    return 'open';
  }
  return 'open';
}

export default function AgronomistBlockDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmerId: string;
    blockId: string;
    farmerName?: string;
    leadId?: string;
  }>();
  const farmerId = searchParam(params.farmerId);
  const blockId = searchParam(params.blockId);
  const farmerName = searchParam(params.farmerName);
  const leadId = searchParam(params.leadId) || undefined;

  const [tab, setTab] = useState<BlockTab>('activities');
  const [recFilter, setRecFilter] = useState<(typeof REC_STATUS_FILTERS)[number]['value']>('all');
  const [block, setBlock] = useState<AgronomistBlockRow | null>(null);
  const [activities, setActivities] = useState<CultivationActivity[]>([]);
  const [soilReports, setSoilReports] = useState<PortalSoilReport[]>([]);
  const [fieldFindings, setFieldFindings] = useState<BlockFieldFinding[]>([]);
  const [blockRecommendations, setBlockRecommendations] = useState<BlockRecommendationItem[]>([]);
  const [plotIntel, setPlotIntel] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!farmerId || !blockId) {
      setLoading(false);
      setError('Missing farmer or block.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const detail = await agronomistClient.getBlockDetail(farmerId, blockId);
      setBlock(detail.block);
      setActivities(detail.activities ?? []);
      setSoilReports(detail.soilReports ?? []);
      setFieldFindings(detail.fieldFindings ?? []);
      setBlockRecommendations(detail.blockRecommendations ?? []);
      const twin = await agronomistClient.getPlotIntelligence(blockId).catch(() => null);
      setPlotIntel(twin as Record<string, unknown> | null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load block';
      try {
        const blocks = await agronomistClient.getFarmerBlocks(farmerId);
        const found = blocks.find((b) => b.id === blockId);
        if (found) {
          setBlock(found);
          setActivities([]);
          setSoilReports([]);
          setFieldFindings([]);
          setBlockRecommendations([]);
          setError(msg.includes('API route not found') ? msg : '');
          return;
        }
      } catch {
        // keep original error
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [farmerId, blockId]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const overview = useMemo(() => (block ? blockToOverview(block) : null), [block]);
  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => (a.activityDate < b.activityDate ? 1 : -1)),
    [activities]
  );
  const filteredRecs = useMemo(() => {
    if (recFilter === 'all') return blockRecommendations;
    return blockRecommendations.filter((r) => recStatusBucket(r.status) === recFilter);
  }, [blockRecommendations, recFilter]);

  const footerRows = tab === 'recommendations' && recFilter !== 'all' ? 2 : 1;
  const scrollBottomPad = useStickyFooterScrollPadding({ rows: footerRows });

  const visitParams = {
    farmerId,
    blockId: block?.id ?? blockId,
    blockName: block?.name ?? '',
    cropType: block?.cropType ?? '',
    farmerName,
  };

  if (loading) return <Loading label="Loading block…" />;
  if (!block || !overview) return <AlertBox>{error || 'Block not found'}</AlertBox>;

  const extraRows = [
    block.lastVisitAt ? { label: 'Last visit', value: formatDate(block.lastVisitAt) } : null,
    block.lastVisitDap != null ? { label: 'Last visit DAP', value: String(block.lastVisitDap) } : null,
    block.cropHealthLabel && block.cropHealthLabel !== '—'
      ? { label: 'Crop health', value: block.cropHealthLabel }
      : null,
    block.soilHealthLabel ? { label: 'Soil health', value: block.soilHealthLabel } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}>
        {error ? <AlertBox>{error}</AlertBox> : null}

        <BlockSummaryCard block={overview} extraRows={extraRows} />

        <ScrollableUnderlineTabs
          tabs={[
            { id: 'activities', label: 'Activities' },
            { id: 'soilTests', label: 'Soil tests' },
            { id: 'plotIntel', label: 'Plot intel' },
            { id: 'fieldFindings', label: 'Field findings' },
            { id: 'recommendations', label: 'Recommendations' },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'activities' ? (
          <ActivityTimeline activities={sortedActivities} plantingDate={block.plantingDate} />
        ) : null}

        {tab === 'soilTests' ? (
          <SoilTestsPanel
            reports={soilReports}
            showAddButton={false}
            onNewTest={() =>
              router.push({
                pathname: '/soil/add',
                params: { farmerId, blockId: block.id },
              })
            }
          />
        ) : null}

        {tab === 'plotIntel' ? (
          <View style={styles.plotIntelPanel}>
            <Text style={styles.plotIntelTitle}>Plot intelligence</Text>
            {plotIntel ? (
              <>
                <Text style={styles.plotIntelLine}>
                  Visits (12m): {String((plotIntel as { visitCount12m?: number }).visitCount12m ?? 0)}
                </Text>
                {((plotIntel as { recurringIssues?: Array<{ label: string; count: number }> }).recurringIssues ?? []).map(
                  (r) => (
                    <Text key={r.label} style={styles.plotIntelLine}>
                      {r.label} — {r.count} occurrence{r.count === 1 ? '' : 's'}
                    </Text>
                  )
                )}
              </>
            ) : (
              <Text style={styles.emptyText}>No plot memory snapshot yet.</Text>
            )}
          </View>
        ) : null}

        {tab === 'fieldFindings' ? (
          fieldFindings.length ? (
            <FieldFindingsPanel
              findings={fieldFindings}
              onPressFinding={(f) => router.push(`/visit/${f.id}`)}
            />
          ) : (
            <Text style={styles.emptyText}>No field findings for this block yet.</Text>
          )
        ) : null}

        {tab === 'recommendations' ? (
          <View>
            <SegmentedChips
              options={REC_STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
              value={recFilter}
              onChange={setRecFilter}
            />
            <View style={styles.recPanel}>
              <BlockRecommendationsPanel items={filteredRecs} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <StickyScreenFooter>
        {tab === 'activities' ? (
          <Btn
            label="+ Add activity"
            onPress={() =>
              router.push({
                pathname: '/activity/add',
                params: { farmerId, blockId: block.id, blockName: block.name },
              })
            }
          />
        ) : null}

        {tab === 'soilTests' ? (
          <Btn
            label="+ Add soil test"
            onPress={() =>
              router.push({
                pathname: '/soil/add',
                params: { farmerId, blockId: block.id },
              })
            }
          />
        ) : null}

        {tab === 'fieldFindings' ? (
          <Btn
            label="Start visit"
            onPress={() => router.push({ pathname: '/visit', params: visitParams })}
          />
        ) : null}

        {tab === 'recommendations' ? (
          <View style={styles.footerCol}>
            {recFilter !== 'all' ? (
              <Btn label="Clear all" variant="secondary" onPress={() => setRecFilter('all')} />
            ) : null}
            <Btn
              label="+ Add recommendation"
              onPress={() =>
                router.push({
                  pathname: '/recommendation/add',
                  params: { farmerId, blockId: block.id, leadId: leadId ?? '' },
                })
              }
            />
          </View>
        ) : null}
      </StickyScreenFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16 },
  emptyText: { fontSize: 14, color: tokens.textMuted, lineHeight: 20, paddingVertical: 8 },
  plotIntelPanel: { gap: 8, paddingVertical: 8 },
  plotIntelTitle: { fontSize: 16, fontWeight: '700', color: tokens.text },
  plotIntelLine: { fontSize: 14, color: tokens.textMuted, lineHeight: 20 },
  recPanel: { marginTop: 12 },
  footerCol: { gap: 8 },
});
