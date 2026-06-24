import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  agronomistClient,
  expandSeparateNutrientIssues,
  buildAnalyzeVisitBody,
  derivePhotoRequestsFromFollowUp,
  issuesNeedInitialScreening,
  partnerClient,
  shouldRunFollowUp,
  tokens,
  withTimeout,
  formatConfidenceProgress,
  confidenceThresholdMessage,
  type TriagePreview,
  type VisitAiClient,
  type VisitAiAnswerType,
  type VisitAiQuestion,
  type VisitScreeningParams,
  type ConfidenceDistributionView,
} from '@morbeez/shared';
import { AlertBox, Panel, TextField } from '@morbeez/ui-native';
import type { IssueDraft } from '../IssueCard';

const ANSWER_CHIPS = ['yes', 'no', 'unknown'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPersistedQuestionId(id: string): boolean {
  return UUID_RE.test(id);
}

function newLocalQuestion(): VisitAiQuestion {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    questionText: '',
    answerType: 'yes_no_unknown',
  };
}

type Props = {
  issues: IssueDraft[];
  onChange: (issues: IssueDraft[]) => void;
  visitAiClient?: VisitAiClient;
  triage?: TriagePreview | null;
  screening?: VisitScreeningParams;
};

const SCREENING_TIMEOUT_MS = 120_000;

function mapDetectedIssues(
  detected: Awaited<ReturnType<typeof agronomistClient.analyzeVisit>>['issues']
): IssueDraft[] {
  const mapped = detected.map((row, idx) => ({
    localId: row.localId ?? `ai-${idx}`,
    category: row.category,
    issueName: row.issueName,
    severity: row.severity ?? row.aiSeverity ?? 'medium',
    status: 'open',
    observation: row.observation ?? '',
    photos: [],
    photosPreview: [],
    aiCaseId: row.aiCaseId,
    hypotheses: row.hypotheses,
    selectedHypothesisLabel: row.selectedHypothesisLabel,
    finalDiagnosis: row.finalDiagnosis,
    finalRecommendation: row.finalRecommendation,
    confidenceAction: row.confidenceAction,
    skipFollowUpOptional: row.skipFollowUpOptional,
    imageSignal: row.imageSignal,
    similarCases: row.similarCases,
    rootCause: row.rootCause,
    evidence: row.evidence,
    initialRecommendation: row.initialRecommendation,
    aiConfidence: row.aiConfidence,
    followUpQuestions: row.followUpQuestions,
  })) as IssueDraft[];
  return expandSeparateNutrientIssues(mapped);
}

