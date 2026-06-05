import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { shopifyProductsService } from '../shopify/shopify.products.service.js';
import { seoSyncService } from './seo-sync.service.js';

function mapFaqJson(raw: unknown): Array<{ q: string; a: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      q: String(r.question ?? r.q ?? ''),
      a: String(r.answer ?? r.a ?? ''),
    };
  }).filter((f) => f.q && f.a);
}

export const seoStorefrontService = {
  async listPublished(opts?: { pageType?: string; crop?: string; limit?: number }) {
    let q = supabase
      .from('seo_content_pages')
      .select('id, slug, title, meta_description, page_type, crop, problem, stage, region, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(opts?.limit ?? 50);
    if (opts?.pageType) q = q.eq('page_type', opts.pageType);
    if (opts?.crop) q = q.ilike('crop', `%${opts.crop}%`);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'List published SEO pages');
    const base = seoSyncService.storefrontBase();
    return (data ?? []).map((p) => ({
      ...p,
      url: `${base}/pages/${p.slug}`,
    }));
  },

  async getBySlug(slug: string) {
    const { data, error } = await supabase
      .from('seo_content_pages')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    throwIfSupabaseError(error, 'Get SEO page');
    if (!data) throw new NotFoundError('Page not found');

    const { data: faqRows } = await supabase
      .from('seo_faqs')
      .select('question, answer')
      .eq('page_id', data.id)
      .order('sort_order');
    const faqsFromTable = (faqRows ?? []).map((f) => ({ q: f.question, a: f.answer }));
    const faqs = faqsFromTable.length ? faqsFromTable : mapFaqJson(data.faq_json);

    const { data: links } = await supabase
      .from('seo_internal_links')
      .select('*')
      .eq('source_type', 'page')
      .eq('source_id', data.id);

    const productIds = (data.related_product_ids as string[]) ?? [];
    const relatedProducts = await this.resolveProducts(productIds);

    const base = seoSyncService.storefrontBase();
    return {
      id: data.id,
      slug: data.slug,
      title: data.title,
      metaTitle: data.meta_title,
      metaDescription: data.meta_description,
      pageType: data.page_type,
      crop: data.crop,
      problem: data.problem,
      stage: data.stage,
      region: data.region,
      bodyHtml: data.body_html,
      focusKeywords: data.focus_keywords,
      faqs,
      schema: data.schema_json,
      internalLinks: links ?? [],
      relatedProducts,
      canonicalUrl: data.canonical_url ?? `${base}/pages/${data.slug}`,
      url: `${base}/pages/${data.slug}`,
      publishedAt: data.published_at,
    };
  },

  async resolveProducts(shopifyProductIds: string[]) {
    if (!shopifyProductIds.length) return [];
    const base = seoSyncService.storefrontBase();
    const out = [];
    for (const id of shopifyProductIds.slice(0, 8)) {
      try {
        const p = await shopifyProductsService.get(id);
        out.push({
          id: p.id,
          title: p.title,
          handle: p.handle,
          imageUrl: p.imageUrl,
          price: p.price,
          url: `${base}/products/${p.handle}`,
        });
      } catch {
        // skip missing products
      }
    }
    return out;
  },
};
