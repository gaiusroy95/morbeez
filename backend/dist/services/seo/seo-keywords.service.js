import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
export const seoKeywordsService = {
    async list(opts) {
        let q = supabase.from('seo_keywords').select('*').order('clicks', { ascending: false });
        if (opts?.region)
            q = q.eq('region', opts.region);
        if (opts?.search?.trim())
            q = q.ilike('keyword', `%${opts.search.trim()}%`);
        const { data, error } = await q.limit(200);
        throwIfSupabaseError(error, 'List keywords');
        return data ?? [];
    },
    async upsert(input) {
        const ctr = input.ctr ??
            (input.impressions && input.clicks ? input.clicks / input.impressions : undefined);
        const keyword = input.keyword.trim().toLowerCase();
        let q = supabase.from('seo_keywords').select('id').eq('keyword', keyword);
        if (input.targetType)
            q = q.eq('target_type', input.targetType);
        else
            q = q.is('target_type', null);
        if (input.targetId)
            q = q.eq('target_id', input.targetId);
        else
            q = q.is('target_id', null);
        if (input.region)
            q = q.eq('region', input.region);
        else
            q = q.is('region', null);
        const { data: existing } = await q.maybeSingle();
        const payload = {
            keyword,
            target_type: input.targetType ?? null,
            target_id: input.targetId ?? null,
            region: input.region ?? null,
            position: input.position ?? null,
            impressions: input.impressions ?? 0,
            clicks: input.clicks ?? 0,
            ctr: ctr ?? null,
            organic_traffic: input.organicTraffic ?? 0,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const { data, error } = existing?.id
            ? await supabase.from('seo_keywords').update(payload).eq('id', existing.id).select('*').single()
            : await supabase.from('seo_keywords').insert(payload).select('*').single();
        throwIfSupabaseError(error, 'Upsert keyword');
        return data;
    },
    async importRows(rows) {
        const imported = [];
        for (const row of rows) {
            const kw = await this.upsert({
                keyword: String(row.keyword ?? row.query ?? ''),
                targetType: row.targetType ? String(row.targetType) : undefined,
                targetId: row.targetId ? String(row.targetId) : undefined,
                region: row.region ? String(row.region) : undefined,
                position: row.position != null ? Number(row.position) : undefined,
                impressions: row.impressions != null ? Number(row.impressions) : undefined,
                clicks: row.clicks != null ? Number(row.clicks) : undefined,
                ctr: row.ctr != null ? Number(row.ctr) : undefined,
            });
            imported.push(kw);
        }
        return imported;
    },
};
//# sourceMappingURL=seo-keywords.service.js.map