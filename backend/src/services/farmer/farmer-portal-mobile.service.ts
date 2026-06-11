import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { blockService, blockDisplayName } from '../core/block.service.js';
import { cropDoctorService } from '../ai/crop-doctor.service.js';
import { farmerAuthService } from '../auth/farmer-auth.service.js';
import { advisoryImageStorageService } from '../core/advisory-image-storage.service.js';
import { weatherSnapshotService } from '../core/weather-snapshot.service.js';
import { whatsappOsAdminService } from '../admin/whatsapp-os-admin.service.js';
import { roiFlowService } from '../whatsapp/roi/roi-flow.service.js';
import type { RoiEntryType } from '../admin/farmer-roi-admin.service.js';
import type { AdvisoryLanguage } from '../ai/types.js';
import { growthStageFromDap } from './crop-stage.service.js';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function growthStageLabel(
  crop: string | null | undefined,
  stage: string | null | undefined,
  dap: number | null
): string {
  return growthStageFromDap(crop, dap, stage);
}

function healthFromSoil(raw: string | null | undefined): {
  status: 'stable' | 'monitor' | 'alert' | 'critical';
  label: string;
} {
  const v = String(raw ?? '').toLowerCase();
  if (v.includes('critical') || v.includes('poor')) return { status: 'critical', label: 'Critical' };
  if (v.includes('alert') || v.includes('watch')) return { status: 'alert', label: 'Needs attention' };
  if (v.includes('monitor')) return { status: 'monitor', label: 'Monitor' };
  return { status: 'stable', label: 'Stable' };
}

function parseBullets(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n|•|·|;/)
    .map((s) => s.replace(/^[-*]\s*/, '').trim())
    .filter((s) => s.length > 3)
    .slice(0, 8);
}

function parseRecommendationProducts(raw: unknown): Array<{
  title: string;
  quantity?: number;
  variantId?: string | null;
  shopifyHandle?: string | null;
}> {
  if (Array.isArray(raw)) {
    return raw
      .map((p) => {
        if (typeof p === 'string') return { title: p.trim() };
        if (p && typeof p === 'object') {
          const o = p as Record<string, unknown>;
          const title = String(
            o.tradeName ?? o.productTitle ?? o.title ?? o.name ?? o.technicalName ?? 'Product'
          ).trim();
          const variantId = o.shopifyVariantId ?? o.variantId ?? null;
          return {
            title,
            quantity: o.quantity != null ? Number(o.quantity) : undefined,
            variantId: variantId ? String(variantId) : null,
            shopifyHandle: o.shopifyHandle ? String(o.shopifyHandle) : null,
          };
        }
        return { title: 'Product' };
      })
      .filter((p) => p.title.length > 0)
      .slice(0, 8);
  }
  const productsRaw = String(raw ?? '');
  return productsRaw
    .split(/[,;|\n]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((title) => ({ title }));
}

function severityFromConfidence(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence < 0.5) return 'high';
  if (confidence < 0.7) return 'medium';
  return 'low';
}

async function fetchPriceRows(crop: string, today: string) {
  const { data: rows } = await supabase
    .from('crop_daily_prices')
    .select('market_name, price_per_kg, last_year_price_per_kg')
    .eq('crop_type', crop.toLowerCase())
    .eq('price_date', today)
    .eq('active', true)
    .order('market_name')
    .limit(10);

  if (rows?.length) return { date: today, rows };

  const { data: fallback } = await supabase
    .from('crop_daily_prices')
    .select('market_name, price_per_kg, last_year_price_per_kg, price_date')
    .eq('crop_type', crop.toLowerCase())
    .eq('active', true)
    .order('price_date', { ascending: false })
    .limit(5);

  if (!fallback?.length) return { date: today, rows: [] as typeof rows };
  return { date: String(fallback[0].price_date), rows: fallback };
}

