import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import { seoDashboardService } from '../../services/seo/seo-dashboard.service.js';
import { seoProductService } from '../../services/seo/seo-product.service.js';
import { seoPagesService } from '../../services/seo/seo-pages.service.js';
import { seoFaqService } from '../../services/seo/seo-faq.service.js';
import { seoLinksService } from '../../services/seo/seo-links.service.js';
import { seoSchemaService } from '../../services/seo/seo-schema.service.js';
import { seoHealthService } from '../../services/seo/seo-health.service.js';
import { seoKeywordsService } from '../../services/seo/seo-keywords.service.js';
import { seoGscService } from '../../services/seo/seo-gsc.service.js';
import { seoSitemapService } from '../../services/seo/seo-sitemap.service.js';
import { seoRegionalService } from '../../services/seo/seo-regional.service.js';
import { seoAiService } from '../../services/seo/seo-ai.service.js';
export async function osSeoRoutes(app) {
    const api = '/morbeez-staff/api/v1/os/seo';
    // ─── Dashboard ──────────────────────────────────────────────────────────────
    app.get(`${api}/dashboard`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const dashboard = await seoDashboardService.getDashboard();
        return reply.send({ ok: true, dashboard });
    });
    // ─── Products ───────────────────────────────────────────────────────────────
    app.get(`${api}/products`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const q = request.query;
        const products = await seoProductService.list({
            search: q.search,
            missingOnly: q.missingOnly === 'true',
        });
        return reply.send({ ok: true, products });
    });
    app.get(`${api}/products/:shopifyProductId`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const { shopifyProductId } = request.params;
        const product = await seoProductService.get(shopifyProductId);
        return reply.send({ ok: true, product });
    });
    app.put(`${api}/products/:shopifyProductId`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'seo', 'write');
        const { shopifyProductId } = request.params;
        const body = z
            .object({
            seoTitle: z.string().optional(),
            seoDescription: z.string().optional(),
            urlSlug: z.string().optional(),
            focusKeywords: z.string().optional(),
            canonicalUrl: z.string().optional(),
            altTags: z.array(z.object({ imageId: z.string(), alt: z.string() })).optional(),
        })
            .parse(request.body);
        const product = await seoProductService.update(shopifyProductId, body, admin.id);
        return reply.send({ ok: true, product });
    });
    app.post(`${api}/products/:shopifyProductId/sync`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const { shopifyProductId } = request.params;
        const result = await seoProductService.syncToShopify(shopifyProductId);
        return reply.send({ ...result, ok: true });
    });
    app.post(`${api}/products/:shopifyProductId/generate`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'seo', 'write');
        const { shopifyProductId } = request.params;
        const result = await seoAiService.generateProductSeo(shopifyProductId, admin.id);
        return reply.send({ ok: true, ...result });
    });
    // ─── Content pages ──────────────────────────────────────────────────────────
    app.get(`${api}/pages`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const q = request.query;
        const pages = await seoPagesService.list(q);
        return reply.send({ ok: true, pages });
    });
    app.get(`${api}/pages/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const { id } = request.params;
        const page = await seoPagesService.get(id);
        return reply.send({ ok: true, page });
    });
    app.post(`${api}/pages`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'seo', 'write');
        const body = z
            .object({
            pageType: z.string(),
            title: z.string().min(1),
            slug: z.string().optional(),
            metaTitle: z.string().optional(),
            metaDescription: z.string().optional(),
            crop: z.string().optional(),
            problem: z.string().optional(),
            stage: z.string().optional(),
            region: z.string().optional(),
            bodyHtml: z.string().optional(),
            focusKeywords: z.array(z.string()).optional(),
            relatedProductIds: z.array(z.string()).optional(),
            status: z.string().optional(),
        })
            .parse(request.body);
        const page = await seoPagesService.create(body, admin.id);
        return reply.send({ ok: true, page });
    });
    app.put(`${api}/pages/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const { id } = request.params;
        const body = request.body;
        const page = await seoPagesService.update(id, body);
        return reply.send({ ok: true, page });
    });
    app.post(`${api}/pages/:id/publish`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const { id } = request.params;
        const { seoShopifyPublishService } = await import('../../services/seo/seo-shopify-publish.service.js');
        const result = await seoShopifyPublishService.publishToShopify(id);
        return reply.send({ ok: true, ...result });
    });
    app.post(`${api}/pages/generate-crop-problem`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'seo', 'write');
        const body = z
            .object({
            crop: z.string().min(1),
            problem: z.string().min(1),
            stage: z.string().optional(),
            region: z.string().optional(),
            useAi: z.boolean().optional(),
        })
            .parse(request.body);
        if (body.useAi !== false) {
            const result = await seoAiService.generateCropProblemContent(body, admin.id);
            return reply.send({ ok: true, ...result });
        }
        const page = await seoPagesService.generateCropProblemPage(body, admin.id);
        return reply.send({ ok: true, page });
    });
    // ─── FAQs ───────────────────────────────────────────────────────────────────
    app.get(`${api}/faqs`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const q = request.query;
        const faqs = await seoFaqService.list(q);
        return reply.send({ ok: true, faqs });
    });
    app.post(`${api}/faqs`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const body = z
            .object({
            pageId: z.string().uuid().optional(),
            shopifyProductId: z.string().optional(),
            question: z.string().min(1),
            answer: z.string().min(1),
            sortOrder: z.number().optional(),
        })
            .parse(request.body);
        const faq = await seoFaqService.create(body);
        return reply.send({ ok: true, faq });
    });
    app.delete(`${api}/faqs/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const { id } = request.params;
        await seoFaqService.remove(id);
        return reply.send({ ok: true });
    });
    // ─── Internal links ─────────────────────────────────────────────────────────
    app.get(`${api}/links`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const q = request.query;
        const links = await seoLinksService.list(q);
        return reply.send({ ok: true, links });
    });
    app.post(`${api}/links`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const body = z
            .object({
            sourceType: z.string(),
            sourceId: z.string(),
            targetType: z.string(),
            targetId: z.string(),
            anchorText: z.string(),
            context: z.string().optional(),
        })
            .parse(request.body);
        const link = await seoLinksService.create(body);
        return reply.send({ ok: true, link });
    });
    app.post(`${api}/links/auto/:pageId`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const { pageId } = request.params;
        const links = await seoLinksService.autoLinkPage(pageId);
        return reply.send({ ok: true, links });
    });
    app.delete(`${api}/links/:id`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const { id } = request.params;
        await seoLinksService.remove(id);
        return reply.send({ ok: true });
    });
    // ─── Schema ─────────────────────────────────────────────────────────────────
    app.post(`${api}/schema/preview`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const body = z
            .object({
            type: z.enum(['product', 'faq', 'breadcrumb', 'article']),
            payload: z.record(z.unknown()),
        })
            .parse(request.body);
        let schema;
        switch (body.type) {
            case 'product':
                schema = seoSchemaService.buildProductSchema(body.payload);
                break;
            case 'faq':
                schema = seoSchemaService.buildFaqSchema(body.payload.faqs);
                break;
            case 'breadcrumb':
                schema = seoSchemaService.buildBreadcrumbSchema(body.payload.items);
                break;
            default:
                schema = seoSchemaService.buildArticleSchema(body.payload);
        }
        return reply.send({ ok: true, schema });
    });
    // ─── Health ─────────────────────────────────────────────────────────────────
    app.get(`${api}/health`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const q = request.query;
        const issues = await seoHealthService.list({
            resolved: q.resolved === 'true' ? true : q.resolved === 'false' ? false : undefined,
            issueType: q.issueType,
        });
        return reply.send({ ok: true, issues });
    });
    app.post(`${api}/health/scan`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const result = await seoHealthService.runScan();
        return reply.send({ ok: true, ...result });
    });
    app.post(`${api}/health/:id/resolve`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const { id } = request.params;
        const issue = await seoHealthService.resolve(id);
        return reply.send({ ok: true, issue });
    });
    // ─── Keywords ───────────────────────────────────────────────────────────────
    app.get(`${api}/keywords`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const q = request.query;
        const keywords = await seoKeywordsService.list(q);
        return reply.send({ ok: true, keywords });
    });
    app.post(`${api}/keywords`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const body = z
            .object({
            keyword: z.string().min(1),
            targetType: z.string().optional(),
            targetId: z.string().optional(),
            region: z.string().optional(),
            position: z.number().optional(),
            impressions: z.number().optional(),
            clicks: z.number().optional(),
            ctr: z.number().optional(),
        })
            .parse(request.body);
        const row = await seoKeywordsService.upsert(body);
        return reply.send({ ok: true, keyword: row });
    });
    // ─── GSC ──────────────────────────────────────────────────────────────────
    app.get(`${api}/gsc`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const [config, snapshot] = await Promise.all([
            seoGscService.getConfig(),
            seoGscService.getLatestSnapshot(),
        ]);
        return reply.send({ ok: true, config, snapshot });
    });
    app.post(`${api}/gsc/config`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const body = z.object({ siteUrl: z.string().url(), refreshToken: z.string().optional() }).parse(request.body);
        const config = await seoGscService.saveConfig(body);
        return reply.send({ ok: true, config });
    });
    app.post(`${api}/gsc/sync`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const result = await seoGscService.sync();
        return reply.send(result);
    });
    // ─── Sitemaps ───────────────────────────────────────────────────────────────
    app.get(`${api}/sitemaps`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const sitemaps = await seoSitemapService.list();
        return reply.send({ ok: true, sitemaps });
    });
    app.post(`${api}/sitemaps/generate`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const result = await seoSitemapService.generateAll();
        return reply.send({ ok: true, ...result });
    });
    app.post(`${api}/sitemaps/:id/submit`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const { id } = request.params;
        const sitemap = await seoSitemapService.markSubmitted(id);
        return reply.send({ ok: true, sitemap });
    });
    // ─── Regional ───────────────────────────────────────────────────────────────
    app.get(`${api}/regional`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'read');
        const q = request.query;
        const trends = await seoRegionalService.list(q.region);
        return reply.send({ ok: true, trends });
    });
    app.post(`${api}/regional`, async (request, reply) => {
        await assertModuleAccess(request, 'seo', 'write');
        const body = z
            .object({
            region: z.string(),
            keyword: z.string(),
            trendScore: z.number().optional(),
            searchVolumeEstimate: z.number().optional(),
            notes: z.string().optional(),
            suggestedPageSlug: z.string().optional(),
        })
            .parse(request.body);
        const trend = await seoRegionalService.upsert(body);
        return reply.send({ ok: true, trend });
    });
    // ─── AI content ─────────────────────────────────────────────────────────────
    app.post(`${api}/ai/article`, async (request, reply) => {
        const admin = await assertModuleAccess(request, 'seo', 'write');
        const body = z
            .object({
            topic: z.string().min(1),
            crop: z.string().optional(),
            region: z.string().optional(),
        })
            .parse(request.body);
        const result = await seoAiService.generateArticle(body, admin.id);
        return reply.send({ ok: true, ...result });
    });
}
//# sourceMappingURL=os-seo.routes.js.map