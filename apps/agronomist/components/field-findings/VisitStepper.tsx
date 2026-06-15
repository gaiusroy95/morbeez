import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';

export type VisitWizardStep =
  | 'overview'
  | 'photos'
  | 'measurements'
  | 'issues'
  | 'aiAnalysis'
  | 'followUp'
  | 'recommendation'
  | 'review'
  | 'summary';

export const VISIT_WIZARD_STEPS: Array<{ id: VisitWizardStep; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'photos', label: 'Photos' },
  { id: 'measurements', label: 'Measures' },
  { id: 'issues', label: 'Issues' },
  { id: 'aiAnalysis', label: 'AI' },
  { id: 'followUp', label: 'Q&A' },
  { id: 'recommendation', label: 'Rec' },
  { id: 'review', label: 'Review' },
  { id: 'summary', label: 'Summary' },
];

type Props = {
  current: VisitWizardStep;
};

export function VisitStepper({ current }: Props) {
  const currentIndex = VISIT_WIZARD_STEPS.findIndex((s) => s.id === current);

  return (
    <View style={styles.root}>
      {VISIT_WIZARD_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <View key={step.id} style={styles.stepWrap}>
            <View style={styles.stepRow}>
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                <Text style={[styles.dotText, (done || active) && styles.dotTextActive]}>{index + 1}</Text>
              </View>
              {index < VISIT_WIZARD_STEPS.length - 1 ? (
                <View style={[styles.line, done && styles.lineDone]} />
              ) : null}
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 10,
    backgroundColor: tokens.card,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  stepWrap: { flex: 1, alignItems: 'center', minWidth: 0 },
  stepRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: tokens.border,
    backgroundColor: tokens.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { borderColor: tokens.green700, backgroundColor: tokens.green700 },
  dotDone: { borderColor: tokens.green700, backgroundColor: tokens.green700 },
  dotText: { fontSize: 10, fontWeight: '700', color: tokens.textMuted },
  dotTextActive: { color: '#fff' },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: tokens.border,
    marginHorizontal: 1,
  },
  lineDone: { backgroundColor: tokens.green500 },
  label: { fontSize: 9, color: tokens.textMuted, marginTop: 4, textAlign: 'center' },
  labelActive: { color: tokens.green800, fontWeight: '700' },
});
