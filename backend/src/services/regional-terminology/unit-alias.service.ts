import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import {
  normalizeLexiconToken,
  pickBestScopedRow,
} from './terminology-match.util.js';

export const FARM_ACTIVITY_CANONICAL_UNITS = [
  'kg',
  'g',
  'litre',
  'ml',
  'quintal',
  'tonne',
  'bag',
  'piece',
  'hour',
  'day',
  'acre',
  'other',
] as const;

export type FarmActivityCanonicalUnit = (typeof FARM_ACTIVITY_CANONICAL_UNITS)[number];

export type UnitAliasMatch = {
  id: string;
  alias: string;
  language: string;
  canonicalUnit: FarmActivityCanonicalUnit;
  cropType: string | null;
  district: string | null;
  farmerId: string | null;
  status: string;
  source: 'farmer' | 'district_crop' | 'crop' | 'global' | 'builtin';
};

const BUILTIN_UNIT_ALIASES: Record<string, FarmActivityCanonicalUnit> = {
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  g: 'g',
  gram: 'g',
  grams: 'g',
  litre: 'litre',
  liter: 'litre',
  litres: 'litre',
  liters: 'litre',
  l: 'litre',
  ml: 'ml',
  millilitre: 'ml',
  milliliter: 'ml',
  quintal: 'quintal',
  qtl: 'quintal',
  tonne: 'tonne',
  ton: 'tonne',
  bag: 'bag',
  bags: 'bag',
  piece: 'piece',
  pcs: 'piece',
  hour: 'hour',
  hr: 'hour',
  hours: 'hour',
  day: 'day',
  days: 'day',
  acre: 'acre',
  acres: 'acre',
};

function isCanonicalUnit(value: string): value is FarmActivityCanonicalUnit {
  return (FARM_ACTIVITY_CANONICAL_UNITS as readonly string[]).includes(value);
}

function mapRow(row: Record<string, unknown>): UnitAliasMatch {
  const cropType = row.crop_type ? String(row.crop_type) : null;
  const district = row.district ? String(row.district) : null;
  const farmerId = row.farmer_id ? String(row.farmer_id) : null;
  const canonical = String(row.canonical_unit);
  let source: UnitAliasMatch['source'] = 'global';
  if (farmerId) source = 'farmer';
  else if (district && cropType) source = 'district_crop';
  else if (cropType) source = 'crop';

  return {
    id: String(row.id),
    alias: String(row.alias),
    language: String(row.language ?? 'en'),
    canonicalUnit: isCanonicalUnit(canonical) ? canonical : 'other',
    cropType,
    district,
    farmerId,
    status: String(row.status ?? 'pending'),
    source,
  };
}

function scoreAlias(
  row: UnitAliasMatch,
  opts: { farmerId?: string | null; cropType?: string | null; district?: string | null }
): number {
  if (row.farmerId) {
    if (!opts.farmerId || row.farmerId !== opts.farmerId) return -1;
    return 200;
  }
  const scoped = pickBestScopedRow([{ cropType: row.cropType, district: row.district }], {
    cropType: opts.cropType,
    district: opts.district,
  });
  if (!scoped) return -1;
  return row.district && row.cropType ? 100 : row.district ? 80 : row.cropType ? 60 : 40;
}

export const unitAliasService = {
  async resolve(params: {
    alias: string;
    language: string;
    farmerId?: string | null;
    cropType?: string | null;
    district?: string | null;
  }): Promise<UnitAliasMatch | null> {
    const alias = normalizeLexiconToken(params.alias);
    if (!alias) return null;

    const { data, error } = await supabase
      .from('farm_activity_unit_aliases')
      .select('*')
      .eq('language', params.language)
      .eq('status', 'approved')
      .ilike('alias', alias)
      .limit(40);
    throwIfSupabaseError(error, 'Could not resolve unit alias');

    const mapped = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    let best: UnitAliasMatch | null = null;
    let bestScore = -1;
    for (const row of mapped) {
      if (normalizeLexiconToken(row.alias) !== alias) continue;
      const score = scoreAlias(row, params);
      if (score > bestScore) {
        best = row;
        bestScore = score;
      }
    }
    if (best) return best;

    const builtin = BUILTIN_UNIT_ALIASES[alias];
    if (!builtin) return null;
    return {
      id: `builtin-unit:${alias}`,
      alias,
      language: params.language,
      canonicalUnit: builtin,
      cropType: null,
      district: null,
      farmerId: null,
      status: 'approved',
      source: 'builtin',
    };
  },

  async propose(params: {
    alias: string;
    language: string;
    canonicalUnit: FarmActivityCanonicalUnit;
    farmerId?: string | null;
    cropType?: string | null;
    district?: string | null;
    proposedBy?: string | null;
    sourceDraftId?: string | null;
    sourceMessageId?: string | null;
    reviewTaskId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<UnitAliasMatch> {
    if (!isCanonicalUnit(params.canonicalUnit)) {
      throw new Error(`Unsupported canonical unit: ${params.canonicalUnit}`);
    }
    const alias = normalizeLexiconToken(params.alias);
    const { data, error } = await supabase
      .from('farm_activity_unit_aliases')
      .insert({
        alias,
        language: params.language || 'en',
        canonical_unit: params.canonicalUnit,
        farmer_id: params.farmerId ?? null,
        crop_type: params.cropType ?? null,
        district: params.district ?? null,
        status: 'pending',
        proposed_by: params.proposedBy ?? null,
        source_draft_id: params.sourceDraftId ?? null,
        source_message_id: params.sourceMessageId ?? null,
        review_task_id: params.reviewTaskId ?? null,
        metadata: params.metadata ?? {},
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not propose unit alias');
    return mapRow(data as Record<string, unknown>);
  },

  async list(params?: {
    status?: string;
    language?: string;
    search?: string;
    limit?: number;
  }): Promise<UnitAliasMatch[]> {
    let q = supabase
      .from('farm_activity_unit_aliases')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(params?.limit ?? 200);
    if (params?.status && params.status !== 'all') q = q.eq('status', params.status);
    if (params?.language) q = q.eq('language', params.language);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not list unit aliases');
    let rows = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    if (params?.search?.trim()) {
      const s = params.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.alias.toLowerCase().includes(s) ||
          r.canonicalUnit.toLowerCase().includes(s)
      );
    }
    return rows;
  },

  async setStatus(params: {
    id: string;
    status: 'approved' | 'rejected' | 'retired' | 'pending';
    approvedBy?: string | null;
  }): Promise<UnitAliasMatch> {
    const patch: Record<string, unknown> = {
      status: params.status,
      updated_at: new Date().toISOString(),
    };
    if (params.status === 'approved') {
      patch.approved_by = params.approvedBy ?? null;
      patch.approved_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('farm_activity_unit_aliases')
      .update(patch)
      .eq('id', params.id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update unit alias');
    return mapRow(data as Record<string, unknown>);
  },
};
