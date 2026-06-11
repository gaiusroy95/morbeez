import { randomUUID } from 'crypto';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { razorpayCheckoutService } from '../razorpay/razorpay.checkout.service.js';
import { shopifyOrdersService } from '../shopify/shopify.orders.service.js';
import { checkoutOmsBridgeService } from './checkout-oms-bridge.service.js';
import { checkoutPricingService } from './checkout-pricing.service.js';
function paiseTotal(lineItems) {
    return lineItems.reduce((total, li) => total + Math.round(li.price) * li.quantity, 0);
}
export const checkoutService = {
    async createRazorpayCheckout(input, channel = 'website') {
        const validatedLines = await checkoutPricingService.validateLineItems(input.lineItems);
        const amountPaise = paiseTotal(validatedLines);
        const sessionId = randomUUID();
        const receipt = `mbz_${sessionId.replace(/-/g, '').slice(0, 18)}`;
        const rzOrder = await razorpayCheckoutService.createOrder({
            amount: amountPaise,
            currency: 'INR',
            receipt,
            notes: { checkout_session_id: sessionId },
        });
        const { error } = await supabase.from('checkout_sessions').insert({
            id: sessionId,
            razorpay_order_id: rzOrder.id,
            receipt,
            amount_paise: amountPaise,
            currency: 'INR',
            line_items: validatedLines,
            customer: { ...input.customer, sourceChannel: channel },
            shipping: input.shipping,
            status: 'pending',
        });
        throwIfSupabaseError(error, 'Could not start checkout');
        return {
            sessionId,
            razorpayOrderId: rzOrder.id,
            amount: amountPaise,
            currency: 'INR',
            keyId: razorpayCheckoutService.getPublicKey(),
            prefill: {
                name: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
                email: input.customer.email,
                contact: input.customer.phone.replace(/\D/g, '').slice(-10),
            },
        };
    },
    async verifyAndComplete(input) {
        if (!razorpayCheckoutService.verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
            throw new UnauthorizedError('Payment verification failed');
        }
        const { data: session, error } = await supabase
            .from('checkout_sessions')
            .select('*')
            .eq('razorpay_order_id', input.razorpayOrderId)
            .single();
        throwIfSupabaseError(error, 'Checkout session not found');
        if (!session)
            throw new NotFoundError('Checkout session not found');
        if (session.status === 'paid' && session.shopify_order_id) {
            try {
                await checkoutOmsBridgeService.syncToWarehouse({
                    shopifyOrderId: String(session.shopify_order_id),
                    razorpayPaymentId: session.razorpay_payment_id
                        ? String(session.razorpay_payment_id)
                        : input.razorpayPaymentId,
                });
            }
            catch (err) {
                logger.warn({ err, sessionId: session.id, shopifyOrderId: session.shopify_order_id }, 'Warehouse sync on idempotent checkout complete failed');
            }
            return {
                alreadyCompleted: true,
                shopifyOrderId: session.shopify_order_id,
                orderName: session.shopify_order_name,
            };
        }
        const customer = session.customer;
        const shipping = session.shipping;
        const lineItems = session.line_items;
        const sourceChannel = customer.sourceChannel === 'mobile' ? 'mobile' : 'website';
        const totalInr = (session.amount_paise / 100).toFixed(2);
        const shopifyOrder = await shopifyOrdersService.createPaidOrder({
            email: customer.email,
            phone: customer.phone,
            lineItems: lineItems.map((li) => ({
                variantId: li.variantId,
                quantity: li.quantity,
                title: li.title,
                unitPrice: li.price / 100,
            })),
            shipping: {
                firstName: customer.firstName,
                lastName: customer.lastName,
                address1: shipping.address1,
                address2: shipping.address2,
                city: shipping.city,
                province: shipping.province,
                zip: shipping.zip,
                country: shipping.country ?? 'IN',
                phone: customer.phone,
            },
            totalAmountInr: totalInr,
            razorpayPaymentId: input.razorpayPaymentId,
            razorpayOrderId: input.razorpayOrderId,
            tags: `razorpay-checkout,${sourceChannel}`,
        });
        await supabase
            .from('checkout_sessions')
            .update({
            status: 'paid',
            razorpay_payment_id: input.razorpayPaymentId,
            shopify_order_id: shopifyOrder.shopifyOrderId,
            shopify_order_name: shopifyOrder.orderName,
            updated_at: new Date().toISOString(),
        })
            .eq('id', session.id);
        await supabase.from('payment_events').insert({
            provider: 'razorpay',
            external_id: input.razorpayPaymentId,
            event_type: 'checkout.payment.captured',
            amount: session.amount_paise / 100,
            currency: 'INR',
            status: 'captured',
            metadata: {
                checkout_session_id: session.id,
                shopify_order_id: shopifyOrder.shopifyOrderId,
            },
        });
        try {
            await checkoutOmsBridgeService.syncToWarehouse({
                shopifyOrderId: shopifyOrder.shopifyOrderId,
                razorpayPaymentId: input.razorpayPaymentId,
            });
        }
        catch (err) {
            logger.error({ err, sessionId: session.id, shopifyOrderId: shopifyOrder.shopifyOrderId }, 'Warehouse sync after checkout payment failed — repair job will retry');
        }
        return {
            alreadyCompleted: false,
            shopifyOrderId: shopifyOrder.shopifyOrderId,
            orderName: shopifyOrder.orderName,
            orderStatusUrl: shopifyOrder.orderStatusUrl,
        };
    },
    async createCodCheckout(input, channel = 'mobile', farmerId) {
        const validatedLines = await checkoutPricingService.validateLineItems(input.lineItems);
        const totalInr = (paiseTotal(validatedLines) / 100).toFixed(2);
        const sourceChannel = channel === 'mobile' ? 'mobile' : 'website';
        const shopifyOrder = await shopifyOrdersService.createCodOrder({
            email: input.customer.email,
            phone: input.customer.phone,
            lineItems: validatedLines.map((li) => ({
                variantId: li.variantId,
                quantity: li.quantity,
                title: li.title,
                unitPrice: li.price / 100,
            })),
            shipping: {
                firstName: input.customer.firstName,
                lastName: input.customer.lastName,
                address1: input.shipping.address1,
                address2: input.shipping.address2,
                city: input.shipping.city,
                province: input.shipping.province,
                zip: input.shipping.zip,
                country: input.shipping.country ?? 'IN',
                phone: input.customer.phone,
            },
            totalAmountInr: totalInr,
            note: farmerId ? `Farmer app COD · farmer ${farmerId}` : 'Farmer app COD',
            tags: `razorpay-checkout,${sourceChannel},cod`,
        });
        try {
            await checkoutOmsBridgeService.syncToWarehouse({
                shopifyOrderId: shopifyOrder.shopifyOrderId,
            });
        }
        catch (err) {
            logger.error({ err, shopifyOrderId: shopifyOrder.shopifyOrderId }, 'Warehouse sync after COD checkout failed');
        }
        return {
            shopifyOrderId: shopifyOrder.shopifyOrderId,
            orderName: shopifyOrder.orderName,
            orderStatusUrl: shopifyOrder.orderStatusUrl,
            paymentMethod: 'cod',
        };
    },
};
//# sourceMappingURL=checkout.service.js.map