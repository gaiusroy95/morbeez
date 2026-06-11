import { logger } from '../../lib/logger.js';
import { shopifyAdmin } from './shopify.client.js';
import { shopifyPublicationsService } from './shopify.publications.service.js';

type ParsedDiscount =
  | { valueType: 'percentage'; value: number }
  | { valueType: 'fixed_amount'; value: number };

function parseDiscountLabel(label: string): ParsedDiscount | null {
  const trimmed = label.trim();
  const pctMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    const value = Number(pctMatch[1]);
    if (value > 0 && value <= 100) return { valueType: 'percentage', value };
  }
  const flatMatch = trimmed.replace(/,/g, '').match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)/i);
  if (flatMatch && /off/i.test(trimmed)) {
    const value = Number(flatMatch[1]);
    if (value > 0) return { valueType: 'fixed_amount', value };
  }
  return null;
}

type CouponSyncInput = {
  code: string;
  discountLabel: string;
  minOrderAmount: number;
  usageLimit: number;
  validUntil: string;
};

type FlashSaleSyncInput = {
  shopifyProductId: string;
  flashPrice: number;
  originalPrice: number;
};

export const shopifyCampaignsService = {
  async getConnectionStatus() {
    return shopifyPublicationsService.getConnectionStatus();
  },

  async syncCoupon(input: CouponSyncInput): Promise<{ ok: boolean; reason?: string }> {
    const parsed = parseDiscountLabel(input.discountLabel);
    if (!parsed) {
      return { ok: false, reason: `Could not parse discount "${input.discountLabel}"` };
    }

    const startsAt = new Date().toISOString();
    const endsAt = new Date(input.validUntil).toISOString();
    const priceRule: Record<string, unknown> = {
      title: `Morbeez ${input.code}`,
      target_type: 'line_item',
      target_selection: 'all',
      allocation_method: 'across',
      value_type: parsed.valueType,
      value: parsed.valueType === 'percentage' ? `-${parsed.value}` : `-${parsed.value.toFixed(2)}`,
      customer_selection: 'all',
      starts_at: startsAt,
      ends_at: endsAt,
      usage_limit: Math.max(1, input.usageLimit),
      once_per_customer: false,
    };

    if (input.minOrderAmount > 0) {
      priceRule.prerequisite_subtotal_range = {
        greater_than_or_equal_to: input.minOrderAmount.toFixed(2),
      };
    }

    try {
      const ruleRes = await shopifyAdmin<{ price_rule: { id: number } }>('/price_rules.json', {
        method: 'POST',
        body: JSON.stringify({ price_rule: priceRule }),
      });

      await shopifyAdmin('/discount_codes.json', {
        method: 'POST',
        body: JSON.stringify({
          discount_code: {
            code: input.code.trim().toUpperCase(),
            price_rule_id: ruleRes.price_rule.id,
          },
        }),
      });

      return { ok: true };
    } catch (err) {
      logger.warn({ err, code: input.code }, 'Shopify coupon sync failed');
      return { ok: false, reason: err instanceof Error ? err.message : 'Shopify sync failed' };
    }
  },

  async syncFlashSalePrice(input: FlashSaleSyncInput): Promise<{ ok: boolean; reason?: string }> {
    const productId = input.shopifyProductId.trim();
    if (!productId) return { ok: false, reason: 'No Shopify product linked' };

    try {
      const res = await shopifyAdmin<{
        product: { variants?: Array<{ id: number; price: string; compare_at_price: string | null }> };
      }>(`/products/${productId}.json`);

      const variants = res.product.variants ?? [];
      if (!variants.length) return { ok: false, reason: 'Product has no variants' };

      const flash = input.flashPrice.toFixed(2);
      const compareAt = input.originalPrice.toFixed(2);

      await Promise.all(
        variants.map((variant) =>
          shopifyAdmin(`/variants/${variant.id}.json`, {
            method: 'PUT',
            body: JSON.stringify({
              variant: {
                id: variant.id,
                price: flash,
                compare_at_price: compareAt,
              },
            }),
          })
        )
      );

      return { ok: true };
    } catch (err) {
      logger.warn({ err, productId }, 'Shopify flash sale price sync failed');
      return { ok: false, reason: err instanceof Error ? err.message : 'Shopify sync failed' };
    }
  },
};
