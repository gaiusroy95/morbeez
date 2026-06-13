import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { formatDate, telecallerClient, tokens } from '@morbeez/shared';
import { AlertBox, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';

export default function BlockWorkspaceScreen() {
  const { leadId, blockId } = useLocalSearchParams<{ leadId: string; blockId: string }>();
  const [workspace, setWorkspace] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!leadId || !blockId) return;
    setLoading(true);
    setError('');
    try {
      setWorkspace(await telecallerClient.getBlockWorkspace(String(leadId), String(blockId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load block workspace');
    } finally {
      setLoading(false);
    }
  }, [leadId, blockId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading block workspace…" />;
  if (!workspace) {
    return (
      <View style={styles.center}>
        {error ? <AlertBox>{error}</AlertBox> : null}
      </View>
    );
  }

  const block = (workspace.block as Record<string, unknown> | undefined) ?? {};
  const activities = (workspace.activities as Record<string, unknown>[] | undefined) ?? [];
  const soilTests = (workspace.soilTests as Record<string, unknown>[] | undefined) ?? [];
  const findings = (workspace.findings as Record<string, unknown>[] | undefined) ?? [];
  const recommendations = (workspace.recommendations as Record<string, unknown>[] | undefined) ?? [];
  const roi = workspace.roi as Record<string, unknown> | undefined;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Panel title={String(block.name ?? 'Block')}>
        <KeyValueRow label="Crop" value={String(block.cropType ?? block.crop_type ?? '—')} />
        <KeyValueRow label="DAP" value={block.dap != null ? String(block.dap) : '—'} />
        <KeyValueRow label="Health" value={String(block.blockHealth ?? block.healthStatus ?? '—')} />
      </Panel>

      <Panel title="Activities">
        {activities.length ? (
          activities.slice(0, 10).map((a) => (
            <Text key={String(a.id)} style={styles.row}>
              • {String(a.title ?? a.activityType ?? 'Activity')}
              {a.occurredAt || a.created_at ? ` — ${formatDate(String(a.occurredAt ?? a.created_at))}` : ''}
            </Text>
          ))
        ) : (
          <Text style={styles.empty}>No activities logged.</Text>
        )}
      </Panel>

      <Panel title="Soil tests">
        {soilTests.length ? (
          soilTests.slice(0, 5).map((s) => (
            <Text key={String(s.id)} style={styles.row}>
              • {s.reportedAt || s.created_at ? formatDate(String(s.reportedAt ?? s.created_at)) : 'Soil test'}
            </Text>
          ))
        ) : (
          <Text style={styles.empty}>No soil tests.</Text>
        )}
      </Panel>

      <Panel title="Field findings">
        {findings.length ? (
          findings.slice(0, 5).map((f) => (
            <Text key={String(f.id)} style={styles.row}>
              • {String(f.summary ?? f.issue ?? 'Visit')}
              {f.visitedAt ? ` — ${formatDate(String(f.visitedAt))}` : ''}
            </Text>
          ))
        ) : (
          <Text style={styles.empty}>No field findings.</Text>
        )}
      </Panel>

      <Panel title="Recommendations">
        {recommendations.length ? (
          recommendations.slice(0, 5).map((r) => (
            <Text key={String(r.id)} style={styles.row}>
              • {String(r.issue ?? r.title ?? 'Recommendation')} — {String(r.status ?? 'open')}
            </Text>
          ))
        ) : (
          <Text style={styles.empty}>No block recommendations.</Text>
        )}
      </Panel>

      {roi ? (
        <Panel title="ROI">
          <KeyValueRow label="Status" value={String(roi.status ?? '—')} />
          {roi.summary ? <Text style={styles.row}>{String(roi.summary)}</Text> : null}
        </Panel>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  row: { fontSize: 14, color: tokens.text, marginBottom: 6, lineHeight: 20 },
  empty: { fontSize: 13, color: tokens.textMuted },
});
