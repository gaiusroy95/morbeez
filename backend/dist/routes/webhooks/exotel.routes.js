import { exotelService } from '../../services/call-intelligence/exotel.service.js';
import { logger } from '../../lib/logger.js';
export async function exotelWebhookRoutes(app) {
    app.post('/webhooks/exotel/status', async (request, reply) => {
        const payload = request.body && typeof request.body === 'object'
            ? request.body
            : {};
        try {
            const result = await exotelService.handleStatusWebhook(payload);
            return reply.send(result);
        }
        catch (err) {
            logger.error({ err, payload }, 'Exotel webhook failed');
            return reply.code(500).send({ ok: false });
        }
    });
}
//# sourceMappingURL=exotel.routes.js.map