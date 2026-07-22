import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { learningLoopService } from '../core/learning-loop.service.js';
import { terminologyDictionaryService } from '../regional-terminology/terminology-dictionary.service.js';
import { terminologyEscalationService } from '../regional-terminology/terminology-escalation.service.js';
import { terminologyConceptSuggestService } from '../regional-terminology/terminology-concept-suggest.service.js';
import { farmerTerminologyMemoryService } from '../regional-terminology/farmer-terminology-memory.service.js';
import { productAliasService } from '../regional-terminology/product-alias.service.js';
import { unitAliasService, FARM_ACTIVITY_CANONICAL_UNITS, } from '../regional-terminology/unit-alias.service.js';
const CONCEPT_CATEGORIES = [
    'general',
    'disease',
    'pest',
    'nutrient_deficiency',
    'growth_issue',
    'weather_impact',
];
function mapTermRow(row) {
    const concept = row.agronomy_concepts;
    const aliases = row.terminology_term_aliases ?? [];
    return {
        id: String(row.id),
        term: String(row.term),
        language: String(row.language ?? 'en'),
        meaning: String(row.meaning),
        standardTerm: row.standard_term ? String(row.standard_term) : null,
        localScript: row.local_script ? String(row.local_script) : null,
        cropType: row.crop_type ? String(row.crop_type) : null,
        district: row.district ? String(row.district) : null,
        state: row.state ? String(row.state) : null,
        status: String(row.status ?? 'active'),
        replyPreferred: Boolean(row.reply_preferred ?? true),
        usageCount: Number(row.usage_count ?? 0),
        conceptId: row.concept_id ? String(row.concept_id) : null,
        conceptName: concept?.name ? String(concept.name) : null,
        conceptCode: concept?.concept_code ? String(concept.concept_code) : null,
        conceptCategory: concept?.category ? String(concept.category) : null,
        aliases: aliases.map((a) => ({ alias: String(a.alias), language: String(a.language) })),
        updatedAt: String(row.updated_at ?? row.created_at),
    };
}
export const terminologyAdminService = {
    async getSummary() {
        const [{ count: pending }, { count: approved }, { count: learned }, { count: concepts },] = await Promise.all([
            supabase
                .from('terminology_review_tasks')
                .select('id', { count: 'exact', head: true })
                .in('status', ['open', 'in_review']),
            supabase
                .from('terminology_review_tasks')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'resolved'),
            supabase
                .from('agronomy_terms')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'active'),
            supabase.from('agronomy_concepts').select('id', { count: 'exact', head: true }),
        ]);
        return {
            pendingTerms: pending ?? 0,
            approvedTerms: approved ?? 0,
            learnedTerminologies: learned ?? 0,
            totalConcepts: concepts ?? 0,
        };
    },
    async listConcepts() {
        const [{ data: concepts, error }, { data: terms, error: termErr }] = await Promise.all([
            supabase.from('agronomy_concepts').select('*').order('name'),
            supabase.from('agronomy_terms').select('concept_id, status').eq('status', 'active'),
        ]);
        throwIfSupabaseError(error, 'Could not load concepts');
        throwIfSupabaseError(termErr, 'Could not load term counts');
        const counts = new Map();
        for (const t of terms ?? []) {
            if (t.concept_id)
                counts.set(String(t.concept_id), (counts.get(String(t.concept_id)) ?? 0) + 1);
        }
        return (concepts ?? []).map((row) => ({
            id: String(row.id),
            conceptCode: row.concept_code ? String(row.concept_code) : null,
            name: String(row.name),
            category: String(row.category),
            termCount: counts.get(String(row.id)) ?? 0,
            createdAt: String(row.created_at),
        }));
    },
    async createConcept(input) {
        const category = input.category ?? 'general';
        if (!CONCEPT_CATEGORIES.includes(category)) {
            throw new ValidationError('Invalid concept category');
        }
        const conceptCode = await terminologyConceptSuggestService.nextConceptCode(category);
        const { data, error } = await supabase
            .from('agronomy_concepts')
            .insert({
            name: input.name.trim(),
            category,
            concept_code: conceptCode,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create concept');
        return data;
    },
    async listLearnedTerminologies(params) {
        let q = supabase
            .from('agronomy_terms')
            .select('*, agronomy_concepts(name, category, concept_code), terminology_term_aliases(alias, language)')
            .order('usage_count', { ascending: false })
            .limit(300);
        if (params?.language)
            q = q.eq('language', params.language);
        if (params?.district)
            q = q.eq('district', params.district);
        if (params?.status && params.status !== 'all')
            q = q.eq('status', params.status);
        else
            q = q.eq('status', 'active');
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not load learned terminologies');
        let rows = (data ?? []).map((r) => mapTermRow(r));
        if (params?.search?.trim()) {
            const s = params.search.toLowerCase();
            rows = rows.filter((r) => r.term.toLowerCase().includes(s) ||
                (r.conceptName ?? '').toLowerCase().includes(s) ||
                (r.standardTerm ?? '').toLowerCase().includes(s) ||
                r.aliases.some((a) => a.alias.toLowerCase().includes(s)));
        }
        return rows;
    },
    async getRegionalTerm(termId) {
        const { data, error } = await supabase
            .from('agronomy_terms')
            .select('*, agronomy_concepts(name, category, concept_code), terminology_term_aliases(alias, language)')
            .eq('id', termId)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load term');
        if (!data)
            throw new NotFoundError('Term not found');
        return mapTermRow(data);
    },
    async updateRegionalTerm(termId, input) {
        const patch = { updated_at: new Date().toISOString() };
        if (input.term !== undefined)
            patch.term = input.term.trim().toLowerCase();
        if (input.language !== undefined)
            patch.language = input.language;
        if (input.cropType !== undefined)
            patch.crop_type = input.cropType;
        if (input.district !== undefined)
            patch.district = input.district;
        if (input.state !== undefined)
            patch.state = input.state;
        if (input.meaning !== undefined)
            patch.meaning = input.meaning.trim().slice(0, 500);
        if (input.standardTerm !== undefined)
            patch.standard_term = input.standardTerm?.trim().slice(0, 200) ?? null;
        if (input.conceptId !== undefined)
            patch.concept_id = input.conceptId;
        if (input.replyPreferred !== undefined)
            patch.reply_preferred = input.replyPreferred;
        if (input.status !== undefined)
            patch.status = input.status;
        const { data, error } = await supabase
            .from('agronomy_terms')
            .update(patch)
            .eq('id', termId)
            .select('*, agronomy_concepts(name, category, concept_code), terminology_term_aliases(alias, language)')
            .single();
        throwIfSupabaseError(error, 'Could not update term');
        if (input.aliases) {
            await supabase.from('terminology_term_aliases').delete().eq('term_id', termId);
            const language = input.language ?? String(data.language ?? 'en');
            for (const alias of input.aliases) {
                const a = alias.trim().toLowerCase();
                if (!a)
                    continue;
                await supabase.from('terminology_term_aliases').insert({
                    term_id: termId,
                    alias: a,
                    language,
                });
            }
        }
        await terminologyEscalationService.recordLearningHistory({
            term: String(data.term),
            language: String(data.language ?? 'en'),
            meaning: String(data.meaning),
            standardTerm: data.standard_term ? String(data.standard_term) : null,
            cropType: data.crop_type ? String(data.crop_type) : null,
            district: data.district ? String(data.district) : null,
            action: 'updated',
            metadata: { termId },
        });
        return this.getRegionalTerm(termId);
    },
    async listRegionalTerms(params) {
        return this.listLearnedTerminologies(params);
    },
    async listLocalizationProfiles(params) {
        let q = supabase.from('terminology_localization_profiles').select('*').order('language');
        if (params?.language)
            q = q.eq('language', params.language);
        if (params?.district)
            q = q.eq('district', params.district);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not load localization profiles');
        return (data ?? []).map((row) => ({
            id: String(row.id),
            language: String(row.language),
            district: row.district ? String(row.district) : null,
            state: row.state ? String(row.state) : null,
            preferredTerms: row.preferred_terms ?? [],
            responseStyle: String(row.response_style ?? 'simple_farmer'),
            updatedAt: String(row.updated_at),
        }));
    },
    async upsertLocalizationProfile(input) {
        const { data, error } = await supabase
            .from('terminology_localization_profiles')
            .upsert({
            language: input.language,
            district: input.district ?? null,
            state: input.state ?? null,
            preferred_terms: input.preferredTerms ?? [],
            response_style: input.responseStyle ?? 'simple_farmer',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'language,district_key' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not save localization profile');
        return data;
    },
    async approveTask(taskId, input) {
        const { data: task, error: taskErr } = await supabase
            .from('terminology_review_tasks')
            .select('*')
            .eq('id', taskId)
            .maybeSingle();
        throwIfSupabaseError(taskErr, 'Could not load task');
        if (!task)
            throw new NotFoundError('Task not found');
        let conceptId = input.conceptId;
        if (!conceptId && input.conceptName?.trim()) {
            const created = await this.createConcept({
                name: input.conceptName.trim(),
                category: input.conceptCategory,
            });
            conceptId = String(created.id);
        }
        const cropType = input.cropType !== undefined
            ? input.cropType
            : task.crop_type
                ? String(task.crop_type)
                : null;
        const district = input.district !== undefined
            ? input.district
            : task.district
                ? String(task.district)
                : null;
        const entry = await terminologyDictionaryService.upsertApproved({
            term: String(task.term),
            language: String(task.language ?? 'ml'),
            meaning: input.meaning,
            standardTerm: input.standardTerm ?? input.meaning,
            cropType,
            district,
            approvedBy: input.resolvedBy,
        });
        await supabase
            .from('agronomy_terms')
            .update({
            concept_id: conceptId ?? null,
            reply_preferred: input.replyPreferred ?? true,
            usage_count: Number(task.occurrence_count ?? 1),
            state: task.district ? null : null,
            status: 'active',
            updated_at: new Date().toISOString(),
        })
            .eq('id', entry.id);
        const aliases = input.aliases?.length
            ? input.aliases
            : [String(task.unknown_word ?? task.term)];
        for (const alias of aliases) {
            const a = alias.trim().toLowerCase();
            if (!a || a === entry.term)
                continue;
            await supabase.from('terminology_term_aliases').upsert({
                term_id: entry.id,
                alias: a,
                language: String(task.language ?? 'ml'),
            }, { onConflict: 'term_id,alias,language' });
        }
        const examples = input.examples?.length
            ? input.examples
            : [String(task.raw_message ?? task.context_text ?? task.term)];
        for (const msg of examples) {
            if (!msg.trim())
                continue;
            await supabase.from('terminology_term_examples').insert({
                term_id: entry.id,
                message: msg.trim().slice(0, 500),
                farmer_language: String(task.language ?? 'ml'),
            });
        }
        const { data: updated, error } = await supabase
            .from('terminology_review_tasks')
            .update({
            status: 'resolved',
            resolution_meaning: input.meaning,
            standard_term: input.standardTerm ?? input.meaning,
            resolved_at: new Date().toISOString(),
            resolved_by: input.resolvedBy ?? null,
        })
            .eq('id', taskId)
            .select('*, farmers(phone, name, district, state, preferred_language)')
            .single();
        throwIfSupabaseError(error, 'Could not resolve task');
        await terminologyEscalationService.recordLearningHistory({
            term: String(task.term),
            language: String(task.language ?? 'ml'),
            meaning: input.meaning,
            standardTerm: input.standardTerm ?? input.meaning,
            cropType,
            district,
            action: 'approved',
            taskId,
            farmerId: task.farmer_id ? String(task.farmer_id) : null,
            approvedBy: input.resolvedBy,
        });
        await learningLoopService
            .onTerminologyResolved({
            taskId,
            term: String(task.term),
            language: String(task.language ?? 'ml'),
            meaning: input.meaning,
            standardTerm: input.standardTerm ?? input.meaning,
            cropType,
            district,
            resolvedBy: input.resolvedBy,
            farmerId: task.farmer_id ? String(task.farmer_id) : null,
        })
            .catch(() => { });
        if (conceptId && district) {
            await this.syncProfilePreferredTerm({
                language: String(task.language ?? 'ml'),
                district: String(district),
                conceptId,
                termId: entry.id,
                regionalTerm: String(task.unknown_word ?? task.term),
            }).catch(() => { });
        }
        return updated;
    },
    async syncProfilePreferredTerm(params) {
        const { data: existing } = await supabase
            .from('terminology_localization_profiles')
            .select('*')
            .eq('language', params.language)
            .eq('district', params.district)
            .maybeSingle();
        const preferred = Array.isArray(existing?.preferred_terms) ? [...existing.preferred_terms] : [];
        const idx = preferred.findIndex((p) => String(p.conceptId) === params.conceptId);
        const entry = {
            conceptId: params.conceptId,
            termId: params.termId,
            regionalTerm: params.regionalTerm,
        };
        if (idx >= 0)
            preferred[idx] = entry;
        else
            preferred.push(entry);
        await this.upsertLocalizationProfile({
            language: params.language,
            district: params.district,
            preferredTerms: preferred,
            responseStyle: existing?.response_style ? String(existing.response_style) : 'simple_farmer',
        });
    },
    async rejectTask(taskId, resolvedBy, reason) {
        const { data: task, error: taskErr } = await supabase
            .from('terminology_review_tasks')
            .select('*')
            .eq('id', taskId)
            .maybeSingle();
        throwIfSupabaseError(taskErr, 'Could not load task');
        if (!task)
            throw new NotFoundError('Task not found');
        const { data, error } = await supabase
            .from('terminology_review_tasks')
            .update({
            status: 'rejected',
            resolved_at: new Date().toISOString(),
            resolved_by: resolvedBy ?? null,
            resolution_meaning: reason?.trim().slice(0, 500) ?? 'Rejected by agronomist',
        })
            .eq('id', taskId)
            .select('*, farmers(phone, name, district, state, preferred_language)')
            .single();
        throwIfSupabaseError(error, 'Could not reject task');
        await terminologyEscalationService.recordLearningHistory({
            term: String(task.term),
            language: String(task.language ?? 'ml'),
            meaning: reason?.trim() || 'rejected',
            standardTerm: task.standard_term ? String(task.standard_term) : null,
            cropType: task.crop_type ? String(task.crop_type) : null,
            district: task.district ? String(task.district) : null,
            action: 'rejected',
            taskId,
            farmerId: task.farmer_id ? String(task.farmer_id) : null,
            approvedBy: resolvedBy,
            metadata: { reason },
        });
        return data;
    },
    async skipTask(taskId, resolvedBy) {
        const { data, error } = await supabase
            .from('terminology_review_tasks')
            .update({
            status: 'dismissed',
            resolved_at: new Date().toISOString(),
            resolved_by: resolvedBy ?? null,
        })
            .eq('id', taskId)
            .select('*, farmers(phone, name, district, state, preferred_language)')
            .single();
        throwIfSupabaseError(error, 'Could not skip task');
        return data;
    },
    async listFarmerOverrides(params) {
        if (params?.farmerId) {
            return farmerTerminologyMemoryService.listForFarmer({
                farmerId: params.farmerId,
                language: params.language,
                limit: params.limit,
            });
        }
        if (!farmerTerminologyMemoryService.enabled())
            return [];
        let q = supabase
            .from('farmer_terminology_overrides')
            .select('*')
            .eq('active', true)
            .order('updated_at', { ascending: false })
            .limit(params?.limit ?? 200);
        if (params?.language)
            q = q.eq('language', params.language);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not list farmer terminology overrides');
        return (data ?? []).map((row) => ({
            id: String(row.id),
            farmerId: String(row.farmer_id),
            term: String(row.term),
            language: String(row.language ?? 'en'),
            meaning: String(row.resolved_meaning),
            standardTerm: row.standard_term ? String(row.standard_term) : null,
            cropType: row.crop_type ? String(row.crop_type) : null,
            district: row.district ? String(row.district) : null,
            updatedAt: String(row.updated_at ?? row.created_at),
        }));
    },
    async upsertFarmerOverride(input) {
        return farmerTerminologyMemoryService.upsertOverride(input);
    },
    /**
     * Promote a farmer-private override into regional agronomy_terms after human review.
     * Does not auto-promote; requires explicit staff action.
     */
    async promoteFarmerOverride(input) {
        const entry = await terminologyDictionaryService.upsertApproved({
            term: input.term,
            language: input.language,
            meaning: input.meaning,
            standardTerm: input.standardTerm ?? input.meaning,
            cropType: input.cropType ?? null,
            district: input.district ?? null,
            approvedBy: input.approvedBy,
        });
        await terminologyEscalationService.recordLearningHistory({
            term: input.term,
            language: input.language,
            meaning: input.meaning,
            standardTerm: input.standardTerm ?? input.meaning,
            cropType: input.cropType ?? null,
            district: input.district ?? null,
            action: 'approved',
            farmerId: input.farmerId,
            approvedBy: input.approvedBy ?? null,
            metadata: { promotedFrom: 'farmer_terminology_overrides' },
        });
        return entry;
    },
    async listProductAliases(params) {
        return productAliasService.list(params);
    },
    async proposeProductAlias(input) {
        return productAliasService.propose(input);
    },
    async reviewProductAlias(id, status, approvedBy) {
        return productAliasService.setStatus({ id, status, approvedBy });
    },
    async listUnitAliases(params) {
        return unitAliasService.list(params);
    },
    async proposeUnitAlias(input) {
        if (!FARM_ACTIVITY_CANONICAL_UNITS.includes(input.canonicalUnit)) {
            throw new ValidationError('Invalid canonical unit');
        }
        return unitAliasService.propose(input);
    },
    async reviewUnitAlias(id, status, approvedBy) {
        return unitAliasService.setStatus({ id, status, approvedBy });
    },
};
//# sourceMappingURL=terminology-admin.service.js.map