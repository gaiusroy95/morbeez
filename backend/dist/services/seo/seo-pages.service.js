import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { seoSchemaService } from './seo-schema.service.js';
function slugify(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
export const seoPagesService = {
    async list(opts) {
        let q = supabase.from('seo_content_pages').select('*').order('updated_at', { ascending: false });
        if (opts?.pageType)
            q = q.eq('page_type', opts.pageType);
        if (opts?.status)
            q = q.eq('status', opts.status);
        if (opts?.crop)
            q = q.ilike('crop', `%${opts.crop}%`);
        if (opts?.search?.trim()) {
            const s = `%${opts.search.trim()}%`;
            q = q.or(`title.ilike.${s},slug.ilike.${s},problem.ilike.${s}`);
        }
        const { data, error } = await q.limit(100);
        throwIfSupabaseError(error, 'List SEO pages');
        return data ?? [];
    },
    async get(id) {
        const { data, error } = await supabase.from('seo_content_pages').select('*').eq('id', id).maybeSingle();
        throwIfSupabaseError(error, 'Get SEO page');
        if (!data)
            throw new NotFoundError('SEO page not found');
        return data;
    },
    async create(input, adminId) {
        const slug = slugify(input.slug ?? input.title);
        const schema = seoSchemaService.buildArticleSchema({
            title: input.metaTitle ?? input.title,
            description: input.metaDescription ?? '',
            url: `/${slug}`,
        });
        const { data, error } = await supabase
            .from('seo_content_pages')
            .insert({
            page_type: input.pageType,
            slug,
            title: input.title,
            meta_title: input.metaTitle ?? input.title,
            meta_description: input.metaDescription ?? '',
            crop: input.crop ?? null,
            problem: input.problem ?? null,
            stage: input.stage ?? null,
            region: input.region ?? null,
            body_html: input.bodyHtml ?? '',
            focus_keywords: input.focusKeywords ?? [],
            related_product_ids: input.relatedProductIds ?? [],
            schema_json: schema,
            status: input.status ?? 'draft',
            created_by: adminId ?? null,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Create SEO page');
        return data;
    },
    async update(id, input) {
        const patch = { updated_at: new Date().toISOString() };
        const map = {
            pageType: 'page_type',
            title: 'title',
            slug: 'slug',
            metaTitle: 'meta_title',
            metaDescription: 'meta_description',
            crop: 'crop',
            problem: 'problem',
            stage: 'stage',
            region: 'region',
            bodyHtml: 'body_html',
            focusKeywords: 'focus_keywords',
            relatedProductIds: 'related_product_ids',
            internalLinks: 'internal_links',
            faqJson: 'faq_json',
            schemaJson: 'schema_json',
            status: 'status',
            canonicalUrl: 'canonical_url',
            aiVisibilityNotes: 'ai_visibility_notes',
            aiGenerated: 'ai_generated',
        };
        for (const [k, col] of Object.entries(map)) {
            if (input[k] !== undefined) {
                patch[col] = k === 'slug' ? slugify(String(input[k])) : input[k];
            }
        }
        if (input.status === 'published' && !patch.published_at) {
            patch.published_at = new Date().toISOString();
        }
        const { data, error } = await supabase
            .from('seo_content_pages')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Update SEO page');
        if (input.status === 'published' && data) {
            const { seoShopifyPublishService } = await import('./seo-shopify-publish.service.js');
            return (await seoShopifyPublishService.publishToShopify(id)).page;
        }
        return data;
    },
    /** Dynamic page from crop + problem + stage inputs */
    async generateCropProblemPage(input, adminId) {
        const title = `${input.crop} ${input.problem}${input.stage ? ` at ${input.stage}` : ''} — Treatment Guide`;
        const slug = slugify(`${input.crop}-${input.problem}${input.stage ? `-${input.stage}` : ''}`);
        const metaTitle = `${title} | Morbeez Agri Sciences`;
        const metaDescription = `Expert guide on ${input.problem.toLowerCase()} in ${input.crop.toLowerCase()}. Symptoms, causes, organic & chemical treatment, and Morbeez product recommendations.`;
        return this.create({
            pageType: 'crop_problem',
            title,
            slug,
            metaTitle,
            metaDescription,
            crop: input.crop,
            problem: input.problem,
            stage: input.stage,
            region: input.region,
            focusKeywords: [
                `${input.crop.toLowerCase()} ${input.problem.toLowerCase()}`,
                `${input.problem.toLowerCase()} treatment`,
                `${input.crop.toLowerCase()} disease`,
            ],
            status: 'draft',
        }, adminId);
    },
};
//# sourceMappingURL=seo-pages.service.js.map