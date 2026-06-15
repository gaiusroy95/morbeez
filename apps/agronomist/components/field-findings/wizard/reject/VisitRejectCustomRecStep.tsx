import { StyleSheet, Text, View } from 'react-native';
import { tokens, type VisitAiCustomRecommendation } from '@morbeez/shared';
import { TextField } from '@morbeez/ui-native';

type Props = {
  custom: VisitAiCustomRecommendation;
  onChange: (next: VisitAiCustomRecommendation) => void;
};

export function VisitRejectCustomRecStep({ custom, onChange }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Your prescription</Text>
      <TextField
        label="Product"
        value={custom.product}
        onChangeText={(product) => onChange({ ...custom, product })}
      />
      <TextField label="Dose" value={custom.dose} onChangeText={(dose) => onChange({ ...custom, dose })} />
      <TextField
        label="Application method"
        value={custom.method}
        onChangeText={(method) => onChange({ ...custom, method })}
      />
      <TextField
        label="Review date (optional)"
        value={custom.reviewDate ?? ''}
        onChangeText={(reviewDate) => onChange({ ...custom, reviewDate })}
        placeholder="e.g. 15 Jul 2026"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, marginTop: 8 },
  title: { fontSize: 13, fontWeight: '600', color: tokens.text },
});
