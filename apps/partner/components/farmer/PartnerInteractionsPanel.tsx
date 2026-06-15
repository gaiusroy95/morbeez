import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate, partnerClient, tokens, type FarmerTimelineEntry, type TeamTimelineEntry } from '@morbeez/shared';
import { AlertBox, ListCard, Loading } from '@morbeez/ui-native';

type Props = { farmerId: string; initialTimeline?: FarmerTimelineEntry[] };

function toTeamEntry(entry: FarmerTimelineEntry): TeamTimelineEntry {
  const meta = entry.metadata ?? {};
  const source =
    (meta.source as TeamTimelineEntry['source'] | undefined) ??
    (entry.entryType === 'escalation'
      ? 'escalation'
      : entry.entryType === 'support_request'
        ? 'timeline'
        : 'timeline');
  return { ...entry, source, title: (meta.title as string | undefined) ?? undefined };
}

function eventLabel(entry: TeamTimelineEntry): string {
  const src = entry.source ?? entry.entryType;
  if (src === 'call') return 'Telecaller call';
  if (src === 'visit') return 'Field visit';
  if (src === 'recommendation') return 'Expert recommendation';
  if (src === 'escalation') return 'Escalation';
  if (entry.entryType === 'support_request') return 'Support request';
  if (entry.entryType === 'comment') return 'Team comment';
  return entry.title ?? String(entry.entryType ?? 'Interaction');
}

export function PartnerInteractionsPanel({ farmerId, initialTimeline }: Props) {
  const [items, setItems] = useState<TeamTimelineEntry[]>(
    (initialTimeline ?? []).map(toTeamEntry)
  );
  const [loading, setLoading] = useState(!initialTimeline?.length);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialTimeline?.length) return;
    setLoading(true);
    void partnerClient
      .getInteractions(farmerId)
      .then((rows) => setItems(rows.map(toTeamEntry)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [farmerId, initialTimeline]);

  if (loading) return <Loading label="Loading interactions…" />;
  if (error) return <AlertBox>{error}</AlertBox>;

  return (
    <View style={styles.root}>
      {items.map((entry) => (
        <ListCard
          key={entry.id}
          title={eventLabel(entry)}
          subtitle={entry.body}
          meta={formatDate(entry.createdAt)}
        />
      ))}
      {!items.length ? <Text style={styles.empty}>No interactions yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
