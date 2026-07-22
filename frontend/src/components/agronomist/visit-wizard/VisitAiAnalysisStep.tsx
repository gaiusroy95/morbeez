import { useEffect, useState } from 'react';
import {
  agronomistClient,
  applyHypothesisSelection,
  applyManualDiagnosis,
  ensureIssuesForAiStep,
  isManualDiagnosis,
  isProvisionalIssueName,
  manualDiagnosisDisplayValue,
  seedIssueFromAnalysis,
  type BlockHealthLevel,
  type CropPerformanceLevel,
  type MeasurementTemplate,
  type SoilMoistureLevel,
  type VisitAiHypothesis,
} from '@morbeez/shared';
import { Alert, Field, Input, Loading } from '../../ui';
import { Panel } from '../../ui';
import { VisitCopilotWorkflowChat } from '../visit-copilot/VisitCopilotWorkflowChat';
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
    return { text: 'High confidence — field signs align with refined diagnosis.', tone: 'ok' };
  }
  if (action === 'employee_review') {
    return { text: 'Moderate confidence — confirm refined diagnosis matches field signs.', tone: 'warn' };
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
    if (issues.length && issues.every((i) => i.aiCaseId)) return;
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

      const analyzePhotos = visitPhotos
        .filter((p) => p.dataBase64?.length > 100)
        .slice(0, 4)
        .map((p) => ({ dataBase64: p.dataBase64, mimeType: p.mimeType, photoType: p.photoType }));

      const { issues: detected, insufficientEvidence } = await agronomistClient.analyzeVisit({
        farmerId,
        blockId,
        sessionId: sessionId ?? undefined,
        fieldVoiceNote,
        blockAssessment,
        measurements: measurementRows,
        latitude: gpsLat ?? undefined,
        longitude: gpsLon ?? undefined,
        analyzePhotos: analyzePhotos.length ? analyzePhotos : undefined,
      });

      onChange(
        detected.map((row, idx) => ({
          localId: row.localId ?? `ai-${idx}`,
          category: row.category,
          issueName: row.issueName,
          severity: row.severity ?? row.aiSeverity ?? 'medium',
          observation: row.observation ?? '',
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
        })) as VisitIssueDraft[]
      );
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
    next[issueIndex] = applyHypothesisSelection(issue, hypothesis.label);
    onChange(next);
  }

  function setManualDiagnosis(issueIndex: number, text: string) {
    const next = [...issues];
    const issue = next[issueIndex];
    if (!issue) return;
    next[issueIndex] = applyManualDiagnosis(issue, text);
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
      <p className="vw-hint">
        AI analyzes photos and field data first. On the next step you can correct the detected issue or add a manual entry.
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {issues.map((issue, issueIndex) => {
        const banner = confidenceBanner(issue.confidenceAction);
        const panelTitle = isProvisionalIssueName(issue.issueName)
          ? issue.finalDiagnosis || `Issue ${issueIndex + 1}`
          : issue.issueName || `Issue ${issueIndex + 1}`;
        return (
          <Panel key={issue.localId} title={panelTitle}>
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
              const manualActive = isManualDiagnosis(issue.finalDiagnosis, issue.hypotheses);
              const selected =
                !manualActive && (h.selected || h.label === issue.finalDiagnosis || h.label === issue.selectedHypothesisLabel);
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
              <p className="vw-hint">No hypotheses yet. Tap retry below or enter diagnosis manually.</p>
            ) : null}
            <div className="vw-field-label" style={{ marginTop: 12 }}>
              Or enter diagnosis manually
            </div>
            <Field label="Manual diagnosis">
              <Input
                value={manualDiagnosisDisplayValue(issue)}
                onChange={(e) => setManualDiagnosis(issueIndex, e.target.value)}
                placeholder="Type the correct diagnosis if AI is wrong"
              />
            </Field>
          </Panel>
        );
      })}
      <button type="button" className="vw-retry-link" onClick={() => void runAnalysis()}>
        Retry analysis
      </button>
      <VisitCopilotWorkflowChat farmerId={farmerId} blockId={blockId} />
    </div>
  );
}
