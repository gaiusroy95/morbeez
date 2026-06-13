import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, partnerClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, ListCard, Loading, Panel, ScrollableHubTabs, TextField } from '@morbeez/ui-native';
import { PartnerSalesOpportunitiesPanel } from '@/components/PartnerSalesOpportunitiesPanel';
import { PartnerTeamPanel } from '@/components/PartnerTeamPanel';

export type PartnerWorkspaceTab =
  | 'overview'
  | 'blocks'
  | 'visits'
  | 'recommendations'
  | 'sales'
  | 'team'
  | 'notes';

const TABS: Array<{ id: PartnerWorkspaceTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'visits', label: 'Visits' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'sales', label: 'Sales Opportunities' },
  { id: 'team', label: 'Team' },
  { id: 'notes', label: 'Notes' },
];

type Workspace = {
  farmer: Record<string, unknown>;
  blocks: Record<string, unknown>[];
  recentVisits?: Record<string, unknown>[];
  pendingTaskCount?: number;
  opportunityScore?: number | null;
  ownership?: Record<string, unknown> | null;
};

type Props = {
  farmerId: string;
  workspace: Workspace;
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

export function PartnerWorkspaceTabs({ farmerId, workspace }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<PartnerWorkspaceTab>('overview');
  const [notes, setNotes] = useState<Record<string, unknown>[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, unknown>[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [recsLoading, setRecsLoading] = useState(false);
  const [error, setError] = useState('');

  const farmer = workspace.farmer;
  const phone = String(farmer.phone ?? '').replace(/\D/g, '');
  const farmerName = String(farmer.name ?? 'Farmer');

  const loadNotes = async () => {
    setNotesLoading(true);
    setError('');
    try {
      setNotes(await partnerClient.getTimeline(farmerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notes');
    } finally {
      setNotesLoading(false);
    }
  };

  const loadRecommendations = async () => {
    setRecsLoading(true);
    setError('');
    try {
      const timeline = await partnerClient.getTimeline(farmerId);
      setRecommendations(
        timeline.filter(
          (e) =>
            e.entryType === 'review_request' ||
            e.fieldFindingId ||
            String(e.entry_type ?? '').includes('review')
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load recommendations');
    } finally {
      setRecsLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'notes') void loadNotes();
    if (tab === 'recommendations') void loadRecommendations();
  }, [tab, farmerId]);

  const saveNote = async () => {
    if (!noteDraft.trim()) return;
    try {
      await partnerClient.addTimelineNote(farmerId, noteDraft.trim());
      setNoteDraft('');
      await loadNotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save note');
    }
  };

  const startVisit = (blockId?: string) => {
    const qs = new URLSearchParams({ farmerId, farmerName });
    if (blockId) qs.set('blockId', blockId);
    router.push(`/visit?${qs.toString()}`);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.headerWrap}>
        <Panel title={farmerName}>
          <KeyValueRow label="Phone" value={String(farmer.phone ?? '—')} />
          <KeyValueRow label="District" value={String(farmer.district ?? '—')} />
          <KeyValueRow label="Village" value={String(farmer.village ?? '—')} />
          <KeyValueRow label="Service model" value={String(farmer.service_model ?? '—')} />
          {workspace.opportunityScore != null ? (
            <KeyValueRow label="Opportunity score" value={String(workspace.opportunityScore)} />
          ) : null}
          <View style={styles.actions}>
            <Btn label="Call" onPress={() => phone && Linking.openURL(`tel:${phone}`)} disabled={!phone} />
            <Btn
              label="WhatsApp"
              variant="secondary"
              onPress={() => phone && Linking.openURL(`https://wa.me/${phone}`)}
              disabled={!phone}
            />
            <Btn label="Start visit" variant="secondary" onPress={() => startVisit()} />
          </View>
        </Panel>
      </ScrollView>

      <ScrollableHubTabs tabs={TABS} active={tab} onChange={setTab} />

      <ScrollView contentContainerStyle={styles.panelWrap}>
        {error ? <AlertBox>{error}</AlertBox> : null}

        {tab === 'overview' ? (
          <View style={styles.section}>
            <Panel title="Snapshot">
              <View style={styles.kpiGrid}>
                <KpiTile
                  label="Pending tasks"
                  value={String(workspace.pendingTaskCount ?? 0)}
                  onPress={() => router.push('/(tabs)/tasks')}
                />
                <KpiTile
                  label="Blocks"
                  value={String(workspace.blocks.length)}
                  onPress={() => setTab('blocks')}
                />
                <KpiTile
                  label="Recent visits"
                  value={String(workspace.recentVisits?.length ?? 0)}
                  onPress={() => setTab('visits')}
                />
              </View>
            </Panel>
            {workspace.ownership ? (
              <Panel title="Ownership">
                <KeyValueRow
                  label="Enrollment owner"
                  value={String(workspace.ownership.enrollmentOwnerType ?? '—')}
                />
                <KeyValueRow
                  label="Customer owner"
                  value={String(workspace.ownership.customerOwnerType ?? '—')}
                />
                <KeyValueRow
                  label="Service model"
                  value={String(workspace.ownership.serviceModel ?? '—')}
                />
              </Panel>
            ) : null}
          </View>
        ) : null}

        {tab === 'blocks' ? (
          <View style={styles.section}>
            {workspace.blocks.map((block) => (
              <ListCard
                key={String(block.id)}
                title={String(block.name ?? block.block_name ?? 'Block')}
                subtitle={String(block.crop_type ?? block.cropType ?? '')}
                meta={block.acreage != null ? `${block.acreage} ac` : undefined}
                onPress={() => router.push(`/farmer/${farmerId}/block/${String(block.id)}`)}
              />
            ))}
            {!workspace.blocks.length ? (
              <Text style={styles.empty}>No blocks registered.</Text>
            ) : null}
          </View>
        ) : null}

        {tab === 'visits' ? (
          <View style={styles.section}>
            {(workspace.recentVisits ?? []).map((visit) => (
              <ListCard
                key={String(visit.id)}
                title={String(visit.summary ?? 'Visit')}
                subtitle={visit.visitedAt ? formatDate(String(visit.visitedAt)) : undefined}
              />
            ))}
            {!workspace.recentVisits?.length ? (
              <Text style={styles.empty}>No visits recorded yet.</Text>
            ) : null}
          </View>
        ) : null}

        {tab === 'recommendations' ? (
          <View style={styles.section}>
            {recsLoading ? <Loading label="Loading recommendations…" /> : null}
            {recommendations.map((rec) => (
              <ListCard
                key={String(rec.id)}
                title={String(rec.body ?? 'Recommendation')}
                meta={rec.createdAt ? formatDate(String(rec.createdAt)) : undefined}
              />
            ))}
            {!recsLoading && !recommendations.length ? (
              <Text style={styles.empty}>No recommendations yet.</Text>
            ) : null}
          </View>
        ) : null}

        {tab === 'sales' ? <PartnerSalesOpportunitiesPanel farmerId={farmerId} /> : null}
        {tab === 'team' ? <PartnerTeamPanel farmerId={farmerId} /> : null}

        {tab === 'notes' ? (
          <View style={styles.section}>
            <Panel title="Farmer notes">
              <TextField label="Note" value={noteDraft} onChangeText={setNoteDraft} multiline />
              <Btn label="Save note" onPress={() => void saveNote()} variant="secondary" />
            </Panel>
            {notesLoading ? <Loading label="Loading notes…" /> : null}
            {notes.map((note) => (
              <ListCard
                key={String(note.id)}
                title={String(note.authorName ?? note.author_type ?? 'Note')}
                subtitle={String(note.body ?? '')}
                meta={note.createdAt ? formatDate(String(note.createdAt)) : undefined}
              />
            ))}
            {!notesLoading && !notes.length ? (
              <Text style={styles.empty}>No notes yet.</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  headerWrap: { padding: 16, paddingBottom: 0 },
  panelWrap: { padding: 16, paddingTop: 8, paddingBottom: 32 },
  section: { gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
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
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
