import type { ShopifyOrder } from '../shopify/shopify.client.js';
type ShopifyLineItem = {
    id?: number;
    sku?: string | null;
    variant_id?: number | null;
    title?: string;
    variant_title?: string | null;
    quantity?: number;
    price?: string;
};
export declare const orderSyncService: {
    syncOrderMetadata(order: ShopifyOrder & {
        line_items?: ShopifyLineItem[];
    }): Promise<void>;
    syncOrderLines(shopifyOrderId: string, order?: ShopifyOrder): Promise<void>;
};
export {};
//# sourceMappingURL=order-sync.service.d.ts.map