import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { commerceQuoteService } from '../../services/commerce/commerce-quote.service.js';
function assertCheckoutEnabled() {
    if (!env.ENABLE_RAZORPAY_CHECKOUT) {
        throw new AppError('Razorpay checkout is disabled', 503, 'CHECKOUT_DISABLED');
    }
}
export async function quotesRoutes(app) {
    app.get('/api/v1/quotes/public/:token', async (request, reply) => {
        const { token } = request.params;
        const quote = await commerceQuoteService.getByToken(token);
        return reply.send({ ok: true, quote });
    });
    app.post('/api/v1/quotes/public/:token/checkout', async (request, reply) => {
        const { token } = request.params;
        const quote = await commerceQuoteService.getByToken(token);
        const body = z
            .object({
            paymentType: z.enum(['full', 'partial']),
            prepaidAmount: z.number().min(0).optional(),
        })
            .parse(request.body);
        const updated = await commerceQuoteService.startCheckout(quote.id, body);
        return reply.send({ ok: true, quote: updated });
    });
    app.post('/api/v1/quotes/public/:token/pay', async (request, reply) => {
        assertCheckoutEnabled();
        const { token } = request.params;
        const quote = await commerceQuoteService.getByToken(token);
        const payment = await commerceQuoteService.createPayment(quote.id);
        return reply.send({ ok: true, ...payment });
    });
    app.post('/api/v1/quotes/public/:token/verify', async (request, reply) => {
        assertCheckoutEnabled();
        const { token } = request.params;
        const quote = await commerceQuoteService.getByToken(token);
        const body = z
            .object({
            razorpayOrderId: z.string().min(1),
            razorpayPaymentId: z.string().min(1),
            razorpaySignature: z.string().min(1),
        })
            .parse(request.body);
        const result = await commerceQuoteService.verifyPayment(quote.id, body);
        return reply.send({ ok: true, ...result });
    });
}
//# sourceMappingURL=quotes.routes.js.map