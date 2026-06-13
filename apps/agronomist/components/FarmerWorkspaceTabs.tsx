import { useCallback, useEffect, useState } from 'react';

import {

  FlatList,
  Linking,
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
  ScrollableHubTabs,
  KeyValueRow,

  Loading,

  Panel,

  TextField,

} from '@morbeez/ui-native';

import { SegmentedChips } from '@/components/field-findings/SegmentedChips';

import { FarmerCallLogPanel } from '@/components/FarmerCallLogPanel';

import { FarmerFollowUpsPanel } from '@/components/FarmerFollowUpsPanel';

import { FarmerOrdersPanel } from '@/components/FarmerOrdersPanel';

import { FarmerOverviewPanel, type FarmerWorkspaceTab } from '@/components/FarmerOverviewPanel';

import { FarmerRecommendationsPanel } from '@/components/FarmerRecommendationsPanel';

import { FarmerVisitsPanel } from '@/components/FarmerVisitsPanel';

import { FarmerTeamPanel } from '@/components/FarmerTeamPanel';

import { AgronomistBlockCard } from '@/components/AgronomistBlockCard';

import { useStaffAuth } from '@/context/StaffAuth';



type Tab = FarmerWorkspaceTab;



const TABS: Array<{ id: Tab; label: string }> = [

  { id: 'overview', label: 'Overview' },

  { id: 'interactions', label: 'Calls' },

  { id: 'blocks', label: 'Blocks' },

  { id: 'visits', label: 'Visits' },

  { id: 'recommendations', label: 'Recommendations' },

  { id: 'orders', label: 'Orders' },

  { id: 'followUps', label: 'Follow-ups' },

  { id: 'notes', label: 'Notes' },

  { id: 'team', label: 'Team' },

];



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



  return (

    <View style={styles.root}>

      {error ? <AlertBox>{error}</AlertBox> : null}



      <Panel title={summary.farmer.name}>

        <KeyValueRow label="Phone" value={summary.farmer.phone ?? '—'} />

        <KeyValueRow label="District" value={summary.farmer.district ?? '—'} />

        <KeyValueRow label="Health" value={summary.healthStatus} />

        <KeyValueRow label="Active crops" value={summary.activeCrops.join(', ') || '—'} />

        <KeyValueRow label="Last visit" value={summary.lastVisitAt ? formatDate(summary.lastVisitAt) : '—'} />

        <View style={styles.actions}>

          <Btn label="Call" onPress={() => phone && Linking.openURL(`tel:${phone}`)} disabled={!phone} />

          <Btn

            label="WhatsApp"

            variant="secondary"

            onPress={() => phone && Linking.openURL(`https://wa.me/${phone}`)}

            disabled={!phone}

          />

          <Btn label="Start visit" variant="secondary" onPress={() => router.push('/(tabs)/visits')} />

        </View>

      </Panel>



      <ScrollableHubTabs tabs={TABS} active={tab} onChange={setTab} style={styles.tabScroll} />



      {loading && (tab === 'blocks' || tab === 'notes') ? <Loading label="Loading…" /> : null}



      {tab === 'overview' ? (

        <FarmerOverviewPanel

          farmerId={farmerId}

          leadId={leadId}

          recommendations={recommendations}

          onNavigate={setTab}

        />

      ) : tab === 'interactions' ? (

        <FarmerCallLogPanel farmerId={farmerId} leadId={leadId} />

      ) : tab === 'blocks' ? (

        <FlatList

          data={blocks}

          keyExtractor={(b) => b.id}

          contentContainerStyle={styles.listPad}

          ListHeaderComponent={

            <Text style={styles.blocksHint}>

              Blocks needing attention appear first. Tap a block to open details.

            </Text>

          }

          renderItem={({ item }) => (

            <AgronomistBlockCard block={item} onPress={() => openBlock(item)} />

          )}

          ListEmptyComponent={!loading ? <Text style={styles.muted}>No blocks</Text> : null}

        />

      ) : tab === 'visits' ? (

        <FarmerVisitsPanel farmerId={farmerId} />

      ) : tab === 'recommendations' ? (

        <View style={styles.flex}>

          <View style={styles.filterPad}>

            <SegmentedChips

              options={REC_STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}

              value={recFilter}

              onChange={setRecFilter}

            />

          </View>

          <FarmerRecommendationsPanel recommendations={filteredRecommendations} />

        </View>

      ) : tab === 'orders' ? (

        <FarmerOrdersPanel farmerId={farmerId} />

      ) : tab === 'followUps' ? (

        <FarmerFollowUpsPanel farmerId={farmerId} />

      ) : tab === 'notes' ? (

        <View style={styles.flex}>

          {canWrite ? (

            <View style={styles.compose}>

              <TextField label="Farmer note" value={noteText} onChangeText={setNoteText} multiline />

              <Btn label="Save note" onPress={() => void saveNote()} variant="secondary" />

            </View>

          ) : null}

          <FlatList

            data={notes}

            keyExtractor={(n, i) => String(n.id ?? i)}

            contentContainerStyle={styles.listPad}

            renderItem={({ item }) => (

              <Panel title={item.createdAt ? formatDate(String(item.createdAt)) : 'Note'}>

                <Text style={styles.body}>{String(item.noteText ?? item.note_text ?? 'Note')}</Text>

                {item.authorEmail ? (

                  <Text style={styles.noteMeta}>{String(item.authorEmail)}</Text>

                ) : null}

              </Panel>

            )}

            ListEmptyComponent={!loading ? <Text style={styles.muted}>No notes yet.</Text> : null}

          />

        </View>

      ) : tab === 'team' ? (

        <FarmerTeamPanel farmerId={farmerId} />

      ) : null}

    </View>

  );

}



const styles = StyleSheet.create({

  root: { flex: 1, backgroundColor: tokens.bg },

  flex: { flex: 1 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },

  tabScroll: { marginBottom: 4, flexGrow: 0 },

  listPad: { padding: 12, paddingBottom: 32 },

  filterPad: { paddingHorizontal: 12, paddingTop: 8 },

  body: { fontSize: 14, color: tokens.text, lineHeight: 20 },

  noteMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 6 },

  muted: { padding: 16, color: tokens.textMuted, textAlign: 'center' },

  blocksHint: { fontSize: 13, color: tokens.textMuted, marginBottom: 12, lineHeight: 18 },

  compose: { padding: 12, borderBottomWidth: 1, borderBottomColor: tokens.border },

});


