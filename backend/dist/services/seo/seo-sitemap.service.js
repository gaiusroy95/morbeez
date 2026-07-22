import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { shopifyProductsService } from '../shopify/shopify.products.service.js';
import { seoPagesService } from './seo-pages.service.js';
import { seoSyncService } from './seo-sync.service.js';
export const seoSitemapService = {
    async list() {
        const { data, error } = await supabase.from('seo_sitemaps').select('*').order('sitemap_type');
        throwIfSupabaseError(error, 'List sitemaps');
        return data ?? [];
    },
    async generateAll() {
        const base = seoSyncService.storefrontBase();
        const { products } = await shopifyProductsService.list({ limit: 250, page: 1 });
        const pages = await seoPagesService.list({ status: 'published' });
        const entries = [
            {
                sitemap_type: 'product',
                url: `${base}/sitemap_products_1.xml`,
                url_count: products.length,
                status: 'generated',
            },
            {
                sitemap_type: 'content',
                url: `${base}/pages/sitemap.xml`,
                url_count: pages.length,
                status: 'generated',
            },
            {
                sitemap_type: 'image',
                url: `${base}/sitemap_images_1.xml`,
                url_count: products.reduce((n, p) => n + (p.images?.length ?? 0), 0),
                status: 'generated',
            },
            {
                sitemap_type: 'category',
                url: `${base}/sitemap_collections_1.xml`,
                url_count: 0,
                status: 'generated',
            },
            {
                sitemap_type: 'blog',
                url: `${base}/sitemap_blogs_1.xml`,
                url_count: 0,
                status: 'generated',
            },
        ];
        const now = new Date().toISOString();
        const saved = [];
        for (const e of entries) {
            const { data, error } = await supabase
                .from('seo_sitemaps')
                .upsert({
                ...e,
                last_generated_at: now,
                updated_at: now,
            }, { onConflict: 'sitemap_type' })
                .select('*')
                .single();
            if (!error && data)
                saved.push(data);
        }
        return { generated: saved, note: 'Shopify auto-sitemaps referenced; custom content URLs included' };
    },
    async markSubmitted(sitemapId) {
        const { data, error } = await supabase
            .from('seo_sitemaps')
            .update({
            submitted_at: new Date().toISOString(),
            status: 'submitted',
            updated_at: new Date().toISOString(),
        })
            .eq('id', sitemapId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Mark sitemap submitted');
        return data;
    },
};
//# sourceMappingURL=seo-sitemap.service.js.map