import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { STAFF_API_V1, staffApi, tokens } from '@morbeez/shared';
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

const BASE = `${STAFF_API_V1}/os/telecaller`;

type Tab =
  | 'overview'
  | 'interactions'
  | 'whatsapp'
  | 'blocks'
  | 'findings'
  | 'agronomist'
  | 'pending_tasks'
  | 'escalations'
  | 'notes'
  | 'orders'
  | 'roi_tracker'
  | 'field_activity';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'interactions', label: 'Calls' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'findings', label: 'Findings' },
  { id: 'agronomist', label: 'Agro' },
  { id: 'pending_tasks', label: 'Tasks' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'notes', label: 'Notes' },
  { id: 'orders', label: 'Orders' },
  { id: 'roi_tracker', label: 'ROI' },
  { id: 'field_activity', label: 'Field' },
];

type Props = {
  leadId: string;
  canWrite: boolean;
};

export function LeadDetailTabs({ leadId, canWrite }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [tabData, setTabData] = useState<unknown[]>([]);
  const [messages, setMessages] = useState<unknown[]>([]);
  const [waText, setWaText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const lead = (detail?.lead ?? {}) as Record<string, unknown>;
  const farmerId = String(lead.farmerId ?? '');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await staffApi<{ ok: boolean } & Record<string, unknown>>(`${BASE}/leads/${leadId}`);
      setDetail(d);
      setStage(String((d.lead as Record<string, unknown>)?.stage ?? ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  const loadTab = useCallback(async () => {
    if (!detail) return;
    setError('');
    try {
      switch (tab) {
        case 'interactions': {
          const r = await staffApi<{ ok: boolean; interactions: unknown[] }>(`${BASE}/leads/${leadId}/interactions`);
          setTabData(r.interactions ?? []);
          break;
        }
        case 'whatsapp': {
          const [msg, sess] = await Promise.all([
            staffApi<{ ok: boolean; messages: unknown[] }>(`${BASE}/whatsapp/${farmerId}/messages`),
            staffApi<{ ok: boolean; session: unknown }>(`${BASE}/whatsapp/${farmerId}/session`),
          ]);
          setMessages(msg.messages ?? []);
          setTabData(sess.session ? [sess.session] : []);
          break;
        }
        case 'blocks': {
          const r = await staffApi<{ ok: boolean; blocks: unknown[] }>(`${BASE}/leads/${leadId}/blocks`);
          setTabData(r.blocks ?? []);
          break;
        }
        case 'findings': {
          const r = await staffApi<{ ok: boolean; findings: unknown[] }>(`${BASE}/leads/${leadId}/field-findings`);
          setTabData(r.findings ?? []);
          break;
        }
        case 'agronomist': {
          const r = await staffApi<{ ok: boolean; activities: unknown[] }>(`${BASE}/leads/${leadId}/agronomist`);
          setTabData((r as { visits?: unknown[] }).visits ?? (r as { activities?: unknown[] }).activities ?? []);
          break;
        }
        case 'pending_tasks': {
          const r = await staffApi<{ ok: boolean; tasks: unknown[] }>(`${BASE}/leads/${leadId}/tasks`);
          setTabData(r.tasks ?? []);
          break;
        }
        case 'escalations': {
          const r = await staffApi<{ ok: boolean; escalations: unknown[] }>(`${BASE}/leads/${leadId}/escalations`);
          setTabData(r.escalations ?? []);
          break;
        }
        case 'notes': {
          const r = await staffApi<{ ok: boolean; notes: unknown[] }>(`${BASE}/leads/${leadId}/notes`);
          setTabData(r.notes ?? []);
          break;
        }
        case 'orders': {
          const r = await staffApi<{ ok: boolean; orders: unknown[]; estimates?: unknown[] }>(
            `${BASE}/leads/${leadId}/orders`
          );
          setTabData([...(r.orders ?? []), ...((r.estimates as unknown[]) ?? [])]);
          break;
        }
        case 'roi_tracker': {
          const r = await staffApi<{ ok: boolean; entries: unknown[] }>(`${BASE}/leads/${leadId}/roi-entries`);
          setTabData(r.entries ?? []);
          break;
        }
        case 'field_activity': {
          const r = await staffApi<{ ok: boolean; activities: unknown[] }>(
            `${BASE}/leads/${leadId}/field-activities?limit=30`
          );
          setTabData(r.activities ?? []);
          break;
        }
        default:
          setTabData([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tab');
    }
  }, [tab, leadId, detail, farmerId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (tab !== 'overview') void loadTab();
  }, [tab, loadTab]);

  async function patchStage(next: string) {
    if (!canWrite) return;
    setBusy(true);
    try {
      await staffApi(`${BASE}/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: next }),
      });
      setStage(next);
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stage update failed');
    } finally {
      setBusy(false);
    }
  }

  async function logCall() {
    if (!canWrite) return;
    setBusy(true);
    try {
      await staffApi(`${BASE}/leads/${leadId}/calls`, {
        method: 'POST',
        body: JSON.stringify({ outcome: 'connected', notes: 'Logged from mobile' }),
      });
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Call log failed');
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!canWrite || !noteText.trim()) return;
    setBusy(true);
    try {
      await staffApi(`${BASE}/leads/${leadId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: noteText.trim() }),
      });
      setNoteText('');
      await loadTab();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Note failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendWhatsApp() {
    if (!canWrite || !waText.trim()) return;
    setBusy(true);
    try {
      await staffApi(`${BASE}/whatsapp/${farmerId}/send`, {
        method: 'POST',
        body: JSON.stringify({ text: waText.trim() }),
      });
      setWaText('');
      await loadTab();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  async function completeTask(taskId: string) {
    if (!canWrite) return;
    await staffApi(`${BASE}/tasks/${taskId}/complete`, { method: 'PATCH', body: '{}' });
    await loadTab();
  }

  if (loading) return <Loading label="Loading lead…" />;

  const phone = String(lead.phone ?? '').replace(/\D/g, '');

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title={String(lead.farmerName ?? 'Lead')}>
        <KeyValueRow label="Phone" value={String(lead.phone ?? '—')} />
        <KeyValueRow label="District" value={String(lead.district ?? '—')} />
        <KeyValueRow label="Stage" value={String(lead.stageLabel ?? stage ?? '—')} />
        <View style={styles.actions}>
          <Btn label="Call" onPress={() => phone && Linking.openURL(`tel:${phone}`)} disabled={!phone} />
          {canWrite ? (
            <Btn label="Log call" onPress={logCall} variant="secondary" disabled={busy} />
          ) : null}
        </View>
        {canWrite ? (
          <View style={styles.stageRow}>
            {['new_lead', 'interested', 'follow_up', 'order_placed'].map((s) => (
              <Btn
                key={s}
                label={s.replace(/_/g, ' ')}
                variant={stage === s ? 'primary' : 'secondary'}
                onPress={() => patchStage(s)}
                disabled={busy}
              />
            ))}
          </View>
        ) : null}
      </Panel>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <HubTabs tabs={TABS} active={tab} onChange={setTab} />
      </ScrollView>

      {tab === 'overview' ? (
        <Panel title="Overview">
          <Text style={styles.body}>{String(lead.notes ?? detail?.summary ?? 'No summary')}</Text>
          {(detail?.intelligence as Record<string, unknown>)?.headline ? (
            <Text style={styles.meta}>
              {String((detail.intelligence as Record<string, unknown>).headline)}
            </Text>
          ) : null}
        </Panel>
      ) : tab === 'whatsapp' ? (
        <View style={styles.flex}>
          <FlatList
            data={messages as Array<Record<string, unknown>>}
            keyExtractor={(m, i) => String(m.id ?? i)}
            contentContainerStyle={styles.listPad}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.direction === 'outbound' ? styles.out : styles.in]}>
                <Text style={styles.body}>{String(item.body ?? item.text ?? '')}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.muted}>No messages</Text>}
          />
          {canWrite ? (
            <View style={styles.compose}>
              <TextInput
                style={styles.composeInput}
                value={waText}
                onChangeText={setWaText}
                placeholder="WhatsApp message"
                placeholderTextColor={tokens.textMuted}
              />
              <Btn label="Send" onPress={sendWhatsApp} disabled={busy} />
            </View>
          ) : null}
        </View>
      ) : tab === 'notes' ? (
        <View style={styles.flex}>
          {canWrite ? (
            <View style={styles.compose}>
              <TextField label="New note" value={noteText} onChangeText={setNoteText} />
              <Btn label="Add note" onPress={addNote} disabled={busy} variant="secondary" />
            </View>
          ) : null}
          <FlatList
            data={tabData as Array<Record<string, unknown>>}
            keyExtractor={(n, i) => String(n.id ?? i)}
            contentContainerStyle={styles.listPad}
            renderItem={({ item }) => (
              <ListCard title={String(item.body ?? item.note ?? 'Note')} subtitle={String(item.createdAtLabel ?? '')} />
            )}
          />
        </View>
      ) : tab === 'pending_tasks' ? (
        <FlatList
          data={tabData as Array<Record<string, unknown>>}
          keyExtractor={(t, i) => String(t.id ?? i)}
          contentContainerStyle={styles.listPad}
          renderItem={({ item }) => (
            <ListCard
              title={String(item.title ?? 'Task')}
              subtitle={String(item.dueLabel ?? item.status ?? '')}
              meta={String(item.status ?? '')}
              onPress={canWrite && item.id ? () => completeTask(String(item.id)) : undefined}
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
                  item.orderName ??
                  item.blockName ??
                  item.category ??
                  item.subject ??
                  'Item'
              )}
              subtitle={String(
                item.summary ??
                  item.observations ??
                  item.statusLabel ??
                  item.dateLabel ??
                  item.cropType ??
                  ''
              )}
              meta={String(item.status ?? item.stage ?? item.amountInr ?? '')}
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
  actions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tabScroll: { maxHeight: 56, marginBottom: 4 },
  listPad: { padding: 12, paddingBottom: 32 },
  body: { fontSize: 14, color: tokens.text, lineHeight: 20 },
  meta: { fontSize: 12, color: tokens.textMuted, marginTop: 6 },
  muted: { padding: 16, color: tokens.textMuted, textAlign: 'center' },
  bubble: { padding: 10, borderRadius: 10, marginBottom: 8, maxWidth: '85%' },
  out: { alignSelf: 'flex-end', backgroundColor: tokens.green100 },
  in: { alignSelf: 'flex-start', backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.border },
  compose: { padding: 12, borderTopWidth: 1, borderTopColor: tokens.border, backgroundColor: tokens.card },
  composeInput: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 10,
    marginBottom: 8,
    color: tokens.text,
  },
});
