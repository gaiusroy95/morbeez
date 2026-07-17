import type { VisitDraftPayload } from '@morbeez/shared';

export type VisitDraft = VisitDraftPayload;

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Convert the backend's snake_case row and nested payload into the mobile draft shape. */
export function hydrateServerVisitDraft(value: unknown): VisitDraft | null {
  const row = record(value);
  const payload = record(row?.payload);
  if (!row || !payload) return null;

  const farmerId = String(row.farmer_id ?? row.farmerId ?? payload.farmerId ?? '');
  const blockId = String(row.block_id ?? row.blockId ?? payload.blockId ?? '');
  if (!farmerId || !blockId) return null;

  return {
    ...payload,
    farmerId,
    blockId,
    sessionId: String(row.session_id ?? row.sessionId ?? payload.sessionId ?? '') || undefined,
    currentStep: String(
      row.current_step ?? row.currentStep ?? payload.currentStep ?? ''
    ) as VisitDraft['currentStep'],
    wizardVersion: String(
      row.wizard_version ?? row.wizardVersion ?? payload.wizardVersion ?? 'v12'
    ),
    savedAt: String(row.saved_at ?? row.savedAt ?? payload.savedAt ?? ''),
  } as VisitDraft;
}

export function newestVisitDraft(
  localDraft: VisitDraft | null,
  serverDraft: VisitDraft | null
): VisitDraft | null {
  if (!localDraft) return serverDraft;
  if (!serverDraft) return localDraft;
  const localTime = Date.parse(localDraft.savedAt);
  const serverTime = Date.parse(serverDraft.savedAt);
  return (Number.isFinite(serverTime) ? serverTime : 0) >
    (Number.isFinite(localTime) ? localTime : 0)
    ? serverDraft
    : localDraft;
}
