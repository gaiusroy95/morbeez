import { StyleSheet, Text, View } from 'react-native';
import { tokens, type MeasurementTemplate } from '@morbeez/shared';
import { Btn, Panel } from '@morbeez/ui-native';
import { FollowUpSection, type FollowUpDraft } from '../FollowUpSection';
import { computeVisitQualityScore } from './visitQualityScore';
import type { IssueDraft } from '../IssueCard';

type Props = {
  photoCount: number;
  photoTypeCount?: number;
  templates: MeasurementTemplate[];
  measurements: Record<string, string>;
  issues: IssueDraft[];
  followUps: FollowUpDraft[];
  onFollowUpChange: (index: number, next: FollowUpDraft) => void;
  blockHealth: import('@morbeez/shared').BlockHealthLevel | null;
  cropPerformance: import('@morbeez/shared').CropPerformanceLevel | null;
  soilMoisture: import('@morbeez/shared').SoilMoistureLevel | null;
  hasGps: boolean;
  gpsStatus: string;
  gpsLoading: boolean;
  onCaptureGps: () => void;
};

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export function VisitSummaryStep({
  photoCount,
  photoTypeCount,
  templates,
  measurements,
  issues,
  followUps,
  onFollowUpChange,
  blockHealth,
  cropPerformance,
  soilMoisture,
  hasGps,
  gpsStatus,
  gpsLoading,
  onCaptureGps,
}: Props) {
  const filledMeasurements = templates.filter((t) => measurements[t.measurementKey]?.trim()).length;
  const requiredMeasurements = templates.filter((t) => t.required).length;
  const recCount = issues.filter((i) => i.finalRecommendation?.trim()).length;
  const qaAnswered = issues.reduce(
    (n, i) => n + (i.followUpQuestions?.filter((q) => q.answer?.trim()).length ?? 0),
    0
  );
  const qaTotal = issues.reduce((n, i) => n + (i.followUpQuestions?.length ?? 0), 0);
  const hasReview = issues.every((i) => i.agronomistReview?.action);
  const quality = computeVisitQualityScore({
    blockHealth,
    cropPerformance,
    soilMoisture,
    photoCount,
    photoTypeCount,
    filledMeasurements,
    requiredMeasurements,
    issueCount: issues.length,
    recommendationCount: recCount,
    hasGps,
    qaAnsweredCount: qaAnswered,
    qaTotalCount: qaTotal,
    hasReviewDecision: hasReview,
  });

  return (
    <View style={styles.root}>
      <Panel title="Visit summary">
        <SummaryRow label="Photos" value={photoCount} />
        <SummaryRow label="Photo types" value={photoTypeCount ?? 0} />
        <SummaryRow label="Measurements" value={filledMeasurements} />
        <SummaryRow label="Issues" value={issues.length} />
        <SummaryRow label="Q&A answered" value={`${qaAnswered}/${qaTotal || '—'}`} />
        <SummaryRow label="Recommendations" value={recCount} />
      </Panel>

      <Panel title="AI & review">
        {issues.map((issue) => (
          <View key={issue.localId} style={styles.issueSummary}>
            <Text style={styles.issueName}>{issue.finalDiagnosis ?? issue.issueName}</Text>
            <Text style={styles.issueMeta}>
              Review: {issue.agronomistReview?.action?.replace(/_/g, ' ') ?? 'pending'}
              {issue.reviewAfterDays ? ` · Re-check in ${issue.reviewAfterDays}d` : ''}
            </Text>
          </View>
        ))}
      </Panel>

      <View style={styles.scoreCard}>
        <View style={styles.scoreRing}>
          <Text style={styles.scoreValue}>{quality.score}%</Text>
        </View>
        <Text style={styles.scoreLabel}>Case quality score</Text>
        <Text style={styles.scoreTitle}>{quality.label}</Text>
        <Text style={styles.scoreMessage}>{quality.message}</Text>
      </View>

      <FollowUpSection items={followUps} onChange={onFollowUpChange} />

      <Panel title="Plot GPS">
        <Text style={styles.gpsHint}>Stand at the plot and capture GPS for accurate weather advice.</Text>
        {gpsStatus ? <Text style={styles.gpsStatus}>{gpsStatus}</Text> : null}
        <Btn
          label={gpsLoading ? 'Getting location…' : hasGps ? 'Update GPS' : 'Capture plot GPS'}
          onPress={onCaptureGps}
          disabled={gpsLoading}
          variant="secondary"
        />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  summaryLabel: { fontSize: 15, color: tokens.text },
  summaryValue: { fontSize: 15, fontWeight: '700', color: tokens.green800 },
  issueSummary: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.border },
  issueName: { fontSize: 15, fontWeight: '700', color: tokens.text },
  issueMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 4 },
  scoreCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 20,
    alignItems: 'center',
  },
  scoreRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    borderColor: tokens.green700,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  scoreValue: { fontSize: 22, fontWeight: '800', color: tokens.green800 },
  scoreLabel: { fontSize: 13, color: tokens.textMuted },
  scoreTitle: { fontSize: 18, fontWeight: '700', color: tokens.text, marginTop: 4 },
  scoreMessage: { fontSize: 13, color: tokens.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  gpsHint: { fontSize: 13, color: tokens.textMuted, marginBottom: 8 },
  gpsStatus: { fontSize: 13, color: tokens.green700, marginBottom: 8 },
});
