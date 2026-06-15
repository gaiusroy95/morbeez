import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VISIT_AI_REJECT_REASON_OPTIONS, tokens, type VisitAiRejectReason } from '@morbeez/shared';

type Props = {
  value?: VisitAiRejectReason;
  onChange: (reason: VisitAiRejectReason) => void;
};

export function VisitRejectReasonStep({ value, onChange }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Why are you rejecting this recommendation?</Text>
      {VISIT_AI_REJECT_REASON_OPTIONS.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[styles.option, value === opt.value && styles.optionActive]}
        >
          <Text style={[styles.optionLabel, value === opt.value && styles.optionLabelActive]}>{opt.label}</Text>
          <Text style={styles.optionDesc}>{opt.description}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, marginTop: 8 },
  title: { fontSize: 14, fontWeight: '600', color: tokens.text, marginBottom: 4 },
  option: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 12,
    backgroundColor: tokens.card,
  },
  optionActive: { borderColor: tokens.green500, backgroundColor: tokens.green100 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: tokens.text },
  optionLabelActive: { color: tokens.green800 },
  optionDesc: { fontSize: 13, color: tokens.textMuted, marginTop: 4 },
});
