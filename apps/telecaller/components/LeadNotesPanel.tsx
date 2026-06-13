import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate, telecallerClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, ListCard, Loading, Panel, TextField } from '@morbeez/ui-native';

type Props = {
  leadId: string;
};

export function LeadNotesPanel({ leadId }: Props) {
  const [notes, setNotes] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setNotes(await telecallerClient.listLeadNotes(leadId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notes');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    setError('');
    try {
      await telecallerClient.addLeadNote(leadId, draft.trim());
      setDraft('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save note');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading notes…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Compose note">
        <TextField
          label="Note"
          value={draft}
          onChangeText={setDraft}
          placeholder='e.g. "Prefers WhatsApp", "Price sensitive"'
          multiline
        />
        <Btn label={saving ? 'Saving…' : 'Add note'} onPress={() => void save()} disabled={saving} />
      </Panel>
      {notes.map((note) => (
        <ListCard
          key={String(note.id)}
          title={String(note.note ?? note.content ?? 'Note')}
          meta={[
            note.createdBy ? String(note.createdBy) : note.author ? String(note.author) : null,
            note.createdAt || note.created_at ? formatDate(String(note.createdAt ?? note.created_at)) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      ))}
      {!notes.length ? <Text style={styles.empty}>No notes yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, paddingBottom: 24 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
