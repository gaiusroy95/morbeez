import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { SUPPORTED_TEMPLATE_LANGUAGES, STANDARD_TEMPLATE_VARIABLES, computeLanguageCompletion, displayNameFromKey, renderLanguageTemplate, SAMPLE_VARIABLE_CONTEXT, } from './language-template-variables.js';
import { languageTemplateTranslateService } from './language-template-translate.service.js';
function mapDefinition(row, langRows) {
    const languages = {};
    for (const lang of SUPPORTED_TEMPLATE_LANGUAGES) {
        const found = langRows.find((r) => r.language === lang);
        languages[lang] = {
            id: found?.id,
            bodyText: found?.body_text ?? '',
            headerText: found?.header_text ?? null,
            footerText: found?.footer_text ?? null,
            status: found?.status ?? 'draft',
            channel: found?.channel ?? row.channel,
            metaTemplateName: found?.meta_template_name ?? row.meta_template_name,
        };
    }
    const completion = computeLanguageCompletion(Object.fromEntries(Object.entries(languages).map(([k, v]) => [k, { bodyText: v.bodyText, status: v.status }])));
    return {
        templateKey: row.template_key,
        displayName: row.display_name,
        category: row.category,
        channel: row.channel,
        metaTemplateName: row.meta_template_name,
        status: row.status,
        variableSchema: (row.variable_schema ?? []),
        workflowJson: row.workflow_json ?? {},
        masterLanguage: row.master_language,
        languages,
        completionRate: completion.rate,
        languageComplete: completion.perLanguage,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
async function loadDefinition(templateKey) {
    const { data: def, error } = await supabase
        .from('whatsapp_template_definitions')
        .select('*')
        .eq('template_key', templateKey)
        .maybeSingle();
    throwIfSupabaseError(error, 'Could not load template definition');
    if (!def)
        throw new NotFoundError('Template not found');
    const { data: langs, error: langErr } = await supabase
        .from('whatsapp_language_templates')
        .select('*')
        .eq('template_key', templateKey);
    throwIfSupabaseError(langErr, 'Could not load language versions');
    return mapDefinition(def, (langs ?? []));
}
export const operationsMessagingService = {
    async listQuickReplies(category) {
        let q = supabase
            .from('whatsapp_quick_replies')
            .select('*')
            .order('sort_order')
            .order('shortcut_key');
        if (category && category !== 'all')
            q = q.eq('category', category);
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not load quick replies');
        return data ?? [];
    },
    async upsertQuickReply(row) {
        const payload = {
            shortcut_key: row.shortcutKey.trim(),
            category: row.category ?? 'general',
            label_en: row.labelEn,
            body_en: row.bodyEn,
            body_ml: row.bodyMl ?? null,
            body_ta: row.bodyTa ?? null,
            body_kn: row.bodyKn ?? null,
            body_hi: row.bodyHi ?? null,
            active: row.active ?? true,
            sort_order: row.sortOrder ?? 0,
            updated_at: new Date().toISOString(),
        };
        if (row.id) {
            const { data, error } = await supabase
                .from('whatsapp_quick_replies')
                .update(payload)
                .eq('id', row.id)
                .select('*')
                .single();
            throwIfSupabaseError(error, 'Could not update quick reply');
            return data;
        }
        const { data, error } = await supabase
            .from('whatsapp_quick_replies')
            .insert(payload)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create quick reply');
        return data;
    },
    async deleteQuickReply(id) {
        const { error } = await supabase.from('whatsapp_quick_replies').delete().eq('id', id);
        throwIfSupabaseError(error, 'Could not delete quick reply');
    },
    /** Resolve body for a language (falls back to English). */
    resolveQuickReplyBody(row, language) {
        const map = {
            en: row.body_en,
            ml: row.body_ml,
            ta: row.body_ta,
            kn: row.body_kn,
            hi: row.body_hi,
        };
        return map[language]?.trim() || row.body_en;
    },
    async listLanguageTemplates(params) {
        if (params?.templateKey) {
            return [await loadDefinition(params.templateKey)];
        }
        let q = supabase.from('whatsapp_template_definitions').select('*').order('display_name');
        if (params?.status && params.status !== 'all')
            q = q.eq('status', params.status);
        if (params?.category && params.category !== 'all')
            q = q.eq('category', params.category);
        const { data: defs, error } = await q;
        throwIfSupabaseError(error, 'Could not load language templates');
        const keys = (defs ?? []).map((d) => String(d.template_key));
        const { data: langs, error: langErr } = keys.length
            ? await supabase.from('whatsapp_language_templates').select('*').in('template_key', keys)
            : { data: [], error: null };
        throwIfSupabaseError(langErr, 'Could not load language versions');
        let items = (defs ?? []).map((def) => mapDefinition(def, (langs ?? []).filter((l) => l.template_key === def.template_key)));
        if (params?.search?.trim()) {
            const s = params.search.toLowerCase();
            items = items.filter((t) => t.displayName.toLowerCase().includes(s) || t.templateKey.toLowerCase().includes(s));
        }
        return items;
    },
    async getLanguageTemplate(templateKey) {
        return loadDefinition(templateKey);
    },
    async createLanguageTemplateDefinition(input) {
        const key = input.templateKey.trim().toLowerCase().replace(/\s+/g, '_');
        if (!key)
            throw new ValidationError('Template key is required');
        const now = new Date().toISOString();
        const { error } = await supabase.from('whatsapp_template_definitions').insert({
            template_key: key,
            display_name: input.displayName?.trim() || displayNameFromKey(key),
            category: input.category ?? 'general',
            channel: input.channel ?? 'session',
            meta_template_name: input.metaTemplateName ?? null,
            status: 'draft',
            variable_schema: STANDARD_TEMPLATE_VARIABLES.map((v) => v.key),
            workflow_json: { created: now },
            master_language: input.masterLanguage ?? 'en',
            created_at: now,
            updated_at: now,
        });
        throwIfSupabaseError(error, 'Could not create template definition');
        if (input.initialBody?.trim()) {
            await this.upsertLanguageTemplate({
                templateKey: key,
                language: input.masterLanguage ?? 'en',
                channel: input.channel,
                bodyText: input.initialBody,
                metaTemplateName: input.metaTemplateName,
                status: 'draft',
            });
        }
        return loadDefinition(key);
    },
    async saveLanguageTemplateBundle(templateKey, input) {
        const existing = await loadDefinition(templateKey);
        const now = new Date().toISOString();
        const workflow = { ...existing.workflowJson };
        const nextStatus = input.status ?? existing.status;
        if (nextStatus === 'in_translation' && !workflow.in_translation)
            workflow.in_translation = now;
        if (nextStatus === 'under_review' && !workflow.under_review)
            workflow.under_review = now;
        if (nextStatus === 'approved' && !workflow.approved)
            workflow.approved = now;
        const { error: defErr } = await supabase
            .from('whatsapp_template_definitions')
            .update({
            display_name: input.displayName ?? existing.displayName,
            category: input.category ?? existing.category,
            channel: input.channel ?? existing.channel,
            meta_template_name: input.metaTemplateName ?? existing.metaTemplateName,
            status: nextStatus,
            master_language: input.masterLanguage ?? existing.masterLanguage,
            workflow_json: workflow,
            updated_at: now,
        })
            .eq('template_key', templateKey);
        throwIfSupabaseError(defErr, 'Could not update template definition');
        for (const lang of SUPPORTED_TEMPLATE_LANGUAGES) {
            const patch = input.languages?.[lang];
            if (!patch)
                continue;
            const current = existing.languages[lang];
            if (!patch.bodyText?.trim() && !current?.bodyText?.trim())
                continue;
            await this.upsertLanguageTemplate({
                id: current?.id,
                templateKey,
                language: lang,
                channel: (input.channel ?? existing.channel),
                bodyText: patch.bodyText ?? current?.bodyText ?? '',
                headerText: patch.headerText,
                footerText: patch.footerText,
                metaTemplateName: (input.metaTemplateName ?? current?.metaTemplateName ?? undefined) || undefined,
                status: patch.status ?? current?.status ?? 'draft',
            });
        }
        return loadDefinition(templateKey);
    },
    async duplicateLanguageTemplate(templateKey, newKey) {
        const src = await loadDefinition(templateKey);
        const key = newKey.trim().toLowerCase().replace(/\s+/g, '_');
        await this.createLanguageTemplateDefinition({
            templateKey: key,
            displayName: `${src.displayName} (copy)`,
            category: src.category,
            channel: src.channel,
            metaTemplateName: src.metaTemplateName ?? undefined,
            masterLanguage: src.masterLanguage,
        });
        const langPatch = {};
        for (const lang of SUPPORTED_TEMPLATE_LANGUAGES) {
            const row = src.languages[lang];
            if (row?.bodyText?.trim()) {
                langPatch[lang] = {
                    bodyText: row.bodyText,
                    headerText: row.headerText ?? undefined,
                    footerText: row.footerText ?? undefined,
                    status: 'draft',
                };
            }
        }
        return this.saveLanguageTemplateBundle(key, { languages: langPatch, status: 'draft' });
    },
    previewLanguageTemplate(templateKey, language, variables) {
        return loadDefinition(templateKey).then((def) => {
            const body = def.languages[language]?.bodyText ?? def.languages.en?.bodyText ?? '';
            return {
                language,
                rendered: renderLanguageTemplate(body, variables ?? SAMPLE_VARIABLE_CONTEXT),
                raw: body,
            };
        });
    },
    async copyLanguageTemplateToAll(templateKey) {
        const def = await loadDefinition(templateKey);
        const master = def.masterLanguage;
        const source = def.languages[master]?.bodyText ?? def.languages.en?.bodyText ?? '';
        if (!source.trim())
            throw new ValidationError('Master language body is empty');
        const languages = {};
        for (const lang of SUPPORTED_TEMPLATE_LANGUAGES) {
            if (lang === master)
                continue;
            if (!def.languages[lang]?.bodyText?.trim()) {
                languages[lang] = { bodyText: source, status: 'draft' };
            }
        }
        return this.saveLanguageTemplateBundle(templateKey, { languages, status: 'in_translation' });
    },
    async translateLanguageTemplate(templateKey, targetLanguages) {
        const def = await loadDefinition(templateKey);
        const master = def.masterLanguage;
        const source = def.languages[master]?.bodyText ?? def.languages.en?.bodyText ?? '';
        if (!source.trim())
            throw new ValidationError('Master language body is empty');
        const languages = {};
        for (const lang of targetLanguages) {
            if (lang === master)
                continue;
            const translated = await languageTemplateTranslateService.translateBody({
                sourceText: source,
                sourceLanguage: master,
                targetLanguage: lang,
            });
            languages[lang] = { bodyText: translated, status: 'draft' };
        }
        return this.saveLanguageTemplateBundle(templateKey, { languages, status: 'in_translation' });
    },
    async upsertLanguageTemplate(row) {
        const payload = {
            template_key: row.templateKey.trim(),
            language: row.language,
            channel: row.channel ?? 'session',
            body_text: row.bodyText,
            header_text: row.headerText ?? null,
            footer_text: row.footerText ?? null,
            meta_template_name: row.metaTemplateName ?? null,
            variable_hints: row.variableHints ?? [],
            status: row.status ?? 'draft',
            active: row.active ?? true,
            notes: row.notes ?? null,
            updated_at: new Date().toISOString(),
        };
        if (row.id) {
            const { data, error } = await supabase
                .from('whatsapp_language_templates')
                .update(payload)
                .eq('id', row.id)
                .select('*')
                .single();
            throwIfSupabaseError(error, 'Could not update language template');
            return data;
        }
        const { data, error } = await supabase
            .from('whatsapp_language_templates')
            .upsert(payload, { onConflict: 'template_key,language' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create language template');
        return data;
    },
    async deleteLanguageTemplate(id) {
        const { error } = await supabase.from('whatsapp_language_templates').delete().eq('id', id);
        throwIfSupabaseError(error, 'Could not delete language template');
    },
    async listAutomationJobs(params) {
        const limit = Math.min(params.limit ?? 50, 100);
        const page = Math.max(1, params.page ?? 1);
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        let q = supabase
            .from('advisory_automation_jobs')
            .select('*, farmers(id, phone, name, first_name, last_name, district, preferred_language)', { count: 'exact' })
            .order('scheduled_at', { ascending: false })
            .range(from, to);
        if (params.status && params.status !== 'all') {
            if (params.status === 'active') {
                q = q.in('status', ['pending', 'processing']);
            }
            else {
                q = q.eq('status', params.status);
            }
        }
        if (params.jobType && params.jobType !== 'all')
            q = q.eq('job_type', params.jobType);
        const { data, error, count } = await q;
        throwIfSupabaseError(error, 'Could not load automation jobs');
        const jobs = (data ?? []).map((row) => {
            const farmer = row.farmers;
            const first = String(farmer?.first_name ?? '').trim();
            const last = String(farmer?.last_name ?? '').trim();
            const name = [first, last].filter(Boolean).join(' ') || String(farmer?.name ?? '').trim() || 'Farmer';
            return {
                ...row,
                farmerName: name,
                farmerPhone: farmer?.phone ?? null,
                farmerDistrict: farmer?.district ?? null,
                farmers: undefined,
            };
        });
        return {
            jobs,
            pagination: {
                page,
                limit,
                total: count ?? 0,
                pages: Math.max(1, Math.ceil((count ?? 0) / limit)),
            },
        };
    },
    async getAutomationStats() {
        const statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
        const counts = {};
        await Promise.all(statuses.map(async (s) => {
            const { count } = await supabase
                .from('advisory_automation_jobs')
                .select('id', { count: 'exact', head: true })
                .eq('status', s);
            counts[s] = count ?? 0;
        }));
        const { count: dueNow } = await supabase
            .from('advisory_automation_jobs')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .lte('scheduled_at', new Date().toISOString());
        return { ...counts, dueNow: dueNow ?? 0 };
    },
    async cancelAutomationJob(id) {
        const { data, error } = await supabase
            .from('advisory_automation_jobs')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .in('status', ['pending', 'processing'])
            .select('*')
            .single();
        if (error || !data)
            throw new NotFoundError('Job not found or cannot cancel');
        return data;
    },
    async retryAutomationJob(id) {
        const { data, error } = await supabase
            .from('advisory_automation_jobs')
            .update({
            status: 'pending',
            scheduled_at: new Date().toISOString(),
            attempts: 0,
            last_error: null,
            completed_at: null,
        })
            .eq('id', id)
            .in('status', ['failed', 'cancelled', 'completed'])
            .select('*')
            .single();
        if (error || !data)
            throw new NotFoundError('Job not found or cannot retry');
        return data;
    },
};
//# sourceMappingURL=operations-messaging.service.js.map