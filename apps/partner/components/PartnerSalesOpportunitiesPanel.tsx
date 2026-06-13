import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate, partnerClient, tokens } from '@morbeez/shared';
import { AlertBox, Btn, ListCard, Loading, Panel, TextField } from '@morbeez/ui-native';

type Props = { farmerId: string };

export function PartnerSalesOpportunitiesPanel({ farmerId }: Props) {
  const [opportunities, setOpportunities] = useState<Record<string, unknown>[]>([]);
  const [product, setProduct] = useState('');
  const [expectedQuantity, setExpectedQuantity] = useState('');
  const [urgency, setUrgency] = useState('');
  const [interestLevel, setInterestLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOpportunities(await partnerClient.listSalesOpportunities(farmerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load opportunities');
    } finally {
      setLoading(false);
    }
  }, [farmerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!product.trim()) {
      setError('Product name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await partnerClient.createSalesOpportunity(farmerId, {
        product: product.trim(),
        expectedQuantity: expectedQuantity.trim() || undefined,
        urgency: urgency.trim() || undefined,
        interestLevel: interestLevel.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setProduct('');
      setExpectedQuantity('');
      setUrgency('');
      setInterestLevel('');
      setNotes('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create opportunity');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Loading opportunities…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Log sales opportunity">
        <TextField label="Product" value={product} onChangeText={setProduct} placeholder="e.g. NPK blend" />
        <TextField label="Expected quantity" value={expectedQuantity} onChangeText={setExpectedQuantity} />
        <TextField label="Urgency" value={urgency} onChangeText={setUrgency} placeholder="e.g. this week" />
        <TextField label="Interest level" value={interestLevel} onChangeText={setInterestLevel} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
        <Btn label={saving ? 'Saving…' : 'Create opportunity'} onPress={() => void create()} disabled={saving} />
      </Panel>
      {opportunities.map((o) => (
        <ListCard
          key={String(o.id)}
          title={String(o.product ?? 'Opportunity')}
          subtitle={o.notes ? String(o.notes) : undefined}
          meta={[
            o.status ? String(o.status) : null,
            o.createdAt ? formatDate(String(o.createdAt)) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      ))}
      {!opportunities.length ? <Text style={styles.empty}>No sales opportunities yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, paddingBottom: 24 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 16 },
});
