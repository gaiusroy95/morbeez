import { supabase } from '../../lib/supabase.js';
import type {
  GingerCanopyAudit,
  GingerFieldMetrics,
  GingerInputHistorySummary,
  GingerWaterReading,
} from '../../domain/ginger-sop/types.js';
import { gingerSopCanopyAuditService } from './ginger-sop-canopy-audit.service.js';
import { gingerSopInputHistoryService } from './ginger-sop-input-history.service.js';

type MeasurementRow = { measurement_key: string; value: string | null };

function num(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function measurementsToMap(rows: MeasurementRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = num(r.value);
    if (v != null) m.set(r.measurement_key, v);
  }
  return m;
}

/** @deprecated Use fieldContextService from services/case — ginger-only shim retained for legacy tests. */
export const gingerSopFieldDataService = {
  async loadLatestMeasurements(
    farmerId: string,
    blockId?: string | null
  ): Promise<{
    findingId: string | null;
    measurements: Map<string, number>;
  }> {
    let q = supabase
      .from('crm_field_findings')
      .select('id')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (blockId) {
      q = q.eq('block_id', blockId);
    }

    const { data: finding } = await q.maybeSingle();
    if (!finding?.id) {
      return { findingId: null, measurements: new Map() };
    }

    const { data: rows } = await supabase
      .from('visit_measurements')
      .select('measurement_key, value')
      .eq('field_finding_id', finding.id);

    return {
      findingId: String(finding.id),
      measurements: measurementsToMap((rows ?? []) as MeasurementRow[]),
    };
  },

  buildFieldMetrics(measurements: Map<string, number>): GingerFieldMetrics | undefined {
    const spad = measurements.get('spad') ?? null;
    const plantHeight = measurements.get('plant_height') ?? null;
    const shoots = measurements.get('shoot_count') ?? null;
    const shootDiameter = measurements.get('shoot_diameter') ?? null;
    const leaves = measurements.get('leaves_per_shoot') ?? null;

    if (spad == null && plantHeight == null && shoots == null) return undefined;

    return {
      spad,
      plantHeightCm: plantHeight,
      shootsPerHill: shoots,
      shootDiameterMm: shootDiameter,
      leavesPerShoot: leaves,
      sampleCount: [spad, plantHeight, shoots].filter((v) => v != null).length,
    };
  },

  buildWaterReading(
    measurements: Map<string, number>,
    metadata?: { irrigationPh?: number; irrigationEc?: number }
  ): GingerWaterReading | undefined {
    const ph = measurements.get('irrigation_water_ph') ?? metadata?.irrigationPh ?? null;
    const ec = measurements.get('irrigation_water_ec') ?? metadata?.irrigationEc ?? null;
    if (ph == null && ec == null) return undefined;
    return {
      irrigationPh: ph,
      irrigationEc: ec,
      source: measurements.has('irrigation_water_ph') ? 'field_visit' : 'metadata',
    };
  },

  buildCanopyAudit(
    measurements: Map<string, number>,
    dap?: number | null,
    canopyCoverPct?: number | null
  ): GingerCanopyAudit | undefined {
    const bedFloor = measurements.get('bed_floor_visibility') ?? null;
    const weed = measurements.get('weed_pressure') ?? null;
    const canopy = measurements.get('canopy_cover') ?? canopyCoverPct ?? null;

    if (bedFloor == null && weed == null && canopy == null) return undefined;

    return gingerSopCanopyAuditService.build({
      bedFloorVisibilityScore: bedFloor,
      weedPressureScore: weed,
      canopyClosurePct: canopy,
      dap: dap ?? null,
    });
  },

  async loadFieldContext(params: {
    farmerId: string;
    blockId?: string | null;
    dap?: number | null;
    metadata?: { irrigationPh?: number; irrigationEc?: number };
  }): Promise<{
    findingId: string | null;
    fieldMetrics?: GingerFieldMetrics;
    canopyAudit?: GingerCanopyAudit;
    waterReading?: GingerWaterReading;
    inputHistory?: GingerInputHistorySummary;
    hasFieldMetrics: boolean;
    hasCanopyAudit: boolean;
    hasWaterData: boolean;
    hasInputHistory: boolean;
  }> {
    const [{ findingId, measurements }, inputHistory] = await Promise.all([
      this.loadLatestMeasurements(params.farmerId, params.blockId),
      gingerSopInputHistoryService.load21Day(params.farmerId, params.blockId),
    ]);

    const fieldMetrics = this.buildFieldMetrics(measurements);
    const waterReading = this.buildWaterReading(measurements, params.metadata);
    const canopyAudit = this.buildCanopyAudit(
      measurements,
      params.dap,
      measurements.get('canopy_cover') ?? null
    );

    return {
      findingId,
      fieldMetrics,
      canopyAudit,
      waterReading,
      inputHistory,
      hasFieldMetrics: Boolean(fieldMetrics?.spad != null || fieldMetrics?.plantHeightCm != null),
      hasCanopyAudit: Boolean(canopyAudit?.auditComplete),
      hasWaterData: Boolean(waterReading?.irrigationPh != null || waterReading?.irrigationEc != null),
      hasInputHistory: Boolean(inputHistory.hasRecentActivity),
    };
  },
};
