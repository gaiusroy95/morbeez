import { shopifyProductsService } from '../shopify/shopify.products.service.js';
import { productIntelligenceService } from '../admin/product-intelligence.service.js';
import { seoSyncService } from './seo-sync.service.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const seoProductService = {
  async list(opts?: { search?: string; missingOnly?: boolean }) {
    const { products } = await shopifyProductsService.list({
      search: opts?.search,
      limit: 100,
      page: 1,
    });

    const rows = await Promise.all(
      products.map(async (p) => {
        const intel = await productIntelligenceService.get(p.id);
        const seo = intel.seo as Record<string, unknown>;
        const seoTitle = String(seo.seoTitle ?? '').trim();
        const seoDescription = String(seo.seoDescription ?? '').trim();
        const urlSlug = String(seo.urlSlug ?? seo.urlHandle ?? p.handle).trim();
        const focusKeywords = String(seo.focusKeywords ?? seo.focusKeyword ?? '').trim();
        const canonicalUrl = String(
          seo.canonicalUrl ?? `${seoSyncService.storefrontBase()}/products/${urlSlug || p.handle}`
        );
        const complete = Boolean(seoTitle && seoDescription && urlSlug);
        const imageAlts = (p.images ?? []).map((img) => ({
          id: img.id,
          src: img.src,
          alt: img.alt ?? '',
        }));

        const { data: faqRows } = await supabase
          .from('seo_faqs')
          .select('id')
          .eq('shopify_product_id', p.id);
        const faqCount = faqRows?.length ?? 0;

        return {
          shopifyProductId: p.id,
          title: p.title,
          handle: p.handle,
          imageUrl: p.imageUrl,
          seoTitle,
          seoDescription,
          urlSlug,
          focusKeywords,
          canonicalUrl,
          altTags: imageAlts,
          faqCount,
          syncedAt: seo.syncedAt ?? null,
          complete,
          status: p.status,
        };
      })
    );

    if (opts?.missingOnly) return rows.filter((r) => !r.complete);
    return rows;
  },

  async get(shopifyProductId: string) {
    const rows = await this.list();
    const row = rows.find((r) => r.shopifyProductId === shopifyProductId);
    if (!row) {
      const p = await shopifyProductsService.get(shopifyProductId);
      const intel = await productIntelligenceService.get(shopifyProductId);
      return {
        shopifyProductId,
        title: p.title,
        handle: p.handle,
        intelligence: intel,
      };
    }

    const { data: faqs, error: faqErr } = await supabase
      .from('seo_faqs')
      .select('*')
      .eq('shopify_product_id', shopifyProductId)
      .order('sort_order');
    throwIfSupabaseError(faqErr, 'Product FAQs');

    const intel = await productIntelligenceService.get(shopifyProductId);
    return { ...row, intelligence: intel, faqs: faqs ?? [] };
  },

  async update(
    shopifyProductId: string,
    input: {
      seoTitle?: string;
      seoDescription?: string;
      urlSlug?: string;
      focusKeywords?: string;
      canonicalUrl?: string;
      altTags?: Array<{ imageId: string; alt: string }>;
    },
    adminId?: string
  ) {
    const intel = await productIntelligenceService.get(shopifyProductId);
    const seo = { ...(intel.seo as Record<string, unknown>) };
    if (input.seoTitle !== undefined) seo.seoTitle = input.seoTitle;
    if (input.seoDescription !== undefined) seo.seoDescription = input.seoDescription;
    if (input.urlSlug !== undefined) seo.urlSlug = slugify(input.urlSlug);
    if (input.focusKeywords !== undefined) seo.focusKeywords = input.focusKeywords;
    if (input.canonicalUrl !== undefined) seo.canonicalUrl = input.canonicalUrl;

    await productIntelligenceService.upsert(shopifyProductId, { seo }, adminId);

    if (input.altTags?.length) {
      for (const img of input.altTags) {
        await supabase.from('seo_image_meta').upsert(
          {
            shopify_product_id: shopifyProductId,
            shopify_image_id: img.imageId,
            alt_text: img.alt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'shopify_image_id' }
        );
      }
    }

    return this.get(shopifyProductId);
  },

  async syncToShopify(shopifyProductId: string) {
    return seoSyncService.syncProductToShopify(shopifyProductId);
  },
};
