import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { normalizeLexiconToken, normalizeScopeKey } from './terminology-match.util.js';
import type { TerminologyDictionaryEntry } from './types.js';

function memoryEnabled(): boolean {
  return env.ENABLE_FARMER_TERMINOLOGY_MEMORY === true;
}

function mapOverride(row: Record<string, unknown>): TerminologyDictionaryEntry {
  return {
    id: `farmer:${String(row.id)}`,
    term: String(row.term),
    language: String(row.language ?? 'en'),
    meaning: String(row.resolved_meaning),
    standardTerm: row.standard_term ? String(row.standard_term) : String(row.resolved_meaning),
    localScript: null,
    cropType: row.crop_type ? String(row.crop_type) : null,
    district: row.district ? String(row.district) : null,
    confidence: 0.99,
    replyPreferred: true,
    conceptId: null,
    source: 'farmer',
  };
}

/**
 * Farmer-scoped lexicon read/write path.
 * Personal overrides never auto-promote to regional agronomy_terms.
 */
export const farmerTerminologyMemoryService = {
  enabled: memoryEnabled,

  async lookup(params: {
    farmerId: string;
    term: string;
    language: string;
    cropType?: string | null;
    district?: string | null;
  }): Promise<TerminologyDictionaryEntry | null> {
    if (!memoryEnabled()) return null;
    const term = normalizeLexiconToken(params.term);
    if (!term || term.length < 2) return null;

    const { data, error } = await supabase
      .from('farmer_terminology_overrides')
      .select('*')
      .eq('farmer_id', params.farmerId)
      .eq('language', params.language)
      .eq('term', term)
      .eq('active', true)
      .limit(20);
    throwIfSupabaseError(error, 'Could not lookup farmer terminology override');

    const rows = (data ?? []) as Record<string, unknown>[];
    if (!rows.length) return null;

    const wantCrop = normalizeScopeKey(params.cropType);
    const wantDistrict = normalizeScopeKey(params.district);

    const ranked = rows
      .map((row) => {
        const crop = normalizeScopeKey(row.crop_type ? String(row.crop_type) : null);
        const district = normalizeScopeKey(row.district ? String(row.district) : null);
        if (crop && wantCrop && crop !== wantCrop) return null;
        if (district && wantDistrict && district !== wantDistrict) return null;
        if (crop && !wantCrop) return null;
        if (district && !wantDistrict) return null;
        let score = 0;
        if (district && wantDistrict) score += crop && wantCrop ? 100 : 80;
        else if (crop && wantCrop) score += 60;
        else if (!crop && !district) score += 40;
        else return null;
        return { row, score };
      })
      .filter((x): x is { row: Record<string, unknown>; score: number } => Boolean(x))
      .sort((a, b) => b.score - a.score);

    return ranked[0] ? mapOverride(ranked[0].row) : null;
  },

  /**
   * Persist a farmer-confirmed nickname/meaning immediately.
   * Regional promotion remains a separate agronomist-reviewed path.
   */
  async upsertOverride(params: {
    farmerId: string;
    term: string;
    language: string;
    meaning: string;
    standardTerm?: string | null;
    cropType?: string | null;
    district?: string | null;
    sourceDraftId?: string | null;
    sourceMessageId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<TerminologyDictionaryEntry | null> {
    if (!memoryEnabled()) return null;
    const term = normalizeLexiconToken(params.term);
    if (!term || !params.meaning.trim()) return null;

    const { data, error } = await supabase
      .from('farmer_terminology_overrides')
      .upsert(
        {
          farmer_id: params.farmerId,
          term,
          language: params.language || 'en',
          resolved_meaning: params.meaning.trim().slice(0, 500),
          standard_term: params.standardTerm?.trim().slice(0, 200) ?? params.meaning.trim().slice(0, 200),
          crop_type: params.cropType ?? null,
          district: params.district ?? null,
          source_draft_id: params.sourceDraftId ?? null,
          source_message_id: params.sourceMessageId ?? null,
          active: true,
          metadata: params.metadata ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'farmer_id,term,language,crop_key,district_key' }
      )
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not save farmer terminology override');
    return mapOverride(data as Record<string, unknown>);
  },

  async listForFarmer(params: {
    farmerId: string;
    language?: string;
    limit?: number;
  }): Promise<TerminologyDictionaryEntry[]> {
    if (!memoryEnabled()) return [];
    let q = supabase
      .from('farmer_terminology_overrides')
      .select('*')
      .eq('farmer_id', params.farmerId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(params.limit ?? 100);
    if (params.language) q = q.eq('language', params.language);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not list farmer terminology overrides');
    return (data ?? []).map((row) => mapOverride(row as Record<string, unknown>));
  },
};
