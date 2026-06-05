import type { ShopifyOrder } from '../shopify/shopify.client.js';
export type OmsStatus = 'pending' | 'confirmed' | 'picking' | 'packed' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'returned';
export declare const omsWorkflowService: {
    onOrderPlaced(shopifyOrderId: string, order?: ShopifyOrder): Promise<void>;
    confirmOrder(commerceOrderId: string): Promise<any>;
    completePacking(pickListId: string, verifiedBy?: string): Promise<{
        invoice: any;
        pickListId: string;
    }>;
    updateStatus(commerceOrderId: string, status: OmsStatus): Promise<void>;
    getOrderWorkflow(commerceOrderId: string): Promise<any>;
    listOmsOrders(opts?: {
        omsStatus?: string;
        limit?: number;
    }): Promise<{
        id: any;
        shopify_order_id: any;
        order_name: any;
        oms_status: any;
        is_cod: any;
        total_amount: any;
        created_at: any;
    }[]>;
};
//# sourceMappingURL=workflow.service.d.ts.map