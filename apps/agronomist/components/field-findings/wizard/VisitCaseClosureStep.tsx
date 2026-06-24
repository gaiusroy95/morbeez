import { StyleSheet, Text, View } from 'react-native';
import { tokens, type RecommendationGroupDraft } from '@morbeez/shared';
import type { IssueDraft } from '../IssueCard';

type Props = {
  issues: IssueDraft[];
  recommendationGroups: RecommendationGroupDraft[];
};

export function VisitCaseClosureStep({ issues, recommendationGroups }: Props) {
  const qaCount = issues.reduce(
    (n, i) => n + (i.followUpQuestions?.filter((q) => q.answer?.trim()).length ?? 0),
    0
  );
  const reviewActions = issues.filter((i) => i.agronomistReview?.action).length;

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>
        Learning loop will capture AI vs final diagnosis, {qaCount} Q&A answer(s), and {reviewActions}{' '}
        validation decision(s) for model improvement.
      </Text>
      {issues.map((issue) => (
        <View key={issue.localId} style={styles.card}>
          <Text style={styles.title}>{issue.issueName}</Text>
          <Text style={styles.sub}>AI diagnosis: {issue.selectedHypothesisLabel ?? issue.issueName}</Text>
          <Text style={styles.sub}>Final: {issue.finalDiagnosis ?? '—'}</Text>
          <Text style={styles.sub}>Review: {issue.agronomistReview?.action ?? 'pending'}</Text>
          {(issue.followUpQuestions ?? []).filter((q) => q.answer?.trim()).length ? (
            <Text style={styles.sub}>
              Q&A: {(issue.followUpQuestions ?? [])
                .filter((q) => q.answer?.trim())
                .map((q) => `${q.questionText.slice(0, 40)}… → ${q.answer}`)
                .join('; ')}
            </Text>
          ) : null}
        </View>
      ))}
      <Text style={styles.sub}>Recommendation groups: {recommendationGroups.length}</Text>
      <Text style={styles.footer}>Submit to start outcome tracking and WhatsApp follow-up.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
  },
  title: { fontSize: 15, fontWeight: '700', color: tokens.text },
  sub: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  footer: { fontSize: 12, color: tokens.green700, marginTop: 4 },
});
