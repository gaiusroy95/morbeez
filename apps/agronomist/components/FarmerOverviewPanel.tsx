import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { agronomistClient, formatDate, tokens, type FarmerWorkspaceDashboard } from '@morbeez/shared';
import { AlertBox, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { RecommendationSection } from '@/components/RecommendationSection';
import type { AgronomistRecommendationRow } from '@morbeez/shared';

export type FarmerWorkspaceTab =
  | 'overview'
  | 'interactions'
  | 'blocks'
  | 'visits'
  | 'recommendations'
  | 'orders'
  | 'followUps'
  | 'notes'
  | 'team';

type Props = {
  farmerId: string;
  leadId?: string | null;
  recommendations: AgronomistRecommendationRow[];
  onNavigate: (tab: FarmerWorkspaceTab) => void;
};

type KpiCard = {
  label: string;
  value: string;
  tab: FarmerWorkspaceTab;
};

function KpiTile({ card, onPress }: { card: KpiCard; onPress: () => void }) {
  return (
    <Pressable style={styles.kpi} onPress={onPress}>
      <Text style={styles.kpiValue}>{card.value}</Text>
      <Text style={styles.kpiLabel}>{card.label}</Text>
    </Pressable>
  );
}

export function FarmerOverviewPanel({ farmerId, leadId, recommendations, onNavigate }: Props) {
  const [dashboard, setDashboard] = useState<FarmerWorkspaceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDashboard(await agronomistClient.getWorkspaceDashboard(farmerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading overview…" />;
  if (!dashboard) {
    return error ? <AlertBox>{error}</AlertBox> : null;
  }

  const cards: KpiCard[] = [
    { label: 'Open tasks', value: String(dashboard.pendingTaskCount), tab: 'followUps' },
    { label: 'Pending reviews', value: String(dashboard.pendingFindingReviewsCount), tab: 'visits' },
    { label: 'Escalations', value: String(dashboard.openEscalationCount), tab: 'followUps' },
    { label: "Today's visits", value: String(dashboard.todaysVisitsCount), tab: 'visits' },
    { label: 'Pending recs', value: String(dashboard.pendingRecommendationsCount), tab: 'recommendations' },
    { label: 'Open issues', value: String(dashboard.openIssuesCount), tab: 'visits' },
  ];

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Command center">
        <View style={styles.kpiGrid}>
          {cards.map((card) => (
            <KpiTile key={card.label} card={card} onPress={() => onNavigate(card.tab)} />
          ))}
        </View>
        <KeyValueRow
          label="Last call"
          value={dashboard.lastCallAt ? formatDate(dashboard.lastCallAt) : '—'}
        />
        <KeyValueRow
          label="Last visit"
          value={dashboard.lastVisitAt ? formatDate(dashboard.lastVisitAt) : '—'}
        />
        <KeyValueRow label="Health" value={dashboard.healthStatus} />
        <KeyValueRow label="Active crops" value={dashboard.activeCrops.join(', ') || '—'} />
      </Panel>
      <RecommendationSection
        farmerId={farmerId}
        leadId={leadId}
        recommendations={recommendations}
        compact
      />
      <Pressable onPress={() => onNavigate('blocks')}>
        <Text style={styles.link}>View blocks →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: 12, paddingBottom: 32 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kpi: {
    width: '31%',
    minWidth: 96,
    flexGrow: 1,
    backgroundColor: tokens.green100,
    borderRadius: tokens.radiusSm,
    padding: 10,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 20, fontWeight: '800', color: tokens.green800 },
  kpiLabel: { fontSize: 11, color: tokens.textMuted, marginTop: 4, textAlign: 'center' },
  link: { fontSize: 14, fontWeight: '600', color: tokens.green700, textAlign: 'center', marginTop: 8 },
});
