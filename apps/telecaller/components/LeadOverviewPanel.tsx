import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDate, formatPhoneDisplay, telecallerClient, tokens, type LeadWorkspaceTab, type TelecallerWorkspaceSummary } from '@morbeez/shared';
import { AlertBox, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';
import { useCallback, useEffect, useState } from 'react';

type Props = {
  leadId: string;
  summary: TelecallerWorkspaceSummary;
  onNavigate: (tab: LeadWorkspaceTab) => void;
};

type KpiCard = { label: string; value: string; tab: LeadWorkspaceTab };

function KpiTile({ card, onPress }: { card: KpiCard; onPress: () => void }) {
  return (
    <Pressable style={styles.kpi} onPress={onPress}>
      <Text style={styles.kpiValue}>{card.value}</Text>
      <Text style={styles.kpiLabel}>{card.label}</Text>
    </Pressable>
  );
}

export function LeadOverviewPanel({ leadId, summary, onNavigate }: Props) {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = await telecallerClient.getLeadFarmerProfile(leadId);
      setProfile(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading overview…" />;

  const cards: KpiCard[] = [
    { label: 'Open tasks', value: String(summary.pendingTaskCount), tab: 'notes' },
    { label: 'Open recs', value: String(summary.openRecommendationsCount), tab: 'recommendations' },
    { label: 'Escalations', value: String(summary.openEscalationCount), tab: 'interactions' },
    { label: 'Blocks', value: String(summary.blockCount), tab: 'blocks' },
    { label: 'Last order', value: summary.lastOrderAt ? formatDate(summary.lastOrderAt) : '—', tab: 'orders' },
    { label: 'Health', value: summary.healthStatus, tab: 'overview' },
  ];

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Snapshot">
        <View style={styles.kpiGrid}>
          {cards.map((card) => (
            <KpiTile key={card.label} card={card} onPress={() => onNavigate(card.tab)} />
          ))}
        </View>
      </Panel>

      <Panel title="Personal information">
        <KeyValueRow label="Name" value={summary.farmer.name} />
        <KeyValueRow label="Phone" value={summary.farmer.phone ? formatPhoneDisplay(summary.farmer.phone) : '—'} />
        <KeyValueRow label="Language" value={summary.farmer.language ?? '—'} />
        <KeyValueRow label="Location" value={[summary.farmer.village, summary.farmer.district].filter(Boolean).join(', ') || '—'} />
      </Panel>

      <Panel title="Farm information">
        <KeyValueRow label="Acreage" value={summary.farmer.acreage != null ? String(summary.farmer.acreage) : '—'} />
        <KeyValueRow label="Blocks" value={String(summary.blockCount)} />
        <KeyValueRow label="Active crops" value={summary.activeCrops.join(', ') || '—'} />
        <KeyValueRow label="Current DAP" value={summary.dap != null ? String(summary.dap) : '—'} />
      </Panel>

      <Panel title="CRM information">
        <KeyValueRow label="Lead stage" value={summary.lead.stageLabel} />
        <KeyValueRow label="Lead source" value={summary.lead.leadSource ?? '—'} />
        <KeyValueRow label="Campaign" value={summary.lead.campaign ?? '—'} />
        <KeyValueRow
          label="Customer since"
          value={summary.lead.customerSince ? formatDate(summary.lead.customerSince) : '—'}
        />
        <KeyValueRow label="Assigned telecaller" value={summary.lead.assignedTelecaller ?? '—'} />
        <KeyValueRow label="Assigned agronomist" value={summary.lead.assignedAgronomist ?? '—'} />
        <KeyValueRow label="Assigned partner" value={summary.lead.assignedPartnerName ?? '—'} />
        <KeyValueRow
          label="Revenue generated"
          value={
            summary.intelligence.revenueGenerated != null
              ? `₹${summary.intelligence.revenueGenerated.toLocaleString('en-IN')}`
              : '—'
          }
        />
        <KeyValueRow
          label="Last interaction"
          value={summary.lastInteractionAt ? formatDate(summary.lastInteractionAt) : '—'}
        />
        <KeyValueRow
          label="Last visit"
          value={summary.lastVisitAt ? formatDate(summary.lastVisitAt) : '—'}
        />
        <KeyValueRow label="Service model" value={summary.lead.serviceModel ?? 'remote_advisory'} />
        <KeyValueRow label="Ownership" value={summary.lead.ownership ?? '—'} />
        <KeyValueRow label="Enrollment source" value={summary.lead.enrollmentSource ?? '—'} />
        {profile?.farmType ? <KeyValueRow label="Farm type" value={String(profile.farmType)} /> : null}
        {profile?.irrigation ? <KeyValueRow label="Irrigation" value={String(profile.irrigation)} /> : null}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingBottom: 24 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: {
    width: '31%',
    backgroundColor: tokens.bg,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 10,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 14, fontWeight: '700', color: tokens.text },
  kpiLabel: { fontSize: 11, color: tokens.textMuted, marginTop: 4, textAlign: 'center' },
});
