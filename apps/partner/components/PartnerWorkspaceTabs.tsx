import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { PartnerFarmerWorkspace } from '@morbeez/shared';
import { tokens } from '@morbeez/shared';
import { AlertBox, ScrollableHubTabs } from '@morbeez/ui-native';
import { PARTNER_WORKSPACE_TABS, type PartnerWorkspaceTab } from '@/lib/farmer-workspace-routing';
import { PartnerFarmerHeader } from '@/components/farmer/PartnerFarmerHeader';
import { PartnerOverviewPanel } from '@/components/farmer/PartnerOverviewPanel';
import { PartnerInteractionsPanel } from '@/components/farmer/PartnerInteractionsPanel';
import { PartnerBlocksPanel } from '@/components/farmer/PartnerBlocksPanel';
import { PartnerFarmerTasksPanel } from '@/components/farmer/PartnerFarmerTasksPanel';
import { PartnerVisitsPanel } from '@/components/farmer/PartnerVisitsPanel';
import { PartnerOrdersPanel } from '@/components/farmer/PartnerOrdersPanel';
import { PartnerEscalationsPanel } from '@/components/farmer/PartnerEscalationsPanel';
import { PartnerCollaborationPanel } from '@/components/farmer/PartnerCollaborationPanel';
import { PartnerSalesOpportunitiesPanel } from '@/components/PartnerSalesOpportunitiesPanel';

type Props = {
  farmerId: string;
  workspace: PartnerFarmerWorkspace;
};

export function PartnerWorkspaceTabs({ farmerId, workspace }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<PartnerWorkspaceTab>('overview');
  const [error, setError] = useState('');

  const farmerName = workspace.header?.name ?? workspace.farmer?.name ?? 'Farmer';

  function startVisit(blockId?: string) {
    const block = blockId
      ? workspace.blocks.find((b) => String(b.id) === blockId)
      : workspace.blocks[0];
    const qs = new URLSearchParams({
      farmerId,
      farmerName,
      blockId: String(block?.id ?? blockId ?? ''),
      blockName: String(block?.name ?? block?.plotLabel ?? 'Block'),
      cropType: String(block?.cropType ?? block?.crop_type ?? 'ginger'),
    });
    router.push(`/visit?${qs.toString()}`);
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.headerWrap}>
        {error ? <AlertBox>{error}</AlertBox> : null}
        <PartnerFarmerHeader farmerId={farmerId} workspace={workspace} onStartVisit={startVisit} />
      </ScrollView>

      <ScrollableHubTabs tabs={PARTNER_WORKSPACE_TABS} active={tab} onChange={setTab} />

      <ScrollView contentContainerStyle={styles.panelWrap}>
        {tab === 'overview' ? (
          <PartnerOverviewPanel workspace={workspace} onNavigate={setTab} />
        ) : null}
        {tab === 'interactions' ? (
          <PartnerInteractionsPanel farmerId={farmerId} initialTimeline={workspace.timeline} />
        ) : null}
        {tab === 'blocks' ? (
          <PartnerBlocksPanel farmerId={farmerId} blocks={workspace.blocks} />
        ) : null}
        {tab === 'tasks' ? <PartnerFarmerTasksPanel farmerId={farmerId} /> : null}
        {tab === 'visits' ? (
          <PartnerVisitsPanel
            farmerId={farmerId}
            farmerName={farmerName}
            recentVisits={workspace.recentVisits}
          />
        ) : null}
        {tab === 'orders' ? <PartnerOrdersPanel farmerId={farmerId} /> : null}
        {tab === 'escalations' ? <PartnerEscalationsPanel farmerId={farmerId} /> : null}
        {tab === 'collaboration' ? <PartnerCollaborationPanel farmerId={farmerId} /> : null}
        {tab === 'sales' ? <PartnerSalesOpportunitiesPanel farmerId={farmerId} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  headerWrap: { padding: 16, paddingBottom: 0 },
  panelWrap: { padding: 16, paddingTop: 8, paddingBottom: 32 },
});
