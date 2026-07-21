import type { ExpertCaseQueue, ExpertCaseSafetyDecision } from '@morbeez/shared';
import {
  draftCommitBlockers,
  draftReadyForCommit,
  type ExpertCaseReviewDraft,
} from '@morbeez/shared/expert-case';

/** Keep the legacy task surface unless the server explicitly enables Expert Copilot. */
export function enabledExpertQueue(queue: ExpertCaseQueue): ExpertCaseQueue | null {
  return queue.enabled ? queue : null;
}

/** Operational commit requires safety PASS, explicit confirmation, and a complete draft. */
export function canCommitExpertDraft(
  decision: ExpertCaseSafetyDecision['decision'] | null | undefined,
  confirmed: boolean,
  draft?: ExpertCaseReviewDraft | null
): boolean {
  return decision === 'PASS' && confirmed && draftReadyForCommit(draft);
}

export { draftCommitBlockers, draftReadyForCommit };
