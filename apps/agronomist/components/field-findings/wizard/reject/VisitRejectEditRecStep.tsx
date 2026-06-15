import { StyleSheet, Text, TextInput, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { MULTILINE_MIN_HEIGHT, TextField } from '@morbeez/ui-native';

type Props = {
  recommendation: string;
  rejectNote: string;
  onChangeRecommendation: (value: string) => void;
  onChangeNote: (value: string) => void;
};

export function VisitRejectEditRecStep({
  recommendation,
  rejectNote,
  onChangeRecommendation,
  onChangeNote,
}: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>Why is the recommendation not suitable?</Text>
      <TextField
        label="Reason"
        value={rejectNote}
        onChangeText={onChangeNote}
        placeholder="e.g. Not suitable for current crop stage"
      />
      <Text style={styles.label}>Edited recommendation</Text>
      <TextInput
        style={[styles.input, { minHeight: MULTILINE_MIN_HEIGHT }]}
        multiline
        value={recommendation}
        onChangeText={onChangeRecommendation}
        placeholder="Edit the AI recommendation"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 12,
    fontSize: 14,
    color: tokens.text,
    backgroundColor: tokens.bg,
    textAlignVertical: 'top',
  },
});
