import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { agronomistClient, formatDate, tokens, type FarmerWorkspaceDashboard } from '@morbeez/shared';
import { AlertBox, KeyValueRow, Loading, Panel, androidPressHandlers } from '@morbeez/ui-native';
import { RecommendationSection } from '@/components/RecommendationSection';
import type { AgronomistRecommendationRow } from '@morbeez/shared';
import {
  type FarmerWorkspaceTab,
} from '@/lib/farmer-workspace-routing';

export type { FarmerWorkspaceTab };

type Props = {
  farmerId: string;
  farmerName: string;
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
    <Pressable style={styles.kpi} {...androidPressHandlers(onPress)}>
      <Text style={styles.kpiValue}>{card.value}</Text>
      <Text style={styles.kpiLabel}>{card.label}</Text>
    </Pressable>
  );
}

export function FarmerOverviewPanel({ farmerId, farmerName, leadId, recommendations, onNavigate }: Props) {
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
    {
      label: 'Pending reviews',
      value: String(dashboard.pendingFindingReviewsCount),
      tab: 'fieldFindings',
    },
    { label: 'Escalations', value: String(dashboard.openEscalationCount), tab: 'followUps' },
    {
      label: "Today's visits",
      value: String(dashboard.todaysVisitsCount),
      tab: 'fieldFindings',
    },
    { label: 'Pending recs', value: String(dashboard.pendingRecommendationsCount), tab: 'recommendations' },
    { label: 'Open issues', value: String(dashboard.openIssuesCount), tab: 'fieldFindings' },
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
        farmerName={farmerName}
        leadId={leadId}
        recommendations={recommendations}
        compact
        showAdd={false}
      />
      <View style={styles.links}>
        <Pressable {...androidPressHandlers(() => onNavigate('recommendations'))}>
          <Text style={styles.link}>View recommendations →</Text>
        </Pressable>
        <Pressable {...androidPressHandlers(() => onNavigate('blocks'))}>
          <Text style={styles.link}>View blocks →</Text>
        </Pressable>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { padding: 12, paddingBottom: 8, gap: 12 },
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
  links: { gap: 4 },
});
