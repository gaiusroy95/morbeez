import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import { logAdminMutation } from '../../lib/admin-mutation-audit.js';
import { channelPoolService } from '../../services/pricing/channel-pool.service.js';
import { CHANNEL_POOL_PRESETS, versionLabel } from '../../services/pricing/channel-pool.util.js';

function serializeVersion(row: NonNullable<Awaited<ReturnType<typeof channelPoolService.createVersion>>>) {
  return {
    id: row.id,
    productId: row.productId,
    variantId: row.variantId,
    sku: row.sku,
    version: versionLabel(row.versionNumber),
    versionNumber: row.versionNumber,
    poolPct: row.poolPct,
    agronomistMaxPct: row.agronomistMaxPct,
    partnerMaxPct: row.partnerMaxPct,
    previousPoolPct: row.previousPoolPct,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    status: row.status,
    changeReason: row.changeReason,
    editedBy: row.editedByName,
    editedByAdminId: row.editedByAdminId,
    editedAt: row.editedAt,
  };
}

export async function osChannelPoolRoutes(app: FastifyInstance): Promise<void> {
  const api = '/morbeez-staff/api/v1';

  app.get(`${api}/channel-pool/presets`, async (request, reply) => {
    await assertModuleAccess(request, 'channel_pool', 'read');
    return reply.send({ ok: true, presets: CHANNEL_POOL_PRESETS });
  });

  app.get(`${api}/products/:id/channel-pool`, async (request, reply) => {
    await assertModuleAccess(request, 'channel_pool', 'read');
    const { id } = request.params as { id: string };
    const variants = await channelPoolService.listForProduct(id);
    return reply.send({
      ok: true,
      variants: variants.map((v) => ({
        variantId: v.variantId,
        sku: v.sku,
        current: v.current ? serializeVersion(v.current) : null,
        previous: v.previous ? serializeVersion(v.previous) : null,
        history: v.history.map(serializeVersion),
      })),
    });
  });

  app.post(`${api}/products/:id/channel-pool`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'channel_pool', 'write');
    const { id } = request.params as { id: string };
    const body = z
      .object({
        variantId: z.string().min(1),
        sku: z.string().optional(),
        poolPct: z.coerce.number(),
        agronomistMaxPct: z.coerce.number().optional().nullable(),
        partnerMaxPct: z.coerce.number().optional().nullable(),
        effectiveFrom: z.string().min(8),
        reason: z.string().min(3).max(500),
      })
      .parse(request.body);

    const version = await channelPoolService.createVersion({
      productId: id,
      variantId: body.variantId,
      sku: body.sku,
      poolPct: body.poolPct,
      agronomistMaxPct: body.agronomistMaxPct,
      partnerMaxPct: body.partnerMaxPct,
      effectiveFrom: body.effectiveFrom,
      reason: body.reason,
      adminId: admin.id,
      adminEmail: admin.email,
    });

    await logAdminMutation({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'create',
      resource: 'channel_pool',
      resourceId: version.id,
      details: {
        productId: id,
        variantId: body.variantId,
        sku: body.sku ?? null,
        poolPct: version.poolPct,
        agronomistMaxPct: version.agronomistMaxPct,
        partnerMaxPct: version.partnerMaxPct,
        previousPoolPct: version.previousPoolPct,
        version: versionLabel(version.versionNumber),
        effectiveFrom: version.effectiveFrom,
        reason: body.reason,
      },
    });

    return reply.code(201).send({ ok: true, version: serializeVersion(version) });
  });
}
