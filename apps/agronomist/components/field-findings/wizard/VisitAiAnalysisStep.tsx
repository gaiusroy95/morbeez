import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  agronomistClient,
  applyHypothesisSelection,
  applyManualDiagnosis,
  expandSeparateNutrientIssues,
  formatFetchError,
  getApiOrigin,
  isManualDiagnosis,
  isProvisionalIssueName,
  manualDiagnosisDisplayValue,
  tokens,
  withTimeout,
  type VisitAiHypothesis,
} from '@morbeez/shared';
import { AlertBox, Panel, TextField } from '@morbeez/ui-native';
import { VisitCopilotPanel } from '@/components/VisitCopilotPanel';
import type { IssueDraft } from '../IssueCard';
import type { VisitPhotoDraft } from './types';
import { ensureVisitPhotoBase64 } from '@/lib/prefillVisitPhotos';

const ANALYSIS_TIMEOUT_MS = 120_000;
const HEALTH_TIMEOUT_MS = 8_000;

type Props = {
  farmerId: string;
  blockId: string;
  sessionId: string | null;
  cropType: string;
  issues: IssueDraft[];
  visitPhotos: VisitPhotoDraft[];
  fieldVoiceNote?: string;
  blockAssessment?: {
    blockHealth: import('@morbeez/shared').BlockHealthLevel;
    cropPerformance: import('@morbeez/shared').CropPerformanceLevel;
    soilMoisture: import('@morbeez/shared').SoilMoistureLevel;
  };
  measurements: Record<string, string>;
  templates: Array<{ measurementKey: string; unit?: string | null }>;
  gpsLat: number | null;
  gpsLon: number | null;
  onChange: (issues: IssueDraft[]) => void;
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

export function VisitAiAnalysisStep({
  farmerId,
  blockId,
  sessionId,
  cropType,
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
  const [loading, setLoading] = useState(
    () => !(issues.length && issues.every((i) => i.aiCaseId))
  );
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
      const origin = getApiOrigin();
      if (!origin) {
        throw new Error(
          'API URL is not configured. Set EXPO_PUBLIC_API_BASE_URL in apps/agronomist/.env or rebuild the app.'
        );
      }

      // Wake Render / verify DNS before sending large photo payload
      try {
        await withTimeout(
          fetch(`${origin}/health`, { method: 'GET' }),
          HEALTH_TIMEOUT_MS,
          'API health check timed out — server may be waking up. Tap Retry.'
        ).then((health) => {
          if (!health.ok) throw new Error(`API health check failed (${health.status})`);
        });
      } catch (pingErr) {
        throw formatFetchError(pingErr, origin);
      }

      const measurementRows = templates
        .map((tpl) => ({
          key: tpl.measurementKey,
          value: measurements[tpl.measurementKey]?.trim() ?? '',
          unit: tpl.unit ?? undefined,
        }))
        .filter((m) => m.value);

      const photosWithData = await ensureVisitPhotoBase64(visitPhotos);
      const analyzePhotos = photosWithData
        .filter((p) => p.dataBase64?.length > 100)
        .slice(0, 4)
        .map((p) => ({ dataBase64: p.dataBase64, mimeType: p.mimeType, photoType: p.photoType }));

      const { issues: detected, insufficientEvidence } = await withTimeout(
        agronomistClient.analyzeVisit({
          farmerId,
          blockId,
          sessionId: sessionId ?? undefined,
          fieldVoiceNote,
          blockAssessment,
          measurements: measurementRows,
          latitude: gpsLat ?? undefined,
          longitude: gpsLon ?? undefined,
          analyzePhotos: analyzePhotos.length ? analyzePhotos : undefined,
        }),
        ANALYSIS_TIMEOUT_MS,
        'AI analysis timed out — check network or tap Retry. Large photo uploads can take up to 2 minutes.'
      );

      if (insufficientEvidence && !detected.length) {
        setError('AI could not produce an evidence-backed diagnosis. Escalate to senior agronomist.');
        return;
      }

      onChange(
        expandSeparateNutrientIssues(
          detected.map((row, idx) => ({
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
          })) as IssueDraft[]
        )
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : formatFetchError(e, getApiOrigin()).message
      );
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
      <View style={styles.center}>
        <ActivityIndicator color={tokens.green700} />
        <Text style={styles.loadingText}>Running AI analysis…</Text>
        <Text style={styles.loadingHint}>Uploading photos and running vision — may take 1–2 minutes.</Text>
      </View>
    );
  }

  if (error && !issues.length) {
    return (
      <View style={styles.root}>
        <AlertBox>{error}</AlertBox>
        <Pressable onPress={() => void runAnalysis()}>
          <Text style={styles.retry}>Retry analysis</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Review refined AI diagnosis after Q&A. Confirm the top hypothesis or enter a manual diagnosis.
      </Text>
      {error ? <AlertBox>{error}</AlertBox> : null}
      {issues.map((issue, issueIndex) => {
        const banner = confidenceBanner(issue.confidenceAction);
        const panelTitle = isProvisionalIssueName(issue.issueName)
          ? issue.finalDiagnosis || `Issue ${issueIndex + 1}`
          : issue.issueName;
        return (
          <Panel key={issue.localId} title={panelTitle}>
            {banner ? (
              <View style={[styles.banner, banner.tone === 'danger' && styles.bannerDanger]}>
                <Text style={styles.bannerText}>{banner.text}</Text>
              </View>
            ) : null}
            {issue.aiConfidence != null ? (
              <Text style={styles.conf}>Confidence: {Math.round(issue.aiConfidence * 100)}%</Text>
            ) : null}
            {issue.rootCause?.conclusion ? (
              <Text style={styles.rationale}>Root cause: {issue.rootCause.conclusion}</Text>
            ) : null}
            {issue.initialRecommendation ? (
              <Text style={styles.rec}>
                Initial rec: {issue.initialRecommendation.text}
                {issue.initialRecommendation.dose ? ` · ${issue.initialRecommendation.dose}` : ''}
              </Text>
            ) : null}
            {(issue.hypotheses ?? []).map((h) => {
              const manualActive = isManualDiagnosis(issue.finalDiagnosis, issue.hypotheses);
              const selected =
                !manualActive && (h.selected || h.label === issue.finalDiagnosis || h.label === issue.selectedHypothesisLabel);
              return (
                <Pressable
                  key={h.label}
                  style={[styles.hypothesis, selected && styles.hypothesisSelected]}
                  onPress={() => selectHypothesis(issueIndex, h)}
                >
                  <Text style={styles.hypothesisLabel}>{h.label}</Text>
                  <Text style={styles.hypothesisConf}>{Math.round(h.confidence * 100)}%</Text>
                </Pressable>
              );
            })}
            <TextField
              label="Manual diagnosis"
              value={manualDiagnosisDisplayValue(issue)}
              onChangeText={(text) => setManualDiagnosis(issueIndex, text)}
              placeholder="Override if AI is wrong"
            />
          </Panel>
        );
      })}
      <Pressable onPress={() => void runAnalysis()}>
        <Text style={styles.retry}>Retry analysis</Text>
      </Pressable>
      <VisitCopilotPanel
        farmerId={farmerId}
        blockId={blockId}
        cropType={cropType}
        issueName={issues[0]?.finalDiagnosis ?? issues[0]?.issueName}
        aiCaseId={issues[0]?.aiCaseId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  intro: { fontSize: 13, color: tokens.textMuted },
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { color: tokens.textMuted, fontSize: 14 },
  loadingHint: { color: tokens.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: 16 },
  banner: { borderRadius: tokens.radiusSm, padding: 10, marginBottom: 10, backgroundColor: '#fff8e6' },
  bannerDanger: { backgroundColor: '#fdecea' },
  bannerText: { fontSize: 13 },
  conf: { fontSize: 13, fontWeight: '600', color: tokens.green800, marginBottom: 6 },
  rationale: { fontSize: 12, color: tokens.textMuted, marginBottom: 6 },
  rec: { fontSize: 12, color: tokens.text, marginBottom: 8 },
  hypothesis: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 12,
    marginBottom: 8,
  },
  hypothesisSelected: { borderColor: tokens.green700, backgroundColor: tokens.green100 },
  hypothesisLabel: { fontSize: 15, fontWeight: '700' },
  hypothesisConf: { fontSize: 13, color: tokens.green800, marginTop: 4 },
  retry: { textAlign: 'center', color: tokens.green700, fontWeight: '600', paddingVertical: 8 },
});
