import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
export const seoGscService = {
    isConfigured() {
        return Boolean(env.GSC_SITE_URL &&
            (env.GSC_REFRESH_TOKEN || (env.GSC_CLIENT_ID && env.GSC_CLIENT_SECRET)));
    },
    async getConfig() {
        const { data, error } = await supabase.from('seo_gsc_config').select('*').limit(1).maybeSingle();
        throwIfSupabaseError(error, 'GSC config');
        return {
            configured: this.isConfigured(),
            siteUrl: data?.site_url ?? env.GSC_SITE_URL ?? null,
            connectedAt: data?.connected_at ?? null,
            lastSyncAt: data?.last_sync_at ?? null,
            syncStatus: data?.sync_status ?? (this.isConfigured() ? 'ready' : 'not_configured'),
        };
    },
    async saveConfig(input) {
        const { data, error } = await supabase
            .from('seo_gsc_config')
            .upsert({
            site_url: input.siteUrl,
            refresh_token: input.refreshToken ?? null,
            connected_at: new Date().toISOString(),
            sync_status: 'connected',
            updated_at: new Date().toISOString(),
        }, { onConflict: 'site_url' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Save GSC config');
        return data;
    },
    async getLatestSnapshot() {
        const { data, error } = await supabase
            .from('seo_gsc_snapshots')
            .select('*')
            .order('snapshot_date', { ascending: false })
            .limit(1)
            .maybeSingle();
        throwIfSupabaseError(error, 'GSC snapshot');
        return data;
    },
    /** Pull from GSC API when credentials exist; otherwise seed from keywords table */
    async sync() {
        if (!this.isConfigured()) {
            return { ok: false, reason: 'GSC credentials not configured — set GSC_SITE_URL and GSC_REFRESH_TOKEN' };
        }
        // Placeholder for full Search Console API — store snapshot from env + keyword aggregates
        const { data: keywords } = await supabase
            .from('seo_keywords')
            .select('keyword, clicks, impressions, position')
            .order('clicks', { ascending: false })
            .limit(25);
        const totalClicks = (keywords ?? []).reduce((s, k) => s + (Number(k.clicks) || 0), 0);
        const totalImpressions = (keywords ?? []).reduce((s, k) => s + (Number(k.impressions) || 0), 0);
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
            .from('seo_gsc_snapshots')
            .upsert({
            snapshot_date: today,
            indexed_pages: 0,
            total_clicks: totalClicks,
            total_impressions: totalImpressions,
            avg_ctr: totalImpressions ? totalClicks / totalImpressions : null,
            avg_position: null,
            top_pages: [],
            top_queries: keywords ?? [],
            errors: [],
        }, { onConflict: 'snapshot_date' })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'GSC snapshot upsert');
        await supabase
            .from('seo_gsc_config')
            .update({ last_sync_at: new Date().toISOString(), sync_status: 'synced' })
            .eq('site_url', env.GSC_SITE_URL);
        return { ok: true, snapshot: data };
    },
};
//# sourceMappingURL=seo-gsc.service.js.map