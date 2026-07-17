import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import {
  normalizeLexiconToken,
  pickBestScopedRow,
} from './terminology-match.util.js';

export type ProductAliasMatch = {
  id: string;
  alias: string;
  language: string;
  canonicalProductKey: string;
  shopifyProductId: string | null;
  cropType: string | null;
  district: string | null;
  farmerId: string | null;
  status: string;
  source: 'farmer' | 'district_crop' | 'crop' | 'global';
};

function mapRow(row: Record<string, unknown>): ProductAliasMatch {
  const cropType = row.crop_type ? String(row.crop_type) : null;
  const district = row.district ? String(row.district) : null;
  const farmerId = row.farmer_id ? String(row.farmer_id) : null;
  let source: ProductAliasMatch['source'] = 'global';
  if (farmerId) source = 'farmer';
  else if (district && cropType) source = 'district_crop';
  else if (cropType) source = 'crop';

  return {
    id: String(row.id),
    alias: String(row.alias),
    language: String(row.language ?? 'en'),
    canonicalProductKey: String(row.canonical_product_key),
    shopifyProductId: row.shopify_product_id ? String(row.shopify_product_id) : null,
    cropType,
    district,
    farmerId,
    status: String(row.status ?? 'pending'),
    source,
  };
}

function scoreAlias(
  row: ProductAliasMatch,
  opts: { farmerId?: string | null; cropType?: string | null; district?: string | null }
): number {
  if (row.farmerId) {
    if (!opts.farmerId || row.farmerId !== opts.farmerId) return -1;
    const scoped = pickBestScopedRow([{ cropType: row.cropType, district: row.district }], {
      cropType: opts.cropType,
      district: opts.district,
    });
    return scoped ? 200 : -1;
  }
  const scoped = pickBestScopedRow([{ cropType: row.cropType, district: row.district }], {
    cropType: opts.cropType,
    district: opts.district,
  });
  if (!scoped) return -1;
  return row.district && row.cropType ? 100 : row.district ? 80 : row.cropType ? 60 : 40;
}

export const productAliasService = {
  async resolve(params: {
    alias: string;
    language: string;
    farmerId?: string | null;
    cropType?: string | null;
    district?: string | null;
  }): Promise<ProductAliasMatch | null> {
    const alias = normalizeLexiconToken(params.alias);
    if (!alias) return null;

    const { data, error } = await supabase
      .from('farm_activity_product_aliases')
      .select('*')
      .eq('language', params.language)
      .eq('status', 'approved')
      .ilike('alias', alias)
      .limit(40);
    throwIfSupabaseError(error, 'Could not resolve product alias');

    const mapped = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    let best: ProductAliasMatch | null = null;
    let bestScore = -1;
    for (const row of mapped) {
      if (normalizeLexiconToken(row.alias) !== alias) continue;
      const score = scoreAlias(row, params);
      if (score > bestScore) {
        best = row;
        bestScore = score;
      }
    }
    return best;
  },

  async propose(params: {
    alias: string;
    language: string;
    canonicalProductKey: string;
    shopifyProductId?: string | null;
    farmerId?: string | null;
    cropType?: string | null;
    district?: string | null;
    proposedBy?: string | null;
    sourceDraftId?: string | null;
    sourceMessageId?: string | null;
    reviewTaskId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ProductAliasMatch> {
    const alias = normalizeLexiconToken(params.alias);
    const { data, error } = await supabase
      .from('farm_activity_product_aliases')
      .insert({
        alias,
        language: params.language || 'en',
        canonical_product_key: params.canonicalProductKey.trim().slice(0, 200),
        shopify_product_id: params.shopifyProductId ?? null,
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
    throwIfSupabaseError(error, 'Could not propose product alias');
    return mapRow(data as Record<string, unknown>);
  },

  async list(params?: {
    status?: string;
    language?: string;
    search?: string;
    limit?: number;
  }): Promise<ProductAliasMatch[]> {
    let q = supabase
      .from('farm_activity_product_aliases')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(params?.limit ?? 200);
    if (params?.status && params.status !== 'all') q = q.eq('status', params.status);
    if (params?.language) q = q.eq('language', params.language);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not list product aliases');
    let rows = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    if (params?.search?.trim()) {
      const s = params.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.alias.toLowerCase().includes(s) ||
          r.canonicalProductKey.toLowerCase().includes(s)
      );
    }
    return rows;
  },

  async setStatus(params: {
    id: string;
    status: 'approved' | 'rejected' | 'retired' | 'pending';
    approvedBy?: string | null;
  }): Promise<ProductAliasMatch> {
    const patch: Record<string, unknown> = {
      status: params.status,
      updated_at: new Date().toISOString(),
    };
    if (params.status === 'approved') {
      patch.approved_by = params.approvedBy ?? null;
      patch.approved_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('farm_activity_product_aliases')
      .update(patch)
      .eq('id', params.id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update product alias');
    return mapRow(data as Record<string, unknown>);
  },
};
