import { useEffect, useState } from 'react';
import {
  agronomistClient,
  derivePhotoRequestsFromFollowUp,
  issueTopConfidence,
  shouldRunFollowUp,
  type VisitAiQuestion,
} from '@morbeez/shared';
import { Alert, Loading, Panel } from '../../ui';
import type { VisitIssueDraft } from './types';

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
  issues: VisitIssueDraft[];
  onChange: (issues: VisitIssueDraft[]) => void;
};

export function VisitFollowUpStep({ issues, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
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
        const questions = await agronomistClient.getVisitAiQuestions(issue.aiCaseId);
        next[i] = { ...issue, followUpQuestions: questions };
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load questions');
    } finally {
      setLoading(false);
    }
  }

  function patchIssue(issueIndex: number, patch: Partial<VisitIssueDraft>) {
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
      const questions = await agronomistClient.regenerateVisitAiQuestions(issue.aiCaseId);
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
      await agronomistClient.skipVisitAiFollowUp(issue.aiCaseId);
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
            answerType: q.answerType,
          }))
          .filter((q) => q.questionText.length > 0);

        if (!payload.length) {
          setError('Add at least one question before saving.');
          return;
        }

        const synced = await agronomistClient.syncVisitAiQuestions(issue.aiCaseId, payload);
        const answered = synced.filter((q) => q.answer?.trim());
        if (!answered.length) {
          setError('Answer at least one question before updating the diagnosis.');
          return;
        }

        const result = await agronomistClient.reanalyzeVisitAiCase(issue.aiCaseId);
        let finalRecommendation = issue.finalRecommendation;
        let initialRecommendation = issue.initialRecommendation;
        try {
          const rec = await agronomistClient.recommendVisitAiCase(issue.aiCaseId, result.finalDiagnosis);
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
          hypotheses: result.hypotheses.map((h) => ({
            label: h.label,
            confidence: h.confidence,
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
      <div className="vw-loading-center">
        <Loading label="Loading follow-up questions…" />
      </div>
    );
  }

  const gateConfidence = issues.length
    ? Math.min(...issues.map((i) => issueTopConfidence(i)))
    : 1;
  const gateTone =
    gateConfidence >= 0.85 ? 'ok' : gateConfidence >= 0.65 ? 'warn' : 'danger';
  const gateMessage =
    gateTone === 'ok'
      ? 'Confidence high — validate key answers and continue.'
      : gateTone === 'warn'
        ? 'Confidence moderate — confirm answers before final diagnosis.'
        : 'Confidence low — add evidence or escalate after Q&A.';

  return (
    <div className="vw-stack">
      <div
        className={[
          'vw-confidence-gate',
          gateTone === 'ok' ? 'vw-confidence-gate--ok' : '',
          gateTone === 'warn' ? 'vw-confidence-gate--warn' : '',
          gateTone === 'danger' ? 'vw-confidence-gate--danger' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <strong>Confidence gate</strong> · {Math.round(gateConfidence * 100)}% — {gateMessage}
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {issues.map((issue, issueIndex) => {
        const canSkip = issue.skipFollowUpOptional && !issue.qaSkipped;
        const regenerating = regeneratingIndex === issueIndex;
        return (
          <Panel key={issue.localId} title={issue.finalDiagnosis ?? issue.issueName}>
            {issue.confidenceAction === 'escalate' ? (
              <div className="vw-banner vw-banner--danger">
                Low AI confidence — edit questions to match what you see in the field, then save answers to
                refine the diagnosis.
              </div>
            ) : null}
            {!issue.qaSkipped ? (
              <p className="vw-hint" style={{ marginBottom: 12 }}>
                Questions are AI-generated from photos and context. Edit wording, add your own, or regenerate if
                they do not match this case.
              </p>
            ) : null}
            {canSkip ? (
              <button
                type="button"
                className="vw-chip vw-chip--active"
                onClick={() => void skipQa(issueIndex)}
                disabled={skipping}
              >
                {skipping ? 'Skipping…' : 'Skip Q&A (high confidence)'}
              </button>
            ) : null}
            {issue.qaSkipped ? (
              <p className="vw-hint" style={{ fontStyle: 'italic' }}>
                Follow-up Q&A skipped — high confidence case.
              </p>
            ) : null}
            {(issue.followUpQuestions ?? []).map((q, qIndex) => (
              <div key={q.id} className="vw-qa-block">
                <span className="vw-qa-label">Question {qIndex + 1}</span>
                <textarea
                  className="vw-textarea"
                  rows={2}
                  value={q.questionText}
                  onChange={(e) => setQuestionText(issueIndex, q.id, e.target.value)}
                  placeholder="Enter a field-specific follow-up question"
                />
                {q.answerType === 'text' || q.answerType === 'number' ? (
                  <input
                    className="vw-qa-input"
                    type={q.answerType === 'number' ? 'number' : 'text'}
                    value={q.answer ?? ''}
                    onChange={(e) => setAnswer(issueIndex, q.id, e.target.value)}
                    placeholder={q.answerType === 'number' ? 'e.g. 7' : 'Your answer'}
                  />
                ) : (
                  <>
                    <span className="vw-field-label" style={{ marginTop: 8 }}>
                      Answer
                    </span>
                    <div className="vw-chip-row">
                      {ANSWER_CHIPS.map((chip) => {
                        const active = q.answer === chip;
                        return (
                          <button
                            key={chip}
                            type="button"
                            className={['vw-chip', active ? 'vw-chip--active' : ''].filter(Boolean).join(' ')}
                            onClick={() => setAnswer(issueIndex, q.id, chip)}
                          >
                            {chip.charAt(0).toUpperCase() + chip.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      className="vw-qa-input"
                      type="text"
                      value={
                        q.answer && !ANSWER_CHIPS.includes(q.answer as (typeof ANSWER_CHIPS)[number])
                          ? q.answer
                          : ''
                      }
                      onChange={(e) => setAnswer(issueIndex, q.id, e.target.value)}
                      placeholder="Or type a custom answer"
                    />
                  </>
                )}
                <button
                  type="button"
                  className="vw-qa-remove"
                  onClick={() => removeQuestion(issueIndex, q.id)}
                >
                  Remove question
                </button>
              </div>
            ))}
            {!issue.qaSkipped ? (
              <div className="vw-qa-actions">
                <button type="button" className="vw-qa-secondary" onClick={() => addQuestion(issueIndex)}>
                  + Add question
                </button>
                {issue.aiCaseId ? (
                  <button
                    type="button"
                    className="vw-qa-secondary"
                    onClick={() => void regenerateQuestions(issueIndex)}
                    disabled={regenerating}
                  >
                    {regenerating ? 'Regenerating…' : 'Regenerate from photos'}
                  </button>
                ) : null}
              </div>
            ) : null}
            {!issue.qaSkipped && !issue.followUpQuestions?.length ? (
              <p className="vw-hint">No follow-up questions yet. Add one or regenerate from photos.</p>
            ) : null}
          </Panel>
        );
      })}
      <button
        type="button"
        className="vw-reanalyze-btn"
        onClick={() => void saveAndReanalyze()}
        disabled={reanalyzing}
      >
        {reanalyzing ? 'Updating diagnosis…' : 'Save answers & update diagnosis'}
      </button>
    </div>
  );
}
