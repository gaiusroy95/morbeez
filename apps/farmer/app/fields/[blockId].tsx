import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchFieldDetail, tokens, type FieldDetail, type FieldTimelineItem } from '@morbeez/shared';
import { AlertBox, Btn, HealthBadge, HubTabs, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';

type Tab = 'overview' | 'timeline' | 'activities' | 'recommendations' | 'roi';

export default function FieldDetailScreen() {
  const router = useRouter();
  const { blockId } = useLocalSearchParams<{ blockId: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<FieldDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!blockId) return;
    void fetchFieldDetail(String(blockId))
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load field'))
      .finally(() => setLoading(false));
  }, [blockId]);

  if (loading) return <Loading label="Loading field…" />;
  if (!detail) return <AlertBox>{error || 'Field not found'}</AlertBox>;

  const b = detail.block;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Text style={styles.title}>{b.name}</Text>
      <HealthBadge status={b.healthStatus} label={b.healthLabel} />

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
          {detail.timeline.map((t: FieldTimelineItem) => (
            <Text key={t.id} style={styles.line}>
              {t.atLabel} · {t.title}
              {t.subtitle ? ` — ${t.subtitle}` : ''}
            </Text>
          ))}
        </Panel>
      ) : null}

      {tab === 'activities' ? (
        <Panel title="Activities">
          <Btn label="View all activities" variant="secondary" onPress={() => router.push({ pathname: '/activities', params: { blockId: b.id } })} />
          <Btn label="Add activity" onPress={() => router.push({ pathname: '/activities/add', params: { blockId: b.id } })} />
        </Panel>
      ) : null}

      {tab === 'recommendations' ? (
        <Btn label="View recommendations" onPress={() => router.push('/recommendations')} />
      ) : null}

      {tab === 'roi' ? (
        <Btn label="ROI dashboard" onPress={() => router.push('/intel/roi')} />
      ) : null}

      <Panel title="Actions">
        <Btn label="Upload scan" onPress={() => router.push('/(tabs)/scan')} />
        <Btn label="Add activity" variant="secondary" onPress={() => router.push({ pathname: '/activities/add', params: { blockId: b.id } })} />
        <Btn label="Buy recommendation" variant="secondary" onPress={() => router.push('/(tabs)/shop')} />
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: tokens.text, marginBottom: 8 },
  line: { fontSize: 13, color: tokens.text, marginBottom: 8, lineHeight: 18 },
});
