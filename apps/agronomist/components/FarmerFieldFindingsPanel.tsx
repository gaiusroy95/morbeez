import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  agronomistClient,
  formatDate,
  tokens,
  type FarmerFieldFindingRow,
  type FieldFindingStatusFilter,
} from '@morbeez/shared';
import { AlertBox, ListCard, Loading, Panel } from '@morbeez/ui-native';
import { SegmentedChips } from '@/components/field-findings/SegmentedChips';

const STATUS_FILTERS = [
  { value: 'all' as const, label: 'All' },
  { value: 'open' as const, label: 'Open' },
  { value: 'monitoring' as const, label: 'Monitoring' },
  { value: 'resolved' as const, label: 'Resolved' },
];

type Props = {
  farmerId: string;
};

function healthLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/_/g, ' ');
}

export function FarmerFieldFindingsPanel({ farmerId }: Props) {
  const router = useRouter();
  const [findings, setFindings] = useState<FarmerFieldFindingRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<FieldFindingStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await agronomistClient.listFarmerVisits(farmerId, {
        limit: 50,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setFindings(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load field findings');
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, [farmerId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const emptyLabel = useMemo(() => {
    if (statusFilter === 'all') return 'No field findings recorded yet.';
    return `No ${statusFilter} findings.`;
  }, [statusFilter]);

  if (loading && !findings.length) return <Loading label="Loading field findings…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <SegmentedChips options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      <Panel title="Field findings timeline">
        <Text style={styles.hint}>
          Structured visits create AI-ready issue records. Start a new visit from a block or the footer below.
        </Text>
      </Panel>
      <View style={styles.list}>
        {findings.map((item) => {
          const topIssues =
            item.topIssueNames?.length ? item.topIssueNames.join(', ') : item.summary || '—';
          const health = healthLabel(item.blockHealth);
          return (
            <ListCard
              key={item.id}
              title={item.blockName}
              subtitle={topIssues}
              meta={[
                formatDate(item.visitedAt),
                item.cropType ?? null,
                item.dapAtVisit != null ? `DAP ${item.dapAtVisit}` : null,
                `${item.issueCount} issue${item.issueCount === 1 ? '' : 's'}`,
                item.recommendationCount ? `${item.recommendationCount} recs` : null,
                health,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push(`/visit/${item.id}`)}
            />
          );
        })}
        {!findings.length && !loading ? <Text style={styles.empty}>{emptyLabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, paddingBottom: 8 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  list: { gap: 8 },
  empty: { padding: 24, color: tokens.textMuted, textAlign: 'center' },
});
