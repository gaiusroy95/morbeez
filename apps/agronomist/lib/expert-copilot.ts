import type { ExpertCaseQueue, ExpertCaseSafetyDecision } from '@morbeez/shared';

/** Keep the legacy task surface unless the server explicitly enables Expert Copilot. */
export function enabledExpertQueue(queue: ExpertCaseQueue): ExpertCaseQueue | null {
  return queue.enabled ? queue : null;
}

/** Operational commit requires both a passing gate and explicit human confirmation. */
export function canCommitExpertDraft(
  decision: ExpertCaseSafetyDecision['decision'] | null | undefined,
  confirmed: boolean
): boolean {
  return decision === 'PASS' && confirmed;
}
