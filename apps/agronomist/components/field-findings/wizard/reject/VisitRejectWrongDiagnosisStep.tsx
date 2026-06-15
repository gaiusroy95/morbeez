import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { Panel, TextField } from '@morbeez/ui-native';

type Props = {
  aiDiagnosis: string;
  correctedDiagnosis: string;
  onChangeCorrected: (value: string) => void;
};

export function VisitRejectWrongDiagnosisStep({ aiDiagnosis, correctedDiagnosis, onChangeCorrected }: Props) {
  return (
    <View style={styles.root}>
      <Panel title="AI diagnosis">
        <Text style={styles.aiText}>{aiDiagnosis || '—'}</Text>
      </Panel>
      <Text style={styles.label}>Correct diagnosis</Text>
      <TextField
        label="Correct diagnosis"
        value={correctedDiagnosis}
        onChangeText={onChangeCorrected}
        placeholder="Enter the correct diagnosis"
      />
      <Text style={styles.hint}>A new recommendation will be generated from the corrected diagnosis.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, marginTop: 8 },
  aiText: { fontSize: 14, color: tokens.text },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginTop: 4 },
  hint: { fontSize: 12, color: tokens.textMuted },
});
