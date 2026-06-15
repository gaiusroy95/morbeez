import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  BlockHealthLevel,
  CropPerformanceLevel,
  IssueCategory,
  SoilMoistureLevel,
  StructuredVisitIssueInput,
} from '@morbeez/shared';

const PREFIX = 'agronomist_visit_draft_';

export type VisitDraft = {
  farmerId: string;
  blockId: string;
  sessionId?: string;
  blockHealth?: BlockHealthLevel;
  cropPerformance?: CropPerformanceLevel;
  soilMoisture?: SoilMoistureLevel;
  selectedCategories?: IssueCategory[];
  issues?: StructuredVisitIssueInput[];
  measurements?: Record<string, string>;
  savedAt: string;
};

export async function saveVisitDraft(blockId: string, draft: VisitDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + blockId, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
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
