import type { VisitDraftPayload } from './index';

export type VisitDraftSyncEnvelope = {
  farmerId: string;
  blockId: string;
  currentStep: string;
  wizardVersion: string;
  payload: Omit<VisitDraftPayload, 'farmerId' | 'blockId' | 'currentStep' | 'wizardVersion'>;
};

export type DraftSyncClient = {
  upsertVisitDraft(sessionId: string, body: VisitDraftSyncEnvelope): Promise<unknown>;
};

const DEBOUNCE_MS = 800;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function buildDraftPayload(
  base: Omit<VisitDraftPayload, 'savedAt'> & { currentStep?: string }
): VisitDraftPayload & { currentStep?: string; wizardVersion: string } {
  return {
    ...base,
    wizardVersion: 'v12',
    savedAt: new Date().toISOString(),
  };
}

export function buildDraftSyncEnvelope(
  draft: VisitDraftPayload & { currentStep?: string }
): VisitDraftSyncEnvelope {
  const {
    farmerId,
    blockId,
    currentStep = 'intakeTriage',
    wizardVersion = 'v12',
    ...payload
  } = draft;
  return { farmerId, blockId, currentStep, wizardVersion, payload };
}

export function scheduleServerDraftSync(
  sessionId: string,
  client: DraftSyncClient,
  payload: VisitDraftPayload & { currentStep?: string }
): void {
  const existing = timers.get(sessionId);
  if (existing) clearTimeout(existing);
  timers.set(
    sessionId,
    setTimeout(() => {
      timers.delete(sessionId);
      void client.upsertVisitDraft(sessionId, buildDraftSyncEnvelope(payload)).catch(() => {
        // best-effort
      });
    }, DEBOUNCE_MS)
  );
}

export async function flushServerDraftSync(
  sessionId: string,
  client: DraftSyncClient,
  payload: VisitDraftPayload & { currentStep?: string }
): Promise<void> {
  const existing = timers.get(sessionId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(sessionId);
  }
  await client.upsertVisitDraft(sessionId, buildDraftSyncEnvelope(payload));
}
