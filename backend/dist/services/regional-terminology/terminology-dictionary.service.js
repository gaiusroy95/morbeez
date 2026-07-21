import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { normalizeRegionalFarmerQuery } from '../ai/regional-query-normalize.util.js';
import { farmerTerminologyMemoryService } from './farmer-terminology-memory.service.js';
import { normalizeLexiconToken, pickBestScopedRow, } from './terminology-match.util.js';
const BUILTIN = {
    chimb: { meaning: 'new shoot / tiller emergence', standardTerm: 'shoot emergence', crop: 'cardamom' },
    chimbi: { meaning: 'new shoot / tiller emergence', standardTerm: 'shoot emergence', crop: 'cardamom' },
    kana: { meaning: 'new sprout / young shoot', standardTerm: 'shoot emergence' },
    kanaya: { meaning: 'new sprout / young shoot', standardTerm: 'shoot emergence' },
};
function mapRow(row) {
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
        source: 'dictionary',
    };
}
async function lookupDictionaryRows(token, language, opts) {
    const { data, error } = await supabase
        .from('agronomy_terms')
        .select('*')
        .eq('term', token)
        .eq('language', language)
        .eq('status', 'active')
        .limit(40);
    throwIfSupabaseError(error, 'Could not lookup terminology');
    const rows = (data ?? []).map((row) => {
        const mapped = mapRow(row);
        return {
            ...mapped,
            cropType: mapped.cropType,
            district: mapped.district,
            confidence: mapped.confidence,
        };
    });
    const best = pickBestScopedRow(rows, {
        cropType: opts?.cropType,
        district: opts?.district,
    });
    return best ?? null;
}
async function lookupAlias(token, language, opts) {
    const { data: aliasRows, error } = await supabase
        .from('terminology_term_aliases')
        .select('term_id, agronomy_terms(*)')
        .eq('alias', token)
        .eq('language', language)
        .limit(40);
    throwIfSupabaseError(error, 'Could not lookup terminology alias');
    const candidates = [];
    for (const aliasRow of aliasRows ?? []) {
        const rawTerm = aliasRow.agronomy_terms;
        const termRow = (Array.isArray(rawTerm) ? rawTerm[0] : rawTerm);
        if (!termRow || String(termRow.status ?? 'active') !== 'active')
            continue;
        if (String(termRow.language ?? language) !== language)
            continue;
        candidates.push(mapRow(termRow));
    }
    return (pickBestScopedRow(candidates, {
        cropType: opts?.cropType,
        district: opts?.district,
    }) ?? null);
}
function lookupBuiltin(token, language, opts) {
    const builtin = BUILTIN[token];
    if (!builtin)
        return null;
    if (builtin.crop && opts?.cropType && builtin.crop !== opts.cropType)
        return null;
    return {
        id: `builtin:${token}`,
        term: token,
        language,
        meaning: builtin.meaning,
        standardTerm: builtin.standardTerm,
        localScript: null,
        cropType: builtin.crop ?? null,
        district: null,
        confidence: 0.95,
        source: 'builtin',
    };
}
export const terminologyDictionaryService = {
    /**
     * Deterministic lookup priority:
     * farmer override → district+crop → crop → language-global → builtin.
     * District fallback always retains language.
     */
    async lookup(token, language, opts) {
        const key = normalizeLexiconToken(token);
        if (!key || key.length < 2)
            return null;
        if (opts?.farmerId) {
            const farmerHit = await farmerTerminologyMemoryService.lookup({
                farmerId: opts.farmerId,
                term: key,
                language,
                cropType: opts.cropType,
                district: opts.district,
            });
            if (farmerHit)
                return farmerHit;
        }
        const dictionaryHit = await lookupDictionaryRows(key, language, opts);
        if (dictionaryHit)
            return dictionaryHit;
        const aliasHit = await lookupAlias(key, language, opts);
        if (aliasHit)
            return aliasHit;
        const builtin = lookupBuiltin(key, language, opts);
        if (builtin)
            return builtin;
        const normalized = normalizeRegionalFarmerQuery(token);
        if (normalized !== token && normalized.length >= 2) {
            return this.lookup(normalized.split(/\s+/)[0] ?? normalized, language, opts);
        }
        return null;
    },
    async upsertApproved(params) {
        const term = normalizeLexiconToken(params.term);
        const { data, error } = await supabase
            .from('agronomy_terms')
            .upsert({
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
            status: 'active',
        }, { onConflict: 'term,language,crop_type,district' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not save terminology');
        return mapRow(data);
    },
    async listForContext(opts) {
        const { data, error } = await supabase
            .from('agronomy_terms')
            .select('*')
            .eq('language', opts.language)
            .eq('status', 'active')
            .order('confidence', { ascending: false })
            .limit(Math.max((opts.limit ?? 40) * 3, 40));
        throwIfSupabaseError(error, 'Could not list terminology');
        const mapped = (data ?? []).map((r) => mapRow(r));
        const ranked = mapped
            .map((row) => ({
            row,
            score: pickBestScopedRow([row], {
                cropType: opts.cropType,
                district: opts.district,
            })
                ? (row.district && row.cropType
                    ? 100
                    : row.district
                        ? 80
                        : row.cropType
                            ? 60
                            : 40) + row.confidence
                : -1,
        }))
            .filter((x) => x.score >= 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, opts.limit ?? 40)
            .map((x) => x.row);
        return ranked;
    },
};
//# sourceMappingURL=terminology-dictionary.service.js.map