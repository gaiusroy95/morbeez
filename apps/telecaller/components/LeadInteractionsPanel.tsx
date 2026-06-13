import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, telecallerClient, tokens, type TelecallerTimelineItem } from '@morbeez/shared';
import { AlertBox, Btn, ListCard, Loading, Panel } from '@morbeez/ui-native';

type Props = {
  leadId: string;
  farmerId: string;
};

type TimelineRow = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  at: string;
  callId?: string;
};

function kindIcon(kind: string): string {
  const k = kind.toLowerCase();
  if (k.includes('call')) return '📞';
  if (k.includes('whatsapp')) return '💬';
  if (k.includes('order')) return '📦';
  if (k.includes('visit')) return '🚜';
  if (k.includes('recommendation') || k.includes('rec')) return '📋';
  if (k.includes('soil')) return '🧪';
  return '•';
}

export function LeadInteractionsPanel({ leadId, farmerId }: Props) {
  const router = useRouter();
  const [timeline, setTimeline] = useState<TelecallerTimelineItem[]>([]);
  const [whatsapp, setWhatsapp] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tl, wa] = await Promise.all([
        telecallerClient.getLeadTimeline(leadId),
        telecallerClient.listWhatsAppMessages(farmerId).catch(() => []),
      ]);
      setTimeline(tl);
      setWhatsapp(wa);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load interactions');
    } finally {
      setLoading(false);
    }
  }, [leadId, farmerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const merged: TimelineRow[] = timeline.map((item) => ({
      id: item.id,
      kind: item.type,
      title: item.title,
      detail: item.detail ?? '',
      at: item.at,
      callId: item.type === 'call' ? String(item.meta?.callId ?? item.id) : undefined,
    }));

    for (const msg of whatsapp) {
      merged.push({
        id: `wa-${String(msg.id ?? merged.length)}`,
        kind: 'whatsapp',
        title: 'WhatsApp message',
        detail: String(msg.body ?? msg.content ?? msg.summary ?? ''),
        at: String(msg.created_at ?? msg.at ?? new Date().toISOString()),
      });
    }

    merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return merged;
  }, [timeline, whatsapp]);

  if (loading) return <Loading label="Loading interactions…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Unified timeline">
        <Text style={styles.hint}>AI summaries are read-only. Tap a call to view transcript and QC.</Text>
      </Panel>
      {rows.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => {
            if (row.callId) router.push(`/lead/${leadId}/call/${row.callId}`);
          }}
          disabled={!row.callId}
        >
          <ListCard
            title={`${kindIcon(row.kind)} ${row.title}`}
            subtitle={row.detail || '—'}
            meta={formatDate(row.at)}
          />
        </Pressable>
      ))}
      {!rows.length ? <Text style={styles.empty}>No interactions yet.</Text> : null}
      <Btn label="Refresh" variant="secondary" onPress={() => void load()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, paddingBottom: 24 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 24 },
});
