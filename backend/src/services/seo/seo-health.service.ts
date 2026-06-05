import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { shopifyProductsService } from '../shopify/shopify.products.service.js';
import { productIntelligenceService } from '../admin/product-intelligence.service.js';
import { seoPagesService } from './seo-pages.service.js';
import { seoSyncService } from './seo-sync.service.js';

export const seoHealthService = {
  async list(opts?: { resolved?: boolean; issueType?: string }) {
    let q = supabase.from('seo_health_issues').select('*').order('detected_at', { ascending: false });
    if (opts?.resolved === false) q = q.eq('resolved', false);
    if (opts?.resolved === true) q = q.eq('resolved', true);
    if (opts?.issueType) q = q.eq('issue_type', opts.issueType);
    const { data, error } = await q.limit(200);
    throwIfSupabaseError(error, 'List health issues');
    return data ?? [];
  },

  async resolve(id: string) {
    const { data, error } = await supabase
      .from('seo_health_issues')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Resolve issue');
    return data;
  },

  async runScan() {
    const issues: Array<Record<string, unknown>> = [];
    const base = seoSyncService.storefrontBase();

    const { products } = await shopifyProductsService.list({ limit: 150, page: 1 });
    for (const p of products) {
      const intel = await productIntelligenceService.get(p.id);
      const seo = intel.seo as Record<string, unknown>;
      const url = `${base}/products/${p.handle}`;

      if (!String(seo.seoTitle ?? '').trim()) {
        issues.push({
          issue_type: 'missing_meta',
          severity: 'warning',
          url,
          entity_type: 'product',
          entity_id: p.id,
          message: `Missing SEO title for ${p.title}`,
        });
      }
      if (!String(seo.seoDescription ?? '').trim()) {
        issues.push({
          issue_type: 'missing_meta',
          severity: 'warning',
          url,
          entity_type: 'product',
          entity_id: p.id,
          message: `Missing meta description for ${p.title}`,
        });
      }
      for (const img of p.images ?? []) {
        if (!img.alt?.trim()) {
          issues.push({
            issue_type: 'missing_alt',
            severity: 'info',
            url,
            entity_type: 'product',
            entity_id: p.id,
            message: `Image missing ALT text on ${p.title}`,
            details: { imageId: img.id },
          });
        }
      }
      const bodyLen = (p.bodyHtml ?? '').replace(/<[^>]+>/g, '').trim().length;
      if (bodyLen < 120) {
        issues.push({
          issue_type: 'thin_content',
          severity: 'warning',
          url,
          entity_type: 'product',
          entity_id: p.id,
          message: `Thin product description (${bodyLen} chars)`,
        });
      }
    }

    const pages = await seoPagesService.list();
    const slugs = new Map<string, string>();
    for (const page of pages) {
      const slug = String(page.slug);
      if (slugs.has(slug)) {
        issues.push({
          issue_type: 'duplicate_content',
          severity: 'critical',
          url: `${base}/pages/${slug}`,
          entity_type: 'page',
          entity_id: page.id,
          message: `Duplicate slug: ${slug}`,
        });
      }
      slugs.set(slug, page.id);
      if (!String(page.meta_description ?? '').trim()) {
        issues.push({
          issue_type: 'missing_meta',
          severity: 'warning',
          url: `${base}/pages/${slug}`,
          entity_type: 'page',
          entity_id: page.id,
          message: `Missing meta description on ${page.title}`,
        });
      }
      const bodyLen = String(page.body_html ?? '').replace(/<[^>]+>/g, '').trim().length;
      if (bodyLen < 200 && page.status === 'published') {
        issues.push({
          issue_type: 'thin_content',
          severity: 'warning',
          entity_type: 'page',
          entity_id: page.id,
          message: `Thin published content on ${page.title}`,
        });
      }
    }

    await supabase.from('seo_health_issues').update({ resolved: true }).eq('resolved', false);

    if (issues.length) {
      const { error } = await supabase.from('seo_health_issues').insert(issues);
      throwIfSupabaseError(error, 'Insert health issues');
    }

    return {
      scannedProducts: products.length,
      scannedPages: pages.length,
      issuesFound: issues.length,
      issues,
    };
  },
};
