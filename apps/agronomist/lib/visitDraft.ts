import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VisitDraft } from './visitDraftRecovery';
export {
  hydrateServerVisitDraft,
  newestVisitDraft,
  type VisitDraft,
} from './visitDraftRecovery';

const PREFIX = 'agronomist_visit_draft_';

export async function saveVisitDraft(blockId: string, draft: VisitDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + blockId, JSON.stringify(draft));
  } catch {
    // Draft persistence is best-effort; a missing native module must not crash the visit flow.
  }
}

export async function loadVisitDraft(blockId: string): Promise<VisitDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + blockId);
    if (!raw) return null;
    return JSON.parse(raw) as VisitDraft;
  } catch {
    return null;
  }
}

export async function clearVisitDraft(blockId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + blockId);
  } catch {
    // ignore
  }
}
