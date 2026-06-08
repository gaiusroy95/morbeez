import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { getOrder } from '../shopify/shopify.client.js';
import { shopifyWebhookService } from '../shopify/shopify.webhook.service.js';
import { logger } from '../../lib/logger.js';

export const quoteOmsBridgeService = {
  /** Sync a Shopify order into commerce_orders + lines and auto-confirm for warehouse picking. */
  async syncShopifyOrderToWarehouse(input: {
    shopifyOrderId: string;
    farmerId?: string | null;
    leadId?: string | null;
    quoteId?: string;
    quoteNumber?: string;
    paymentMethod?: string;
  }) {
    const { order } = await getOrder(input.shopifyOrderId);
    await shopifyWebhookService.syncOrder(order);

    const { data: commerceOrder, error } = await supabase
      .from('commerce_orders')
      .select('id, oms_status')
      .eq('shopify_order_id', input.shopifyOrderId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Commerce order lookup after quote sync');

    if (!commerceOrder?.id) {
      logger.error({ shopifyOrderId: input.shopifyOrderId }, 'Commerce order missing after sync');
      return { commerceOrderId: null, omsStatus: null };
    }

    const patch: Record<string, unknown> = {
      order_source: 'telecaller_quote',
      updated_at: new Date().toISOString(),
    };
    if (input.farmerId) patch.farmer_id = input.farmerId;
    if (input.paymentMethod) patch.payment_method = input.paymentMethod;

    await supabase.from('commerce_orders').update(patch).eq('id', commerceOrder.id);

    if (input.quoteId) {
      await supabase
        .from('commerce_quotes')
        .update({
          commerce_order_id: commerceOrder.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.quoteId);
    }

    return {
      commerceOrderId: commerceOrder.id,
      omsStatus: commerceOrder.oms_status,
      orderName: order.name,
    };
  },

  async listQuoteQueue(limit = 30) {
    const { data: quotes, error } = await supabase
      .from('commerce_quotes')
      .select(
        'id, quote_number, status, customer_name, total, prepaid_amount, cod_amount, commerce_order_id, shopify_order_id, created_at, updated_at'
      )
      .in('status', ['checkout', 'paid'])
      .order('updated_at', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'Quote queue');

    const rows = quotes ?? [];
    const orderIds = rows.map((q) => q.commerce_order_id).filter(Boolean) as string[];

    let pickByOrder = new Map<string, string>();
    if (orderIds.length) {
      const { data: picks } = await supabase
        .from('pick_lists')
        .select('id, commerce_order_id, status')
        .in('commerce_order_id', orderIds);
      pickByOrder = new Map(
        (picks ?? []).map((p) => [String(p.commerce_order_id), String(p.status)])
      );
    }

    return rows.map((q) => {
      const commerceOrderId = q.commerce_order_id ? String(q.commerce_order_id) : null;
      const pickStatus = commerceOrderId ? pickByOrder.get(commerceOrderId) : undefined;
      let queueStatus: 'awaiting_payment' | 'awaiting_warehouse' | 'in_warehouse' = 'awaiting_payment';
      if (q.status === 'paid' || commerceOrderId) {
        queueStatus = pickStatus ? 'in_warehouse' : 'awaiting_warehouse';
      }
      if (q.status === 'checkout') queueStatus = 'awaiting_payment';

      return {
        id: q.id,
        quoteNumber: q.quote_number,
        status: q.status,
        customerName: q.customer_name,
        total: Number(q.total),
        prepaidAmount: Number(q.prepaid_amount),
        codAmount: Number(q.cod_amount),
        commerceOrderId,
        shopifyOrderId: q.shopify_order_id,
        pickStatus: pickStatus ?? null,
        queueStatus,
        updatedAt: q.updated_at,
      };
    });
  },
};
