import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  partnerClient,
  applyHypothesisSelection,
  applyManualDiagnosis,
  isManualDiagnosis,
  isProvisionalIssueName,
  manualDiagnosisDisplayValue,
  tokens,
  type VisitAiHypothesis,
} from '@morbeez/shared';
import { AlertBox, Panel, TextField } from '@morbeez/ui-native';
import type { IssueDraft } from '@agronomist/components/field-findings/IssueCard';
import type { VisitPhotoDraft } from '@agronomist/components/field-findings/wizard/types';

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
    return { text: 'High confidence — expert may skip follow-up Q&A.', tone: 'ok' };
  }
  if (action === 'employee_review') {
    return { text: 'Moderate confidence — complete follow-up Q&A when prompted.', tone: 'warn' };
  }
  if (action === 'escalate') {
    return { text: 'Low confidence — complete Q&A; expert review will follow.', tone: 'danger' };
  }
  return null;
}

export function PartnerVisitAiAnalysisStep({
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
        .slice(0, 12)
        .map((p) => ({ dataBase64: p.dataBase64, mimeType: p.mimeType, photoType: p.photoType }));

      const detected = await partnerClient.analyzeVisit({
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
          localId: String(row.localId ?? `ai-${idx}`),
          category: row.category as IssueDraft['category'],
          issueName: String(row.issueName ?? 'Field observation'),
          severity: (row.severity as IssueDraft['severity']) ?? 'medium',
          status: 'open',
          observation: String(row.observation ?? ''),
          photos: [],
          photosPreview: [],
          aiCaseId: row.aiCaseId ? String(row.aiCaseId) : undefined,
          hypotheses: row.hypotheses as IssueDraft['hypotheses'],
          selectedHypothesisLabel: row.selectedHypothesisLabel
            ? String(row.selectedHypothesisLabel)
            : undefined,
          finalDiagnosis: row.finalDiagnosis ? String(row.finalDiagnosis) : undefined,
          finalRecommendation: row.finalRecommendation ? String(row.finalRecommendation) : undefined,
          confidenceAction: row.confidenceAction ? String(row.confidenceAction) : undefined,
          skipFollowUpOptional: Boolean(row.skipFollowUpOptional),
          imageSignal: row.imageSignal as IssueDraft['imageSignal'],
          similarCases: row.similarCases as IssueDraft['similarCases'],
          rootCause: row.rootCause as IssueDraft['rootCause'],
          evidence: row.evidence as IssueDraft['evidence'],
          initialRecommendation: row.initialRecommendation as IssueDraft['initialRecommendation'],
        })) as IssueDraft[]
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
      <View style={styles.center}>
        <ActivityIndicator color={tokens.green700} />
        <Text style={styles.loadingText}>Running AI analysis…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        AI detects issues from photos and field data. Confirm or correct on the next step.
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
              <View
                style={[
                  styles.banner,
                  banner.tone === 'ok' && styles.bannerOk,
                  banner.tone === 'warn' && styles.bannerWarn,
                  banner.tone === 'danger' && styles.bannerDanger,
                ]}
              >
                <Text style={styles.bannerText}>{banner.text}</Text>
              </View>
            ) : null}
            {issue.rootCause?.conclusion ? (
              <Text style={styles.rationale}>Root cause: {issue.rootCause.conclusion}</Text>
            ) : null}
            {issue.initialRecommendation ? (
              <Text style={styles.rec}>
                Draft rec: {issue.initialRecommendation.text}
                {issue.initialRecommendation.dose ? ` · ${issue.initialRecommendation.dose}` : ''}
              </Text>
            ) : null}
            {(issue.hypotheses ?? []).map((h) => {
              const manualActive = isManualDiagnosis(issue.finalDiagnosis, issue.hypotheses);
              const selected =
                !manualActive &&
                (h.selected || h.label === issue.finalDiagnosis || h.label === issue.selectedHypothesisLabel);
              return (
                <Pressable
                  key={h.label}
                  style={[styles.hypothesis, selected && styles.hypothesisSelected]}
                  onPress={() => selectHypothesis(issueIndex, h)}
                >
                  <Text style={styles.hypothesisLabel}>{h.label}</Text>
                  {h.rationale ? <Text style={styles.rationale}>{h.rationale}</Text> : null}
                </Pressable>
              );
            })}
            <TextField
              label="Manual diagnosis"
              value={manualDiagnosisDisplayValue(issue)}
              onChangeText={(text) => setManualDiagnosis(issueIndex, text)}
              placeholder="Type diagnosis if AI is wrong"
            />
          </Panel>
        );
      })}
      <Pressable onPress={() => void runAnalysis()}>
        <Text style={styles.retry}>Retry analysis</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  intro: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { color: tokens.textMuted },
  banner: { borderRadius: tokens.radiusSm, padding: 10, marginBottom: 10 },
  bannerOk: { backgroundColor: tokens.green100, borderWidth: 1, borderColor: tokens.green700 },
  bannerWarn: { backgroundColor: '#fff8e6', borderWidth: 1, borderColor: '#d4a017' },
  bannerDanger: { backgroundColor: '#fdecea', borderWidth: 1, borderColor: '#c0392b' },
  bannerText: { fontSize: 13, color: tokens.text },
  rationale: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  rec: { fontSize: 13, color: tokens.green800, marginBottom: 8 },
  hypothesis: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 12,
    marginBottom: 8,
    backgroundColor: tokens.bg,
  },
  hypothesisSelected: { borderColor: tokens.green700, backgroundColor: tokens.green100 },
  hypothesisLabel: { fontSize: 15, fontWeight: '700', color: tokens.text },
  retry: { textAlign: 'center', color: tokens.green700, fontWeight: '600', paddingVertical: 8 },
});
