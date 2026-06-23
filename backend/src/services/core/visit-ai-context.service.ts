import { supabase } from '../../lib/supabase.js';
import { NotFoundError } from '../../lib/errors.js';
import { blockService } from './block.service.js';
import { weatherSnapshotService } from './weather-snapshot.service.js';
import { deriveWeatherPressures } from '../whatsapp/pipeline/weather-fetch.service.js';
import type {
  BlockHealthLevel,
  CropPerformanceLevel,
  SoilMoistureLevel,
} from '../../domain/ai-training/enums.js';

export type VisitAiContextPack = {
  farmerId: string;
  blockId: string;
  sessionId?: string;
  cropType: string;
  dap: number | null;
  stage: string | null;
  blockAssessment?: {
    blockHealth: BlockHealthLevel;
    cropPerformance: CropPerformanceLevel;
    soilMoisture: SoilMoistureLevel;
  };
  measurements: Array<{ key: string; value: string; unit?: string }>;
  soilTestSummary: Record<string, unknown> | null;
  weatherSnapshot: Record<string, unknown> | null;
  gps: { latitude: number; longitude: number } | null;
};

type BuildContextInput = {
  farmerId: string;
  blockId: string;
  sessionId?: string;
  blockAssessment?: {
    blockHealth: BlockHealthLevel;
    cropPerformance: CropPerformanceLevel;
    soilMoisture: SoilMoistureLevel;
  };
  measurements?: Array<{ key: string; value: string; unit?: string }>;
  latitude?: number;
  longitude?: number;
  fieldVoiceNote?: string;
};

export type VisitContextSnapshot = {
  measurements: Array<{ key: string; value: string; unit?: string }>;
  blockAssessment?: BuildContextInput['blockAssessment'];
  soilTestSummary: VisitAiContextPack['soilTestSummary'];
  weatherSnapshot: VisitAiContextPack['weatherSnapshot'];
  imageSignal?: { label: string; confidence: number; source?: string; photoCount?: number } | null;
  fieldVoiceNote?: string | null;
  analyzePhotoCount?: number;
  capturedAt: string;
};

function snapshotFromPack(
  pack: VisitAiContextPack,
  extras?: {
    imageSignal?: VisitContextSnapshot['imageSignal'];
    fieldVoiceNote?: string | null;
    analyzePhotoCount?: number;
  }
): VisitContextSnapshot {
  return {
    measurements: pack.measurements,
    blockAssessment: pack.blockAssessment,
    soilTestSummary: pack.soilTestSummary,
    weatherSnapshot: pack.weatherSnapshot,
    imageSignal: extras?.imageSignal ?? null,
    fieldVoiceNote: extras?.fieldVoiceNote ?? null,
    analyzePhotoCount: extras?.analyzePhotoCount,
    capturedAt: new Date().toISOString(),
  };
}