export const farmerPortalMobileService = {
  async listBlocks(farmerId: string) {
    const blocks = await blockService.listByFarmer(farmerId);

    const { data: activities } = await supabase
      .from('cultivation_activities')
      .select('farm_block_id, applied_at, activity_label, activity_type')
      .eq('farmer_id', farmerId)
      .order('applied_at', { ascending: false })
      .limit(50);

    const lastByBlock = new Map<string, { label: string; at: string }>();
    for (const a of activities ?? []) {
      const bid = String(a.farm_block_id);
      if (!lastByBlock.has(bid)) {
        lastByBlock.set(bid, {
          label: String(a.activity_label ?? a.activity_type ?? 'Activity'),
          at: formatDate(String(a.applied_at)),
        });
      }
    }

    const { data: blockRows } = await supabase
      .from('farm_blocks')
      .select('id, soil_health')
      .eq('farmer_id', farmerId);

    const soilById = new Map((blockRows ?? []).map((b) => [String(b.id), b.soil_health]));

    const { data: openRecs } = await supabase
      .from('crm_recommendations')
      .select('block_id, problem, recommendation')
      .eq('farmer_id', farmerId)
      .or('status.is.null,status.eq.active,status.eq.pending')
      .order('created_at', { ascending: false })
      .limit(20);

    const alertByBlock = new Map<string, string>();
    for (const r of openRecs ?? []) {
      const bid = r.block_id ? String(r.block_id) : '';
      if (bid && !alertByBlock.has(bid)) {
        alertByBlock.set(bid, String(r.problem ?? r.recommendation ?? '').slice(0, 80));
      }
    }

    return {
      blocks: blocks.map((b) => {
        const health = healthFromSoil(soilById.get(b.id) ? String(soilById.get(b.id)) : null);
        const last = lastByBlock.get(b.id);
        return {
          id: b.id,
          name: blockDisplayName(b),
          crop: b.crop_name ?? b.crop_type,
          acreage: b.acreage_decimal,
          dap: b.dap,
          plantingDate: b.planting_date,
          plantingDateLabel: b.planting_date ? formatDate(b.planting_date) : null,
          healthStatus: health.status,
          healthLabel: health.label,
          lastActivity: last ? `${last.label} · ${last.at}` : null,
          currentAlert: alertByBlock.get(b.id) ?? null,
          stage: growthStageLabel(b.crop_type ?? b.crop_name, b.stage, b.dap),
          isPrimary: b.is_primary,
        };
      }),
    };
  },

  async createBlock(
    farmerId: string,
    input: {
      name: string;
      cropType: string;
      acreage?: number;
      plantingDate?: string;
      irrigationType?: string;
    }
  ) {
    const block = await blockService.createBlock(farmerId, {
      name: input.name,
      cropType: input.cropType,
      acreage: input.acreage,
      plantingDate: input.plantingDate,
      irrigationType: input.irrigationType,
    });
    const health = healthFromSoil(null);
    return {
      id: block.id,
      name: blockDisplayName(block),
      crop: block.crop_name ?? block.crop_type,
      acreage: block.acreage_decimal,
      dap: block.dap,
      healthStatus: health.status,
      healthLabel: health.label,
      lastActivity: null,
      currentAlert: null,
      stage: growthStageLabel(block.crop_type ?? block.crop_name, block.stage, block.dap),
      isPrimary: block.is_primary,
    };
  },

  async updateBlock(
    farmerId: string,
    blockId: string,
    input: {
      name?: string;
      cropType?: string;
      acreage?: number;
      plantingDate?: string;
      irrigationType?: string;
    }
  ) {
    const block = await blockService.updateBlock(blockId, farmerId, input);
    const health = healthFromSoil(null);
    return {
      id: block.id,
      name: blockDisplayName(block),
      crop: block.crop_name ?? block.crop_type,
      acreage: block.acreage_decimal,
      dap: block.dap,
      healthStatus: health.status,
      healthLabel: health.label,
      lastActivity: null,
      currentAlert: null,
      stage: growthStageLabel(block.crop_type ?? block.crop_name, block.stage, block.dap),
      isPrimary: block.is_primary,
    };
  },

  async getBlockDetail(farmerId: string, blockId: string) {
    const block = await blockService.getById(blockId, farmerId);
    if (!block) throw new NotFoundError('Field not found');

    const { data: soil } = await supabase
      .from('crm_soil_reports')
      .select('metrics')
      .eq('farmer_id', farmerId)
      .eq('block_id', blockId)
      .order('reported_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const metrics = soil?.metrics as Record<string, unknown> | null;
    const macro = (metrics?.macro ?? metrics) as Record<string, { value?: string; unit?: string }> | undefined;

    const health = healthFromSoil(
      (await supabase.from('farm_blocks').select('soil_health').eq('id', blockId).maybeSingle()).data
        ?.soil_health as string | undefined
    );

    const timeline = await this.getBlockTimeline(farmerId, blockId);

    return {
      block: {
        id: block.id,
        name: blockDisplayName(block),
        crop: block.crop_name ?? block.crop_type,
        acreage: block.acreage_decimal,
        dap: block.dap,
        plantingDate: block.planting_date,
        plantingDateLabel: block.planting_date ? formatDate(block.planting_date) : null,
        healthStatus: health.status,
        healthLabel: health.label,
        lastActivity: timeline[0]?.title ?? null,
        currentAlert: timeline.find((t) => t.type === 'recommendation')?.title ?? null,
        stage: growthStageLabel(block.crop_type ?? block.crop_name, block.stage, block.dap),
        isPrimary: block.is_primary,
        spad: macro?.chlorophyll?.value ? String(macro.chlorophyll.value) : null,
        shootCount: null,
        soilMoisture: macro?.moisture?.value ? String(macro.moisture.value) : null,
        irrigationType: block.irrigation_type,
        healthScore: health.status === 'stable' ? 85 : health.status === 'monitor' ? 65 : 45,
      },
      timeline,
    };
  },

  async getBlockTimeline(farmerId: string, blockId: string) {
    const items: Array<{
      id: string;
      type: 'recommendation' | 'activity' | 'scan' | 'recovery' | 'soil';
      title: string;
      subtitle: string | null;
      at: string;
      atLabel: string;
    }> = [];

    const [acts, recs, scans, soils] = await Promise.all([
      supabase
        .from('cultivation_activities')
        .select('id, activity_label, activity_type, applied_at, notes')
        .eq('farmer_id', farmerId)
        .eq('farm_block_id', blockId)
        .order('applied_at', { ascending: false })
        .limit(20),
      supabase
        .from('crm_recommendations')
        .select('id, problem, recommendation, created_at, status')
        .eq('farmer_id', farmerId)
        .eq('block_id', blockId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('ai_advisory_sessions')
        .select('id, created_at, status, ai_advisory_outputs(probable_issue, farmer_summary_en)')
        .eq('farmer_id', farmerId)
        .eq('block_id', blockId)
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('crm_soil_reports')
        .select('id, reported_at')
        .eq('farmer_id', farmerId)
        .eq('block_id', blockId)
        .order('reported_at', { ascending: false })
        .limit(5),
    ]);

    for (const a of acts.data ?? []) {
      items.push({
        id: `act-${a.id}`,
        type: 'activity',
        title: String(a.activity_label ?? a.activity_type ?? 'Activity'),
        subtitle: a.notes ? String(a.notes).slice(0, 80) : null,
        at: String(a.applied_at),
        atLabel: formatDate(String(a.applied_at)),
      });
    }
    for (const r of recs.data ?? []) {
      items.push({
        id: `rec-${r.id}`,
        type: 'recommendation',
        title: String(r.problem ?? 'Recommendation'),
        subtitle: r.recommendation ? String(r.recommendation).slice(0, 80) : null,
        at: String(r.created_at),
        atLabel: formatDate(String(r.created_at)),
      });
    }
    for (const s of scans.data ?? []) {
      const out = (s.ai_advisory_outputs as Array<{ probable_issue?: string; farmer_summary_en?: string }> | null)?.[0];
      items.push({
        id: `scan-${s.id}`,
        type: 'scan',
        title: out?.probable_issue ? String(out.probable_issue) : 'AI scan',
        subtitle: out?.farmer_summary_en ? String(out.farmer_summary_en).slice(0, 80) : null,
        at: String(s.created_at),
        atLabel: formatDate(String(s.created_at)),
      });
    }
    for (const s of soils.data ?? []) {
      items.push({
        id: `soil-${s.id}`,
        type: 'soil',
        title: 'Soil report',
        subtitle: null,
        at: String(s.reported_at),
        atLabel: formatDate(String(s.reported_at)),
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return items.slice(0, 40);
  },

  async runScan(
    farmerId: string,
    input: {
      blockId?: string;
      scanType: 'leaf' | 'field' | 'rhizome';
      imageData: string;
      mimeType?: string;
      language?: AdvisoryLanguage;
    }
  ) {
    if (!env.ENABLE_AI_CROP_DOCTOR) {
      throw new ValidationError('AI scan is temporarily unavailable');
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const { count: scanCount, error: quotaErr } = await supabase
      .from('ai_advisory_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('farmer_id', farmerId)
      .gte('created_at', dayStart.toISOString());
    throwIfSupabaseError(quotaErr, 'Could not check scan quota');
    if ((scanCount ?? 0) >= env.FARMER_SCAN_DAILY_QUOTA) {
      throw new ValidationError('Daily AI scan limit reached. Try again tomorrow.');
    }

    const profile = await farmerAuthService.me(farmerId);
    const block = input.blockId
      ? await blockService.getById(input.blockId, farmerId)
      : await blockService.ensureDefaultBlock(farmerId);

    const storagePath = await advisoryImageStorageService.uploadFromBase64(
      farmerId,
      input.imageData,
      input.mimeType ?? 'image/jpeg'
    );

    const lang = input.language ?? 'en';

    const result = await cropDoctorService.diagnose({
      farmerId,
      phone: String(profile.phone ?? ''),
      cropType: block?.crop_type ?? 'ginger',
      cropStage: block?.stage ? String(block.stage) : undefined,
      language: lang,
      imageBase64: input.imageData,
      imageMimeType: input.mimeType ?? 'image/jpeg',
      imageStoragePath: storagePath ?? undefined,
      channel: 'api',
      activePlotId: block?.id ?? null,
      symptomsText: `Mobile ${input.scanType} scan`,
    } as Parameters<typeof cropDoctorService.diagnose>[0]);

    const { data: recRow } = await supabase
      .from('crm_recommendations')
      .select('id')
      .eq('ai_session_id', result.sessionId)
      .maybeSingle();

    const summary =
      lang === 'ml' && result.advisory.farmerSummaryMl
        ? result.advisory.farmerSummaryMl
        : result.advisory.farmerSummaryEn || result.advisory.probableIssue;

    return {
      sessionId: result.sessionId,
      detectedIssue: result.advisory.probableIssue,
      confidence: Math.round(result.advisory.confidence * 100),
      severity: severityFromConfidence(result.advisory.confidence),
      spreadRisk: result.advisory.escalationRecommended
        ? result.advisory.escalationReason ?? 'Monitor nearby plants'
        : null,
      description: summary,
      escalated: result.escalated,
      recommendationId: recRow?.id ? String(recRow.id) : null,
      summary,
    };
  },

  async getScan(sessionId: string, farmerId: string) {
    const session = await cropDoctorService.getSession(sessionId);
    if (String(session.farmer_id) !== farmerId) throw new NotFoundError('Scan not found');

    const output = (session.ai_advisory_outputs as Array<Record<string, unknown>> | null)?.[0];
    const confidence = output?.probable_issue
      ? Number(session.confidence_score ?? output.confidence ?? 0.7)
      : 0.5;

    const { data: recRow } = await supabase
      .from('crm_recommendations')
      .select('id')
      .eq('ai_session_id', sessionId)
      .maybeSingle();

    return {
      sessionId,
      detectedIssue: String(output?.probable_issue ?? 'Analysis pending'),
      confidence: Math.round(confidence * (confidence <= 1 ? 100 : 1)),
      severity: severityFromConfidence(confidence <= 1 ? confidence : confidence / 100),
      spreadRisk: output?.escalation_recommended ? 'Monitor spread in field' : null,
      description: String(output?.farmer_summary_en ?? output?.probable_issue ?? ''),
      escalated: session.status === 'escalated',
      recommendationId: recRow?.id ? String(recRow.id) : null,
      summary: String(output?.farmer_summary_en ?? output?.probable_issue ?? ''),
    };
  },

  async listScans(farmerId: string, query: { blockId?: string; limit?: number }) {
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    let q = supabase
      .from('ai_advisory_sessions')
      .select('id, created_at, status, block_id, ai_advisory_outputs(probable_issue, farmer_summary_en)')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (query.blockId) q = q.eq('block_id', query.blockId);

    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load scan history');

    return (data ?? []).map((s) => {
      const out = (s.ai_advisory_outputs as Array<{ probable_issue?: string; farmer_summary_en?: string }> | null)?.[0];
      return {
        sessionId: String(s.id),
        blockId: s.block_id ? String(s.block_id) : null,
        status: String(s.status),
        detectedIssue: out?.probable_issue ? String(out.probable_issue) : 'AI scan',
        summary: out?.farmer_summary_en ? String(out.farmer_summary_en) : null,
        createdAt: String(s.created_at),
        dateLabel: formatDate(String(s.created_at)),
      };
    });
  },

  async listRecommendations(farmerId: string) {
    const { data, error } = await supabase
      .from('crm_recommendations')
      .select('*, farm_blocks(name, crop_name)')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(30);
    throwIfSupabaseError(error, 'Could not load recommendations');

    return {
      recommendations: (data ?? []).map((r) => this.mapRecommendation(r)),
    };
  },

  mapRecommendation(r: Record<string, unknown>) {
    const block = r.farm_blocks as { name?: string; crop_name?: string } | null;
    const text = [r.products, r.dosage, r.recommendation].filter(Boolean).join('\n');
    const products = parseRecommendationProducts(r.products);

    return {
      id: String(r.id),
      kind: products.length ? ('product' as const) : ('technical' as const),
      title: r.problem ? String(r.problem) : 'Crop recommendation',
      blockName: block?.name ? String(block.name) : null,
      cropName: block?.crop_name ? String(block.crop_name) : 'Crop',
      dateLabel: formatDate(String(r.created_at)),
      bullets: parseBullets(text),
      dosage: r.dosage ? String(r.dosage) : null,
      waterRequirement: r.water_requirement ? String(r.water_requirement) : null,
      applicationTiming: r.application_timing ? String(r.application_timing) : null,
      followUpDate: r.follow_up_at ? formatDate(String(r.follow_up_at)) : null,
      expectedRecoveryDays: r.expected_recovery_days != null ? Number(r.expected_recovery_days) : null,
      applicationMethod: r.application_method ? String(r.application_method) : null,
      status: r.status ? String(r.status) : 'active',
      products,
      appliedAt: r.applied_at ? formatDate(String(r.applied_at)) : null,
    };
  },

  async getRecommendation(farmerId: string, id: string) {
    const { data, error } = await supabase
      .from('crm_recommendations')
      .select('*, farm_blocks(name, crop_name)')
      .eq('farmer_id', farmerId)
      .eq('id', id)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load recommendation');
    if (!data) throw new NotFoundError('Recommendation not found');

    const base = this.mapRecommendation(data as Record<string, unknown>);
    const steps = parseBullets(String(data.recommendation ?? ''));
    return {
      ...base,
      applicationSteps: steps.length ? steps : base.bullets,
      recoveryTimeline: base.expectedRecoveryDays
        ? `Expected recovery in ${base.expectedRecoveryDays} days`
        : base.followUpDate
          ? `Follow up on ${base.followUpDate}`
          : null,
    };
  },

  async markRecommendationApplied(farmerId: string, id: string) {
    const { data, error } = await supabase
      .from('crm_recommendations')
      .update({ status: 'applied', applied_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('farmer_id', farmerId)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not update recommendation');
    if (!data) throw new NotFoundError('Recommendation not found');
    return { ok: true };
  },

  async listActivities(
    farmerId: string,
    query: { blockId?: string; type?: string; from?: string; to?: string }
  ) {
    const blocks = await blockService.listByFarmer(farmerId);
    const blockNameById = new Map(blocks.map((b) => [b.id, blockDisplayName(b)]));

    let q = supabase
      .from('cultivation_activities')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('applied_at', { ascending: false })
      .limit(50);

    if (query.blockId) {
      q = q.or(`farm_block_id.eq.${query.blockId},block_id.eq.${query.blockId}`);
    }
    if (query.type) q = q.eq('activity_type', query.type);
    if (query.from) q = q.gte('applied_at', query.from);
    if (query.to) q = q.lte('applied_at', query.to);

    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load activities');

    return {
      activities: (data ?? []).map((a) => {
        const resolvedBlockId = a.farm_block_id ?? a.block_id;
        const blockIdStr = resolvedBlockId ? String(resolvedBlockId) : '';
        return {
          id: String(a.id),
          blockId: blockIdStr,
          blockName: blockIdStr ? (blockNameById.get(blockIdStr) ?? null) : null,
          activityType: String(a.activity_type ?? 'other'),
          activityLabel: String(a.activity_label ?? a.activity_type ?? 'Activity'),
          activityDate: String(a.applied_at).slice(0, 10),
          dateLabel: formatDate(String(a.applied_at)),
          costInr: a.cost_inr != null ? Number(a.cost_inr) : null,
          status: String(a.activity_status ?? 'completed'),
          notes: a.notes ? String(a.notes) : null,
        };
      }),
    };
  },

  async createActivity(
    farmerId: string,
    input: {
      blockId: string;
      activityType: 'spray_applied' | 'fertigation' | 'drench' | 'scouting' | 'irrigation' | 'other';
      activityTypeId?: string;
      activityDate: string;
      productUsed?: string;
      quantity?: string;
      notes?: string;
      costInr?: number;
    }
  ) {
    const block = await blockService.getById(input.blockId, farmerId);
    if (!block) throw new NotFoundError('Field not found');

    const activityType =
      input.activityType === 'irrigation' ? 'other' : input.activityType;

    const label =
      input.productUsed?.trim() ||
      (input.activityType === 'irrigation' ? 'Irrigation' : input.activityType.replace(/_/g, ' '));

    const notes = [input.notes, input.quantity ? `Qty: ${input.quantity}` : null].filter(Boolean).join(' · ');

    await whatsappOsAdminService.createFieldActivity({
      blockId: input.blockId,
      activityType,
      activityTypeId: input.activityTypeId,
      activityLabel: label,
      activityDate: input.activityDate,
      notes: notes || undefined,
      costInr: input.costInr ?? null,
      source: 'mobile',
      status: 'completed',
    });

    return this.listActivities(farmerId, { blockId: input.blockId });
  },

  async createRoiEntry(
    farmerId: string,
    input: { entryType: RoiEntryType; amount: number; entryDate: string; comments?: string }
  ) {
    const id = await roiFlowService.recordEntry({
      farmerId,
      entryType: input.entryType,
      amount: input.amount,
      entryDate: input.entryDate,
      comments: input.comments,
    });
    return { id };
  },

  async getWeather(farmerId: string, blockId?: string) {
    const block = blockId
      ? await blockService.getById(blockId, farmerId)
      : await blockService.getPrimaryBlock(farmerId);

    const captured = await weatherSnapshotService.capture({
      farmerId,
      blockId: block?.id ?? null,
      eventType: 'manual',
      eventId: null,
    });

    if (!captured) {
      return {
        blockId: block?.id ?? null,
        locationLabel: null,
        rainfallMm: null,
        rainfallForecastMm: null,
        humidityPct: null,
        temperatureC: null,
        diseaseRiskScore: null,
        diseaseAlerts: [] as string[],
        summary: 'Weather data unavailable for this location.',
      };
    }

    const ctx = captured.context as Record<string, unknown>;
    const alerts = Array.isArray(ctx.disease_alerts)
      ? (ctx.disease_alerts as string[]).map(String)
      : [];

    return {
      blockId: block?.id ?? null,
      locationLabel: ctx.location_label ? String(ctx.location_label) : null,
      rainfallMm: ctx.rainfall_mm != null ? Number(ctx.rainfall_mm) : null,
      rainfallForecastMm: ctx.rainfall_mm_forecast != null ? Number(ctx.rainfall_mm_forecast) : null,
      humidityPct: ctx.humidity_pct != null ? Number(ctx.humidity_pct) : null,
      temperatureC: ctx.temperature_c != null ? Number(ctx.temperature_c) : null,
      diseaseRiskScore: ctx.weather_risk_score != null ? Number(ctx.weather_risk_score) : null,
      diseaseAlerts: alerts,
      summary:
        alerts.length > 0
          ? `Disease risk elevated: ${alerts.join(', ').replace(/_/g, ' ')}`
          : 'Weather conditions look manageable today.',
    };
  },

  async getMarketPrices(farmerId: string, crop?: string) {
    const block = await blockService.getPrimaryBlock(farmerId);
    const cropType = (crop ?? block?.crop_type ?? 'ginger').toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const { date, rows } = await fetchPriceRows(cropType, today);

    const mapped = (rows ?? []).map((r) => {
      const price = Number(r.price_per_kg);
      const last = r.last_year_price_per_kg != null ? Number(r.last_year_price_per_kg) : null;
      let trend: 'up' | 'down' | 'flat' | null = null;
      if (last != null) {
        if (price > last * 1.02) trend = 'up';
        else if (price < last * 0.98) trend = 'down';
        else trend = 'flat';
      }
      return {
        marketName: String(r.market_name),
        pricePerKg: price,
        lastYearPricePerKg: last,
        trend,
      };
    });

    const top = mapped[0];
    const summary = top
      ? `${cropType}: ₹${top.pricePerKg}/kg at ${top.marketName}${top.trend ? ` (${top.trend})` : ''}`
      : `No published prices for ${cropType} today.`;

    return { crop: cropType, date, rows: mapped, summary };
  },

  async getRoiDashboard(farmerId: string) {
    const { cropSeasonService } = await import('./crop-season.service.js');
    const active = await cropSeasonService.getActiveDashboard(farmerId);
    const breakdownLegacy = { inputs: 0, labor: 0, operations: 0, other: 0 };
    for (const b of active.breakdown) {
      const l = b.label.toLowerCase();
      if (l.includes('labour') || l.includes('labor')) breakdownLegacy.labor += b.value;
      else if (l.includes('fert') || l.includes('spray') || l.includes('purchase')) breakdownLegacy.inputs += b.value;
      else if (l.includes('irrig') || l.includes('mach')) breakdownLegacy.operations += b.value;
      else breakdownLegacy.other += b.value;
    }

    return {
      seasonId: active.seasonId,
      blockName: active.blockName,
      dap: active.dap,
      stageLabel: active.stageLabel,
      investmentInr: active.spentInr,
      projectedRevenueInr: active.expectedIncomeInr,
      profitInr: active.netProfitInr,
      spentInr: active.spentInr,
      expectedIncomeInr: active.expectedIncomeInr,
      netProfitInr: active.netProfitInr,
      roiPercent: active.roiPercent,
      yieldForecast: active.yieldEstimate,
      acreage: active.acreage,
      marketNote: active.marketNote,
      seasonLabel: active.seasonLabel,
      breakdown: breakdownLegacy,
      breakdownByType: active.breakdown,
      recentEntries: active.recentEntries.map((e) => ({
        id: e.id,
        dateLabel: e.dateLabel,
        category: e.label,
        amountInr: e.amountInr,
        type: e.type,
        note: e.note,
        icon: e.icon,
      })),
    };
  },
};
