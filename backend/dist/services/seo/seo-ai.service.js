import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { openaiJsonCompletion } from '../ai/providers/openai.provider.js';
import { shopifyProductsService } from '../shopify/shopify.products.service.js';
import { productIntelligenceService } from '../admin/product-intelligence.service.js';
import { seoFaqService } from './seo-faq.service.js';
import { seoLinksService } from './seo-links.service.js';
import { seoPagesService } from './seo-pages.service.js';
import { seoSchemaService } from './seo-schema.service.js';
import { seoSyncService } from './seo-sync.service.js';
const SEO_SYSTEM = `You are an expert agriculture e-commerce SEO strategist for Morbeez Agri Sciences (India).
Return valid JSON only. Optimize for Google search, Google AI Overviews, and farmer voice queries.
Use clear headings structure, FAQs, tables, and step-by-step agronomy advice.`;
export const seoAiService = {
    async logJob(jobType, entityType, entityId, input, adminId) {
        const { data, error } = await supabase
            .from('seo_ai_jobs')
            .insert({
            job_type: jobType,
            entity_type: entityType,
            entity_id: entityId,
            status: 'running',
            input_json: input,
            created_by: adminId ?? null,
        })
            .select('id')
            .single();
        throwIfSupabaseError(error, 'SEO AI job');
        return data.id;
    },
    async completeJob(jobId, output, failed) {
        await supabase
            .from('seo_ai_jobs')
            .update({
            status: failed ? 'failed' : 'completed',
            output_json: output,
            error_message: failed ?? null,
            completed_at: new Date().toISOString(),
        })
            .eq('id', jobId);
    },
    async generateProductSeo(shopifyProductId, adminId) {
        if (!env.OPENAI_API_KEY)
            throw new AppError('OpenAI not configured', 503, 'OPENAI_NOT_CONFIGURED');
        const product = await shopifyProductsService.get(shopifyProductId);
        const intel = await productIntelligenceService.get(shopifyProductId);
        const ag = intel.agriculture;
        const jobId = await this.logJob('product_seo', 'product', shopifyProductId, { title: product.title }, adminId);
        try {
            const result = await openaiJsonCompletion(SEO_SYSTEM, `Generate SEO for product: ${product.title}
Product type: ${product.productType}
Crops: ${JSON.stringify(ag.crops ?? ag.targetCrops ?? [])}
Benefits: ${JSON.stringify(intel.basic)}
Return JSON: seoTitle (max 60 chars), seoDescription (max 160), urlSlug, focusKeywords (comma-separated),
faqs (3-5 farmer questions), altTags (one per product image concept), internalLinkSuggestions,
schemaNotes, aiVisibilityTips`);
            const seo = {
                seoTitle: result.seoTitle,
                seoDescription: result.seoDescription,
                urlSlug: result.urlSlug,
                focusKeywords: result.focusKeywords,
                aiVisibilityNotes: result.aiVisibilityTips,
                schemaNotes: result.schemaNotes,
                aiGeneratedAt: new Date().toISOString(),
            };
            await productIntelligenceService.upsert(shopifyProductId, { seo }, adminId);
            for (const [i, faq] of (result.faqs ?? []).entries()) {
                await seoFaqService.create({
                    shopifyProductId,
                    question: faq.question,
                    answer: faq.answer,
                    sortOrder: i,
                    aiGenerated: true,
                });
            }
            const schema = seoSchemaService.bundleForProduct({
                product: {
                    name: product.title,
                    description: result.seoDescription,
                    sku: product.sku ?? undefined,
                    image: product.imageUrl ?? undefined,
                    price: product.price ? Number(product.price) : undefined,
                    url: `${seoSyncService.storefrontBase()}/products/${result.urlSlug || product.handle}`,
                },
                faqs: result.faqs,
                breadcrumbs: [
                    { name: 'Home', url: seoSyncService.storefrontBase() },
                    { name: product.productType || 'Products', url: `${seoSyncService.storefrontBase()}/collections/all` },
                    { name: product.title, url: `${seoSyncService.storefrontBase()}/products/${product.handle}` },
                ],
            });
            await this.completeJob(jobId, { ...result, schema });
            return { jobId, seo, faqs: result.faqs, schema, internalLinkSuggestions: result.internalLinkSuggestions };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'AI generation failed';
            await this.completeJob(jobId, {}, msg);
            throw e;
        }
    },
    async generateCropProblemContent(input, adminId) {
        if (!env.OPENAI_API_KEY)
            throw new AppError('OpenAI not configured', 503, 'OPENAI_NOT_CONFIGURED');
        const page = await seoPagesService.generateCropProblemPage(input, adminId);
        const jobId = await this.logJob('crop_problem', 'page', page.id, input, adminId);
        try {
            const result = await openaiJsonCompletion(SEO_SYSTEM, `Write a long-form SEO agronomy article for:
Crop: ${input.crop}
Problem: ${input.problem}
Stage: ${input.stage ?? 'general'}
Region: ${input.region ?? 'South India'}
Include: symptoms, causes, organic & chemical treatment, prevention, product recommendations table.
Structure for Google AI Overviews with H2/H3 headings, bullet lists, and step-by-step fixes.
Return JSON with metaTitle, metaDescription, bodyHtml (HTML), faqs (5+), focusKeywords, relatedProductHints, internalLinks, aiVisibilityStructure`);
            await seoPagesService.update(page.id, {
                metaTitle: result.metaTitle,
                metaDescription: result.metaDescription,
                bodyHtml: result.bodyHtml,
                focusKeywords: result.focusKeywords,
                faqJson: result.faqs,
                aiVisibilityNotes: result.aiVisibilityStructure,
                aiGenerated: true,
                schemaJson: seoSchemaService.buildFaqSchema(result.faqs),
            });
            for (const [i, faq] of (result.faqs ?? []).entries()) {
                await seoFaqService.create({
                    pageId: page.id,
                    question: faq.question,
                    answer: faq.answer,
                    sortOrder: i,
                    aiGenerated: true,
                });
            }
            await seoLinksService.autoLinkPage(page.id);
            await this.completeJob(jobId, result);
            return { pageId: page.id, ...result };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'AI generation failed';
            await this.completeJob(jobId, {}, msg);
            throw e;
        }
    },
    async generateArticle(input, adminId) {
        if (!env.OPENAI_API_KEY)
            throw new AppError('OpenAI not configured', 503, 'OPENAI_NOT_CONFIGURED');
        const page = await seoPagesService.create({
            pageType: 'article',
            title: input.topic,
            crop: input.crop,
            region: input.region,
            status: 'draft',
        }, adminId);
        const jobId = await this.logJob('article', 'page', page.id, input, adminId);
        try {
            const result = await openaiJsonCompletion(SEO_SYSTEM, `Write a comprehensive agronomy SEO article: ${input.topic}
Crop context: ${input.crop ?? 'general horticulture'}
Region: ${input.region ?? 'India'}
Return JSON with title, metaTitle, metaDescription, bodyHtml, faqs, focusKeywords`);
            await seoPagesService.update(page.id, {
                title: result.title,
                metaTitle: result.metaTitle,
                metaDescription: result.metaDescription,
                bodyHtml: result.bodyHtml,
                focusKeywords: result.focusKeywords,
                faqJson: result.faqs,
                aiGenerated: true,
            });
            await this.completeJob(jobId, result);
            return { pageId: page.id, ...result };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'AI generation failed';
            await this.completeJob(jobId, {}, msg);
            throw e;
        }
    },
};
//# sourceMappingURL=seo-ai.service.js.map