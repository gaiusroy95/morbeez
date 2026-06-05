import { env } from '../../config/env.js';
import { shopifyAdmin } from '../shopify/shopify.client.js';
import { productIntelligenceService } from '../admin/product-intelligence.service.js';
function storefrontBase() {
    const base = env.SHOPIFY_STOREFRONT_URL?.replace(/\/$/, '');
    if (base)
        return base;
    return `https://${env.SHOPIFY_STORE_DOMAIN}`;
}
export const seoSyncService = {
    storefrontBase,
    async syncProductToShopify(shopifyProductId) {
        const intel = await productIntelligenceService.get(shopifyProductId);
        const seo = intel.seo;
        const title = String(seo.seoTitle ?? '').trim();
        const description = String(seo.seoDescription ?? '').trim();
        const handle = String(seo.urlSlug ?? seo.urlHandle ?? '').trim();
        const product = { id: Number(shopifyProductId) };
        if (handle)
            product.handle = handle.replace(/^\//, '').replace(/^products\//, '');
        const metafields = [];
        if (title) {
            metafields.push({
                namespace: 'global',
                key: 'title_tag',
                value: title,
                type: 'single_line_text_field',
            });
        }
        if (description) {
            metafields.push({
                namespace: 'global',
                key: 'description_tag',
                value: description,
                type: 'single_line_text_field',
            });
        }
        const focusKw = String(seo.focusKeywords ?? seo.focusKeyword ?? '').trim();
        if (focusKw) {
            metafields.push({
                namespace: 'morbeez',
                key: 'seo_focus_keyword',
                value: focusKw,
                type: 'single_line_text_field',
            });
        }
        if (metafields.length)
            product.metafields = metafields;
        await shopifyAdmin(`/products/${shopifyProductId}.json`, {
            method: 'PUT',
            body: JSON.stringify({ product }),
        });
        const syncedAt = new Date().toISOString();
        await productIntelligenceService.upsert(shopifyProductId, {
            seo: { ...seo, syncedAt, canonicalUrl: `${storefrontBase()}/products/${handle || shopifyProductId}` },
        });
        return { ok: true, syncedAt, canonicalUrl: `${storefrontBase()}/products/${handle}` };
    },
};
//# sourceMappingURL=seo-sync.service.js.map