import type { VisitDraftPayload } from '@morbeez/shared';
import { VISIT_DRAFT_PREFIX } from '@morbeez/shared';

export type VisitDraft = VisitDraftPayload;

export function saveVisitDraft(blockId: string, draft: VisitDraft): void {
  try {
    localStorage.setItem(
      VISIT_DRAFT_PREFIX + blockId,
      JSON.stringify({ ...draft, savedAt: new Date().toISOString() })
    );
  } catch {
    // best-effort
  }
}

export function loadVisitDraft(blockId: string): VisitDraft | null {
  try {
    const raw = localStorage.getItem(VISIT_DRAFT_PREFIX + blockId);
    if (!raw) return null;
    return JSON.parse(raw) as VisitDraft;
  } catch {
    return null;
  }
}

export function clearVisitDraft(blockId: string): void {
  try {
    localStorage.removeItem(VISIT_DRAFT_PREFIX + blockId);
  } catch {
    // ignore
  }
}
