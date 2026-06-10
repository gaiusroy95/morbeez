import type { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { storeCatalogService } from '../../services/store/store-catalog.service.js';
import { requireFarmer } from '../../middleware/require-farmer.js';

export async function storeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/store/products', async (request, reply) => {
    const q = request.query as {
      page?: string;
      limit?: string;
      search?: string;
      category?: string;
    };

    const result = await storeCatalogService.list({
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      search: q.search?.trim() || undefined,
      category: q.category?.trim() || undefined,
    });

    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/store/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await storeCatalogService.get(id);
    return reply.send({ ok: true, product });
  });

  app.get('/api/v1/store/banners', async (request, reply) => {
    const q = request.query as { placement?: string };
    const placement = q.placement?.trim() || 'home_hero';
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('commerce_banners')
      .select('id, title, description, image_url, cta_label, cta_url, placement')
      .eq('active', true)
      .eq('placement', placement)
      .lte('starts_at', now)
      .gte('ends_at', now)
      .order('sort_order', { ascending: true })
      .limit(10);
    throwIfSupabaseError(error, 'Could not load banners');
    return reply.send({
      ok: true,
      banners: (data ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: b.description,
        imageUrl: b.image_url,
        linkUrl: b.cta_url,
        ctaLabel: b.cta_label,
      })),
    });
  });

  app.get('/api/v1/store/recommendations', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { data, error } = await supabase
      .from('crm_recommendations')
      .select('id, problem, products, recommendation')
      .eq('farmer_id', farmerId)
      .or('status.is.null,status.eq.active,status.eq.pending')
      .order('created_at', { ascending: false })
      .limit(5);
    throwIfSupabaseError(error, 'Could not load recommendations');
    const products = await storeCatalogService.list({ limit: 6, page: 1 });
    return reply.send({
      ok: true,
      recommendationIds: (data ?? []).map((r) => String(r.id)),
      products: products.products.slice(0, 6),
    });
  });
}
