import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { partnerClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, ListCard, Loading, Panel, ScrollableHubTabs } from '@morbeez/ui-native';

type BlockTab = 'overview' | 'activities' | 'findings' | 'soil' | 'recommendations' | 'history';

const TABS: Array<{ id: BlockTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'activities', label: 'Activities' },
  { id: 'findings', label: 'Findings' },
  { id: 'soil', label: 'Soil' },
  { id: 'recommendations', label: 'Recs' },
  { id: 'history', label: 'History' },
];

export default function PartnerBlockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmerId: string; blockId: string }>();
  const farmerId = String(params.farmerId ?? '');
  const blockId = String(params.blockId ?? '');
  const [tab, setTab] = useState<BlockTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [timeline, setTimeline] = useState<unknown[]>([]);

  useEffect(() => {
    if (!farmerId || !blockId) return;
    void Promise.all([
      partnerClient.getBlockDetail(farmerId, blockId),
      partnerClient.getBlockTimeline(farmerId, blockId).catch(() => []),
    ])
      .then(([d, t]) => {
        setDetail(d as Record<string, unknown>);
        setTimeline(Array.isArray(t) ? t : ((t as Record<string, unknown>)?.events as unknown[]) ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load block'))
      .finally(() => setLoading(false));
  }, [farmerId, blockId]);

  if (loading) return <Loading label="Loading block…" />;

  const block = (detail?.block ?? detail) as Record<string, unknown>;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.header}>
        {error ? <AlertBox>{error}</AlertBox> : null}
        <Panel title={String(block?.name ?? 'Block')}>
          <KeyValueRow label="Crop" value={String(block?.cropType ?? block?.crop_type ?? '—')} />
          <KeyValueRow label="Area" value={block?.acreage != null ? String(block.acreage) : '—'} />
          <KeyValueRow label="DAP" value={block?.dap != null ? String(block.dap) : '—'} />
          <KeyValueRow label="Status" value={String(block?.healthStatus ?? block?.health_status ?? '—')} />
          <Btn
            label="Start visit"
            onPress={() =>
              router.push(
                `/visit?farmerId=${encodeURIComponent(farmerId)}&blockId=${encodeURIComponent(blockId)}&blockName=${encodeURIComponent(String(block?.name ?? 'Block'))}&cropType=${encodeURIComponent(String(block?.cropType ?? block?.crop_type ?? 'ginger'))}`
              )
            }
          />
        </Panel>
      </ScrollView>
      <ScrollableHubTabs tabs={TABS} active={tab} onChange={setTab} />
      <ScrollView contentContainerStyle={styles.panel}>
        {tab === 'overview' ? (
          <Panel title="Block overview">
            <KeyValueRow label="Planting" value={String(block?.plantingDate ?? '—')} />
            <KeyValueRow label="Last visit" value={String(block?.lastVisitAt ?? '—')} />
          </Panel>
        ) : null}
        {tab === 'activities' ? (
          <View style={styles.list}>
            {((detail?.activities as Record<string, unknown>[]) ?? []).map((a) => (
              <ListCard key={String(a.id)} title={String(a.activityLabel ?? a.activityType)} subtitle={String(a.dateLabel ?? a.activityDate ?? '')} />
            ))}
          </View>
        ) : null}
        {tab === 'findings' ? (
          <View style={styles.list}>
            {((detail?.fieldFindings as Record<string, unknown>[]) ?? []).map((f) => (
              <ListCard key={String(f.id)} title={String(f.diseasePest ?? 'Finding')} subtitle={String(f.observations ?? '')} meta={String(f.visitedLabel ?? '')} />
            ))}
          </View>
        ) : null}
        {tab === 'soil' ? (
          <View style={styles.list}>
            {((detail?.soilReports as Record<string, unknown>[]) ?? []).map((s, i) => (
              <ListCard key={String(s.id ?? i)} title={String(s.label ?? 'Soil test')} subtitle={String(s.sampleDate ?? '')} />
            ))}
          </View>
        ) : null}
        {tab === 'recommendations' ? (
          <View style={styles.list}>
            {((detail?.blockRecommendations as Record<string, unknown>[]) ?? []).map((r) => (
              <ListCard key={String(r.id)} title={String(r.title ?? 'Recommendation')} subtitle={String(r.body ?? '')} meta={String(r.status ?? '')} />
            ))}
          </View>
        ) : null}
        {tab === 'history' ? (
          <View style={styles.list}>
            {timeline.map((e, i) => (
              <ListCard key={i} title={String((e as Record<string, unknown>).title ?? 'Event')} subtitle={String((e as Record<string, unknown>).body ?? '')} />
            ))}
            {!timeline.length ? <Text style={styles.empty}>No history yet.</Text> : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  header: { padding: 16, paddingBottom: 0 },
  panel: { padding: 16, paddingBottom: 32 },
  list: { gap: 8 },
  empty: { color: tokens.textMuted, textAlign: 'center', padding: 16 },
});
