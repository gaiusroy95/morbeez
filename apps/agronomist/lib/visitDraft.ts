import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'agronomist_visit_draft_';

export type VisitDraft = {
  farmerId: string;
  blockId: string;
  sessionId?: string;
  observations?: string;
  diseasePest?: string;
  answers?: Array<{ questionKey: string; label: string; value: string }>;
  savedAt: string;
};

export async function saveVisitDraft(blockId: string, draft: VisitDraft): Promise<void> {
  await AsyncStorage.setItem(PREFIX + blockId, JSON.stringify(draft));
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
  await AsyncStorage.removeItem(PREFIX + blockId);
}
