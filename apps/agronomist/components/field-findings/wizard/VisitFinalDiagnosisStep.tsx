import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { Panel } from '@morbeez/ui-native';
import type { IssueDraft } from '../IssueCard';

type Props = {
  issues: IssueDraft[];
};

export function VisitFinalDiagnosisStep({ issues }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Confirm the final diagnosis for each issue before recommendation planning. These summaries are read-only here;
        update on the Q&A step if needed.
      </Text>
      {issues.map((issue, index) => (
        <Panel key={issue.localId} title={`Issue ${index + 1}: ${issue.issueName}`}>
          <View style={styles.row}>
            <Text style={styles.label}>Category</Text>
            <Text style={styles.value}>{issue.category.replace(/_/g, ' ')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Final diagnosis</Text>
            <Text style={[styles.value, !issue.finalDiagnosis?.trim() ? styles.missing : null]}>
              {issue.finalDiagnosis?.trim() || 'Not set — go back to Q&A'}
            </Text>
          </View>
          {issue.observation?.trim() ? (
            <View style={styles.notes}>
              <Text style={styles.label}>Field notes</Text>
              <Text style={styles.noteText}>{issue.observation}</Text>
            </View>
          ) : null}
        </Panel>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  intro: { fontSize: 13, color: tokens.textMuted, lineHeight: 18, paddingHorizontal: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  label: { fontSize: 13, color: tokens.textMuted, flex: 1 },
  value: { fontSize: 14, fontWeight: '600', color: tokens.text, flex: 1, textAlign: 'right' },
  missing: { color: tokens.danger },
  notes: { paddingTop: 8, gap: 4 },
  noteText: { fontSize: 13, color: tokens.text, lineHeight: 18 },
});
