import { useEffect, useState } from 'react';
import { agronomistClient, derivePhotoRequestsFromFollowUp, shouldRunFollowUp } from '@morbeez/shared';
import { Alert, Loading, Panel } from '../../ui';
import type { VisitIssueDraft } from './types';

const ANSWER_CHIPS = ['yes', 'no', 'unknown'] as const;

type Props = {
  issues: VisitIssueDraft[];
  onChange: (issues: VisitIssueDraft[]) => void;
};

export function VisitFollowUpStep({ issues, onChange }: Props) {
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
      await agronomistClient.skipVisitAiFollowUp(issue.aiCaseId);
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
        await agronomistClient.saveVisitAiAnswers(issue.aiCaseId, answers);
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
          finalDiagnosis: result.finalDiagnosis,
          selectedHypothesisLabel: result.finalDiagnosis,
          confidenceAction: result.confidenceAction,
          finalRecommendation,
          initialRecommendation,
          photoRequests: derivePhotoRequestsFromFollowUp(issue.followUpQuestions ?? []),
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

  return (
    <div className="vw-stack">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {issues.map((issue, issueIndex) => {
        const canSkip = issue.skipFollowUpOptional && !issue.qaSkipped;
        return (
          <Panel key={issue.localId} title={issue.finalDiagnosis ?? issue.issueName}>
            {issue.confidenceAction === 'escalate' ? (
              <div className="vw-banner vw-banner--danger">
                Low AI confidence — consider escalating if answers do not clarify the diagnosis.
              </div>
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
            {(issue.followUpQuestions ?? []).map((q) => (
              <div key={q.id} style={{ marginBottom: 14 }}>
                <p className="vw-field-label" style={{ marginTop: 0 }}>
                  {q.questionText}
                </p>
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
              </div>
            ))}
            {!issue.qaSkipped && !issue.followUpQuestions?.length ? (
              <p className="vw-hint">No follow-up questions for this issue.</p>
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
