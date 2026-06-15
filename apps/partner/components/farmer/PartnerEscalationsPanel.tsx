import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate, partnerClient, tokens, type PartnerEscalationRow } from '@morbeez/shared';
import { AlertBox, Btn, ListCard, Loading, Panel, TextField } from '@morbeez/ui-native';

type Props = { farmerId: string };

const CATEGORIES = [
  { id: 'unknown_disease', label: 'Unknown disease' },
  { id: 'recommendation_failure', label: 'Recommendation failure' },
  { id: 'yield_risk', label: 'Yield risk' },
  { id: 'repeated_issue', label: 'Repeated issue' },
] as const;

export function PartnerEscalationsPanel({ farmerId }: Props) {
  const [items, setItems] = useState<PartnerEscalationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0].id);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError('');
    try {
      setItems(await partnerClient.getFarmerEscalations(farmerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [farmerId]);

  async function submit() {
    if (!notes.trim()) return;
    setBusy(true);
    try {
      await partnerClient.createEscalation(farmerId, { category, notes: notes.trim() });
      setNotes('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create escalation');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading escalations…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Create escalation">
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Btn
              key={c.id}
              label={c.label}
              variant={category === c.id ? 'primary' : 'secondary'}
              onPress={() => setCategory(c.id)}
            />
          ))}
        </View>
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
        <Btn label={busy ? 'Submitting…' : 'Submit escalation'} onPress={() => void submit()} disabled={busy} />
      </Panel>
      {items.map((e) => (
        <ListCard
          key={e.id}
          title={e.status.replace('_', ' ')}
          subtitle={e.body}
          meta={formatDate(e.createdAt)}
        />
      ))}
      {!items.length ? <Text style={styles.empty}>No escalations yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
