import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  partnerClient,
  applyHypothesisSelection,
  applyManualDiagnosis,
  isManualDiagnosis,
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

function collectAnalyzePhotos(issue: IssueDraft, visitPhotos: VisitPhotoDraft[]) {
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

export function PartnerVisitAiAnalysisStep({
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
        const result = (await partnerClient.analyzeVisitIssue({
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
        })) as {
          aiCaseId?: string;
          hypotheses?: VisitAiHypothesis[];
          similarCases?: IssueDraft['similarCases'];
          confidenceAction?: string;
          skipFollowUpOptional?: boolean;
          imageSignal?: string;
        };
        const hyps = result.hypotheses ?? [];
        const top = hyps.find((h) => h.selected) ?? hyps[0];
        next[i] = {
          ...issue,
          aiCaseId: result.aiCaseId,
          hypotheses: hyps,
          selectedHypothesisLabel: top?.label,
          finalDiagnosis: top?.label,
          similarCases: result.similarCases,
          confidenceAction: result.confidenceAction,
          skipFollowUpOptional: result.skipFollowUpOptional,
          imageSignal:
            typeof result.imageSignal === 'object' && result.imageSignal
              ? result.imageSignal
              : undefined,
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
      {error ? <AlertBox>{error}</AlertBox> : null}
      {issues.map((issue, issueIndex) => {
        const banner = confidenceBanner(issue.confidenceAction);
        return (
          <Panel key={issue.localId} title={issue.issueName || `Issue ${issueIndex + 1}`}>
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
            {issue.imageSignal ? (
              <Text style={styles.imageSignal}>
                Image analysis: {issue.imageSignal.label} ({Math.round(issue.imageSignal.confidence * 100)}%)
              </Text>
            ) : null}
            {(issue.similarCases?.length ?? 0) > 0 ? (
              <View style={styles.similarBlock}>
                <Text style={styles.similarLabel}>Similar cases</Text>
                {issue.similarCases!.slice(0, 3).map((c) => {
                  const badge = outcomeBadge(c.outcome);
                  return (
                    <Text key={c.issueLabel} style={styles.similar}>
                      {c.issueLabel}
                      {badge ? ` · ${badge}` : ''}
                    </Text>
                  );
                })}
              </View>
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
                  {h.rationale ? <Text style={styles.rationale}>{h.rationale}</Text> : null}
                </Pressable>
              );
            })}
            {!issue.hypotheses?.length ? (
              <Text style={styles.muted}>No hypotheses yet. Tap retry below or enter diagnosis manually.</Text>
            ) : null}
            <Text style={styles.manualLabel}>Or enter diagnosis manually</Text>
            <TextField
              label="Manual diagnosis"
              value={manualDiagnosisDisplayValue(issue)}
              onChangeText={(text) => setManualDiagnosis(issueIndex, text)}
              placeholder="Type the correct diagnosis if AI is wrong"
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
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { color: tokens.textMuted },
  banner: { borderRadius: tokens.radiusSm, padding: 10, marginBottom: 10 },
  bannerOk: { backgroundColor: tokens.green100, borderWidth: 1, borderColor: tokens.green700 },
  bannerWarn: { backgroundColor: '#fff8e6', borderWidth: 1, borderColor: '#d4a017' },
  bannerDanger: { backgroundColor: '#fdecea', borderWidth: 1, borderColor: '#c0392b' },
  bannerText: { fontSize: 13, color: tokens.text },
  imageSignal: { fontSize: 13, fontWeight: '600', color: tokens.green800, marginBottom: 8 },
  similarBlock: { marginBottom: 8 },
  similarLabel: { fontSize: 12, fontWeight: '700', color: tokens.textMuted, marginBottom: 4 },
  similar: { fontSize: 12, color: tokens.textMuted },
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
  hypothesisConf: { fontSize: 13, color: tokens.green800, marginTop: 4 },
  imageConf: { fontSize: 12, color: tokens.textMuted, marginTop: 2 },
  rationale: { fontSize: 12, color: tokens.textMuted, marginTop: 6 },
  muted: { fontSize: 13, color: tokens.textMuted },
  manualLabel: { fontSize: 13, fontWeight: '600', color: tokens.text, marginTop: 12, marginBottom: 4 },
  retry: { textAlign: 'center', color: tokens.green700, fontWeight: '600', paddingVertical: 8 },
});
