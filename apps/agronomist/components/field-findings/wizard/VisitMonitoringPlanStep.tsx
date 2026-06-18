import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { agronomistClient, tokens, type MonitoringPlanPreviewItem, type RecommendationGroupDraft } from '@morbeez/shared';
import { AlertBox } from '@morbeez/ui-native';
import type { IssueDraft } from '../IssueCard';

type Props = {
  issues: IssueDraft[];
  recommendationGroups: RecommendationGroupDraft[];
  monitoringPlan: MonitoringPlanPreviewItem[];
  onChange: (items: MonitoringPlanPreviewItem[]) => void;
};

export function VisitMonitoringPlanStep({ issues, recommendationGroups, monitoringPlan, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (monitoringPlan.length || !issues.length) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const items = await agronomistClient.previewMonitoringPlan({
        issues: issues.map((i) => ({ localId: i.localId, issueName: i.issueName, severity: i.severity })),
        recommendationGroups,
      });
      onChange(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load monitoring plan');
      onChange(
        issues.map((i) => ({
          localId: `mon-${i.localId}`,
          issueLocalId: i.localId,
          issueLabel: i.issueName,
          intervalDays: i.severity === 'high' ? 3 : i.severity === 'low' ? 14 : 7,
          checkType: 'field_monitoring',
          severity: i.severity,
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.green700} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {monitoringPlan.map((item) => (
        <View key={item.localId} style={styles.card}>
          <Text style={styles.title}>{item.issueLabel}</Text>
          <Text style={styles.sub}>
            Every {item.intervalDays}d · {item.checkType} · {item.severity}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  center: { padding: 24, alignItems: 'center' },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
  },
  title: { fontSize: 15, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
});
