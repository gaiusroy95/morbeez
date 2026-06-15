import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PartnerFarmerWorkspace } from '@morbeez/shared';
import { tokens } from '@morbeez/shared';
import { KeyValueRow, Panel } from '@morbeez/ui-native';
import type { PartnerWorkspaceTab } from '@/lib/farmer-workspace-routing';

type Props = {
  workspace: PartnerFarmerWorkspace;
  onNavigate: (tab: PartnerWorkspaceTab) => void;
};

function KpiTile({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const content = (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{content}</Pressable>;
  return content;
}

export function PartnerOverviewPanel({ workspace, onNavigate }: Props) {
  const snap = workspace.farmSnapshot;
  return (
    <View style={styles.root}>
      <Panel title="Farm snapshot">
        <View style={styles.kpiGrid}>
          <KpiTile label="Farm area" value={snap.totalAcreage != null ? `${snap.totalAcreage} ac` : '—'} />
          <KpiTile
            label="Active blocks"
            value={String(snap.activeBlockCount)}
            onPress={() => onNavigate('blocks')}
          />
          <KpiTile label="Current crop" value={snap.primaryCrop ?? '—'} />
          <KpiTile label="Crop status" value={snap.cropStatus ?? '—'} />
        </View>
      </Panel>

      {workspace.ownership ? (
        <Panel title="Farmer attribution">
          <KeyValueRow
            label="Enrollment owner"
            value={String(workspace.ownership.enrollmentOwnerType ?? '—')}
          />
          <KeyValueRow
            label="Customer owner"
            value={String(workspace.ownership.customerOwnerType ?? '—')}
          />
          <KeyValueRow label="Service model" value={String(workspace.ownership.serviceModel ?? '—')} />
        </Panel>
      ) : null}

      {workspace.currentRecommendation ? (
        <Panel title="Current recommendation">
          <Text style={styles.recTitle}>{workspace.currentRecommendation.title}</Text>
          <Text style={styles.meta}>Status: {workspace.currentRecommendation.status}</Text>
        </Panel>
      ) : null}

      <Panel title="Pending work">
        <KeyValueRow
          label="Partner tasks"
          value={String(workspace.pendingTaskCount ?? 0)}
        />
        <Pressable onPress={() => onNavigate('tasks')}>
          <Text style={styles.link}>View tasks →</Text>
        </Pressable>
      </Panel>

      <Panel title="Suggested action">
        <Text style={styles.suggested}>{workspace.suggestedActionLabel}</Text>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: {
    width: '47%',
    backgroundColor: tokens.bg,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 10,
  },
  kpiValue: { fontSize: 14, fontWeight: '700', color: tokens.text },
  kpiLabel: { fontSize: 11, color: tokens.textMuted, marginTop: 4 },
  recTitle: { fontSize: 15, fontWeight: '600', color: tokens.text },
  meta: { fontSize: 13, color: tokens.textMuted, marginTop: 4 },
  link: { color: tokens.green700, fontWeight: '600', marginTop: 8 },
  suggested: { fontSize: 16, fontWeight: '600', color: tokens.green800 },
});
