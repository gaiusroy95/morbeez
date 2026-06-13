import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  fetchActivities,
  fetchFieldDetail,
  fetchPortalSoilReports,
  t,
  tokens,
  type CultivationActivity,
  type FieldDetail,
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
import { useLocale } from '@/context/LocaleContext';

type BlockTab = 'activities' | 'soilTests' | 'fieldFindings' | 'recommendations';

export default function BlockDetailScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { blockId } = useLocalSearchParams<{ blockId: string }>();
  const scrollBottomPad = useStickyFooterScrollPadding();
  const [tab, setTab] = useState<BlockTab>('activities');
  const [detail, setDetail] = useState<FieldDetail | null>(null);
  const [activities, setActivities] = useState<CultivationActivity[]>([]);
  const [soilReports, setSoilReports] = useState<PortalSoilReport[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!blockId) return;
    setError('');
    setLoading(true);
    try {
      const [d, reports] = await Promise.all([
        fetchFieldDetail(String(blockId)),
        fetchPortalSoilReports(),
      ]);
      setDetail(d);
      setSoilReports(
        reports.filter((r) => r.blockId === String(blockId) || r.blockName === d.block.name)
      );
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

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => (a.activityDate < b.activityDate ? 1 : -1)),
    [activities]
  );

  if (loading) return <Loading label={t('loading', locale)} />;
  if (!detail) return <AlertBox>{error || 'Block not found'}</AlertBox>;

  const b = detail.block;
  const latestFinding = detail.fieldFindings?.[0];
  const extraRows = [
    latestFinding?.visitedLabel
      ? { label: 'Last visit', value: latestFinding.visitedLabel }
      : null,
    latestFinding?.cropHealthLabel && latestFinding.cropHealthLabel !== '—'
      ? { label: 'Crop health', value: latestFinding.cropHealthLabel }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}
      >
        {error ? <AlertBox>{error}</AlertBox> : null}

        <BlockSummaryCard block={b} locale={locale} extraRows={extraRows} />

        <ScrollableUnderlineTabs
          tabs={[
            { id: 'activities', label: t('activities', locale) },
            { id: 'soilTests', label: t('soilTests', locale) },
            { id: 'fieldFindings', label: t('fieldFindings', locale) },
            { id: 'recommendations', label: t('recommendations', locale) },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'activities' ? (
          <ActivityTimeline
            activities={sortedActivities}
            plantingDate={b.plantingDate}
            locale={locale}
          />
        ) : null}

        {tab === 'soilTests' ? (
          <SoilTestsPanel reports={soilReports} locale={locale} showAddButton={false} />
        ) : null}

        {tab === 'fieldFindings' ? (
          <FieldFindingsPanel findings={detail.fieldFindings ?? []} locale={locale} />
        ) : null}

        {tab === 'recommendations' ? (
          <BlockRecommendationsPanel items={detail.blockRecommendations ?? []} locale={locale} />
        ) : null}
      </ScrollView>

      <StickyScreenFooter>
        {tab === 'activities' ? (
          <Btn
            label={`+ ${t('addActivity', locale)}`}
            onPress={() => router.push({ pathname: '/activities/add', params: { blockId: b.id } })}
          />
        ) : null}
        {tab === 'soilTests' ? (
          <Btn
            label={`+ ${t('newSoilTest', locale)}`}
            onPress={() => router.push({ pathname: '/soil/add', params: { blockId: b.id } })}
          />
        ) : null}
        {tab === 'fieldFindings' ? (
          <Btn
            label={`+ ${t('addFieldFinding', locale)}`}
            onPress={() => router.push({ pathname: '/findings/add', params: { blockId: b.id } })}
          />
        ) : null}
        {tab === 'recommendations' ? (
          <Btn
            label={`+ ${t('addRecommendation', locale)}`}
            onPress={() => router.push({ pathname: '/recommendations/add', params: { blockId: b.id } })}
          />
        ) : null}
      </StickyScreenFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16 },
});
