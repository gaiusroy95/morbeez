import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { AlertBox, Btn, Loading } from '@morbeez/ui-native';
import {
  ActivityTimeline,
  BlockSummaryCard,
  SoilTestsPanel,
  UnderlineTabs,
} from '@/components/fields/FieldBlockUi';
import { useLocale } from '@/context/LocaleContext';

type BlockTab = 'activities' | 'soilTests';

export default function BlockDetailScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { blockId } = useLocalSearchParams<{ blockId: string }>();
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

  const sortedActivities = useMemo(
    () => [...activities].sort((a, b) => (a.activityDate < b.activityDate ? 1 : -1)),
    [activities]
  );

  if (loading) return <Loading label={t('loading', locale)} />;
  if (!detail) return <AlertBox>{error || 'Block not found'}</AlertBox>;

  const b = detail.block;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error ? <AlertBox>{error}</AlertBox> : null}

        <BlockSummaryCard block={b} locale={locale} />

        <UnderlineTabs
          tabs={[
            { id: 'activities', label: t('activities', locale) },
            { id: 'soilTests', label: t('soilTests', locale) },
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
          <SoilTestsPanel
            reports={soilReports}
            locale={locale}
            onNewTest={() =>
              router.push({ pathname: '/soil/add', params: { blockId: b.id } })
            }
          />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
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
