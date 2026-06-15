import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate, partnerClient, tokens, type TeamTimelineEntry } from '@morbeez/shared';
import { AlertBox, Btn, ListCard, Loading, Panel, TextField } from '@morbeez/ui-native';

type Props = { farmerId: string };

export function PartnerCollaborationPanel({ farmerId }: Props) {
  const [items, setItems] = useState<TeamTimelineEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError('');
    try {
      setItems(await partnerClient.getTeamTimeline(farmerId) as TeamTimelineEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [farmerId]);

  async function postComment() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await partnerClient.addTeamComment(farmerId, draft.trim());
      setDraft('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post comment');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading collaboration…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Participants">
        <Text style={styles.hint}>Telecaller · Partner · Expert · Admin</Text>
      </Panel>
      <Panel title="Add comment">
        <TextField label="Comment" value={draft} onChangeText={setDraft} multiline />
        <Btn label={busy ? 'Posting…' : 'Post comment'} onPress={() => void postComment()} disabled={busy} />
      </Panel>
      {items.map((entry) => (
        <ListCard
          key={entry.id}
          title={String(entry.authorName ?? entry.authorType ?? 'Team')}
          subtitle={entry.body}
          meta={formatDate(entry.createdAt)}
        />
      ))}
      {!items.length ? <Text style={styles.empty}>No collaboration messages yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  hint: { fontSize: 13, color: tokens.textMuted },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
