import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { blockService } from '../core/block.service.js';
import { fieldStorageService } from '../core/field-storage.service.js';
import { telecallerAdminService } from './telecaller-admin.service.js';

function soilHealthMeta(raw?: string | null) {
  const health = String(raw ?? 'good').toLowerCase();
  if (health === 'good') {
    return { soilHealth: health, soilHealthLabel: 'Good', soilHealthStatus: 'stable' };
  }
  if (health === 'medium') {
    return { soilHealth: health, soilHealthLabel: 'Average', soilHealthStatus: 'monitor' };
  }
  return { soilHealth: health, soilHealthLabel: 'Need assistance', soilHealthStatus: 'alert' };
}

function cropHealthFromTone(tone?: string | null) {
  const t = String(tone ?? '').toLowerCase();
  if (t === 'healthy') {
    return { cropHealthLabel: 'Good', cropHealthStatus: 'stable' };
  }
  if (t === 'warning') {
    return { cropHealthLabel: 'Average', cropHealthStatus: 'monitor' };
  }
  if (t === 'danger') {
    return { cropHealthLabel: 'Need assistance', cropHealthStatus: 'alert' };
  }
  return { cropHealthLabel: '—', cropHealthStatus: 'monitor' };
}

function dapAtDate(plantingDate: string | null | undefined, atIso: string | null | undefined): number | null {
  if (!plantingDate || !atIso) return null;
  const start = new Date(String(plantingDate).slice(0, 10));
  const at = new Date(String(atIso).slice(0, 10));
  start.setHours(0, 0, 0, 0);
  at.setHours(0, 0, 0, 0);
  const dap = Math.floor((at.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return dap >= 0 ? dap : null;
}

function mapFarmerSearchRow(f: {
  id: string;
  phone?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  district?: string | null;
  village?: string | null;
  preferred_language?: string | null;
}) {
  return {
    id: f.id,
    phone: f.phone,
    name:
      [f.first_name, f.last_name].filter(Boolean).join(' ') ||
      String(f.name ?? '').trim() ||
      'Farmer',
    district: f.district,
    village: f.village,
    preferredLanguage: f.preferred_language ?? 'en',
  };
}

export const fieldPwaService = {
  async searchFarmers(q: string, limit = 20) {
    const term = q.trim();
    if (term.length < 2) return [];

    const digits = term.replace(/\D/g, '');
    let query = supabase
      .from('farmers')
      .select('id, phone, name, first_name, last_name, district, village, preferred_language')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (digits.length >= 4) {
      query = query.ilike('phone', `%${digits.slice(-10)}%`);
    } else {
      query = query.or(`name.ilike.%${term}%,first_name.ilike.%${term}%,district.ilike.%${term}%`);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error, 'Could not search farmers');
    return (data ?? []).map((f) => mapFarmerSearchRow(f));
  },

  /** Recent farmers for browse lists (no search term required). */
  async listRecentFarmers(limit = 20) {
    const { data, error } = await supabase
      .from('farmers')
      .select('id, phone, name, first_name, last_name, district, village, preferred_language')
      .order('updated_at', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'Could not load farmers');
    return (data ?? []).map((f) => mapFarmerSearchRow(f));
  },

  async getFarmerBlocks(farmerId: string) {
    const blocks = await blockService.listByFarmer(farmerId);
    if (!blocks.length) return [];

    const blockIds = blocks.map((b) => b.id);

    const [{ data: blockRows }, { data: findings }, { data: soils }, { data: activities }] = await Promise.all([
      supabase
        .from('farm_blocks')
        .select('id, soil_health, last_visit_at, area, acreage_decimal')
        .in('id', blockIds),
      supabase
        .from('crm_field_findings')
        .select('block_id, disease_tone, disease_pest, observations, visited_at')
        .eq('farmer_id', farmerId)
        .in('block_id', blockIds)
        .is('archived_at', null)
        .order('visited_at', { ascending: false }),
      supabase
        .from('crm_soil_reports')
        .select('block_id, reported_at')
        .eq('farmer_id', farmerId)
        .in('block_id', blockIds)
        .order('reported_at', { ascending: false }),
      supabase
        .from('cultivation_activities')
        .select('farm_block_id, activity_label, activity_type, applied_at')
        .in('farm_block_id', blockIds)
        .order('applied_at', { ascending: false }),
    ]);

    const rawById = new Map((blockRows ?? []).map((r) => [String(r.id), r]));
    const findingByBlock = new Map<string, NonNullable<typeof findings>[number]>();
    for (const f of findings ?? []) {
      const id = String(f.block_id);
      if (!findingByBlock.has(id)) findingByBlock.set(id, f);
    }
    const soilByBlock = new Map<string, NonNullable<typeof soils>[number]>();
    for (const s of soils ?? []) {
      const id = String(s.block_id);
      if (!soilByBlock.has(id)) soilByBlock.set(id, s);
    }
    const activityByBlock = new Map<string, NonNullable<typeof activities>[number]>();
    for (const a of activities ?? []) {
      const id = String(a.farm_block_id);
      if (!activityByBlock.has(id)) activityByBlock.set(id, a);
    }

    const mapped = blocks.map((b) => {
      const raw = rawById.get(b.id);
      const finding = findingByBlock.get(b.id);
      const soil = soilByBlock.get(b.id);
      const activity = activityByBlock.get(b.id);
      const soilMeta = soilHealthMeta(raw?.soil_health as string | null | undefined);
      const cropMeta = cropHealthFromTone(finding?.disease_tone as string | null | undefined);
      const lastVisitAt =
        (finding?.visited_at ? String(finding.visited_at) : null) ??
        (raw?.last_visit_at ? String(raw.last_visit_at) : null);
      const latestFindingLabel =
        (finding?.disease_pest ? String(finding.disease_pest) : null) ??
        (finding?.observations ? String(finding.observations).slice(0, 80) : null);
      const needsAttention =
        cropMeta.cropHealthStatus === 'alert' ||
        soilMeta.soilHealthStatus === 'alert' ||
        String(finding?.disease_tone ?? '') === 'danger';

      return {
        id: b.id,
        name: b.name,
        cropType: b.crop_type,
        plotLabel: b.plot_label,
        dap: b.dap,
        plantingDate: b.planting_date,
        latitude: b.latitude,
        longitude: b.longitude,
        hasPlotGps: b.latitude != null && b.longitude != null,
        acreage: b.acreage_decimal ?? (raw?.acreage_decimal != null ? Number(raw.acreage_decimal) : null),
        area: raw?.area ? String(raw.area) : null,
        ...soilMeta,
        lastVisitAt,
        lastVisitDap: dapAtDate(b.planting_date, lastVisitAt),
        ...cropMeta,
        latestFindingLabel,
        latestFieldActivity: activity
          ? String(activity.activity_label ?? activity.activity_type ?? '')
          : null,
        latestSoilTestAt: soil?.reported_at ? String(soil.reported_at) : null,
        needsAttention,
      };
    });

    return mapped.sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention));
  },

  async saveBlockLocation(input: {
    blockId: string;
    farmerId: string;
    latitude: number;
    longitude: number;
  }) {
    return blockService.updatePlotLocation(input.blockId, {
      latitude: input.latitude,
      longitude: input.longitude,
      source: 'field_pwa',
      farmerId: input.farmerId,
    });
  },

  async getQuestionnaire(cropType: string) {
    const crop = cropType.trim().toLowerCase() || 'ginger';
    const { data, error } = await supabase
      .from('field_visit_questionnaire')
      .select('*')
      .eq('active', true)
      .in('crop_type', [crop, '_default'])
      .order('sort_order');

    throwIfSupabaseError(error, 'Could not load questionnaire');

    const rows = data ?? [];
    const specific = rows.filter((r) => r.crop_type === crop);
    const use = specific.length ? specific : rows.filter((r) => r.crop_type === '_default');

    return use.map((r) => ({
      id: r.id,
      questionKey: r.question_key,
      labelEn: r.label_en,
      labelMl: r.label_ml,
      inputType: r.input_type,
      options: (r.options as string[]) ?? [],
      required: r.required,
      sortOrder: r.sort_order,
    }));
  },

  async submitVisit(input: {
    farmerId: string;
    blockId: string;
    blockName: string;
    cropType: string;
    leadId?: string;
    agronomistName: string;
    agronomistEmail: string;
    observations?: string;
    diseasePest?: string;
    diseaseTone?: 'healthy' | 'warning' | 'danger';
    actionTaken?: string;
    answers: Array<{ questionKey: string; label: string; value: string }>;
    photos?: Array<{ filename: string; mimeType: string; dataBase64: string }>;
    latitude?: number;
    longitude?: number;
  }) {
    const farmer = await supabase
      .from('farmers')
      .select('id, phone')
      .eq('id', input.farmerId)
      .maybeSingle();

    if (!farmer.data) throw new NotFoundError('Farmer not found');

    let leadId = input.leadId;
    if (!leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('farmer_id', input.farmerId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      leadId = lead?.id ?? undefined;
    }

    const photoUrls = input.photos?.length
      ? await fieldStorageService.uploadPhotos(input.farmerId, input.photos)
      : [];

    const parameters = input.answers.map((a) => ({
      key: a.questionKey,
      label: a.label,
      value: a.value,
    }));

    if (input.latitude != null && input.longitude != null) {
      await blockService.updatePlotLocation(input.blockId, {
        latitude: input.latitude,
        longitude: input.longitude,
        source: 'field_pwa',
        farmerId: input.farmerId,
      });
    }

    const finding = await telecallerAdminService.createFieldFinding(
      input.farmerId,
      leadId ?? null,
      {
        blockId: input.blockId,
        blockName: input.blockName,
        cropType: input.cropType,
        observations: input.observations,
        diseasePest: input.diseasePest,
        diseaseTone: input.diseaseTone,
        actionTaken: input.actionTaken,
        parameters,
        photoUrls,
        agronomistName: input.agronomistName,
        agronomistRole: 'Field Agronomist',
        agentEmail: input.agronomistEmail,
      }
    );

    return { finding, photoUrls };
  },

  async listRecentVisits(agronomistEmail: string, limit = 15, farmerId?: string) {
    let query = supabase
      .from('crm_field_findings')
      .select(
        'id, farmer_id, block_name, crop_type, disease_pest, visited_at, photo_urls, agronomist_name, farmers(name, phone)'
      )
      .is('archived_at', null)
      .order('visited_at', { ascending: false })
      .limit(limit);

    const email = agronomistEmail.trim().toLowerCase();
    if (email) query = query.eq('agronomist_name', email);
    if (farmerId) query = query.eq('farmer_id', farmerId);

    const { data, error } = await query;
    throwIfSupabaseError(error, 'Could not load recent visits');
    return data ?? [];
  },
};
