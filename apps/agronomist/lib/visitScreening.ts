import {
  agronomistClient,
  buildAnalyzeVisitBody,
  expandSeparateNutrientIssues,
  type VisitIssueDraft,
  type VisitScreeningParams,
} from '@morbeez/shared';
import type { IssueDraft } from '@/components/field-findings/IssueCard';

export function mapAnalyzeVisitIssues(detected: VisitIssueDraft[]): IssueDraft[] {
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

export async function runVisitScreening(
  screening: VisitScreeningParams,
  client: {
    analyzeVisit: (body: ReturnType<typeof buildAnalyzeVisitBody>) => Promise<{ issues?: VisitIssueDraft[] }>;
  } = agronomistClient
): Promise<IssueDraft[]> {
  const { issues = [] } = await client.analyzeVisit(buildAnalyzeVisitBody(screening));
  return mapAnalyzeVisitIssues(issues);
}

export function buildScreeningPrefetchKey(screening: VisitScreeningParams): string {
  return JSON.stringify({
    farmerId: screening.farmerId,
    blockId: screening.blockId,
    sessionId: screening.sessionId ?? null,
    fieldVoiceNote: screening.fieldVoiceNote ?? '',
    blockAssessment: screening.blockAssessment,
    measurements: screening.measurements,
    gpsLat: screening.gpsLat ?? null,
    gpsLon: screening.gpsLon ?? null,
    photos: screening.visitPhotos.map((p) => `${p.photoType ?? ''}:${p.dataBase64.length}`),
  });
}
