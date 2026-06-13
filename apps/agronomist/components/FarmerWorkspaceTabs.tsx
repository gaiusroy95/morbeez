import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  agronomistClient,
  formatDate,
  tokens,
  type AgronomistBlockRow,
  type AgronomistRecommendationRow,
  type AgronomistWorkspaceSummary,
} from '@morbeez/shared';
import {
  AlertBox,
  Btn,
  ScrollableUnderlineTabs,
  Loading,
  Panel,
  StickyScreenFooter,
  TextField,
  useDeviceBottomInset,
  useStickyFooterScrollPadding,
} from '@morbeez/ui-native';
import { SegmentedChips } from '@/components/field-findings/SegmentedChips';
import { FarmerCallLogPanel } from '@/components/FarmerCallLogPanel';
import { FarmerFollowUpsPanel } from '@/components/FarmerFollowUpsPanel';
import { FarmerOrdersPanel } from '@/components/FarmerOrdersPanel';
import { FarmerOverviewPanel } from '@/components/FarmerOverviewPanel';
import { FarmerRecommendationsPanel } from '@/components/FarmerRecommendationsPanel';
import { FarmerFieldFindingsPanel } from '@/components/FarmerFieldFindingsPanel';
import { FarmerTeamPanel } from '@/components/FarmerTeamPanel';
import { AgronomistBlockCard } from '@/components/AgronomistBlockCard';
import { BlockPickerModal } from '@/components/BlockPickerModal';
import { useStaffAuth } from '@/context/StaffAuth';
import {
  FARMER_WORKSPACE_TABS,
  buildVisitRouteParams,
  type FarmerWorkspaceTab,
} from '@/lib/farmer-workspace-routing';

type Tab = FarmerWorkspaceTab;

const REC_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'completed', label: 'Done' },
  { value: 'escalated', label: 'Escalated' },
] as const;

function recStatusBucket(status: string, fieldRecStatus?: string | null): string {
  const s = (fieldRecStatus ?? status).toLowerCase();
  if (s.includes('escalat')) return 'escalated';
  if (s.includes('complete') || s.includes('applied') || s.includes('resolved')) return 'completed';
  if (s.includes('monitor')) return 'monitoring';
  return 'open';
}

type Props = {
  farmerId: string;
  summary: AgronomistWorkspaceSummary;
};

