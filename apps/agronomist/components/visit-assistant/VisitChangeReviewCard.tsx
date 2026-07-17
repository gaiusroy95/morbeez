import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { AlertBox, Btn, Panel } from '@morbeez/ui-native';
import type { VisitAssistantOperationReview } from '@/lib/visitAssistantBridge';

type Props = {
  review: VisitAssistantOperationReview;
  busy?: boolean;
  onApply: (explicitCriticalConfirmation: boolean) => void;
  onReject: () => void;
};

export function VisitChangeReviewCard({ review, busy, onApply, onReject }: Props) {
  const [confirmedCritical, setConfirmedCritical] = useState(false);
  const isCritical = review.riskLevel === 'critical';

  return (
    <Panel title={review.title}>
      <View style={styles.row}>
        <Text style={styles.label}>Current</Text>
        <Text style={styles.value}>{review.oldValue}</Text>
      </View>
      <View style={styles.arrowRow}>
        <Text style={styles.arrow}>→</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Proposed</Text>
        <Text style={[styles.value, styles.proposed]}>{review.newValue}</Text>
      </View>

      {isCritical ? (
        <AlertBox>
          Critical change{review.riskReasons.length ? `: ${review.riskReasons.join('; ')}` : ''}.
          Confirm before applying.
        </AlertBox>
      ) : null}

      {isCritical ? (
        <Pressable
          style={styles.checkRow}
          onPress={() => setConfirmedCritical((prev) => !prev)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: confirmedCritical }}
        >
          <View style={[styles.checkbox, confirmedCritical && styles.checkboxOn]}>
            {confirmedCritical ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkLabel}>I reviewed this critical change</Text>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.actionBtn}>
          <Btn
            label="Apply"
            onPress={() => onApply(isCritical ? confirmedCritical : false)}
            disabled={busy || (isCritical && !confirmedCritical)}
          />
        </View>
        <View style={styles.actionBtn}>
          <Btn label="Reject" variant="secondary" onPress={onReject} disabled={busy} />
        </View>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase' },
  value: { fontSize: 14, lineHeight: 20, color: tokens.text },
  proposed: { fontWeight: '600', color: tokens.green700 },
  arrowRow: { marginVertical: 2 },
  arrow: { fontSize: 16, color: tokens.textMuted },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: tokens.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.card,
  },
  checkboxOn: {
    backgroundColor: tokens.green700,
    borderColor: tokens.green700,
  },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 13, color: tokens.text },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { flex: 1 },
});
