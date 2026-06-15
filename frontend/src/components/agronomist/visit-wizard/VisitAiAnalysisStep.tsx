import { useEffect, useState } from 'react';
import {
  agronomistClient,
  type BlockHealthLevel,
  type CropPerformanceLevel,
  type MeasurementTemplate,
  type SoilMoistureLevel,
  type VisitAiHypothesis,
} from '@morbeez/shared';
import { Alert, Loading } from '../../ui';
import { Panel } from '../../ui';
import type { VisitIssueDraft, VisitPhotoDraft } from './types';

type Props = {
  farmerId: string;
  blockId: string;
  sessionId: string | null;
  cropType: string;
  issues: VisitIssueDraft[];
  visitPhotos: VisitPhotoDraft[];
  fieldVoiceNote?: string;
  blockAssessment?: {
    blockHealth: BlockHealthLevel;
    cropPerformance: CropPerformanceLevel;
    soilMoisture: SoilMoistureLevel;
  };
  measurements: Record<string, string>;
  templates: MeasurementTemplate[];
  gpsLat: number | null;
  gpsLon: number | null;
  onChange: (issues: VisitIssueDraft[]) => void;
};

function confidenceBanner(action?: string): { text: string; tone: 'ok' | 'warn' | 'danger' } | null {
  if (action === 'auto_send') {
    return { text: 'High confidence — you may skip follow-up Q&A if field signs match.', tone: 'ok' };
  }
  if (action === 'employee_review') {
    return { text: 'Moderate confidence — complete follow-up Q&A before finalizing.', tone: 'warn' };
  }
  if (action === 'escalate') {
    return { text: 'Low confidence — expert review recommended; complete Q&A if possible.', tone: 'danger' };
  }
  return null;
}

function outcomeBadge(outcome?: string | null): string | null {
  if (!outcome) return null;
  const map: Record<string, string> = {
    better: 'Improved',
    improved: 'Improved',
    partial: 'Partial',
    no_improvement: 'No change',
    worsened: 'Worse',
    worse: 'Worse',
  };
  return map[outcome.toLowerCase()] ?? outcome;
}

function collectAnalyzePhotos(issue: VisitIssueDraft, visitPhotos: VisitPhotoDraft[]) {
  const fromIssue = (issue.photos ?? [])
    .filter((p) => p.dataBase64?.length > 100)
    .slice(0, 4)
    .map((p) => ({ dataBase64: p.dataBase64, mimeType: p.mimeType }));
  const fromVisit = visitPhotos
    .filter((p) => p.dataBase64?.length > 100)
    .slice(0, 2)
    .map((p) => ({ dataBase64: p.dataBase64, mimeType: p.mimeType }));
  return [...fromIssue, ...fromVisit].slice(0, 4);
}

