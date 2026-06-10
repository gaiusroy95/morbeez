import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  fetchActivities,
  fetchFieldDetail,
  fetchRecommendations,
  formatInr,
  t,
  tokens,
  type CultivationActivity,
  type FarmerRecommendation,
  type FieldDetail,
  type FieldTimelineItem,
} from '@morbeez/shared';
import { AlertBox, Btn, HealthBadge, HubTabs, KeyValueRow, Loading, Panel, StageProgressBar } from '@morbeez/ui-native';
import { useShopCart } from '@/context/ShopCartContext';
import { buildCartItemFromRecommendationProduct } from '@/lib/shop-helpers';

import { useLocale } from '@/context/LocaleContext';

type Tab = 'overview' | 'timeline' | 'activities' | 'recommendations' | 'roi';

export default function FieldDetailScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const { blockId } = useLocalSearchParams<{ blockId: string }>();
  const { addItem } = useShopCart();
  const [tab, setTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<FieldDetail | null>(null);
  const [activities, setActivities] = useState<CultivationActivity[]>([]);
  const [recommendations, setRecommendations] = useState<FarmerRecommendation[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!blockId) return;
    setError('');
    try {
      const [d, acts, recs] = await Promise.all([
        fetchFieldDetail(String(blockId)),
        fetchActivities({ blockId: String(blockId) }),
        fetchRecommendations(),
      ]);
      setDetail(d);
      setActivities(acts);
      setRecommendations(recs.filter((r) => r.blockName === d.block.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load field');
    } finally {
      setLoading(false);
    }
  }, [blockId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addRecoProduct(rec: FarmerRecommendation, productTitle: string) {
    const product = rec.products.find((p) => p.title === productTitle);
    if (!product) return;
    try {
      const item = await buildCartItemFromRecommendationProduct(product, {
        recommendationId: rec.id,
        recoveryPurpose: rec.title,
      });
      if (!item) {
        setError('Product not found in shop catalog');
        return;
      }
      addItem(item);
      router.push('/shop/cart');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add to cart');
    }
  }

  if (loading) return <Loading label={t('loading', locale)} />;
  if (!detail) return <AlertBox>{error || 'Field not found'}</AlertBox>;

  const b = detail.block;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.title}>{b.name}</Text>
      <HealthBadge status={b.healthStatus} label={b.healthLabel} />
      <StageProgressBar dap={b.dap} stage={b.stage} />

      <HubTabs
        tabs={[
          { id: 'overview' as Tab, label: 'Overview' },
          { id: 'timeline' as Tab, label: 'Timeline' },
          { id: 'activities' as Tab, label: 'Activities' },
          { id: 'recommendations' as Tab, label: 'Reco' },
          { id: 'roi' as Tab, label: 'ROI' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' ? (
        <Panel title="Crop overview">
          <KeyValueRow label="Crop" value={b.crop} />
          <KeyValueRow label="Stage" value={b.stage ?? '—'} />
          <KeyValueRow label="DAP" value={b.dap != null ? String(b.dap) : '—'} />
          <KeyValueRow label="SPAD" value={b.spad ?? '—'} />
          <KeyValueRow label="Soil moisture" value={b.soilMoisture ?? '—'} />
          <KeyValueRow label="Irrigation" value={b.irrigationType ?? '—'} />
          <KeyValueRow label="Health score" value={b.healthScore != null ? String(b.healthScore) : '—'} />
        </Panel>
      ) : null}

      {tab === 'timeline' ? (
        <Panel title="Timeline">
          {detail.timeline.length ? (
            detail.timeline.map((item: FieldTimelineItem) => (
              <Text key={item.id} style={styles.line}>
                {item.atLabel} · {item.title}
                {item.subtitle ? ` — ${item.subtitle}` : ''}
              </Text>
            ))
          ) : (
            <Text style={styles.muted}>No timeline events yet.</Text>
          )}
        </Panel>
      ) : null}

      {tab === 'activities' ? (
        <Panel title="Activities">
          {activities.length ? (
            activities.slice(0, 8).map((a) => (
              <View key={a.id} style={styles.card}>
                <Text style={styles.cardTitle}>{a.activityLabel}</Text>
                <Text style={styles.muted}>
                  {a.dateLabel}
                  {a.costInr ? ` · ${formatInr(a.costInr)}` : ''}
                  {a.notes ? ` · ${a.notes}` : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No activities recorded for this field.</Text>
          )}
          <Btn label="View all activities" variant="secondary" onPress={() => router.push({ pathname: '/activities', params: { blockId: b.id } })} />
          <Btn label="Add activity" onPress={() => router.push({ pathname: '/activities/add', params: { blockId: b.id } })} />
        </Panel>
      ) : null}

      {tab === 'recommendations' ? (
        <Panel title="Recommendations">
          {recommendations.length ? (
            recommendations.map((rec) => (
              <View key={rec.id} style={styles.card}>
                <Text style={styles.cardTitle}>{rec.title}</Text>
                <Text style={styles.muted}>{rec.dateLabel} · {rec.cropName}</Text>
                {rec.products.map((p) => (
                  <View key={p.title} style={styles.recoRow}>
                    <Text style={styles.body}>• {p.title}</Text>
                    <Btn label="Add to cart" variant="secondary" onPress={() => void addRecoProduct(rec, p.title)} />
                  </View>
                ))}
                <Btn label="View details" variant="secondary" onPress={() => router.push(`/recommendations/${rec.id}`)} />
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No open recommendations for this field.</Text>
          )}
        </Panel>
      ) : null}

      {tab === 'roi' ? (
        <Panel title="Field ROI">
          <Btn label="Open ROI dashboard" onPress={() => router.push('/(tabs)/roi')} />
          <Btn label="Add expense" variant="secondary" onPress={() => router.push('/roi/quick-expense')} />
        </Panel>
      ) : null}

      <Panel title="Quick actions">
        <Btn label="Upload scan" onPress={() => router.push('/scan')} />
        <Btn label="Add activity" variant="secondary" onPress={() => router.push({ pathname: '/activities/add', params: { blockId: b.id } })} />
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: tokens.text, marginBottom: 8 },
  line: { fontSize: 13, color: tokens.text, marginBottom: 8, lineHeight: 18 },
  muted: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: tokens.text, marginBottom: 4 },
  body: { fontSize: 13, color: tokens.text, flex: 1 },
  recoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
});
