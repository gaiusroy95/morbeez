import type { RecordSeverity, ReviewSeverity } from './enums.js';

export type { ReviewSeverity } from './enums.js';

/** Map DB record severity → UI review severity */
export function mapRecordSeverityToUi(
  severity: string | null | undefined
): ReviewSeverity | undefined {
  if (severity === 'low') return 'mild';
  if (severity === 'medium') return 'moderate';
  if (severity === 'high') return 'severe';
  return undefined;
}

/** Map UI review severity → DB record severity */
export function mapUiSeverityToRecord(
  severity: ReviewSeverity | undefined
): RecordSeverity | null {
  if (severity === 'mild') return 'low';
  if (severity === 'moderate') return 'medium';
  if (severity === 'severe') return 'high';
  return null;
}

export function isReviewSeverity(value: unknown): value is ReviewSeverity {
  return value === 'mild' || value === 'moderate' || value === 'severe';
}

export function isRecordSeverity(value: unknown): value is RecordSeverity {
  return value === 'low' || value === 'medium' || value === 'high';
}
