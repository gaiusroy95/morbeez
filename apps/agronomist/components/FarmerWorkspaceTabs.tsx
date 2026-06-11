import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { agronomistClient, formatDate, tokens, type AgronomistWorkspaceSummary } from '@morbeez/shared';
import {
  AlertBox,
  Btn,
  HubTabs,
  KeyValueRow,
  ListCard,
  Loading,
  Panel,
  TextField,
} from '@morbeez/ui-native';
import { useStaffAuth } from '@/context/StaffAuth';

type Tab =
  | 'overview'
  | 'interactions'
  | 'blocks'
  | 'visits'
  | 'findings'
  | 'recommendations'
  | 'documents'
  | 'orders'
  | 'tasks'
  | 'callbacks'
  | 'escalations'
  | 'intelligence';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'interactions', label: 'Calls' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'visits', label: 'Visits' },
  { id: 'findings', label: 'Findings' },
  { id: 'recommendations', label: 'Recs' },
  { id: 'documents', label: 'Docs' },
  { id: 'orders', label: 'Orders' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'callbacks', label: 'Callbacks' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'intelligence', label: 'Intel' },
];

type Props = {
  farmerId: string;
  summary: AgronomistWorkspaceSummary;
};

export function FarmerWorkspaceTabs({ farmerId, summary }: Props) {
  const router = useRouter();
  const { canWrite } = useStaffAuth();
  const leadId = summary.leadId;
  const [tab, setTab] = useState<Tab>('overview');
  const [tabData, setTabData] = useState<unknown[]>([]);
  const [intel, setIntel] = useState<Record<string, unknown> | null>(null);
  const [leadDetail, setLeadDetail] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [callbackReason, setCallbackReason] = useState('');

  const phone = String(summary.farmer.phone ?? '').replace(/\D/g, '');

  const loadTab = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      switch (tab) {
        case 'overview': {
          if (leadId) {
            const d = await agronomistClient.getLeadDetail(leadId);
            setLeadDetail(d);
          } else {
            setLeadDetail(null);
          }
          setTabData([]);
          break;
        }
        case 'interactions': {
          if (!leadId) {
            setTabData([]);
            break;
          }
          const r = await agronomistClient.getLeadInteractions(leadId);
          setTabData(r.interactions ?? []);
          break;
        }
        case 'blocks': {
          setTabData(await agronomistClient.getFarmerBlocks(farmerId));
          break;
        }
        case 'visits': {
          setTabData(await agronomistClient.listRecentVisits(farmerId));
          break;
        }
        case 'findings': {
          if (!leadId) {
            setTabData([]);
            break;
          }
          const d = await agronomistClient.getLeadDetail(leadId);
          setTabData((d.findings as unknown[]) ?? (d.fieldFindings as unknown[]) ?? []);
          break;
        }
        case 'recommendations': {
          if (!leadId) {
            setTabData([]);
            break;
          }
          const r = await agronomistClient.getLeadRecommendations(leadId);
          setTabData(r.recommendations ?? []);
          break;
        }
        case 'documents': {
          setTabData(await agronomistClient.getFarmerDocuments(farmerId));
          break;
        }
        case 'orders': {
          if (!leadId) {
            setTabData([]);
            break;
          }
          const r = await agronomistClient.getLeadOrders(leadId);
          setTabData(r.orders ?? []);
          break;
        }
        case 'tasks': {
          const all = await agronomistClient.listTasks();
          setTabData(all.filter((t) => t.farmerId === farmerId));
          break;
        }
        case 'callbacks': {
          const rows = await agronomistClient.listCallbacks();
          setTabData(rows.filter((c) => c.farmerId === farmerId));
          break;
        }
        case 'escalations': {
          setTabData(await agronomistClient.listEscalations({ farmerId }));
          break;
        }
        case 'intelligence': {
          const r = await agronomistClient.getFarmerIntelligence(farmerId);
          setIntel(r.profile ?? null);
          setTabData([]);
          break;
        }
        default:
          setTabData([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tab');
    } finally {
      setLoading(false);
    }
  }, [tab, farmerId, leadId]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  async function scheduleCallback() {
    if (!canWrite || !callbackReason.trim()) return;
    await agronomistClient.createCallback({ farmerId, reason: callbackReason.trim() });
    setCallbackReason('');
    await loadTab();
  }

  async function completeCallback(id: string) {
    if (!canWrite) return;
    await agronomistClient.updateCallback(id, 'completed');
    await loadTab();
  }

  function startVisit(block: Record<string, unknown>) {
    router.push({
      pathname: '/visit',
      params: {
        farmerId,
        blockId: String(block.id ?? ''),
        blockName: String(block.name ?? 'Block'),
        cropType: String(block.cropType ?? ''),
        farmerName: summary.farmer.name,
      },
    });
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      </ScrollView>

      {loading ? <Loading label="Loading…" /> : null}

      {tab === 'overview' ? (
        <Panel title="Summary">
          <KeyValueRow label="Pending tasks" value={String(summary.pendingTaskCount)} />
          <KeyValueRow label="Open escalations" value={String(summary.openEscalationCount)} />
          {leadDetail?.lead ? (
            <Text style={styles.body}>
              {String((leadDetail.lead as Record<string, unknown>).stageLabel ?? 'Lead linked')}
            </Text>
          ) : (
            <Text style={styles.muted}>No telecaller lead linked yet.</Text>
          )}
        </Panel>
      ) : tab === 'blocks' ? (
        <FlatList
          data={tabData as Array<Record<string, unknown>>}
          keyExtractor={(b, i) => String(b.id ?? i)}
          contentContainerStyle={styles.listPad}
          renderItem={({ item }) => (
            <ListCard
              title={String(item.name ?? 'Block')}
              subtitle={[item.cropType, item.plotLabel].filter(Boolean).join(' · ')}
              onPress={() => startVisit(item)}
            />
          )}
          ListEmptyComponent={<Text style={styles.muted}>No blocks</Text>}
        />
      ) : tab === 'intelligence' ? (
        <Panel title="Intelligence">
          <Text style={styles.body}>
            {String(intel?.headline ?? intel?.summary ?? 'No intelligence profile yet.')}
          </Text>
        </Panel>
      ) : tab === 'callbacks' ? (
        <View style={styles.flex}>
          {canWrite ? (
            <View style={styles.compose}>
              <TextField label="Callback reason" value={callbackReason} onChangeText={setCallbackReason} />
              <Btn label="Schedule callback" onPress={scheduleCallback} variant="secondary" />
            </View>
          ) : null}
          <FlatList
            data={tabData as Array<Record<string, unknown>>}
            keyExtractor={(c, i) => String(c.id ?? i)}
            contentContainerStyle={styles.listPad}
            renderItem={({ item }) => (
              <ListCard
                title={String(item.reason ?? 'Callback')}
                subtitle={String(item.status ?? '')}
                meta={item.dueAt ? formatDate(String(item.dueAt)) : undefined}
                onPress={canWrite && item.id ? () => completeCallback(String(item.id)) : undefined}
              />
            )}
          />
        </View>
      ) : tab === 'documents' ? (
        <FlatList
          data={tabData as Array<Record<string, unknown>>}
          keyExtractor={(d, i) => String(d.id ?? i)}
          contentContainerStyle={styles.listPad}
          renderItem={({ item }) => (
            <ListCard
              title={String(item.title ?? item.type ?? 'Document')}
              subtitle={item.createdAt ? formatDate(String(item.createdAt)) : undefined}
              onPress={item.url ? () => Linking.openURL(String(item.url)) : undefined}
            />
          )}
        />
      ) : (
        <FlatList
          data={tabData as Array<Record<string, unknown>>}
          keyExtractor={(row, i) => String(row.id ?? i)}
          contentContainerStyle={styles.listPad}
          renderItem={({ item }) => (
            <ListCard
              title={String(
                item.title ??
                  item.name ??
                  item.blockName ??
                  item.subject ??
                  item.type ??
                  item.summary ??
                  'Item'
              )}
              subtitle={String(
                item.subtitle ??
                  item.observations ??
                  item.statusLabel ??
                  item.cropType ??
                  item.reason ??
                  ''
              )}
              meta={String(item.status ?? item.dueAt ?? item.visitedAt ?? '')}
            />
          )}
          ListEmptyComponent={<Text style={styles.muted}>Nothing in this tab yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tabScroll: { maxHeight: 56, marginBottom: 4 },
  listPad: { padding: 12, paddingBottom: 32 },
  body: { fontSize: 14, color: tokens.text, lineHeight: 20 },
  muted: { padding: 16, color: tokens.textMuted, textAlign: 'center' },
  compose: { padding: 12, borderBottomWidth: 1, borderBottomColor: tokens.border },
});
