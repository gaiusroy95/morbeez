import { StyleSheet, Text, View } from 'react-native';
import { VISIT_WIZARD_STEPS, getVisibleWizardSteps, normalizeVisitWizardStep, type VisitWizardStep } from '@morbeez/shared';
import { tokens } from '@morbeez/shared';

export type { VisitWizardStep };
export { VISIT_WIZARD_STEPS };

type Props = {
  current: VisitWizardStep;
  hiddenSteps?: VisitWizardStep[];
  partnerMode?: boolean;
};

export function VisitStepper({ current, hiddenSteps = [], partnerMode }: Props) {
  const steps = getVisibleWizardSteps(partnerMode).filter((id) => !hiddenSteps.includes(id));
  const labels = VISIT_WIZARD_STEPS;
  const normalizedCurrent = normalizeVisitWizardStep(current);
  const currentIndex = steps.indexOf(normalizedCurrent);

  return (
    <View style={styles.root}>
      {steps.map((stepId, index) => {
        const step = labels.find((s) => s.id === stepId)!;
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <View key={step.id} style={styles.stepWrap}>
            <View style={styles.stepRow}>
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                <Text style={[styles.dotText, (done || active) && styles.dotTextActive]}>{index + 1}</Text>
              </View>
              {index < steps.length - 1 ? <View style={[styles.line, done && styles.lineDone]} /> : null}
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
  line: { flex: 1, height: 2, backgroundColor: tokens.border, marginHorizontal: 1 },
  lineDone: { backgroundColor: tokens.green500 },
  label: { fontSize: 9, color: tokens.textMuted, marginTop: 4, textAlign: 'center' },
  labelActive: { color: tokens.green800, fontWeight: '700' },
});
