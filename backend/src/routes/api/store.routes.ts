import type { FastifyInstance } from 'fastify';
import { storeCatalogService } from '../../services/store/store-catalog.service.js';

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
}
