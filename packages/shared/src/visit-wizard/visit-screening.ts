import type { StructuredFieldVisitPayload } from '../types/field-findings';

export type VisitScreeningPhoto = {
  dataBase64: string;
  mimeType: string;
  photoType?: string;
};

const SYMPTOM_PHOTO_RE =
  /^(leaf|rhizome|disease|pest|symptom|close|affected|damage|spot|wilt|blight)/i;

function visitPhotoTypePriority(photoType?: string): number {
  if (!photoType?.trim()) return 1;
  if (SYMPTOM_PHOTO_RE.test(photoType.trim())) return 0;
  return 2;
}

export function sortVisitScreeningPhotos(photos: VisitScreeningPhoto[]): VisitScreeningPhoto[] {
  return [...photos].sort(
    (a, b) => visitPhotoTypePriority(a.photoType) - visitPhotoTypePriority(b.photoType)
  );
}

export type VisitScreeningParams = {
  farmerId: string;
  blockId: string;
  sessionId?: string | null;
  fieldVoiceNote?: string;
  blockAssessment?: StructuredFieldVisitPayload['blockAssessment'];
  measurements: Record<string, string>;
  templates: Array<{ measurementKey: string; unit?: string | null }>;
  gpsLat?: number | null;
  gpsLon?: number | null;
  visitPhotos: VisitScreeningPhoto[];
};

export function buildAnalyzeVisitBody(params: VisitScreeningParams) {
  const measurementRows = params.templates
    .map((tpl) => ({
      key: tpl.measurementKey,
      value: params.measurements[tpl.measurementKey]?.trim() ?? '',
      unit: tpl.unit ?? undefined,
    }))
    .filter((m) => m.value);

  const analyzePhotos = sortVisitScreeningPhotos(params.visitPhotos)
    .filter((p) => p.dataBase64?.length > 100)
    .slice(0, 4)
    .map((p) => ({ dataBase64: p.dataBase64, mimeType: p.mimeType, photoType: p.photoType }));

  return {
    farmerId: params.farmerId,
    blockId: params.blockId,
    sessionId: params.sessionId ?? undefined,
    fieldVoiceNote: params.fieldVoiceNote,
    blockAssessment: params.blockAssessment,
    measurements: measurementRows,
    latitude: params.gpsLat ?? undefined,
    longitude: params.gpsLon ?? undefined,
    analyzePhotos: analyzePhotos.length ? analyzePhotos : undefined,
    purpose: 'screening' as const,
  };
}

export function issuesNeedInitialScreening(
  issues: Array<{ aiCaseId?: string }> | undefined
): boolean {
  return !issues?.length || !issues.some((i) => i.aiCaseId);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Request timed out'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
