import type { IssueCategory, StructuredVisitIssueInput } from '../types/field-findings';

export const PROVISIONAL_ISSUE_NAME = 'Field observation';

export type VisitIssueAnalysisDraft = StructuredVisitIssueInput & {
  localId: string;
  selectedHypothesisLabel?: string;
  confidenceAction?: string;
  skipFollowUpOptional?: boolean;
  imageSignal?: { label: string; confidence: number };
  hypotheses?: Array<{
    label: string;
    confidence: number;
    rationale?: string;
    selected?: boolean;
    imagePrediction?: string;
    imageConfidence?: number;
  }>;
  similarCases?: Array<{ issueLabel: string; score: number; confidence: number; outcome?: string | null }>;
};

/** Placeholder issue used when AI runs before the agronomist defines issues. */
export function createProvisionalVisitIssue(category: IssueCategory = 'other'): VisitIssueAnalysisDraft {
  return {
    localId: 'ai-provisional',
    category,
    issueName: PROVISIONAL_ISSUE_NAME,
    severity: 'medium',
    status: 'open',
    observation: '',
    photos: [],
  };
}

export function ensureIssuesForAiStep<T extends VisitIssueAnalysisDraft>(issues: T[]): T[] {
  return issues.length ? issues : [createProvisionalVisitIssue() as T];
}

export function isProvisionalIssueName(name: string | undefined): boolean {
  const trimmed = name?.trim() ?? '';
  return !trimmed || trimmed === PROVISIONAL_ISSUE_NAME;
}

export type VisitAnalyzeSeedInput = {
  aiCaseId: string;
  hypotheses: Array<{
    label: string;
    confidence: number;
    rationale?: string;
    selected?: boolean;
    imagePrediction?: string;
    imageConfidence?: number;
  }>;
  confidenceAction?: string;
  skipFollowUpOptional?: boolean;
  imageSignal?: { label: string; confidence: number } | null;
  similarCases?: VisitIssueAnalysisDraft['similarCases'];
};

/** Attach analyze API output to an issue and seed the issue name from the top hypothesis. */
export function seedIssueFromAnalysis<T extends VisitIssueAnalysisDraft>(
  issue: T,
  result: VisitAnalyzeSeedInput
): T {
  const top = result.hypotheses.find((h) => h.selected) ?? result.hypotheses[0];
  const diagnosis = top?.label ?? issue.finalDiagnosis;
  return {
    ...issue,
    aiCaseId: result.aiCaseId,
    hypotheses: result.hypotheses,
    selectedHypothesisLabel: top?.label,
    finalDiagnosis: diagnosis,
    issueName: isProvisionalIssueName(issue.issueName) && top?.label ? top.label : issue.issueName,
    similarCases: result.similarCases,
    confidenceAction: result.confidenceAction,
    skipFollowUpOptional: result.skipFollowUpOptional,
    imageSignal: result.imageSignal ?? undefined,
  };
}
