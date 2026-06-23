import type { StructuredFieldVisitPayload } from '../types/field-findings';

export type VisitScreeningPhoto = {
  dataBase64: string;
  mimeType: string;
  photoType?: string;
};

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

  const analyzePhotos = params.visitPhotos
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