export function VisitAiAnalysisStep({
  farmerId,
  blockId,
  sessionId,
  issues,
  visitPhotos,
  fieldVoiceNote,
  blockAssessment,
  measurements,
  templates,
  gpsLat,
  gpsLon,
  onChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!issues.length || issues.every((i) => i.aiCaseId)) return;
    void runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAnalysis() {
    setLoading(true);
    setError('');
    try {
      const measurementRows = templates
        .map((tpl) => ({
          key: tpl.measurementKey,
          value: measurements[tpl.measurementKey]?.trim() ?? '',
          unit: tpl.unit ?? undefined,
        }))
        .filter((m) => m.value);

      const next = [...issues];
      for (let i = 0; i < next.length; i++) {
        const issue = next[i]!;
        if (issue.aiCaseId) continue;
        const analyzePhotos = collectAnalyzePhotos(issue, visitPhotos);
        const result = await agronomistClient.analyzeVisitIssue({
          farmerId,
          blockId,
          sessionId: sessionId ?? undefined,
          issueCategory: issue.category,
          issueName: issue.issueName,
          observation: [issue.observation, fieldVoiceNote?.trim()].filter(Boolean).join(' '),
          blockAssessment,
          measurements: measurementRows,
          latitude: gpsLat ?? undefined,
          longitude: gpsLon ?? undefined,
          analyzePhotos: analyzePhotos.length ? analyzePhotos : undefined,
        });
        next[i] = {
          ...issue,
          aiCaseId: result.aiCaseId,
          hypotheses: result.hypotheses,
          selectedHypothesisLabel: result.hypotheses.find((h) => h.selected)?.label ?? result.hypotheses[0]?.label,
          finalDiagnosis: result.hypotheses.find((h) => h.selected)?.label ?? result.hypotheses[0]?.label,
          similarCases: result.similarCases,
          confidenceAction: result.confidenceAction,
          skipFollowUpOptional: result.skipFollowUpOptional,
          imageSignal: result.imageSignal ?? undefined,
        };
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI analysis failed');
    } finally {
      setLoading(false);
    }
  }

  function selectHypothesis(issueIndex: number, hypothesis: VisitAiHypothesis) {
    const next = [...issues];
    const issue = next[issueIndex];
    if (!issue) return;
    next[issueIndex] = {
      ...issue,
      selectedHypothesisLabel: hypothesis.label,
      finalDiagnosis: hypothesis.label,
      hypotheses: (issue.hypotheses ?? []).map((h) => ({
        ...h,
        selected: h.label === hypothesis.label,
      })),
    };
    onChange(next);
  }

  if (loading) {
    return (
      <div className="vw-loading-center">
        <Loading label="Running AI analysis…" />
      </div>
    );
  }

  return (
    <div className="vw-stack">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {issues.map((issue, issueIndex) => {
        const banner = confidenceBanner(issue.confidenceAction);
        return (
          <Panel key={issue.localId} title={issue.issueName || `Issue ${issueIndex + 1}`}>
            {banner ? (
              <div className={`vw-banner vw-banner--${banner.tone === 'ok' ? 'ok' : banner.tone === 'warn' ? 'warn' : 'danger'}`}>
                {banner.text}
              </div>
            ) : null}
            {issue.imageSignal ? (
              <p className="vw-hint" style={{ fontWeight: 600, color: '#166534' }}>
                Image analysis: {issue.imageSignal.label} ({Math.round(issue.imageSignal.confidence * 100)}%)
              </p>
            ) : null}
            {(issue.similarCases?.length ?? 0) > 0 ? (
              <div style={{ marginBottom: 8 }}>
                <div className="vw-field-label" style={{ marginTop: 0 }}>
                  Similar cases
                </div>
                {issue.similarCases!.slice(0, 3).map((c) => {
                  const badge = outcomeBadge(c.outcome);
                  return (
                    <p key={c.issueLabel} className="vw-hint">
                      {c.issueLabel}
                      {badge ? ` · ${badge}` : ''}
                    </p>
                  );
                })}
              </div>
            ) : null}
            {(issue.hypotheses ?? []).map((h) => {
              const selected = h.selected || h.label === issue.selectedHypothesisLabel;
              return (
                <button
                  key={h.label}
                  type="button"
                  className={['vw-hypothesis', selected ? 'vw-hypothesis--selected' : ''].filter(Boolean).join(' ')}
                  onClick={() => selectHypothesis(issueIndex, h)}
                >
                  <div className="vw-hypothesis-label">{h.label}</div>
                  <div className="vw-hypothesis-conf">{Math.round(h.confidence * 100)}%</div>
                  {h.imageConfidence != null ? (
                    <div className="vw-hint">Image: {Math.round(h.imageConfidence * 100)}%</div>
                  ) : null}
                  {h.rationale ? <div className="vw-hypothesis-rationale">{h.rationale}</div> : null}
                </button>
              );
            })}
            {!issue.hypotheses?.length ? (
              <p className="vw-hint">No hypotheses yet. Tap retry below.</p>
            ) : null}
          </Panel>
        );
      })}
      <button type="button" className="vw-retry-link" onClick={() => void runAnalysis()}>
        Retry analysis
      </button>
    </div>
  );
}
