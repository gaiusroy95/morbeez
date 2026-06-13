import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate, partnerClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, ListCard, Loading, Panel, TextField } from '@morbeez/ui-native';

type Props = { farmerId: string };

export function PartnerTeamPanel({ farmerId }: Props) {
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEntries(await partnerClient.getTeamTimeline(farmerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load team timeline');
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await partnerClient.addTimelineNote(farmerId, draft.trim());
      setDraft('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post note');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading team discussion…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Internal team discussion">
        <Text style={styles.hint}>
          Visible to telecaller, partner, expert, and admin — not the farmer.
        </Text>
        <TextField label="Comment" value={draft} onChangeText={setDraft} placeholder="Add internal note…" multiline />
        <Btn label={saving ? 'Posting…' : 'Post comment'} onPress={() => void save()} disabled={saving} />
      </Panel>
      {entries.map((e) => (
        <ListCard
          key={String(e.id)}
          title={`${String(e.authorType ?? e.author_type ?? 'system')} · ${String(e.title ?? e.source ?? 'Update')}`}
          subtitle={String(e.body ?? '')}
          meta={
            e.createdAt || e.at
              ? formatDate(String(e.createdAt ?? e.at))
              : undefined
          }
        />
      ))}
      {!entries.length ? <Text style={styles.empty}>No team activity yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, paddingBottom: 24 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
