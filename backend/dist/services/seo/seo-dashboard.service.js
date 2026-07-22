import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { shopifyProductsService } from '../shopify/shopify.products.service.js';
import { productIntelligenceService } from '../admin/product-intelligence.service.js';
export const seoDashboardService = {
    async getDashboard() {
        const [pagesRes, healthRes, keywordsRes, gscRes, regionalRes, products,] = await Promise.all([
            supabase.from('seo_content_pages').select('id, status, page_type'),
            supabase
                .from('seo_health_issues')
                .select('id, issue_type, severity')
                .eq('resolved', false),
            supabase
                .from('seo_keywords')
                .select('keyword, clicks, impressions, position')
                .order('clicks', { ascending: false })
                .limit(20),
            supabase
                .from('seo_gsc_snapshots')
                .select('*')
                .order('snapshot_date', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase.from('seo_regional_trends').select('*').order('trend_score', { ascending: false }).limit(5),
            shopifyProductsService.list({ limit: 200, page: 1 }),
        ]);
        throwIfSupabaseError(pagesRes.error, 'SEO pages');
        throwIfSupabaseError(healthRes.error, 'SEO health');
        throwIfSupabaseError(keywordsRes.error, 'SEO keywords');
        throwIfSupabaseError(gscRes.error, 'GSC snapshots');
        throwIfSupabaseError(regionalRes.error, 'Regional trends');
        const pages = pagesRes.data ?? [];
        const health = healthRes.data ?? [];
        const keywords = keywordsRes.data ?? [];
        const gsc = gscRes.data;
        const regional = regionalRes.data ?? [];
        const productRows = products.products ?? [];
        let missingSeo = 0;
        let schemaErrors = 0;
        const productTraffic = [];
        for (const p of productRows.slice(0, 50)) {
            const intel = await productIntelligenceService.get(p.id);
            const seo = intel.seo;
            const hasTitle = Boolean(String(seo.seoTitle ?? '').trim());
            const hasDesc = Boolean(String(seo.seoDescription ?? '').trim());
            const hasSlug = Boolean(String(seo.urlSlug ?? seo.urlHandle ?? p.handle).trim());
            if (!hasTitle || !hasDesc || !hasSlug)
                missingSeo += 1;
            if (!hasTitle || !hasDesc)
                schemaErrors += 1;
            const score = (hasTitle ? 40 : 0) + (hasDesc ? 40 : 0) + (hasSlug ? 20 : 0);
            productTraffic.push({ id: p.id, title: p.title, handle: p.handle, score });
        }
        productTraffic.sort((a, b) => b.score - a.score);
        const lowCtrPages = keywords
            .filter((k) => Number(k.impressions) > 100 && Number(k.clicks) < 5)
            .slice(0, 8)
            .map((k) => ({
            keyword: k.keyword,
            impressions: k.impressions,
            clicks: k.clicks,
            position: k.position,
        }));
        const topRanking = keywords
            .filter((k) => k.position != null && Number(k.position) <= 10)
            .slice(0, 8);
        return {
            indexedPages: gsc?.indexed_pages ?? pages.filter((p) => p.status === 'published').length,
            topRankingPages: gsc?.top_pages ?? topRanking,
            lowCtrPages: gsc?.top_queries?.length ? gsc.top_queries : lowCtrPages,
            missingSeoCount: missingSeo,
            brokenLinksCount: health.filter((h) => h.issue_type === 'broken_link').length,
            trafficByKeyword: keywords.slice(0, 10),
            topProductTraffic: productTraffic.slice(0, 8),
            schemaErrorsCount: health.filter((h) => h.issue_type === 'schema_error').length + schemaErrors,
            openHealthIssues: health.length,
            contentPageCount: pages.length,
            publishedPageCount: pages.filter((p) => p.status === 'published').length,
            cropProblemCount: pages.filter((p) => p.page_type === 'crop_problem').length,
            regionalHighlights: regional,
            gscLastSync: gsc?.snapshot_date ?? null,
            gscTotals: gsc
                ? {
                    clicks: gsc.total_clicks,
                    impressions: gsc.total_impressions,
                    avgCtr: gsc.avg_ctr,
                    avgPosition: gsc.avg_position,
                }
                : null,
        };
    },
};
//# sourceMappingURL=seo-dashboard.service.js.map