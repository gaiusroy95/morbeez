import { useCallback, useEffect, useState } from 'react';

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {

  agronomistClient,

  formatDate,

  tokens,

  type FarmerCallLogSummary,

  type FarmerInteractionRow,

} from '@morbeez/shared';

import { AlertBox, Btn, KeyValueRow, ListCard, Loading, Panel, TextField } from '@morbeez/ui-native';

import { useStaffAuth } from '@/context/StaffAuth';



type Props = {

  farmerId: string;

  leadId?: string | null;

};



type WhatsAppRow = { id: string; summary: string; at: string; by: string | null };



type TimelineRow = {

  id: string;

  date: string;

  kind: string;

  summary: string;

  meta: string;

  onPress?: () => void;

};



export function FarmerCallLogPanel({ farmerId, leadId }: Props) {

  const { canWrite } = useStaffAuth();

  const [summary, setSummary] = useState<FarmerCallLogSummary | null>(null);

  const [interactions, setInteractions] = useState<FarmerInteractionRow[]>([]);

  const [whatsapp, setWhatsapp] = useState<WhatsAppRow[]>([]);

  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  const [loading, setLoading] = useState(true);

  const [detailLoading, setDetailLoading] = useState(false);

  const [error, setError] = useState('');

  const [showLogCall, setShowLogCall] = useState(false);

  const [showReminder, setShowReminder] = useState(false);

  const [callNotes, setCallNotes] = useState('');

  const [callOutcome, setCallOutcome] = useState('connected');

  const [reminderReason, setReminderReason] = useState('');

  const [saving, setSaving] = useState(false);



  const load = useCallback(async () => {

    setLoading(true);

    setError('');

    try {

      const [callSummary, ix, wa] = await Promise.all([

        agronomistClient.getFarmerCallLogSummary(farmerId),

        agronomistClient.listFarmerInteractions(farmerId, { leadId: leadId ?? undefined, limit: 50 }),

        agronomistClient.listWhatsAppHistory(farmerId).catch(() => []),

      ]);

      setSummary(callSummary);

      setInteractions(ix.interactions ?? []);

      setWhatsapp(wa);

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Could not load call log');

      setSummary(null);

      setInteractions([]);

      setWhatsapp([]);

    } finally {

      setLoading(false);

    }

  }, [farmerId, leadId]);



  useEffect(() => {

    void load();

  }, [load]);



  async function openDetail(row: FarmerInteractionRow) {

    setDetailLoading(true);

    setSelected({ id: row.id, summary: row.summary, interactionType: row.interactionType });

    try {

      const r = await agronomistClient.getFarmerInteractionDetail(farmerId, row.id, leadId ?? undefined);

      setSelected(r.interaction);

    } catch (e) {

      setSelected({

        id: row.id,

        summary: row.summary,

        interactionType: row.interactionType,

        error: e instanceof Error ? e.message : 'Could not load details',

      });

    } finally {

      setDetailLoading(false);

    }

  }



  async function submitCallLog() {

    if (!canWrite) return;

    setSaving(true);

    setError('');

    try {

      await agronomistClient.logFarmerCall(farmerId, {

        outcome: callOutcome,

        notes: callNotes.trim() || undefined,

      });

      setShowLogCall(false);

      setCallNotes('');

      await load();

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Could not log call');

    } finally {

      setSaving(false);

    }

  }



  async function submitReminder() {

    if (!canWrite || !reminderReason.trim()) return;

    setSaving(true);

    setError('');

    try {

      await agronomistClient.createFarmerReminder(farmerId, {

        reason: reminderReason.trim(),

        assignTo: 'agronomist',

      });

      setShowReminder(false);

      setReminderReason('');

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Could not create reminder');

    } finally {

      setSaving(false);

    }

  }



  if (loading) return <Loading label="Loading call log…" />;



  const timelineRows: TimelineRow[] = [

    ...(summary?.recentCalls ?? []).map((call) => ({

      id: `call-${call.id}`,

      date: call.at,

      kind: 'Phone',

      summary: call.aiSummary || call.outcome || 'Call logged',

      meta: [call.outcome, call.agentEmail].filter(Boolean).join(' · '),

    })),

    ...whatsapp.map((m) => ({

      id: `wa-${m.id}`,

      date: m.at,

      kind: 'WhatsApp',

      summary: m.summary,

      meta: m.by ?? '',

    })),

    ...interactions.slice(0, 20).map((row) => ({

      id: `ix-${row.id}`,

      date: row.createdLabel ?? '',

      kind: row.typeCategory ?? row.interactionType ?? 'Session',

      summary: row.summary?.trim() || '—',

      meta: [row.displayStatus ?? row.workflowStatus, row.by].filter(Boolean).join(' · '),

      onPress: () => void openDetail(row),

    })),

  ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());



  return (

    <View style={styles.root}>

      {error ? <AlertBox>{error}</AlertBox> : null}



      <Panel title="Call log summary">

        <View style={styles.summaryGrid}>

          <View style={styles.stat}>

            <Text style={styles.statValue}>{summary?.totalCalls ?? 0}</Text>

            <Text style={styles.statLabel}>Total calls</Text>

          </View>

          <View style={styles.stat}>

            <Text style={styles.statValue}>{summary?.connectedCount ?? 0}</Text>

            <Text style={styles.statLabel}>Connected</Text>

          </View>

          <View style={styles.stat}>

            <Text style={styles.statValue}>{summary?.pendingAiSummary ?? 0}</Text>

            <Text style={styles.statLabel}>Pending AI</Text>

          </View>

        </View>

        <KeyValueRow

          label="Last call"

          value={

            summary?.lastCallAt

              ? `${formatDate(summary.lastCallAt)} · ${summary.lastCallOutcome ?? '—'}`

              : '—'

          }

        />

        {summary?.lastCallSummary ? (

          <Text style={styles.aiSummary}>{summary.lastCallSummary}</Text>

        ) : null}

        {canWrite ? (

          <View style={styles.actions}>

            <Btn label="Log call" variant="secondary" onPress={() => setShowLogCall(true)} />

            <Btn label="Create reminder" variant="secondary" onPress={() => setShowReminder(true)} />

          </View>

        ) : null}

      </Panel>



      <Panel title="Communication history">

        <Text style={styles.hint}>Dated rows from phone calls, WhatsApp, and CRM sessions.</Text>

        {timelineRows.length === 0 ? (

          <Text style={styles.empty}>No communication history yet.</Text>

        ) : (

          timelineRows.map((row) => (

            <ListCard

              key={row.id}

              title={`${row.date ? formatDate(row.date) : '—'} · ${row.kind}`}

              subtitle={row.summary}

              meta={row.meta || undefined}

              onPress={row.onPress}

            />

          ))

        )}

      </Panel>



      <Modal visible={showLogCall} animationType="slide" onRequestClose={() => setShowLogCall(false)}>

        <View style={styles.modal}>

          <View style={styles.modalHeader}>

            <Text style={styles.modalTitle}>Log call</Text>

            <Pressable onPress={() => setShowLogCall(false)}>

              <Text style={styles.close}>Close</Text>

            </Pressable>

          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>

            <TextField label="Outcome" value={callOutcome} onChangeText={setCallOutcome} placeholder="connected" />

            <TextField

              label="Notes / summary"

              value={callNotes}

              onChangeText={setCallNotes}

              multiline

              placeholder="Farmer reports yellowing increasing…"

            />

            <Btn label={saving ? 'Saving…' : 'Save call log'} onPress={() => void submitCallLog()} disabled={saving} />

          </ScrollView>

        </View>

      </Modal>



      <Modal visible={showReminder} animationType="slide" onRequestClose={() => setShowReminder(false)}>

        <View style={styles.modal}>

          <View style={styles.modalHeader}>

            <Text style={styles.modalTitle}>Create reminder</Text>

            <Pressable onPress={() => setShowReminder(false)}>

              <Text style={styles.close}>Close</Text>

            </Pressable>

          </View>

          <ScrollView contentContainerStyle={styles.modalBody}>

            <TextField

              label="Reason"

              value={reminderReason}

              onChangeText={setReminderReason}

              multiline

              placeholder="Follow up on spray application in 5 days"

            />

            <Btn

              label={saving ? 'Saving…' : 'Create reminder task'}

              onPress={() => void submitReminder()}

              disabled={saving || !reminderReason.trim()}

            />

          </ScrollView>

        </View>

      </Modal>



      <Modal visible={selected != null} animationType="slide" onRequestClose={() => setSelected(null)}>

        <View style={styles.modal}>

          <View style={styles.modalHeader}>

            <Text style={styles.modalTitle}>

              {String(selected?.interactionType ?? 'Interaction detail')}

            </Text>

            <Pressable onPress={() => setSelected(null)}>

              <Text style={styles.close}>Close</Text>

            </Pressable>

          </View>

          {detailLoading ? (

            <Loading label="Loading…" />

          ) : (

            <ScrollView contentContainerStyle={styles.modalBody}>

              {selected?.error ? <AlertBox>{String(selected.error)}</AlertBox> : null}

              {selected?.summary ? <Text style={styles.detailSummary}>{String(selected.summary)}</Text> : null}

              {Array.isArray(selected?.fields)

                ? (selected.fields as Array<{ label: string; value: string }>).map((f) => (

                    <KeyValueRow key={f.label} label={f.label} value={f.value} />

                  ))

                : null}

            </ScrollView>

          )}

        </View>

      </Modal>

    </View>

  );

}



