import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
function mapRow(row) {
    return {
        id: row.id,
        dictKey: row.dict_key,
        category: row.category,
        appScope: row.app_scope,
        valueEn: row.value_en,
        valueHi: row.value_hi,
        valueMl: row.value_ml,
        valueTa: row.value_ta,
        valueKn: row.value_kn,
        translate: row.translate,
        status: row.status,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function localeColumn(locale) {
    switch (locale) {
        case 'hi':
            return 'value_hi';
        case 'ml':
            return 'value_ml';
        case 'ta':
            return 'value_ta';
        case 'kn':
            return 'value_kn';
        default:
            return 'value_en';
    }
}
export const translationDictionaryService = {
    async list(params) {
        let q = supabase
            .from('translation_dictionary')
            .select('*')
            .order('dict_key')
            .limit(params?.limit ?? 500);
        if (params?.category && params.category !== 'all')
            q = q.eq('category', params.category);
        if (params?.appScope && params.appScope !== 'all')
            q = q.eq('app_scope', params.appScope);
        if (params?.status && params.status !== 'all')
            q = q.eq('status', params.status);
        if (params?.q?.trim()) {
            const term = `%${params.q.trim()}%`;
            q = q.or(`dict_key.ilike.${term},value_en.ilike.${term}`);
        }
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not load translations');
        return (data ?? []).map((row) => mapRow(row));
    },
    async upsert(row) {
        const payload = {
            dict_key: row.dictKey.trim(),
            category: row.category ?? 'ui_labels',
            app_scope: row.appScope ?? 'all',
            value_en: row.valueEn.trim(),
            value_hi: row.valueHi?.trim() || null,
            value_ml: row.valueMl?.trim() || null,
            value_ta: row.valueTa?.trim() || null,
            value_kn: row.valueKn?.trim() || null,
            translate: row.translate ?? true,
            status: row.status ?? 'draft',
            notes: row.notes?.trim() || null,
            updated_at: new Date().toISOString(),
        };
        if (row.id) {
            const { data, error } = await supabase
                .from('translation_dictionary')
                .update(payload)
                .eq('id', row.id)
                .select('*')
                .single();
            throwIfSupabaseError(error, 'Could not update translation');
            return mapRow(data);
        }
        const { data, error } = await supabase
            .from('translation_dictionary')
            .insert(payload)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create translation');
        return mapRow(data);
    },
    async setStatus(id, status) {
        const { data, error } = await supabase
            .from('translation_dictionary')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not update translation status');
        if (!data)
            throw new NotFoundError('Translation not found');
        return mapRow(data);
    },
    async delete(id) {
        const { error } = await supabase.from('translation_dictionary').delete().eq('id', id);
        throwIfSupabaseError(error, 'Could not delete translation');
    },
    async getPackMeta(locale, appScope) {
        const scopes = appScope === 'all' ? ['all'] : [appScope, 'all'];
        const { data, error } = await supabase
            .from('i18n_pack_meta')
            .select('locale, app_scope, version, published_at')
            .eq('locale', locale)
            .in('app_scope', scopes)
            .order('app_scope', { ascending: false });
        throwIfSupabaseError(error, 'Could not load pack version');
        const rows = data ?? [];
        const specific = rows.find((r) => r.app_scope === appScope);
        const fallback = rows.find((r) => r.app_scope === 'all');
        const picked = specific ?? fallback;
        return picked
            ? {
                locale: picked.locale,
                appScope: picked.app_scope,
                version: Number(picked.version),
                publishedAt: picked.published_at,
            }
            : { locale, appScope, version: 1, publishedAt: new Date().toISOString() };
    },
    async publishPack(params) {
        const version = Date.now();
        const locales = params.locale
            ? [params.locale]
            : ['en', 'hi', 'ml', 'ta', 'kn'];
        const scopes = params.appScope
            ? [params.appScope]
            : ['all', 'farmer', 'agronomist', 'warehouse'];
        const rows = locales.flatMap((locale) => scopes.map((app_scope) => ({
            locale,
            app_scope,
            version,
            published_at: new Date().toISOString(),
        })));
        const { error } = await supabase.from('i18n_pack_meta').upsert(rows, {
            onConflict: 'locale,app_scope',
        });
        throwIfSupabaseError(error, 'Could not publish language pack');
        return { version, locales, scopes };
    },
    async buildLanguagePack(params) {
        const scopes = params.appScope === 'all' ? ['all'] : [params.appScope, 'all'];
        let q = supabase
            .from('translation_dictionary')
            .select('*')
            .eq('status', 'approved')
            .in('app_scope', scopes);
        if (params.category && params.category !== 'all') {
            q = q.eq('category', params.category);
        }
        const { data, error } = await q;
        throwIfSupabaseError(error, 'Could not build language pack');
        const col = localeColumn(params.locale);
        const strings = {};
        const keepEnglish = [];
        for (const raw of data ?? []) {
            const row = raw;
            if (!row.translate) {
                strings[row.dict_key] = row.value_en;
                keepEnglish.push(row.dict_key);
                continue;
            }
            const localized = row[col];
            strings[row.dict_key] =
                params.locale === 'en'
                    ? row.value_en
                    : localized?.trim() || row.value_en;
        }
        const meta = await this.getPackMeta(params.locale, params.appScope);
        return {
            locale: params.locale,
            appScope: params.appScope,
            version: meta.version,
            publishedAt: meta.publishedAt,
            strings,
            keepEnglish,
        };
    },
};
//# sourceMappingURL=translation-dictionary.service.js.map