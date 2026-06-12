import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { normalizeRegionalFarmerQuery } from '../ai/regional-query-normalize.util.js';
import type { AdvisoryLanguage } from '../ai/types.js';
import type { TerminologyDictionaryEntry } from './types.js';

const BUILTIN: Record<string, { meaning: string; standardTerm: string; crop?: string }> = {
  chimb: { meaning: 'new shoot / tiller emergence', standardTerm: 'shoot emergence', crop: 'cardamom' },
  chimbi: { meaning: 'new shoot / tiller emergence', standardTerm: 'shoot emergence', crop: 'cardamom' },
  kana: { meaning: 'new sprout / young shoot', standardTerm: 'shoot emergence' },
  kanaya: { meaning: 'new sprout / young shoot', standardTerm: 'shoot emergence' },
};

function mapRow(row: Record<string, unknown>): TerminologyDictionaryEntry {
  return {
    id: String(row.id),
    term: String(row.term),
    language: String(row.language ?? 'en'),
    meaning: String(row.meaning),
    standardTerm: row.standard_term ? String(row.standard_term) : null,
    localScript: row.local_script ? String(row.local_script) : null,
    cropType: row.crop_type ? String(row.crop_type) : null,
    district: row.district ? String(row.district) : null,
    confidence: Number(row.confidence ?? 0.7),
    replyPreferred: row.reply_preferred !== false,
    conceptId: row.concept_id ? String(row.concept_id) : null,
  };
}

async function lookupAlias(
  token: string,
  language: AdvisoryLanguage,
  opts?: { cropType?: string | null; district?: string | null }
): Promise<TerminologyDictionaryEntry | null> {
  const key = token.trim().toLowerCase();
  const { data: aliasRow, error } = await supabase
    .from('terminology_term_aliases')
    .select('term_id, agronomy_terms(*)')
    .eq('alias', key)
    .eq('language', language)
    .limit(1)
    .maybeSingle();
  throwIfSupabaseError(error, 'Could not lookup terminology alias');
  const rawTerm = aliasRow?.agronomy_terms as unknown;
  const termRow = (Array.isArray(rawTerm) ? rawTerm[0] : rawTerm) as Record<string, unknown> | null | undefined;
  if (!termRow || String(termRow.status ?? 'active') !== 'active') return null;
  if (opts?.cropType && termRow.crop_type && String(termRow.crop_type) !== opts.cropType) return null;
  if (opts?.district && termRow.district && String(termRow.district) !== opts.district) return null;
  return mapRow(termRow);
}

export const terminologyDictionaryService = {
  async lookup(
    token: string,
    language: AdvisoryLanguage,
    opts?: { cropType?: string | null; district?: string | null }
  ): Promise<TerminologyDictionaryEntry | null> {
    const key = token.trim().toLowerCase();
    if (!key || key.length < 2) return null;

    const builtin = BUILTIN[key];
    if (builtin && (!builtin.crop || !opts?.cropType || builtin.crop === opts.cropType)) {
      return {
        id: `builtin:${key}`,
        term: key,
        language,
        meaning: builtin.meaning,
        standardTerm: builtin.standardTerm,
        localScript: null,
        cropType: builtin.crop ?? null,
        district: null,
        confidence: 0.95,
      };
    }

    let q = supabase
      .from('agronomy_terms')
      .select('*')
      .eq('term', key)
      .eq('language', language)
      .eq('status', 'active');

    if (opts?.cropType) q = q.or(`crop_type.is.null,crop_type.eq.${opts.cropType}`);

    const { data, error } = await q.order('confidence', { ascending: false }).limit(1).maybeSingle();
    throwIfSupabaseError(error, 'Could not lookup terminology');
    if (data) return mapRow(data as Record<string, unknown>);

    const aliasHit = await lookupAlias(key, language, opts);
    if (aliasHit) return aliasHit;

    if (opts?.district) {
      const { data: dRow, error: dErr } = await supabase
        .from('agronomy_terms')
        .select('*')
        .eq('term', key)
        .eq('district', opts.district)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      throwIfSupabaseError(dErr, 'Could not lookup terminology by district');
      if (dRow) return mapRow(dRow as Record<string, unknown>);
    }

    const normalized = normalizeRegionalFarmerQuery(token);
    if (normalized !== token && normalized.length >= 2) {
      return this.lookup(normalized.split(/\s+/)[0] ?? normalized, language, opts);
    }

    return null;
  },

  async upsertApproved(params: {
    term: string;
    language: string;
    meaning: string;
    standardTerm?: string | null;
    localScript?: string | null;
    cropType?: string | null;
    district?: string | null;
    approvedBy?: string;
    confidence?: number;
  }): Promise<TerminologyDictionaryEntry> {
    const term = params.term.trim().toLowerCase();
    const { data, error } = await supabase
      .from('agronomy_terms')
      .upsert(
        {
          term,
          language: params.language || 'en',
          meaning: params.meaning.trim().slice(0, 500),
          standard_term: params.standardTerm?.trim().slice(0, 200) ?? null,
          local_script: params.localScript?.trim().slice(0, 120) ?? null,
          crop_type: params.cropType ?? null,
          district: params.district ?? null,
          confidence: params.confidence ?? 0.92,
          created_by: 'agronomist',
          approved_by: params.approvedBy ?? null,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'term,language,crop_type,district' }
      )
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not save terminology');
    return mapRow(data as Record<string, unknown>);
  },

  async listForContext(opts: {
    language: AdvisoryLanguage;
    cropType?: string | null;
    district?: string | null;
    limit?: number;
  }): Promise<TerminologyDictionaryEntry[]> {
    let q = supabase
      .from('agronomy_terms')
      .select('*')
      .eq('language', opts.language)
      .order('confidence', { ascending: false })
      .limit(opts.limit ?? 40);

    if (opts.cropType) q = q.or(`crop_type.is.null,crop_type.eq.${opts.cropType}`);

    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not list terminology');
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  },
};
