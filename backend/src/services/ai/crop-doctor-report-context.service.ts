import { supabase } from '../../lib/supabase.js';
import { blockService } from '../core/block.service.js';
import { plotLocationService } from '../core/plot-location.service.js';
import { visitAiContextService } from '../core/visit-ai-context.service.js';
import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
import type { ContextPack } from '../whatsapp/pipeline/context-pack.service.js';

export type FieldActivitySnapshot = {
  label: string;
  date?: string;
  daysAgo?: string;
};

export type CropDoctorReportContext = {
  cropType?: string;
  cropStage?: string;
  variety?: string;
  dap?: number;
  location?: string;
  plotLabel?: string;
  contextPack?: ContextPack;
  reasoning?: MaiosReasoningSnapshot | null;
  weather?: {
    temperature?: string;
    humidity?: string;
    rainfall7d?: string;
    weather?: string;
    soilMoisture?: string;
  };
  lastFertilizer?: FieldActivitySnapshot;
  lastFoliarSpray?: FieldActivitySnapshot;
  lastDrench?: FieldActivitySnapshot;
  previousDisease?: string;
  previousRecommendation?: string;
  previousDiagnosisStatus?: string;
  soilSummary?: string;
};

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function formatDaysAgo(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function productNames(products: unknown): string {
  if (!Array.isArray(products) || !products.length) return '';
  const names = products
    .map((p) => {
      if (typeof p === 'string') return p.trim();
      if (p && typeof p === 'object') {
        const row = p as Record<string, unknown>;
        return String(row.name ?? row.product ?? row.title ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
  return names.join(', ');
}

function activityLabel(row: {
  activity_type?: string | null;
  activity_label?: string | null;
  products?: unknown;
  dosage_notes?: string | null;
}): string {
  const custom = row.activity_label?.trim();
  if (custom) return custom;
  const products = productNames(row.products);
  if (products) return products;
  if (row.dosage_notes?.trim()) return row.dosage_notes.trim();
  const type = String(row.activity_type ?? 'activity');
  if (type === 'spray_applied') return 'Foliar spray';
  if (type === 'fertigation') return 'Fertigation';
  if (type === 'drench') return 'Drench';
  return type.replace(/_/g, ' ');
}

function isFertilizerType(type: string, label: string): boolean {
  const blob = `${type} ${label}`.toLowerCase();
  return /fertig|fertiliz|npk|urea|potash|manure|compost/.test(blob);
}

function isFoliarType(type: string, label: string): boolean {
  if (type === 'spray_applied') return true;
  const blob = `${type} ${label}`.toLowerCase();
  return /foliar|spray|fungicide|insecticide|mancozeb|copper/.test(blob);
}

function isDrenchType(type: string, label: string): boolean {
  if (type === 'drench') return true;
  return /drench/.test(`${type} ${label}`.toLowerCase());
}

function snapshotFromRow(row: {
  applied_at?: string | null;
  activity_type?: string | null;
  activity_label?: string | null;
  products?: unknown;
  dosage_notes?: string | null;
}): FieldActivitySnapshot {
  const appliedAt = String(row.applied_at ?? '');
  return {
    label: activityLabel(row),
    date: appliedAt ? formatDateShort(appliedAt) : undefined,
    daysAgo: appliedAt ? formatDaysAgo(appliedAt) : undefined,
  };
}

function formatLocation(params: {
  village?: string;
  district?: string;
  pincode?: string;
  weatherLabel?: string | null;
}): string | undefined {
  const village = params.village?.trim();
  const district = params.district?.trim();
  const pincode = params.pincode?.trim();

  const parts: string[] = [];
  if (village) parts.push(village);
  if (district) {
    parts.push(district);
    if (!district.toLowerCase().includes('kerala')) parts.push('Kerala');
  }
  if (parts.length) return parts.join(', ');
  if (district) return `${district}, Kerala`;
  if (pincode) return `PIN ${pincode}`;
  if (params.weatherLabel?.trim()) return params.weatherLabel.trim();
  return undefined;
}

async function loadFieldActivities(
  farmerId: string,
  blockId?: string | null
): Promise<{
  lastFertilizer?: FieldActivitySnapshot;
  lastFoliarSpray?: FieldActivitySnapshot;
  lastDrench?: FieldActivitySnapshot;
}> {
  let q = supabase
    .from('cultivation_activities')
    .select(
      'applied_at, activity_type, activity_label, products, dosage_notes, farm_block_id, farmer_crop_id'
    )
    .eq('farmer_id', farmerId)
    .order('applied_at', { ascending: false })
    .limit(40);

  const { data: rows } = await q;
  const scoped = (rows ?? []).filter((row) => {
    if (!blockId) return true;
    const bid = row.farm_block_id ? String(row.farm_block_id) : null;
    const cropId = row.farmer_crop_id ? String(row.farmer_crop_id) : null;
    if (!bid && !cropId) return true;
    return bid === blockId || cropId === blockId;
  });

  let lastFertilizer: FieldActivitySnapshot | undefined;
  let lastFoliarSpray: FieldActivitySnapshot | undefined;
  let lastDrench: FieldActivitySnapshot | undefined;

  for (const row of scoped) {
    const type = String(row.activity_type ?? '');
    const label = activityLabel(row);
    const snap = snapshotFromRow(row);
    if (!lastFertilizer && isFertilizerType(type, label)) lastFertilizer = snap;
    if (!lastFoliarSpray && isFoliarType(type, label)) lastFoliarSpray = snap;
    if (!lastDrench && isDrenchType(type, label)) lastDrench = snap;
    if (lastFertilizer && lastFoliarSpray && lastDrench) break;
  }

  if (!lastFertilizer || !lastFoliarSpray || !lastDrench) {
    const { data: logs } = await supabase
      .from('interaction_logs')
      .select('field_activity_label, field_activity_date, summary, interaction_at')
      .eq('farmer_id', farmerId)
      .not('field_activity_label', 'is', null)
      .order('field_activity_date', { ascending: false, nullsFirst: false })
      .limit(15);

    for (const log of logs ?? []) {
      const label = String(log.field_activity_label ?? '').trim();
      if (!label) continue;
      const at = String(log.field_activity_date ?? log.interaction_at ?? '');
      const snap: FieldActivitySnapshot = {
        label,
        date: at ? formatDateShort(at) : undefined,
        daysAgo: at ? formatDaysAgo(at) : undefined,
      };
      if (!lastFertilizer && isFertilizerType('interaction', label)) lastFertilizer = snap;
      if (!lastFoliarSpray && isFoliarType('interaction', label)) lastFoliarSpray = snap;
      if (!lastDrench && isDrenchType('interaction', label)) lastDrench = snap;
    }
  }

  return { lastFertilizer, lastFoliarSpray, lastDrench };
}

async function loadPreviousDiagnosis(
  farmerId: string,
  blockId?: string | null,
  currentIssue?: string
): Promise<{
  previousDisease?: string;
  previousRecommendation?: string;
  previousDiagnosisStatus?: string;
}> {
  const [{ data: history }, { data: recs }] = await Promise.all([
    supabase
      .from('disease_history')
      .select('issue_label, recorded_at, severity')
      .eq('farmer_id', farmerId)
      .order('recorded_at', { ascending: false })
      .limit(5),
    blockId
      ? supabase
          .from('recommendation_records')
          .select('issue_detected, recommendation_text, outcome, created_at')
          .eq('farmer_id', farmerId)
          .eq('block_id', blockId)
          .order('created_at', { ascending: false })
          .limit(3)
      : Promise.resolve({ data: null }),
  ]);

  const priorIssue = (history ?? []).find(
    (h) => h.issue_label && (!currentIssue || !labelsSimilar(String(h.issue_label), currentIssue))
  );
  const priorRec = recs?.[0];

  let status: string | undefined;
  const outcome = priorRec?.outcome ? String(priorRec.outcome).toLowerCase() : '';
  if (/recover|resolved|better/.test(outcome)) status = 'Recovered';
  else if (/improv|partial/.test(outcome)) status = 'Improving';
  else if (/same|unchanged/.test(outcome)) status = 'Same';
  else if (/worse|spread/.test(outcome)) status = 'Worse';
  else if (priorIssue || priorRec) status = 'Unknown';

  return {
    previousDisease: priorIssue?.issue_label ? String(priorIssue.issue_label) : priorRec?.issue_detected ? String(priorRec.issue_detected) : undefined,
    previousRecommendation: priorRec?.recommendation_text ? String(priorRec.recommendation_text).slice(0, 200) : undefined,
    previousDiagnosisStatus: status,
  };
}

function labelsSimilar(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return na === nb || na.includes(nb) || nb.includes(na);
}

function weatherFromVisitContext(weather: Record<string, unknown> | null | undefined): CropDoctorReportContext['weather'] {
  if (!weather) return undefined;
  const totals = weather.totals7d as { rainfallMm?: number; avgHumidityPct?: number; avgTempC?: number } | undefined;
  const pressures = weather.pressures as { waterlogging?: boolean } | undefined;
  const alerts = Array.isArray(weather.diseaseAlerts) ? weather.diseaseAlerts.map(String) : [];
  const flags: string[] = [];
  if (alerts.includes('heavy_rain_likely')) flags.push('Heavy rain likely');
  if (alerts.includes('high_humidity_likely')) flags.push('High humidity');
  if (alerts.includes('high_heat_likely')) flags.push('High heat');

  return {
    temperature:
      weather.temperatureC != null
        ? `${Math.round(Number(weather.temperatureC))}°C`
        : totals?.avgTempC != null
          ? `${Math.round(totals.avgTempC)}°C`
          : undefined,
    humidity:
      weather.humidityPct != null
        ? `${Math.round(Number(weather.humidityPct))}%`
        : totals?.avgHumidityPct != null
          ? `${Math.round(totals.avgHumidityPct)}%`
          : undefined,
    rainfall7d:
      totals?.rainfallMm != null
        ? `${totals.rainfallMm} mm`
        : weather.rainfallMm != null
          ? `${weather.rainfallMm} mm`
          : undefined,
    weather: flags.length ? flags.join('; ') : undefined,
    soilMoisture: pressures?.waterlogging
      ? 'Wet, risk of temporary waterlogging'
      : undefined,
  };
}

function weatherFromContextPack(pack?: ContextPack): CropDoctorReportContext['weather'] {
  if (!pack) return undefined;
  const flags: string[] = [];
  if (pack.heavyRainLikely) flags.push('Heavy rain likely');
  if (pack.highHumidityLikely) flags.push('High humidity');
  if (pack.highHeatLikely) flags.push('High heat');
  return {
    temperature: pack.maxTempCToday != null ? `${Math.round(pack.maxTempCToday)}°C` : undefined,
    humidity: pack.avgHumidityPct != null ? `${Math.round(pack.avgHumidityPct)}%` : undefined,
    rainfall7d: pack.rainMmToday != null ? `${pack.rainMmToday} mm (today)` : undefined,
    weather: flags.length ? flags.join('; ') : pack.seasonPhase ? `${pack.seasonPhase} season` : undefined,
    soilMoisture:
      pack.drainageRisk === 'high'
        ? 'Wet, risk of temporary waterlogging'
        : pack.drainageRisk === 'moderate'
          ? 'Moist'
          : pack.drainageRisk === 'low'
            ? 'Normal'
            : undefined,
  };
}

export const cropDoctorReportContextService = {
  async build(params: {
    farmerId: string;
    blockId?: string | null;
    cropType?: string;
    cropStage?: string;
    plotLabel?: string;
    contextPack?: ContextPack;
    currentIssue?: string;
  }): Promise<CropDoctorReportContext> {
    const blockId = params.blockId?.trim() || null;

    const [{ data: farmer }, block, activities, previous, visitContext, weatherCoords] = await Promise.all([
      supabase
        .from('farmers')
        .select('district, village, pincode_id, pincode_master(pincode, district, village)')
        .eq('id', params.farmerId)
        .maybeSingle(),
      blockId ? blockService.getById(blockId, params.farmerId) : blockService.getPrimaryBlock(params.farmerId),
      loadFieldActivities(params.farmerId, blockId ?? undefined),
      loadPreviousDiagnosis(params.farmerId, blockId ?? undefined, params.currentIssue),
      blockId
        ? visitAiContextService.buildVisitAiContext({ farmerId: params.farmerId, blockId }).catch(() => null)
        : Promise.resolve(null),
      plotLocationService.resolveWeatherCoords(params.farmerId, blockId).catch(() => null),
    ]);

    const pm = farmer?.pincode_master as { pincode?: string; district?: string; village?: string } | null;
    const village = farmer?.village ? String(farmer.village) : pm?.village ?? params.contextPack?.village;
    const district = farmer?.district ? String(farmer.district) : pm?.district ?? params.contextPack?.district;
    const pincode = pm?.pincode ?? params.contextPack?.pincode;
    const weatherSnapshot = visitContext?.weatherSnapshot as Record<string, unknown> | null | undefined;

    const location =
      formatLocation({
        village,
        district,
        pincode,
        weatherLabel: weatherSnapshot?.locationLabel ? String(weatherSnapshot.locationLabel) : null,
      }) ?? weatherCoords?.label;

    const soilSummary = params.contextPack?.soilLabSummary
      ?? (visitContext?.soilTestSummary
        ? formatSoilOneLiner(visitContext.soilTestSummary as Record<string, unknown>)
        : undefined);

    const visitWeather = weatherFromVisitContext(weatherSnapshot);
    const packWeather = weatherFromContextPack(params.contextPack);
    const weather = mergeWeather(visitWeather, packWeather);

    return {
      cropType: params.cropType ?? block?.crop_type,
      cropStage: params.cropStage ?? block?.stage ?? undefined,
      variety: block?.variety_name ?? undefined,
      dap: block?.dap ?? params.contextPack?.dap,
      location,
      plotLabel: params.plotLabel ?? block?.plot_label ?? block?.name ?? undefined,
      contextPack: params.contextPack,
      lastFertilizer: activities.lastFertilizer,
      lastFoliarSpray: activities.lastFoliarSpray,
      lastDrench: activities.lastDrench,
      previousDisease: previous.previousDisease,
      previousRecommendation: previous.previousRecommendation,
      previousDiagnosisStatus: previous.previousDiagnosisStatus,
      soilSummary,
      weather,
    };
  },
};

function mergeWeather(
  primary?: CropDoctorReportContext['weather'],
  fallback?: CropDoctorReportContext['weather']
): CropDoctorReportContext['weather'] {
  if (!primary && !fallback) return undefined;
  return {
    temperature: primary?.temperature ?? fallback?.temperature,
    humidity: primary?.humidity ?? fallback?.humidity,
    rainfall7d: primary?.rainfall7d ?? fallback?.rainfall7d,
    weather: primary?.weather ?? fallback?.weather,
    soilMoisture: primary?.soilMoisture ?? fallback?.soilMoisture,
  };
}

function formatSoilOneLiner(summary: Record<string, unknown>): string | undefined {
  const metrics = (summary.metrics ?? summary) as Record<string, unknown>;
  if (!metrics || typeof metrics !== 'object') return undefined;
  const parts: string[] = [];
  for (const key of ['nitrogen', 'N', 'phosphorus', 'P', 'potassium', 'K', 'ph', 'pH']) {
    const val = metrics[key];
    if (val != null && val !== '') parts.push(`${key}: ${String(val)}`);
  }
  if (!parts.length) return undefined;
  const reported = summary.reportedAt ? ` (${String(summary.reportedAt).slice(0, 10)})` : '';
  return `Soil lab${reported}: ${parts.slice(0, 5).join(', ')}`;
}
