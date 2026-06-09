import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireFarmer } from '../../middleware/require-farmer.js';
import { farmerPortalService } from '../../services/farmer/farmer-portal.service.js';
import { farmerProductReviewService } from '../../services/farmer/farmer-product-review.service.js';

/**
 * Farmer customer portal — JWT-protected, no CRM internals exposed.
 */
export async function farmerPortalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/store/product-reviews', async (request, reply) => {
    const q = request.query as { productId?: string };
    if (!q.productId?.trim()) {
      return reply.status(400).send({ ok: false, message: 'productId is required' });
    }
    const result = await farmerProductReviewService.aggregateForProduct(q.productId.trim());
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/summary', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const summary = await farmerPortalService.getSummary(farmerId);
    return reply.send({ ok: true, ...summary });
  });

  app.get('/api/v1/farmer/portal/orders', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalService.listOrders(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/orders/:id/tracking', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { id } = request.params as { id: string };
    const result = await farmerPortalService.getOrderTracking(farmerId, id);
    return reply.send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/orders/:id/reviews', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const { id } = request.params as { id: string };
    const body = z
      .object({
        productKey: z.string().min(1).max(160),
        rating: z.number().int().min(1).max(5),
        reviewText: z.string().max(2000).optional(),
      })
      .parse(request.body);
    const review = await farmerPortalService.submitOrderReview(farmerId, id, body);
    return reply.status(201).send({ ok: true, review });
  });

  app.get('/api/v1/farmer/portal/advisory', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalService.getAdvisory(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/soil-reports', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalService.listSoilReports(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/roi', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalService.getRoi(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.get('/api/v1/farmer/portal/notifications', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const notifications = await farmerPortalService.listNotifications(farmerId);
    return reply.send({ ok: true, notifications });
  });

  app.get('/api/v1/farmer/portal/field-photos', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const result = await farmerPortalService.listFieldPhotos(farmerId);
    return reply.send({ ok: true, ...result });
  });

  app.post('/api/v1/farmer/portal/field-photos', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        photoType: z.enum(['field', 'leaf', 'rhizome']),
        imageData: z.string().min(32),
        mimeType: z.string().optional(),
        notes: z.string().max(300).optional(),
      })
      .parse(request.body);
    const result = await farmerPortalService.uploadFieldPhoto(farmerId, body);
    return reply.status(201).send(result);
  });

  app.patch('/api/v1/farmer/portal/address', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const body = z
      .object({
        address1: z.string().max(240).optional(),
        address2: z.string().max(120).optional(),
        city: z.string().max(80).optional(),
        state: z.string().max(80).optional(),
        pincode: z.string().max(10).optional(),
      })
      .parse(request.body);
    const profile = await farmerPortalService.updateShippingAddress(farmerId, body);
    return reply.send({ ok: true, profile });
  });

  app.get('/api/v1/farmer/portal/profile', async (request, reply) => {
    const { farmerId } = requireFarmer(request);
    const profile = await farmerPortalService.getProfile(farmerId);
    return reply.send({ ok: true, profile });
  });
}
