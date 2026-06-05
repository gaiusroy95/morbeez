import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { shopifyAdmin } from '../shopify/shopify.client.js';
import { seoPagesService } from './seo-pages.service.js';
import { seoFaqService } from './seo-faq.service.js';
import { seoSyncService } from './seo-sync.service.js';

interface ShopifyPageResponse {
  page: {
    id: number;
    handle: string;
    title: string;
  };
}

function faqForMetafield(faqs: Array<{ question?: string; answer?: string; q?: string; a?: string }>) {
  return faqs.map((f) => ({
    q: String(f.question ?? f.q ?? ''),
    a: String(f.answer ?? f.a ?? ''),
  })).filter((f) => f.q && f.a);
}

export const seoShopifyPublishService = {
  async publishToShopify(pageId: string) {
    const page = await seoPagesService.get(pageId);
    const faqRows = await seoFaqService.list({ pageId });
    const faqJson = faqForMetafield(
      faqRows.length
        ? faqRows.map((f) => ({ question: f.question, answer: f.answer }))
        : ((page.faq_json as Array<Record<string, string>>) ?? [])
    );

    const bodyHtml = String(page.body_html ?? '').trim() || `<p>${page.meta_description ?? page.title}</p>`;
    const metaTitle = String(page.meta_title ?? page.title);
    const metaDescription = String(page.meta_description ?? '');

    const metafields: Array<Record<string, unknown>> = [
      { namespace: 'morbeez', key: 'faq', value: JSON.stringify(faqJson), type: 'json' },
      { namespace: 'morbeez', key: 'page_type', value: String(page.page_type), type: 'single_line_text_field' },
    ];
    if (page.crop) {
      metafields.push({ namespace: 'morbeez', key: 'crop', value: String(page.crop), type: 'single_line_text_field' });
    }
    if (page.problem) {
      metafields.push({
        namespace: 'morbeez',
        key: 'problem',
        value: String(page.problem),
        type: 'single_line_text_field',
      });
    }
    if (page.related_product_ids?.length) {
      metafields.push({
        namespace: 'morbeez',
        key: 'related_product_ids',
        value: JSON.stringify(page.related_product_ids),
        type: 'json',
      });
    }
    if (metaTitle) {
      metafields.push({ namespace: 'global', key: 'title_tag', value: metaTitle, type: 'single_line_text_field' });
    }
    if (metaDescription) {
      metafields.push({
        namespace: 'global',
        key: 'description_tag',
        value: metaDescription,
        type: 'single_line_text_field',
      });
    }

    const payload: Record<string, unknown> = {
      title: page.title,
      body_html: bodyHtml,
      handle: page.slug,
      published: true,
      template_suffix: 'agronomy',
      metafields,
    };

    let shopifyPageId = page.shopify_page_id ? String(page.shopify_page_id) : null;

    if (shopifyPageId) {
      const res = await shopifyAdmin<ShopifyPageResponse>(`/pages/${shopifyPageId}.json`, {
        method: 'PUT',
        body: JSON.stringify({ page: { ...payload, id: Number(shopifyPageId) } }),
      });
      shopifyPageId = String(res.page.id);
    } else {
      const res = await shopifyAdmin<ShopifyPageResponse>('/pages.json', {
        method: 'POST',
        body: JSON.stringify({ page: payload }),
      });
      shopifyPageId = String(res.page.id);
    }

    const syncedAt = new Date().toISOString();
    const canonicalUrl = `${seoSyncService.storefrontBase()}/pages/${page.slug}`;

    const { data, error } = await supabase
      .from('seo_content_pages')
      .update({
        shopify_page_id: shopifyPageId,
        shopify_synced_at: syncedAt,
        canonical_url: canonicalUrl,
        status: 'published',
        published_at: page.published_at ?? syncedAt,
        updated_at: syncedAt,
      })
      .eq('id', pageId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Update SEO page after Shopify sync');
    if (!data) throw new NotFoundError('SEO page not found');

    return {
      shopifyPageId,
      handle: page.slug,
      storefrontUrl: canonicalUrl,
      page: data,
    };
  },

  async unpublishFromShopify(pageId: string) {
    const page = await seoPagesService.get(pageId);
    if (!page.shopify_page_id) return { ok: true, skipped: true };

    await shopifyAdmin(`/pages/${page.shopify_page_id}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        page: { id: Number(page.shopify_page_id), published: false },
      }),
    });

    await supabase
      .from('seo_content_pages')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', pageId);

    return { ok: true };
  },
};
