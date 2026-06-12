import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
} from '@morbeez/ui-native';

type BlockTab = 'activities' | 'soilTests' | 'fieldFindings' | 'recommendations';

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
  const [block, setBlock] = useState<AgronomistBlockRow | null>(null);
  const [activities, setActivities] = useState<CultivationActivity[]>([]);
  const [soilReports, setSoilReports] = useState<PortalSoilReport[]>([]);
  const [fieldFindings, setFieldFindings] = useState<BlockFieldFinding[]>([]);
  const [blockRecommendations, setBlockRecommendations] = useState<BlockRecommendationItem[]>([]);
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

  const overview = useMemo(() => (block ? blockToOverview(block) : null), [block]);
  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => (a.activityDate < b.activityDate ? 1 : -1)),
    [activities]
  );

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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error ? <AlertBox>{error}</AlertBox> : null}

        <BlockSummaryCard block={overview} extraRows={extraRows} />

        <ScrollableUnderlineTabs
          tabs={[
            { id: 'activities', label: 'Activities' },
            { id: 'soilTests', label: 'Soil tests' },
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
          <SoilTestsPanel reports={soilReports} showAddButton={false} />
        ) : null}

        {tab === 'fieldFindings' ? (
          <FieldFindingsPanel
            findings={fieldFindings}
            onPressFinding={(f) => router.push(`/finding/${f.id}`)}
          />
        ) : null}

        {tab === 'recommendations' ? (
          <BlockRecommendationsPanel items={blockRecommendations} />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Btn
          label="Start visit"
          onPress={() =>
            router.push({
              pathname: '/visit',
              params: {
                farmerId,
                blockId: block.id,
                blockName: block.name,
                cropType: block.cropType,
                farmerName,
              },
            })
          }
        />
        <Btn
          label="Add recommendation"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/recommendation/add',
              params: { farmerId, blockId: block.id, leadId: leadId ?? '' },
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 120 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    backgroundColor: tokens.bg,
  },
});
