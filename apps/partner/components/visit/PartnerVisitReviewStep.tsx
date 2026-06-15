import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { Panel } from '@morbeez/ui-native';
import type { IssueDraft } from '@agronomist/components/field-findings/IssueCard';

type Props = {
  issues: IssueDraft[];
  onChange: (issues: IssueDraft[]) => void;
};

/** Partner review: draft findings only — expert approves after submit. */
export function PartnerVisitReviewStep({ issues }: Props) {
  return (
    <Panel title="Review before submit">
      <Text style={styles.hint}>
        Partner findings are submitted for expert review. You cannot approve or train AI from the partner app.
      </Text>
      {issues.map((issue, i) => (
        <View key={issue.localId ?? i} style={styles.issue}>
          <Text style={styles.title}>{issue.issueName || issue.category}</Text>
          <Text style={styles.body}>{issue.finalDiagnosis || issue.observation || '—'}</Text>
          {issue.finalRecommendation ? (
            <Text style={styles.rec}>Draft rec: {issue.finalRecommendation}</Text>
          ) : null}
        </View>
      ))}
      {!issues.length ? <Text style={styles.empty}>Add at least one issue before submitting.</Text> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 12, lineHeight: 18 },
  issue: { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: tokens.border },
  title: { fontSize: 15, fontWeight: '600', color: tokens.text },
  body: { fontSize: 13, color: tokens.textMuted, marginTop: 4 },
  rec: { fontSize: 13, color: tokens.green800, marginTop: 4 },
  empty: { color: tokens.textMuted, fontSize: 13 },
});
