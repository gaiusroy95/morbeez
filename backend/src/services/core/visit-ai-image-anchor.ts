import type { VisitImageSignal } from './visit-ai-image.service.js';

type DetectedVisitIssue = {
  category: string;
  issueName: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  observation?: string;
  rootCause: {
    symptoms: string[];
    photoSignals: string[];
    soilSignals: string[];
    weatherSignals: string[];
    conclusion: string;
  };
  evidence: {
    photoSummary: string;
    measurementSummary: string;
    soilSummary: string;
    weatherSummary: string;
    historySummary: string;
  };
};

const SYMPTOM_PHOTO_RE =
  /^(leaf|rhizome|disease|pest|symptom|close|affected|damage|spot|wilt|blight)/i;

export function visitPhotoTypePriority(photoType?: string | null): number {
  if (!photoType?.trim()) return 1;
  if (SYMPTOM_PHOTO_RE.test(photoType.trim())) return 0;
  return 2;
}

export function sortVisitPhotosForDiagnosis<T extends { photoType?: string | null }>(photos: T[]): T[] {
  return [...photos].sort(
    (a, b) => visitPhotoTypePriority(a.photoType) - visitPhotoTypePriority(b.photoType)
  );
}

function labelsAlign(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

export function anchorPrimaryIssueToImageSignal(
  issues: DetectedVisitIssue[],
  imageSignal: VisitImageSignal | null | undefined,
  minConfidence = 0.5
): DetectedVisitIssue[] {
  if (!imageSignal?.label?.trim() || imageSignal.confidence < minConfidence) return issues;
  if (!issues.length) return issues;

  const imageLabel = imageSignal.label.trim();
  const matchIdx = issues.findIndex((issue) => labelsAlign(issue.issueName, imageLabel));

  if (matchIdx === 0) {
    const primary = issues[0]!;
    return [
      {
        ...primary,
        confidence: Math.max(primary.confidence, imageSignal.confidence),
        rootCause: {
          ...primary.rootCause,
          photoSignals: Array.from(
            new Set([...(primary.rootCause?.photoSignals ?? []), imageLabel])
          ),
          conclusion: primary.rootCause?.conclusion || imageLabel,
        },
      },
      ...issues.slice(1),
    ];
  }

  if (matchIdx > 0) {
    const matched = issues[matchIdx]!;
    const rest = issues.filter((_, idx) => idx !== matchIdx);
    return [
      {
        ...matched,
        confidence: Math.max(matched.confidence, imageSignal.confidence),
        rootCause: {
          ...matched.rootCause,
          photoSignals: Array.from(
            new Set([...(matched.rootCause?.photoSignals ?? []), imageLabel])
          ),
        },
      },
      ...rest,
    ];
  }

  const template = issues[0]!;
  const anchored: DetectedVisitIssue = {
    ...template,
    category: template.category,
    issueName: imageLabel,
    confidence: imageSignal.confidence,
    observation: template.observation,
    rootCause: {
      symptoms: template.rootCause?.symptoms ?? [],
      photoSignals: [imageLabel],
      soilSignals: template.rootCause?.soilSignals ?? [],
      weatherSignals: template.rootCause?.weatherSignals ?? [],
      conclusion: imageLabel,
    },
    evidence: template.evidence,
  };
  return [anchored, ...issues];
}
