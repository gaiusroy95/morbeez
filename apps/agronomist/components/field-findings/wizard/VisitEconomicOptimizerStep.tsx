import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { agronomistClient, tokens } from '@morbeez/shared';
import { AlertBox, Panel } from '@morbeez/ui-native';

type Option = {
  id: string;
  label: string;
  costInr: number;
  expectedRecoveryPct: number;
  roiNote: string;
};

type Props = {
  issueLabel: string;
  cropType: string;
  selectedId: string | null;
  onSelect: (id: string | null, option?: Option) => void;
};

export function VisitEconomicOptimizerStep({ issueLabel, cropType, selectedId, onSelect }: Props) {
  const [options, setOptions] = useState<Option[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const rows = (await agronomistClient.previewRecommendationOptions({
          issueLabel,
          cropType,
          farmerSegment: 'roi_focused',
        })) as Option[];
        setOptions(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load options');
      } finally {
        setLoading(false);
      }
    })();
  }, [issueLabel, cropType]);

  if (loading) return <Text style={styles.muted}>Loading economic options…</Text>;
  if (error) return <AlertBox>{error}</AlertBox>;

  return (
    <View style={styles.root}>
      <Panel title="Recommendation economics">
        <Text style={styles.hint}>Compare cost vs expected recovery (outcome intelligence).</Text>
        {options.map((opt) => (
          <Pressable
            key={opt.id}
            style={[styles.card, selectedId === opt.id && styles.cardActive]}
            onPress={() => onSelect(opt.id, opt)}
          >
            <Text style={styles.cardTitle}>{opt.label}</Text>
            <Text style={styles.row}>Cost: ₹{opt.costInr}</Text>
            <Text style={styles.row}>Expected recovery: {opt.expectedRecoveryPct}%</Text>
            <Text style={styles.note}>{opt.roiNote}</Text>
          </Pressable>
        ))}
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  hint: { color: tokens.textMuted, marginBottom: 8 },
  muted: { color: tokens.textMuted },
  card: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 12,
    marginTop: 8,
    backgroundColor: tokens.card,
  },
  cardActive: { borderColor: tokens.green700, backgroundColor: tokens.green100 },
  cardTitle: { fontWeight: '700', color: tokens.text },
  row: { marginTop: 4, color: tokens.text },
  note: { marginTop: 6, fontSize: 12, color: tokens.textMuted },
});
