import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { expandSeparateNutrientIssues, tokens } from '@morbeez/shared';
import { Panel, TextField } from '@morbeez/ui-native';
import type { IssueDraft } from '../IssueCard';

type Props = {
  issues: IssueDraft[];
  onChange: (issues: IssueDraft[]) => void;
};

export function VisitFinalDiagnosisStep({ issues, onChange }: Props) {
  useEffect(() => {
    const expanded = expandSeparateNutrientIssues(issues);
    const changed =
      expanded.length !== issues.length ||
      expanded.some((row, i) => row.issueName !== issues[i]?.issueName);
    if (changed) onChange(expanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patchIssue(index: number, patch: Partial<IssueDraft>) {
    const next = [...issues];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  }

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Confirm or correct the diagnosis for each issue before recommendation planning. Update the issue name if the
        field problem was described incorrectly.
      </Text>
      {issues.map((issue, index) => (
        <Panel key={issue.localId} title={`Issue ${index + 1}`}>
          <TextField
            label="Issue name"
            value={issue.issueName}
            onChangeText={(text) => patchIssue(index, { issueName: text })}
            placeholder="e.g. Rhizome rot, K deficiency"
          />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Category</Text>
            <Text style={styles.rowValue}>{issue.category.replace(/_/g, ' ')}</Text>
          </View>
          <TextField
            label="Final diagnosis"
            value={issue.finalDiagnosis ?? ''}
            onChangeText={(text) =>
              patchIssue(index, {
                finalDiagnosis: text,
                selectedHypothesisLabel: text.trim() || issue.selectedHypothesisLabel,
              })
            }
            placeholder="Enter or correct the confirmed diagnosis"
          />
          {issue.observation?.trim() ? (
            <View style={styles.notes}>
              <Text style={styles.notesLabel}>Field notes</Text>
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
    marginBottom: 4,
  },
  rowLabel: { fontSize: 13, color: tokens.textMuted },
  rowValue: { fontSize: 14, fontWeight: '600', color: tokens.text, textAlign: 'right', flex: 1 },
  notes: { paddingTop: 8, gap: 4 },
  notesLabel: { fontSize: 13, color: tokens.textMuted },
  noteText: { fontSize: 13, color: tokens.text, lineHeight: 18 },
});
