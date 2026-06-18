import { StyleSheet, Text, View } from 'react-native';
import { tokens, type RecommendationGroupDraft } from '@morbeez/shared';
import type { IssueDraft } from '../IssueCard';

type Props = {
  issues: IssueDraft[];
  recommendationGroups: RecommendationGroupDraft[];
};

export function VisitCaseClosureStep({ issues, recommendationGroups }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.hint}>Learning loop will capture AI vs final diagnosis, Q&A, and outcomes.</Text>
      {issues.map((issue) => (
        <View key={issue.localId} style={styles.card}>
          <Text style={styles.title}>{issue.issueName}</Text>
          <Text style={styles.sub}>Final: {issue.finalDiagnosis ?? '—'}</Text>
          <Text style={styles.sub}>Review: {issue.agronomistReview?.action ?? 'pending'}</Text>
        </View>
      ))}
      <Text style={styles.sub}>Groups: {recommendationGroups.length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  hint: { fontSize: 13, color: tokens.textMuted },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
  },
  title: { fontSize: 15, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
});
