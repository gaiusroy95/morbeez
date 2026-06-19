import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PartnerFarmerWorkspace, PartnerSuggestedAction } from '@morbeez/shared';
import { tokens } from '@morbeez/shared';
import { KeyValueRow, Panel } from '@morbeez/ui-native';
import type { PartnerWorkspaceTab } from '@/lib/farmer-workspace-routing';

type Props = {
  workspace: PartnerFarmerWorkspace;
  onNavigate: (tab: PartnerWorkspaceTab) => void;
};

function KpiTile({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{content}</Pressable>;
  return content;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

function actionTab(action: PartnerSuggestedAction): PartnerWorkspaceTab {
  if (action === 'soil_sampling' || action === 'field_visit') return 'tasks';
  if (action === 'follow_up' || action === 'callback') return 'visits';
  return 'visits';
}

export function PartnerOverviewPanel({ workspace, onNavigate }: Props) {
  const snap = workspace.farmSnapshot;
  const ownership = workspace.ownership;
  const lastVisit = workspace.recentVisits?.[0];

  return (
    <View style={styles.root}>
      <Panel title="Key metrics">
        <View style={styles.kpiGrid}>
          <KpiTile
            label="Last visit"
            value={formatDate(workspace.lastVisitAt)}
            onPress={() => onNavigate('visits')}
          />
          <KpiTile
            label="Open recs"
            value={String(workspace.openRecommendationsCount ?? 0)}
            onPress={() => onNavigate('visits')}
          />
          <KpiTile
            label="Pending tasks"
            value={String(workspace.pendingTaskCount ?? 0)}
            onPress={() => onNavigate('tasks')}
          />
          <KpiTile
            label="Sales opportunities"
            value={String(workspace.salesOpportunities?.length ?? 0)}
            onPress={() => onNavigate('sales')}
          />
        </View>
      </Panel>

      {ownership ? (
        <Panel title="Attribution">
          <KeyValueRow
            label="Enrollment owner"
            value={
              ownership.enrollmentOwnerPartnerName ??
              String(ownership.enrollmentOwnerType ?? '—')
            }
          />
          <KeyValueRow
            label="Customer owner"
            value={
              ownership.customerOwnerPartnerName ??
              String(ownership.customerOwnerType ?? '—')
            }
          />
          <KeyValueRow
            label="Assigned partner"
            value={ownership.assignedPartnerName ?? '—'}
          />
          <KeyValueRow label="Service model" value={String(ownership.serviceModel ?? '—')} />
          <KeyValueRow
            label="Enrollment source"
            value={String(ownership.enrollmentSource ?? '—')}
          />
          <KeyValueRow
            label="Partner code"
            value={String(ownership.partnerCodeAtEnrollment ?? '—')}
          />
        </Panel>
      ) : null}

      <Panel title="Team">
        <KeyValueRow
          label="Telecaller"
          value={ownership?.assignedTelecallerEmail ?? '—'}
        />
        <KeyValueRow
          label="Expert"
          value={ownership?.assignedExpertEmail ?? '—'}
        />
      </Panel>

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

      {workspace.currentRecommendation ? (
        <Panel title="Current recommendation">
          <Text style={styles.recTitle}>{workspace.currentRecommendation.title}</Text>
          <Text style={styles.meta}>Status: {workspace.currentRecommendation.status}</Text>
        </Panel>
      ) : null}

      <Panel title="Suggested action">
        <Text style={styles.suggested}>{workspace.suggestedActionLabel}</Text>
        {workspace.suggestedAction !== 'none' ? (
          <Pressable
            style={styles.actionBtn}
            onPress={() => onNavigate(actionTab(workspace.suggestedAction))}
          >
            <Text style={styles.actionBtnText}>
              {workspace.suggestedAction === 'field_visit'
                ? 'Start visit'
                : workspace.suggestedAction === 'soil_sampling'
                  ? 'View soil tasks'
                  : 'View tasks'}
            </Text>
          </Pressable>
        ) : null}
      </Panel>

      {lastVisit ? (
        <Panel title="Recent activity">
          <Text style={styles.recTitle}>{formatDate(lastVisit.visitedAt)}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {lastVisit.summary ?? 'Field visit recorded'}
          </Text>
          <Pressable onPress={() => onNavigate('visits')}>
            <Text style={styles.link}>View visit history →</Text>
          </Pressable>
        </Panel>
      ) : null}
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
  actionBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: tokens.green700,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: tokens.radiusSm,
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