export const visitAiContextService = {
  snapshotFromPack,

  mergeSnapshotIntoInput(
    input: BuildContextInput,
    snapshot: VisitContextSnapshot | null | undefined
  ): BuildContextInput {
    if (!snapshot) return input;
    return {
      ...input,
      blockAssessment: input.blockAssessment ?? snapshot.blockAssessment,
      measurements: input.measurements?.length ? input.measurements : snapshot.measurements,
      fieldVoiceNote: input.fieldVoiceNote ?? snapshot.fieldVoiceNote ?? undefined,
    };
  },

  applySnapshotToPack(pack: VisitAiContextPack, snapshot: VisitContextSnapshot | null | undefined): VisitAiContextPack {
    if (!snapshot) return pack;
    return {
      ...pack,
      measurements: snapshot.measurements.length ? snapshot.measurements : pack.measurements,
      blockAssessment: snapshot.blockAssessment ?? pack.blockAssessment,
      soilTestSummary: snapshot.soilTestSummary ?? pack.soilTestSummary,
      weatherSnapshot: snapshot.weatherSnapshot ?? pack.weatherSnapshot,
    };
  },

  snapshotFromCaseMetadata(metadata: Record<string, unknown>): VisitContextSnapshot | null {
    const snap = metadata.contextSnapshot as VisitContextSnapshot | undefined;
    return snap ?? null;
  },

  async buildVisitAiContext(input: BuildContextInput): Promise<VisitAiContextPack> {
    const block = await blockService.getById(input.blockId, input.farmerId);
    if (!block) throw new NotFoundError('Block not found');

    const [{ data: soilRows }, weatherBundle] = await Promise.all([
      supabase
        .from('crm_soil_reports')
        .select('metrics, reported_at, lab_name')
        .eq('farmer_id', input.farmerId)
        .or(`block_id.eq.${input.blockId},block_id.is.null`)
        .order('reported_at', { ascending: false })
        .limit(1),
      weatherSnapshotService
        .getVisitWeatherBundle({ farmerId: input.farmerId, blockId: input.blockId, days: 7 })
        .catch(() => null),
    ]);

    const soil = soilRows?.[0];
    const soilTestSummary = soil
      ? {
          reportedAt: soil.reported_at ? String(soil.reported_at) : null,
          labName: soil.lab_name ? String(soil.lab_name) : null,
          metrics: (soil.metrics as Record<string, unknown>) ?? {},
        }
      : null;

    const lat = input.latitude ?? (block.latitude != null ? Number(block.latitude) : null);
    const lon = input.longitude ?? (block.longitude != null ? Number(block.longitude) : null);
    const last7Raw = weatherBundle?.last7Days ?? [];
    const today = last7Raw[last7Raw.length - 1];
    const alerts: string[] = [];
    if (weatherBundle?.heavyRainLikely) alerts.push('heavy_rain_likely');
    if (weatherBundle?.highHeatLikely) alerts.push('high_heat_likely');
    if (weatherBundle?.highHumidityLikely) alerts.push('high_humidity_likely');

    const last7Days = last7Raw.map((d) => ({
      date: d.date,
      rainfallMm: d.rainfallMm,
      temperatureC: d.maxTempC,
      humidityPct: d.avgHumidityPct,
    }));
    const totals7d =
      last7Days.length > 0
        ? {
            rainfallMm: Math.round(last7Days.reduce((s, d) => s + (d.rainfallMm ?? 0), 0) * 10) / 10,
            avgTempC:
              Math.round((last7Days.reduce((s, d) => s + (d.temperatureC ?? 0), 0) / last7Days.length) * 10) /
              10,
            avgHumidityPct:
              Math.round(
                (last7Days.reduce((s, d) => s + (d.humidityPct ?? 0), 0) / last7Days.length) * 10
              ) / 10,
          }
        : null;
    const pressures = last7Raw.length ? deriveWeatherPressures(last7Raw) : null;

    return {
      farmerId: input.farmerId,
      blockId: input.blockId,
      sessionId: input.sessionId,
      cropType: block.crop_type,
      dap: block.dap ?? null,
      stage: block.stage ?? null,
      blockAssessment: input.blockAssessment,
      measurements: input.measurements ?? [],
      soilTestSummary,
      weatherSnapshot:
        today || last7Days.length
          ? {
              rainfallMm: today?.rainfallMm ?? 0,
              humidityPct: today?.avgHumidityPct ?? 70,
              temperatureC: today?.maxTempC ?? 28,
              weatherRiskScore: weatherBundle?.weatherRiskScore ?? null,
              diseaseAlerts: alerts,
              locationLabel: weatherBundle?.locationLabel ?? null,
              last7Days,
              totals7d,
              pressures,
            }
          : null,
      gps: lat != null && lon != null ? { latitude: lat, longitude: lon } : null,
    };
  },

  async buildContextForCase(caseRow: {
    farmer_id: string;
    block_id: string;
    session_id?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<VisitAiContextPack> {
    const meta = (caseRow.metadata as Record<string, unknown>) ?? {};
    const snapshot = visitAiContextService.snapshotFromCaseMetadata(meta);
    const base = await visitAiContextService.buildVisitAiContext({
      farmerId: String(caseRow.farmer_id),
      blockId: String(caseRow.block_id),
      sessionId: caseRow.session_id ? String(caseRow.session_id) : undefined,
    });
    return visitAiContextService.applySnapshotToPack(base, snapshot);
  },
};
