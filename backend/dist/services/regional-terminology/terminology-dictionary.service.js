import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { normalizeRegionalFarmerQuery } from '../ai/regional-query-normalize.util.js';
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
    };
}
export const terminologyDictionaryService = {
    async lookup(token, language, opts) {
        const key = token.trim().toLowerCase();
        if (!key || key.length < 2)
            return null;
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
            .eq('language', language);
        if (opts?.cropType)
            q = q.or(`crop_type.is.null,crop_type.eq.${opts.cropType}`);
        const { data, error } = await q.order('confidence', { ascending: false }).limit(1).maybeSingle();
        throwIfSupabaseError(error, 'Could not lookup terminology');
        if (data)
            return mapRow(data);
        if (opts?.district) {
            const { data: dRow, error: dErr } = await supabase
                .from('agronomy_terms')
                .select('*')
                .eq('term', key)
                .eq('district', opts.district)
                .limit(1)
                .maybeSingle();
            throwIfSupabaseError(dErr, 'Could not lookup terminology by district');
            if (dRow)
                return mapRow(dRow);
        }
        const normalized = normalizeRegionalFarmerQuery(token);
        if (normalized !== token && normalized.length >= 2) {
            return this.lookup(normalized.split(/\s+/)[0] ?? normalized, language, opts);
        }
        return null;
    },
    async upsertApproved(params) {
        const term = params.term.trim().toLowerCase();
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
        }, { onConflict: 'term,language,crop_type,district' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not save terminology');
        return mapRow(data);
    },
    async listForContext(opts) {
        let q = supabase
            .from('agronomy_terms')
            .select('*')
            .eq('language', opts.language)
            .order('confidence', { ascending: false })
            .limit(opts.limit ?? 40);
        if (opts.cropType)
            q = q.or(`crop_type.is.null,crop_type.eq.${opts.cropType}`);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not list terminology');
        return (data ?? []).map((r) => mapRow(r));
    },
};
//# sourceMappingURL=terminology-dictionary.service.js.map