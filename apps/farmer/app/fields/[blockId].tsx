import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  fetchActivities,
  fetchFieldDetail,
  fetchPortalSoilReports,
  fetchRoiSummary,
  formatInr,
  t,
  tokens,
  type CultivationActivity,
  type FieldDetail,
  type PortalSoilReport,
  type RoiDashboardV2,
} from '@morbeez/shared';
import {
  AlertBox,
  Btn,
  HealthBadge,
  HubTabs,
  KeyValueRow,
  Loading,
  Panel,
  RoiCropStatusCard,
  RoiStatCards,
  StageProgressBar,
} from '@morbeez/ui-native';
import { useLocale } from '@/context/LocaleContext';
import { useRoiFilter } from '@/context/RoiFilterContext';
import { whatsAppUrl } from '@/lib/config';

type BlockTab = 'activities' | 'soilTests' | 'roi';

function activityIcon(type: string) {
  if (type.includes('spray')) return '🧴';
  if (type.includes('fert')) return '💧';
  if (type.includes('scout') || type.includes('observation')) return '👁';
  if (type.includes('drench')) return '🚿';
  if (type.includes('plant')) return '🌱';
  return '📋';
}

export default function BlockDetailScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { blockId } = useLocalSearchParams<{ blockId: string }>();
  const { setBlockId } = useRoiFilter();
  const [tab, setTab] = useState<BlockTab>('activities');
  const [detail, setDetail] = useState<FieldDetail | null>(null);
  const [activities, setActivities] = useState<CultivationActivity[]>([]);
  const [soilReports, setSoilReports] = useState<PortalSoilReport[]>([]);
  const [roiSummary, setRoiSummary] = useState<RoiDashboardV2 | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!blockId) return;
    setError('');
    setLoading(true);
    try {
      const [d, reports, roi] = await Promise.all([
        fetchFieldDetail(String(blockId)),
        fetchPortalSoilReports(),
        fetchRoiSummary({ blockId: String(blockId) }),
      ]);
      setDetail(d);
      setSoilReports(
        reports.filter((r) => r.blockId === String(blockId) || r.blockName === d.block.name)
      );
      setRoiSummary(roi);
      try {
        setActivities(await fetchActivities({ blockId: String(blockId) }));
      } catch (e) {
        setActivities([]);
        setError(e instanceof Error ? e.message : 'Could not load activities');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load block');
    } finally {
      setLoading(false);
    }
  }, [blockId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => (a.activityDate < b.activityDate ? 1 : -1)),
    [activities]
  );

  const latestSoil = soilReports[0] ?? null;

  if (loading) return <Loading label={t('loading', locale)} />;
  if (!detail) return <AlertBox>{error || 'Block not found'}</AlertBox>;

  const b = detail.block;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error ? <AlertBox>{error}</AlertBox> : null}

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryIcon}>
              <Text style={styles.summaryEmoji}>🌱</Text>
            </View>
            <View style={styles.summaryMain}>
              <View style={styles.summaryTitleRow}>
                <Text style={styles.title}>{b.name}</Text>
                <HealthBadge status={b.healthStatus} label={t('activeStatus', locale)} />
              </View>
              <KeyValueRow label="Crop" value={b.crop} />
              {b.acreage != null ? <KeyValueRow label="Area" value={`${b.acreage} Acre`} /> : null}
              {b.plantingDateLabel ? (
                <KeyValueRow label={t('plantingDateLabel', locale)} value={b.plantingDateLabel} />
              ) : null}
              {b.dap != null ? <KeyValueRow label={t('dapLabel', locale)} value={`${b.dap} Days`} /> : null}
              {b.stage ? <KeyValueRow label="Stage" value={b.stage} /> : null}
            </View>
          </View>
          {b.dap != null ? <StageProgressBar dap={b.dap} stage={b.stage} /> : null}
        </View>

        <HubTabs
          tabs={[
            { id: 'activities', label: t('activities', locale) },
            { id: 'soilTests', label: t('soilTests', locale) },
            { id: 'roi', label: t('roi', locale) },
          ]}
          active={tab}
          onChange={(id) => setTab(id as BlockTab)}
        />

        {tab === 'activities' ? (
          <View style={styles.timeline}>
            {sortedActivities.length ? (
              sortedActivities.map((a, index) => (
                <View key={`${a.id}-${index}`} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={styles.timelineDot} />
                    {index < sortedActivities.length - 1 ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={styles.timelineCard}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.timelineIcon}>{activityIcon(a.activityType)}</Text>
                      <View style={styles.timelineMeta}>
                        <Text style={styles.timelineDate}>{a.dateLabel}</Text>
                        <Text style={styles.timelineTitle}>{a.activityLabel}</Text>
                      </View>
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedText}>{t('completedStatus', locale)}</Text>
                      </View>
                    </View>
                    {a.notes ? <Text style={styles.timelineNotes}>{a.notes}</Text> : null}
                    {a.costInr ? <Text style={styles.timelineCost}>{formatInr(a.costInr)}</Text> : null}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>No activities recorded for this block yet.</Text>
            )}
          </View>
        ) : null}

        {tab === 'soilTests' ? (
          <>
            {latestSoil ? (
              <Panel title={`${t('latestSoilTest', locale)} · ${latestSoil.dateLabel}`}>
                {latestSoil.highlights.length ? (
                  <View style={styles.metricsGrid}>
                    {latestSoil.highlights.map((h, idx) => (
                      <View key={`${h}-${idx}`} style={styles.metricCell}>
                        <Text style={styles.metricValue}>{h}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.muted}>Report on file — open PDF for full metrics.</Text>
                )}
                {latestSoil.pdfUrl ? (
                  <Pressable onPress={() => void Linking.openURL(latestSoil.pdfUrl!)}>
                    <Text style={styles.link}>{t('viewFullReport', locale)} ›</Text>
                  </Pressable>
                ) : null}
              </Panel>
            ) : (
              <Text style={styles.muted}>No soil tests on file for this block yet.</Text>
            )}
            {soilReports.length > 1 ? (
              <Panel title={t('allSoilTests', locale)}>
                {soilReports.map((r) => (
                  <Pressable
                    key={r.id}
                    style={styles.soilRow}
                    onPress={() => r.pdfUrl && void Linking.openURL(r.pdfUrl)}
                  >
                    <Text style={styles.soilDate}>{r.dateLabel}</Text>
                    <Text style={styles.soilMeta}>{r.healthLabel}</Text>
                  </Pressable>
                ))}
              </Panel>
            ) : null}
          </>
        ) : null}

        {tab === 'roi' ? (
          <Panel title={`${b.name} ${t('roi', locale)}`}>
            {roiSummary?.cropStatus ? (
              <RoiCropStatusCard
                crop={roiSummary.cropStatus.crop}
                blockName={roiSummary.cropStatus.blockName}
                acreage={roiSummary.cropStatus.acreage}
                plantingDate={roiSummary.cropStatus.plantingDate}
                dap={roiSummary.cropStatus.dap}
                stageLabel={roiSummary.cropStatus.stageLabel}
                dapMax={roiSummary.cropStatus.dapMax}
              />
            ) : null}
            {roiSummary?.financial ? (
              <RoiStatCards
                expenseLabel={t('spent', locale)}
                incomeLabel={t('totalIncome', locale)}
                profitLabel={t('profit', locale)}
                roiLabel={t('roi', locale)}
                expense={roiSummary.financial.expenseInr}
                income={roiSummary.financial.incomeInr}
                profit={roiSummary.financial.profitInr}
                roiPercent={roiSummary.financial.roiPercent}
                hasIncome={roiSummary.financial.hasIncome}
                profitMessage={roiSummary.financial.profitMessage}
                formatValue={formatInr}
              />
            ) : (
              <Text style={styles.muted}>No active crop cycle for this block.</Text>
            )}
            <Btn
              label="Open ROI dashboard"
              onPress={() => {
                setBlockId(String(blockId));
                router.push('/(tabs)/roi');
              }}
            />
          </Panel>
        ) : null}
      </ScrollView>

      {tab === 'activities' ? (
        <View style={styles.footer}>
          <Btn
            label={`+ ${t('addActivity', locale)}`}
            onPress={() => router.push({ pathname: '/activities/add', params: { blockId: b.id } })}
          />
        </View>
      ) : null}

      {tab === 'soilTests' ? (
        <View style={styles.footer}>
          <Btn
            label={`+ ${t('newSoilTest', locale)}`}
            variant="secondary"
            onPress={() => void Linking.openURL(whatsAppUrl(`Soil test for block ${b.name}`))}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  summaryCard: {
    backgroundColor: tokens.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
    marginBottom: 12,
  },
  summaryTop: { flexDirection: 'row', gap: 12 },
  summaryIcon: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: tokens.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryEmoji: { fontSize: 32 },
  summaryMain: { flex: 1 },
  summaryTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '800', color: tokens.text, flex: 1 },
  muted: { fontSize: 13, color: tokens.textMuted, marginVertical: 8 },
  timeline: { marginTop: 8 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineRail: { width: 16, alignItems: 'center' },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.green700,
    marginTop: 18,
  },
  timelineLine: { flex: 1, width: 2, backgroundColor: tokens.border, marginTop: 4 },
  timelineCard: {
    flex: 1,
    backgroundColor: tokens.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    marginBottom: 12,
  },
  timelineHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timelineIcon: { fontSize: 20, marginTop: 2 },
  timelineMeta: { flex: 1 },
  timelineDate: { fontSize: 11, color: tokens.textMuted, fontWeight: '600' },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: tokens.text, marginTop: 2 },
  completedBadge: {
    backgroundColor: tokens.green100,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  completedText: { fontSize: 10, fontWeight: '700', color: tokens.green800 },
  timelineNotes: { fontSize: 13, color: tokens.text, marginTop: 8 },
  timelineCost: { fontSize: 13, fontWeight: '700', color: tokens.green800, marginTop: 6 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCell: {
    width: '47%',
    backgroundColor: tokens.green100,
    borderRadius: 8,
    padding: 10,
  },
  metricValue: { fontSize: 13, fontWeight: '700', color: tokens.text },
  link: { fontSize: 14, fontWeight: '600', color: tokens.green700, marginTop: 10 },
  soilRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  soilDate: { fontSize: 14, fontWeight: '600', color: tokens.text },
  soilMeta: { fontSize: 13, color: tokens.textMuted },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    backgroundColor: tokens.bg,
  },
});
