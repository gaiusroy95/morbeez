import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { agronomistClient, derivePhotoRequestsFromFollowUp, shouldRunFollowUp, tokens, type VisitAiClient } from '@morbeez/shared';
import { AlertBox, Panel } from '@morbeez/ui-native';
import type { IssueDraft } from '../IssueCard';

const ANSWER_CHIPS = ['yes', 'no', 'unknown'] as const;

type Props = {
  issues: IssueDraft[];
  onChange: (issues: IssueDraft[]) => void;
  visitAiClient?: VisitAiClient;
};

export function VisitFollowUpStep({ issues, onChange, visitAiClient }: Props) {
  const client = visitAiClient ?? agronomistClient;
  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuestions() {
    setLoading(true);
    setError('');
    try {
      const next = [...issues];
      for (let i = 0; i < next.length; i++) {
        const issue = next[i]!;
        if (!shouldRunFollowUp(issue) || !issue.aiCaseId || issue.qaSkipped || issue.followUpQuestions?.length) continue;
        const questions = await client.getVisitAiQuestions(issue.aiCaseId);
        next[i] = { ...issue, followUpQuestions: questions };
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load questions');
    } finally {
      setLoading(false);
    }
  }

  function setAnswer(issueIndex: number, questionId: string, answer: string) {
    const next = [...issues];
    const issue = next[issueIndex];
    if (!issue) return;
    next[issueIndex] = {
      ...issue,
      followUpQuestions: (issue.followUpQuestions ?? []).map((q) =>
        q.id === questionId ? { ...q, answer } : q
      ),
    };
    onChange(next);
  }

  async function skipQa(issueIndex: number) {
    const issue = issues[issueIndex];
    if (!issue?.aiCaseId) return;
    setSkipping(true);
    setError('');
    try {
      await client.skipVisitAiFollowUp(issue.aiCaseId);
      const next = [...issues];
      next[issueIndex] = {
        ...issue,
        qaSkipped: true,
        followUpQuestions: [],
      };
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not skip Q&A');
    } finally {
      setSkipping(false);
    }
  }

  async function saveAndReanalyze() {
    setReanalyzing(true);
    setError('');
    try {
      const next = [...issues];
      for (let i = 0; i < next.length; i++) {
        const issue = next[i]!;
        if (!issue.aiCaseId || issue.qaSkipped || !issue.followUpQuestions?.length) continue;
        const answers = issue.followUpQuestions
          .filter((q) => q.answer?.trim())
          .map((q) => ({ questionId: q.id, answer: q.answer!.trim() }));
        if (!answers.length) continue;
        await client.saveVisitAiAnswers(issue.aiCaseId, answers);
        const result = await client.reanalyzeVisitAiCase(issue.aiCaseId);
        next[i] = {
          ...issue,
          finalDiagnosis: result.finalDiagnosis,
          selectedHypothesisLabel: result.finalDiagnosis,
          confidenceAction: result.confidenceAction,
          photoRequests: derivePhotoRequestsFromFollowUp(issue.followUpQuestions ?? []),
          hypotheses: (result.hypotheses ?? []).map((h) => ({
            label: h.label,
            confidence: h.confidence ?? 0.5,
            rationale: h.rationale,
            selected: h.label === result.finalDiagnosis,
          })),
        };
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-analysis failed');
    } finally {
      setReanalyzing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.green700} />
        <Text style={styles.loadingText}>Loading follow-up questions…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {issues.map((issue, issueIndex) => {
        const canSkip = issue.skipFollowUpOptional && !issue.qaSkipped;
        return (
          <Panel key={issue.localId} title={issue.finalDiagnosis ?? issue.issueName}>
            {issue.confidenceAction === 'escalate' ? (
              <Text style={styles.escalationHint}>
                Low AI confidence — consider escalating if answers do not clarify the diagnosis.
              </Text>
            ) : null}
            {canSkip ? (
              <Pressable
                style={styles.skipChip}
                onPress={() => void skipQa(issueIndex)}
                disabled={skipping}
              >
                <Text style={styles.skipChipText}>{skipping ? 'Skipping…' : 'Skip Q&A (high confidence)'}</Text>
              </Pressable>
            ) : null}
            {issue.qaSkipped ? (
              <Text style={styles.skippedNote}>Follow-up Q&A skipped — high confidence case.</Text>
            ) : null}
            {(issue.followUpQuestions ?? []).map((q) => (
              <View key={q.id} style={styles.questionBlock}>
                <Text style={styles.question}>{q.questionText}</Text>
                <View style={styles.chipRow}>
                  {ANSWER_CHIPS.map((chip) => {
                    const active = q.answer === chip;
                    return (
                      <Pressable
                        key={chip}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setAnswer(issueIndex, q.id, chip)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {chip.charAt(0).toUpperCase() + chip.slice(1)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {!issue.qaSkipped && !issue.followUpQuestions?.length ? (
              <Text style={styles.muted}>No follow-up questions for this issue.</Text>
            ) : null}
          </Panel>
        );
      })}
      <Pressable style={styles.reanalyzeBtn} onPress={() => void saveAndReanalyze()} disabled={reanalyzing}>
        <Text style={styles.reanalyzeText}>{reanalyzing ? 'Updating diagnosis…' : 'Save answers & update diagnosis'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { color: tokens.textMuted },
  escalationHint: {
    fontSize: 13,
    color: '#a94442',
    backgroundColor: '#fdecea',
    padding: 10,
    borderRadius: tokens.radiusSm,
    marginBottom: 10,
  },
  skipChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.green700,
    backgroundColor: tokens.green100,
    marginBottom: 12,
  },
  skipChipText: { fontSize: 13, fontWeight: '700', color: tokens.green800 },
  skippedNote: { fontSize: 13, color: tokens.textMuted, fontStyle: 'italic', marginBottom: 8 },
  questionBlock: { marginBottom: 14 },
  question: { fontSize: 14, fontWeight: '600', color: tokens.text, marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bg,
  },
  chipActive: { borderColor: tokens.green700, backgroundColor: tokens.green100 },
  chipText: { fontSize: 13, color: tokens.textMuted, fontWeight: '600' },
  chipTextActive: { color: tokens.green800 },
  muted: { fontSize: 13, color: tokens.textMuted },
  reanalyzeBtn: {
    backgroundColor: tokens.green700,
    borderRadius: tokens.radiusSm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reanalyzeText: { color: '#fff', fontWeight: '700' },
});
