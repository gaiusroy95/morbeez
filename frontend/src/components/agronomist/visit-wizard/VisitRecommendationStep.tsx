import { useEffect, useState } from 'react';
import { agronomistClient, type RecommendationPriority } from '@morbeez/shared';
import { Alert, Btn, Loading, Panel, textareaClass } from '../../ui';
import type { VisitIssueDraft } from './types';

const REVIEW_DAY_OPTIONS = [3, 7, 15, 30] as const;

type Props = {
  issues: VisitIssueDraft[];
  onChange: (issues: VisitIssueDraft[]) => void;
};

function parseCustomDays(raw: string): number | null {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 1 || n > 365) return null;
  return Math.round(n);
}

export function VisitRecommendationStep({ issues, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customDays, setCustomDays] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRecommendations() {
    setLoading(true);
    setError('');
    try {
      const next = [...issues];
      for (let i = 0; i < next.length; i++) {
        const issue = next[i]!;
        if (!issue.aiCaseId || issue.finalRecommendation?.trim()) continue;
        const rec = await agronomistClient.recommendVisitAiCase(
          issue.aiCaseId,
          issue.finalDiagnosis ?? issue.selectedHypothesisLabel
        );
        next[i] = {
          ...issue,
          finalRecommendation: rec.text,
          aiDosage: rec.dosage ?? undefined,
          aiPriority: rec.priority as RecommendationPriority,
          reviewAfterDays: rec.reviewAfterDays,
        };
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate recommendation');
    } finally {
      setLoading(false);
    }
  }

  function patchIssue(index: number, patch: Partial<VisitIssueDraft>) {
    const next = [...issues];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  }

  function applyCustomDays(index: number, localId: string) {
    const days = parseCustomDays(customDays[localId] ?? '');
    if (days == null) {
      setError('Custom review days must be between 1 and 365.');
      return;
    }
    setError('');
    patchIssue(index, { reviewAfterDays: days });
  }

  if (loading) {
    return (
      <div className="vw-loading-center">
        <Loading label="Drafting AI recommendation…" />
      </div>
    );
  }

  return (
    <div className="vw-stack">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {issues.map((issue, index) => {
        const presetActive = (REVIEW_DAY_OPTIONS as readonly number[]).includes(issue.reviewAfterDays ?? 7);
        return (
          <Panel key={issue.localId} title={issue.finalDiagnosis ?? issue.issueName}>
            <span className="vw-field-label">Recommendation (editable draft)</span>
            <textarea
              className={textareaClass}
              value={issue.finalRecommendation ?? ''}
              onChange={(e) => patchIssue(index, { finalRecommendation: e.target.value })}
              placeholder="AI recommendation draft"
            />
            {issue.aiDosage ? <p className="vw-hint">Dosage: {issue.aiDosage}</p> : null}
            <span className="vw-field-label">Review after (days)</span>
            <div className="vw-chip-row">
              {REVIEW_DAY_OPTIONS.map((days) => {
                const active = (issue.reviewAfterDays ?? 7) === days;
                return (
                  <button
                    key={days}
                    type="button"
                    className={['vw-chip', active ? 'vw-chip--active' : ''].filter(Boolean).join(' ')}
                    onClick={() => patchIssue(index, { reviewAfterDays: days })}
                  >
                    {days}d
                  </button>
                );
              })}
            </div>
            <div className="vw-custom-days-row">
              <input
                type="number"
                min={1}
                max={365}
                className="vw-custom-days-input"
                placeholder="Custom days"
                value={customDays[issue.localId] ?? (!presetActive ? String(issue.reviewAfterDays ?? '') : '')}
                onChange={(e) => setCustomDays((prev) => ({ ...prev, [issue.localId]: e.target.value }))}
              />
              <Btn variant="primary" size="sm" onClick={() => applyCustomDays(index, issue.localId)}>
                Set
              </Btn>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