export function VisitFollowUpStep({ issues, onChange, visitAiClient, triage, screening }: Props) {
  const client = visitAiClient ?? agronomistClient;
  const [loading, setLoading] = useState(true);
  const [screeningRunning, setScreeningRunning] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState('');
  const [confidenceByCase, setConfidenceByCase] = useState<Record<string, ConfidenceDistributionView>>({});

  useEffect(() => {
    void loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runInitialScreening(): Promise<IssueDraft[]> {
    if (!screening) {
      throw new Error('Screening context is missing for this visit.');
    }
    setScreeningRunning(true);
    try {
      const screeningClient = visitAiClient === partnerClient ? partnerClient : agronomistClient;
      const { issues: detected } = await withTimeout(
        screeningClient.analyzeVisit(buildAnalyzeVisitBody(screening)),
        SCREENING_TIMEOUT_MS,
        'Initial AI screening timed out — tap Retry.'
      );
      const mapped = mapDetectedIssues(
        detected as Awaited<ReturnType<typeof agronomistClient.analyzeVisit>>['issues']
      );
      onChange(mapped);
      return mapped;
    } finally {
      setScreeningRunning(false);
    }
  }

  async function attachQuestions(working: IssueDraft[]): Promise<IssueDraft[]> {
    const next = [...working];
    const flowCtx = { issues: next, triage, partnerMode: false };
    await Promise.all(
      next.map(async (issue, i) => {
        if (issue.followUpQuestions?.length) return;
        if (!shouldRunFollowUp(issue, flowCtx) || !issue.aiCaseId || issue.qaSkipped) return;
        const questions = await client.getVisitAiQuestions(issue.aiCaseId);
        next[i] = { ...issue, followUpQuestions: questions };
      })
    );
    return next;
  }

  async function loadQuestions() {
    setLoading(true);
    setError('');
    try {
      let working = [...issues];
      if (issuesNeedInitialScreening(working)) {
        working = await runInitialScreening();
      }
      const next = await attachQuestions(working);
      onChange(next);
      for (const issue of next) {
        if (issue.aiCaseId) {
          try {
            const state = await client.screenVisitAiCase?.(issue.aiCaseId);
            if (state?.distribution) {
              setConfidenceByCase((prev) => ({ ...prev, [issue.aiCaseId!]: state.distribution }));
            }
          } catch {
            // optional
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load questions');
    } finally {
      setLoading(false);
    }
  }

  function patchIssue(issueIndex: number, patch: Partial<IssueDraft>) {
    const next = [...issues];
    const issue = next[issueIndex];
    if (!issue) return;
    next[issueIndex] = { ...issue, ...patch };
    onChange(next);
  }

  function setQuestionText(issueIndex: number, questionId: string, questionText: string) {
    const issue = issues[issueIndex];
    if (!issue) return;
    patchIssue(issueIndex, {
      followUpQuestions: (issue.followUpQuestions ?? []).map((q) =>
        q.id === questionId ? { ...q, questionText } : q
      ),
    });
  }

  function setAnswer(issueIndex: number, questionId: string, answer: string) {
    const issue = issues[issueIndex];
    if (!issue) return;
    patchIssue(issueIndex, {
      followUpQuestions: (issue.followUpQuestions ?? []).map((q) =>
        q.id === questionId ? { ...q, answer } : q
      ),
    });
    if (issue.aiCaseId && ANSWER_CHIPS.includes(answer as (typeof ANSWER_CHIPS)[number])) {
      void (async () => {
        try {
          const result = await agronomistClient.applyVisitAiAnswer(issue.aiCaseId!, questionId, answer);
          if (result.distribution) {
            setConfidenceByCase((prev) => ({ ...prev, [issue.aiCaseId!]: result.distribution }));
          }
          if (result.thresholdReached && result.topLabel) {
            patchIssue(issueIndex, {
              finalDiagnosis: result.topLabel,
              selectedHypothesisLabel: result.topLabel,
              thresholdReached: true,
              confidenceAction: result.confidenceAction,
            });
          }
        } catch {
          // keep local answer
        }
      })();
    }
  }

  function addQuestion(issueIndex: number) {
    const issue = issues[issueIndex];
    if (!issue) return;
    patchIssue(issueIndex, {
      followUpQuestions: [...(issue.followUpQuestions ?? []), newLocalQuestion()],
    });
  }

  function removeQuestion(issueIndex: number, questionId: string) {
    const issue = issues[issueIndex];
    if (!issue) return;
    patchIssue(issueIndex, {
      followUpQuestions: (issue.followUpQuestions ?? []).filter((q) => q.id !== questionId),
    });
  }

  async function regenerateQuestions(issueIndex: number) {
    const issue = issues[issueIndex];
    if (!issue?.aiCaseId) return;
    setRegeneratingIndex(issueIndex);
    setError('');
    try {
      const questions = await client.regenerateVisitAiQuestions(issue.aiCaseId);
      patchIssue(issueIndex, { followUpQuestions: questions });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not regenerate questions');
    } finally {
      setRegeneratingIndex(null);
    }
  }

  async function skipQa(issueIndex: number) {
    const issue = issues[issueIndex];
    if (!issue?.aiCaseId) return;
    setSkipping(true);
    setError('');
    try {
      await client.skipVisitAiFollowUp(issue.aiCaseId);
      patchIssue(issueIndex, { qaSkipped: true, followUpQuestions: [] });
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

        const payload = issue.followUpQuestions
          .map((q) => ({
            id: isPersistedQuestionId(q.id) ? q.id : undefined,
            questionText: q.questionText.trim(),
            answer: q.answer?.trim(),
            answerType: q.answerType as VisitAiAnswerType,
          }))
          .filter((q) => q.questionText.length > 0);

        if (!payload.length) {
          setError('Add at least one question before saving.');
          return;
        }

        const synced = await client.syncVisitAiQuestions(issue.aiCaseId, payload);
        const answered = synced.filter((q) => q.answer?.trim());
        if (!answered.length) {
          setError('Answer at least one question before updating the diagnosis.');
          return;
        }

        const result = await client.reanalyzeVisitAiCase(issue.aiCaseId);
        let finalRecommendation = issue.finalRecommendation;
        let initialRecommendation = issue.initialRecommendation;
        try {
          const rec = await client.recommendVisitAiCase(issue.aiCaseId, result.finalDiagnosis);
          finalRecommendation = rec.text;
          initialRecommendation = {
            text: rec.text,
            dose: rec.dosage ?? undefined,
            method: rec.priority === 'critical' ? 'Spray (urgent)' : 'Spray',
            category: issue.category,
          };
        } catch {
          // keep prior recommendation if refresh fails
        }
        next[i] = {
          ...issue,
          followUpQuestions: synced,
          finalDiagnosis: result.finalDiagnosis,
          selectedHypothesisLabel: result.finalDiagnosis,
          confidenceAction: result.confidenceAction,
          finalRecommendation,
          initialRecommendation,
          photoRequests: derivePhotoRequestsFromFollowUp(synced),
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
        <Text style={styles.loadingText}>
          {screeningRunning ? 'Running initial AI screening…' : 'Loading follow-up questions…'}
        </Text>
        {screeningRunning ? (
          <Text style={styles.loadingHint}>
            Analyzing photos, soil, and 7-day weather — usually 30–90 seconds.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Answer AI questions to improve diagnosis confidence. Target is ≥85% before proceeding.
      </Text>
      {error ? (
        <View style={styles.errorBlock}>
          <AlertBox>{error}</AlertBox>
          <Pressable style={styles.retryBtn} onPress={() => void loadQuestions()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {issues.map((issue, issueIndex) => {
        const canSkip = issue.skipFollowUpOptional && !issue.qaSkipped;
        const regenerating = regeneratingIndex === issueIndex;
        const showQa = shouldRunFollowUp(issue, { issues, triage, partnerMode: false }) && !issue.qaSkipped;
        return (
          <Panel key={issue.localId} title={issue.finalDiagnosis ?? issue.issueName}>
            {issue.aiCaseId && confidenceByCase[issue.aiCaseId] ? (
              <View style={styles.confidenceBlock}>
                <Text style={styles.confidenceLabel}>
                  {formatConfidenceProgress(confidenceByCase[issue.aiCaseId]!).label}
                </Text>
                <Text style={styles.confidenceHint}>
                  {confidenceThresholdMessage(confidenceByCase[issue.aiCaseId]!) ??
                    `Unknown / uncertainty: ${confidenceByCase[issue.aiCaseId]!.unknownWeight}%`}
                </Text>
              </View>
            ) : null}
            {!showQa && !issue.qaSkipped ? (
              <Text style={styles.skippedNote}>Follow-up Q&A not required — continue to refined diagnosis.</Text>
            ) : null}
            {showQa && issue.confidenceAction === 'escalate' ? (
              <Text style={styles.escalationHint}>
                Low AI confidence — edit questions to match what you see in the field, then save answers to
                refine the diagnosis.
              </Text>
            ) : null}
            {showQa && !issue.qaSkipped ? (
              <Text style={styles.editHint}>
                Questions are AI-generated from photos and context. Edit wording, add your own, or regenerate
                if they do not match this case.
              </Text>
            ) : null}
            {showQa && canSkip ? (
              <Pressable
                style={styles.skipChip}
                onPress={() => void skipQa(issueIndex)}
                disabled={skipping}
              >
                <Text style={styles.skipChipText}>{skipping ? 'Skipping…' : 'Skip Q&A (high confidence)'}</Text>
              </Pressable>
            ) : null}
            {showQa && issue.qaSkipped ? (
              <Text style={styles.skippedNote}>Follow-up Q&A skipped — high confidence case.</Text>
            ) : null}
            {showQa
              ? (issue.followUpQuestions ?? []).map((q, qIndex) => (
              <View key={q.id} style={styles.questionBlock}>
                <Text style={styles.questionLabel}>Question {qIndex + 1}</Text>
                <TextField
                  label="Question text"
                  value={q.questionText}
                  onChangeText={(text) => setQuestionText(issueIndex, q.id, text)}
                  placeholder="Enter a field-specific follow-up question"
                  multiline
                />
                {q.answerType === 'text' || q.answerType === 'number' ? (
                  <TextField
                    label={q.answerType === 'number' ? 'Answer (number)' : 'Answer'}
                    value={q.answer ?? ''}
                    onChangeText={(text) => setAnswer(issueIndex, q.id, text)}
                    placeholder={q.answerType === 'number' ? 'e.g. 7' : 'Your answer'}
                    keyboardType={q.answerType === 'number' ? 'numeric' : 'default'}
                  />
                ) : (
                  <>
                    <Text style={styles.answerLabel}>Answer</Text>
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
                    <TextField
                      label="Or type answer"
                      value={q.answer && !ANSWER_CHIPS.includes(q.answer as (typeof ANSWER_CHIPS)[number]) ? q.answer : ''}
                      onChangeText={(text) => setAnswer(issueIndex, q.id, text)}
                      placeholder="Custom answer (optional)"
                    />
                  </>
                )}
                <Pressable style={styles.removeBtn} onPress={() => removeQuestion(issueIndex, q.id)}>
                  <Text style={styles.removeBtnText}>Remove question</Text>
                </Pressable>
              </View>
            ))
              : null}
            {showQa && !issue.qaSkipped ? (
              <View style={styles.qaActions}>
                <Pressable style={styles.secondaryBtn} onPress={() => addQuestion(issueIndex)}>
                  <Text style={styles.secondaryBtnText}>+ Add question</Text>
                </Pressable>
                {issue.aiCaseId ? (
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => void regenerateQuestions(issueIndex)}
                    disabled={regenerating}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {regenerating ? 'Regenerating…' : 'Regenerate from photos'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {showQa && !issue.qaSkipped && !issue.followUpQuestions?.length ? (
              <Text style={styles.muted}>No follow-up questions yet. Add one or regenerate from photos.</Text>
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
  intro: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { fontSize: 14, color: tokens.textMuted },
  loadingHint: { fontSize: 12, color: tokens.textMuted, textAlign: 'center', paddingHorizontal: 16 },
  errorBlock: { gap: 8 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.green700,
  },
  retryText: { fontSize: 14, fontWeight: '600', color: tokens.green700 },
  confidenceBlock: {
    marginBottom: 10,
    padding: 10,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.green500,
  },
  confidenceLabel: { fontSize: 14, fontWeight: '700', color: tokens.green800 },
  confidenceHint: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  hypothesisHint: { fontSize: 12, color: tokens.green800, marginBottom: 8, lineHeight: 17 },
  escalationHint: {
    fontSize: 13,
    color: '#a94442',
    backgroundColor: '#fdecea',
    padding: 10,
    borderRadius: tokens.radiusSm,
    marginBottom: 10,
  },
  editHint: {
    fontSize: 13,
    color: tokens.textMuted,
    marginBottom: 10,
    lineHeight: 18,
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
  questionBlock: { marginBottom: 16, gap: 8 },
  questionLabel: { fontSize: 12, fontWeight: '700', color: tokens.textMuted, textTransform: 'uppercase' },
  answerLabel: { fontSize: 13, fontWeight: '600', color: tokens.text },
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
  removeBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  removeBtnText: { fontSize: 12, color: '#b91c1c', fontWeight: '600' },
  qaActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  secondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.green700,
    backgroundColor: tokens.bg,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '600', color: tokens.green800 },
  muted: { fontSize: 13, color: tokens.textMuted },
  reanalyzeBtn: {
    backgroundColor: tokens.green700,
    borderRadius: tokens.radiusSm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reanalyzeText: { color: '#fff', fontWeight: '700' },
});