export function FarmerWorkspaceTabs({ farmerId, summary }: Props) {
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const leadId = summary.leadId;
  const [tab, setTab] = useState<Tab>('overview');
  const [blocks, setBlocks] = useState<AgronomistBlockRow[]>([]);
  const [notes, setNotes] = useState<Array<Record<string, unknown>>>([]);
  const [recommendations, setRecommendations] = useState<AgronomistRecommendationRow[]>([]);
  const [recFilter, setRecFilter] = useState<(typeof REC_STATUS_FILTERS)[number]['value']>('all');
  const [noteText, setNoteText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockPickerVisible, setBlockPickerVisible] = useState(false);

  const bottomInset = useDeviceBottomInset();
  const footerPad = useStickyFooterScrollPadding({ rows: tab === 'fieldFindings' ? 1 : 0 });
  const scrollBottomPad = tab === 'fieldFindings' ? footerPad : 16 + bottomInset;

  const phone = String(summary.farmer.phone ?? '').replace(/\D/g, '');

  const loadRecommendations = useCallback(async () => {
    try {
      setRecommendations(await agronomistClient.listFarmerRecommendations(farmerId, 30));
    } catch {
      setRecommendations([]);
    }
  }, [farmerId]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  useFocusEffect(
    useCallback(() => {
      void loadRecommendations();
    }, [loadRecommendations])
  );

  const filteredRecommendations =
    recFilter === 'all'
      ? recommendations
      : recommendations.filter((r) =>
          recStatusBucket(r.status, (r as AgronomistRecommendationRow & { fieldRecStatus?: string }).fieldRecStatus) ===
          recFilter
        );

  const loadTab = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      switch (tab) {
        case 'blocks':
          setBlocks(await agronomistClient.getFarmerBlocks(farmerId));
          break;
        case 'notes':
          setNotes(await agronomistClient.listFarmerNotes(farmerId));
          break;
        case 'recommendations':
          await loadRecommendations();
          break;
        default:
          break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tab');
    } finally {
      setLoading(false);
    }
  }, [tab, farmerId, loadRecommendations]);

  useEffect(() => {
    if (tab === 'blocks' || tab === 'notes' || tab === 'recommendations') {
      void loadTab();
    }
  }, [loadTab, tab]);

  async function saveNote() {
    if (!canWrite || !noteText.trim()) return;
    await agronomistClient.addFarmerNote(farmerId, noteText.trim());
    setNoteText('');
    setNotes(await agronomistClient.listFarmerNotes(farmerId));
  }

  function openBlock(block: AgronomistBlockRow) {
    const qs = new URLSearchParams({
      farmerId,
      farmerName: summary.farmer.name,
    });
    if (leadId) qs.set('leadId', leadId);
    router.push(`/block/${block.id}?${qs.toString()}`);
  }

  async function ensureBlocks(): Promise<AgronomistBlockRow[]> {
    if (blocks.length) return blocks;
    const loaded = await agronomistClient.getFarmerBlocks(farmerId);
    setBlocks(loaded);
    return loaded;
  }

  function openVisitForBlock(block: AgronomistBlockRow) {
    setBlockPickerVisible(false);
    router.push(
      buildVisitRouteParams({
        farmerId,
        farmerName: summary.farmer.name,
        block,
        leadId,
      })
    );
  }

  async function startVisit() {
    try {
      const farmerBlocks = await ensureBlocks();
      if (!farmerBlocks.length) {
        Alert.alert('No blocks', 'Add a block before starting a structured visit.', [
          { text: 'Go to Blocks', onPress: () => setTab('blocks') },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }
      if (farmerBlocks.length === 1) {
        openVisitForBlock(farmerBlocks[0]!);
        return;
      }
      setBlockPickerVisible(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load blocks');
    }
  }

  const summaryLine = [
    summary.farmer.phone,
    summary.farmer.district,
    summary.healthStatus,
  ]
    .filter(Boolean)
    .join(' · ');

  const farmLine = [
    summary.activeCrops.join(', ') || null,
    summary.lastVisitAt ? `Last visit ${formatDate(summary.lastVisitAt)}` : 'No visits yet',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {error ? <AlertBox>{error}</AlertBox> : null}

        <Panel title={summary.farmer.name}>
          {summaryLine ? <Text style={styles.summaryLine}>{summaryLine}</Text> : null}
          {farmLine ? <Text style={styles.farmLine}>{farmLine}</Text> : null}
          <View style={styles.actions}>
            <Btn label="Call" onPress={() => phone && Linking.openURL(`tel:${phone}`)} disabled={!phone} />
            <Btn
              label="WhatsApp"
              variant="secondary"
              onPress={() => phone && Linking.openURL(`https://wa.me/${phone}`)}
              disabled={!phone}
            />
            <Btn label="Start visit" variant="secondary" onPress={() => void startVisit()} />
          </View>
        </Panel>

        <ScrollableUnderlineTabs tabs={FARMER_WORKSPACE_TABS} active={tab} onChange={setTab} />

        {loading && (tab === 'blocks' || tab === 'notes') ? <Loading label="Loading…" /> : null}

        <View style={styles.tabBody}>
          {tab === 'overview' ? (
            <FarmerOverviewPanel
              farmerId={farmerId}
              leadId={leadId}
              recommendations={recommendations}
              onNavigate={setTab}
            />
          ) : null}

          {tab === 'interactions' ? (
            <FarmerCallLogPanel farmerId={farmerId} leadId={leadId} />
          ) : null}

          {tab === 'blocks' ? (
            <View style={styles.section}>
              <Text style={styles.blocksHint}>
                Blocks needing attention appear first. Tap a block to open details.
              </Text>
              {blocks.map((block) => (
                <AgronomistBlockCard key={block.id} block={block} onPress={() => openBlock(block)} />
              ))}
              {!blocks.length && !loading ? <Text style={styles.muted}>No blocks</Text> : null}
            </View>
          ) : null}

          {tab === 'fieldFindings' ? <FarmerFieldFindingsPanel farmerId={farmerId} /> : null}

          {tab === 'recommendations' ? (
            <View style={styles.section}>
              <SegmentedChips
                options={REC_STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
                value={recFilter}
                onChange={setRecFilter}
              />
              <FarmerRecommendationsPanel recommendations={filteredRecommendations} />
            </View>
          ) : null}

          {tab === 'orders' ? <FarmerOrdersPanel farmerId={farmerId} /> : null}

          {tab === 'followUps' ? <FarmerFollowUpsPanel farmerId={farmerId} /> : null}

          {tab === 'notes' ? (
            <View style={styles.section}>
              {canWrite ? (
                <View style={styles.compose}>
                  <TextField label="Farmer note" value={noteText} onChangeText={setNoteText} multiline />
                  <Btn label="Save note" onPress={() => void saveNote()} variant="secondary" />
                </View>
              ) : null}
              {notes.map((item, i) => (
                <Panel key={String(item.id ?? i)} title={item.createdAt ? formatDate(String(item.createdAt)) : 'Note'}>
                  <Text style={styles.body}>{String(item.noteText ?? item.note_text ?? 'Note')}</Text>
                  {item.authorEmail ? (
                    <Text style={styles.noteMeta}>{String(item.authorEmail)}</Text>
                  ) : null}
                </Panel>
              ))}
              {!notes.length && !loading ? <Text style={styles.muted}>No notes yet.</Text> : null}
            </View>
          ) : null}

          {tab === 'team' ? <FarmerTeamPanel farmerId={farmerId} /> : null}
        </View>
      </ScrollView>

      {tab === 'fieldFindings' ? (
        <StickyScreenFooter>
          <Btn label="Start visit" onPress={() => void startVisit()} />
        </StickyScreenFooter>
      ) : null}

      <BlockPickerModal
        visible={blockPickerVisible}
        blocks={blocks}
        onSelect={openVisitForBlock}
        onClose={() => setBlockPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, flexGrow: 1 },
  summaryLine: { fontSize: 14, color: tokens.text, marginBottom: 4 },
  farmLine: { fontSize: 13, color: tokens.textMuted, marginBottom: 8, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tabBody: { paddingTop: 8 },
  section: { gap: 10, paddingBottom: 8 },
  body: { fontSize: 14, color: tokens.text, lineHeight: 20 },
  noteMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 6 },
  muted: { padding: 16, color: tokens.textMuted, textAlign: 'center' },
  blocksHint: { fontSize: 13, color: tokens.textMuted, marginBottom: 4, lineHeight: 18 },
  compose: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: tokens.border, gap: 8 },
});
