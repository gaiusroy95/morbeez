import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { tokens, type LeadWorkspaceTab, type TelecallerWorkspaceSummary } from '@morbeez/shared';
import { ScrollableHubTabs } from '@morbeez/ui-native';
import { LeadWorkspaceHeader } from '@/components/LeadWorkspaceHeader';
import { LeadOverviewPanel } from '@/components/LeadOverviewPanel';
import { LeadInteractionsPanel } from '@/components/LeadInteractionsPanel';
import { LeadBlocksPanel } from '@/components/LeadBlocksPanel';
import { LeadRecommendationsPanel } from '@/components/LeadRecommendationsPanel';
import { LeadOrdersPanel } from '@/components/LeadOrdersPanel';
import { LeadNotesPanel } from '@/components/LeadNotesPanel';
import { LeadTeamPanel } from '@/components/LeadTeamPanel';

const TABS: Array<{ id: LeadWorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'team', label: 'Team' },
  { id: 'interactions', label: 'Interactions' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'orders', label: 'Orders' },
  { id: 'notes', label: 'Notes' },
];

type Props = {
  summary: TelecallerWorkspaceSummary;
};

export function LeadWorkspaceTabs({ summary }: Props) {
  const [tab, setTab] = useState<LeadWorkspaceTab>('overview');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.headerWrap}>
        <LeadWorkspaceHeader summary={summary} />
      </ScrollView>
      <ScrollableHubTabs
        tabs={TABS}
        active={tab}
        onChange={setTab}
      />
      <ScrollView contentContainerStyle={styles.panelWrap}>
        {tab === 'overview' ? (
          <LeadOverviewPanel leadId={summary.leadId} summary={summary} onNavigate={setTab} />
        ) : null}
        {tab === 'team' ? <LeadTeamPanel leadId={summary.leadId} /> : null}
        {tab === 'interactions' ? (
          <LeadInteractionsPanel leadId={summary.leadId} farmerId={summary.farmerId} />
        ) : null}
        {tab === 'blocks' ? <LeadBlocksPanel leadId={summary.leadId} /> : null}
        {tab === 'recommendations' ? <LeadRecommendationsPanel leadId={summary.leadId} /> : null}
        {tab === 'orders' ? <LeadOrdersPanel leadId={summary.leadId} /> : null}
        {tab === 'notes' ? <LeadNotesPanel leadId={summary.leadId} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  headerWrap: { padding: 16, paddingBottom: 0 },
  panelWrap: { padding: 16, paddingTop: 8 },
});