const styles = StyleSheet.create({

  root: { padding: 12, paddingBottom: 32 },

  summaryGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },

  stat: {

    flex: 1,

    backgroundColor: tokens.green100,

    borderRadius: tokens.radiusSm,

    padding: 10,

    alignItems: 'center',

  },

  statValue: { fontSize: 20, fontWeight: '800', color: tokens.green800 },

  statLabel: { fontSize: 11, color: tokens.textMuted, marginTop: 2 },

  aiSummary: { fontSize: 13, color: tokens.text, lineHeight: 18, marginTop: 8 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },

  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 12, lineHeight: 18 },

  empty: { fontSize: 14, color: tokens.textMuted, textAlign: 'center', paddingVertical: 12 },

  modal: { flex: 1, backgroundColor: tokens.bg, paddingTop: 48 },

  modalHeader: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    paddingHorizontal: 16,

    paddingBottom: 12,

    borderBottomWidth: 1,

    borderBottomColor: tokens.border,

  },

  modalTitle: { fontSize: 17, fontWeight: '700', color: tokens.text, flex: 1 },

  close: { fontSize: 15, fontWeight: '600', color: tokens.green700 },

  modalBody: { padding: 16, paddingBottom: 40 },

  detailSummary: { fontSize: 15, color: tokens.text, lineHeight: 22, marginBottom: 12 },

});


