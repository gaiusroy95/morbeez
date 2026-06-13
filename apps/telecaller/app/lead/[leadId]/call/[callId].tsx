import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { formatDate, telecallerClient, tokens, type TelecallerCallRow } from '@morbeez/shared';
import { AlertBox, Btn, KeyValueRow, Loading, Panel } from '@morbeez/ui-native';

export default function CallDetailScreen() {
  const { leadId, callId } = useLocalSearchParams<{ leadId: string; callId: string }>();
  const [call, setCall] = useState<TelecallerCallRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!callId) return;
    setLoading(true);
    setError('');
    try {
      setCall(await telecallerClient.getCall(String(callId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load call');
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createFollowUp = async (title: string) => {
    if (!leadId) return;
    setSaving(true);
    try {
      await telecallerClient.createLeadTask(String(leadId), { title });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create follow-up');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading call…" />;
  if (!call) {
    return (
      <View style={styles.center}>
        {error ? <AlertBox>{error}</AlertBox> : <Text style={styles.empty}>Call not found.</Text>}
      </View>
    );
  }

  const qcStatus =
    call.qc_flagged || (call.qc_score != null && call.qc_score < 60)
      ? 'Review'
      : call.qc_score != null && call.qc_score >= 80
        ? 'Pass'
        : 'Review';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      <Panel title="Call details">
        <KeyValueRow label="Date" value={call.created_at ? formatDate(call.created_at) : '—'} />
        <KeyValueRow label="Duration" value={call.duration_seconds != null ? `${call.duration_seconds}s` : '—'} />
        <KeyValueRow label="Direction" value={call.direction ?? '—'} />
        <KeyValueRow label="Processing" value={call.processing_status} />
        <KeyValueRow label="QC status" value={call.qc_status ?? qcStatus} />
        {call.qc_score != null ? <KeyValueRow label="QC score" value={String(call.qc_score)} /> : null}
      </Panel>

      <Panel title="AI Summary (read-only)">
        <Text style={styles.readOnly}>{call.ai_summary ?? 'Summary not available yet.'}</Text>
      </Panel>

      {call.transcript ? (
        <Panel title="Transcript (read-only)">
          <Text style={styles.readOnly}>{call.transcript}</Text>
        </Panel>
      ) : null}

      {call.recording_url ? (
        <Panel title="Recording">
          <Text style={styles.hint}>Recording playback is available in staff web CRM. Download/forward is disabled on mobile.</Text>
          <Text style={styles.recordingUrl} numberOfLines={2}>
            {call.recording_url}
          </Text>
        </Panel>
      ) : null}

      {(call.compliance_flags?.length ?? 0) > 0 ? (
        <Panel title="Compliance flags">
          {call.compliance_flags!.map((flag) => (
            <Text key={flag} style={styles.flag}>
              • {flag}
            </Text>
          ))}
        </Panel>
      ) : null}

      {(call.action_items?.length ?? 0) > 0 ? (
        <Panel title="Suggested action items">
          {call.action_items!.map((item, idx) => (
            <View key={`${item.label}-${idx}`} style={styles.actionRow}>
              <Text style={styles.actionLabel}>{item.label}</Text>
              <Btn
                label="Create follow-up"
                variant="secondary"
                onPress={() => void createFollowUp(item.label)}
                disabled={saving}
              />
            </View>
          ))}
        </Panel>
      ) : null}

      <Panel title="Manual follow-up">
        <Btn
          label={saving ? 'Saving…' : 'Create callback follow-up'}
          onPress={() => void createFollowUp(taskTitle || 'Callback follow-up')}
          disabled={saving}
        />
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  empty: { color: tokens.textMuted, textAlign: 'center' },
  readOnly: { fontSize: 14, color: tokens.text, lineHeight: 22 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  recordingUrl: { fontSize: 12, color: tokens.textMuted },
  flag: { fontSize: 14, color: '#b45309', marginBottom: 4 },
  actionRow: { gap: 8, marginBottom: 12 },
  actionLabel: { fontSize: 14, color: tokens.text },
});
