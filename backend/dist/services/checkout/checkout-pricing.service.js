import { shopifyAdmin } from '../shopify/shopify.client.js';
import { shopifyInventoryService } from '../shopify/shopify.inventory.service.js';
import { ValidationError } from '../../lib/errors.js';
export const checkoutPricingService = {
    async validateLineItems(lineItems) {
        if (!lineItems.length)
            throw new ValidationError('Cart is empty');
        const validated = [];
        for (const li of lineItems) {
            if (!li.variantId || li.quantity < 1) {
                throw new ValidationError('Invalid cart line item');
            }
            const res = await shopifyAdmin(`/variants/${li.variantId}.json`);
            const variant = res.variant;
            if (!variant?.id) {
                throw new ValidationError(`Product variant ${li.variantId} is not available`);
            }
            const serverPricePaise = Math.round(parseFloat(variant.price) * 100);
            if (!Number.isFinite(serverPricePaise) || serverPricePaise <= 0) {
                throw new ValidationError(`Variant ${li.variantId} has invalid price`);
            }
            if (li.price != null && Math.abs(li.price - serverPricePaise) > 1) {
                throw new ValidationError('Cart price changed — refresh and try again');
            }
            let stock = 99;
            try {
                stock = await shopifyInventoryService.getVariantStock(li.variantId);
            }
            catch {
                /* inventory lookup optional */
            }
            if (li.quantity > stock) {
                throw new ValidationError(`Only ${stock} units available for this item`);
            }
            validated.push({
                variantId: li.variantId,
                quantity: li.quantity,
                price: serverPricePaise,
                title: li.title?.trim() || variant.title,
            });
        }
        return validated;
    },
};
//# sourceMappingURL=checkout-pricing.service.js.map