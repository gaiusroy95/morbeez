import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { inventoryService } from '../wms/inventory.service.js';
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

export const orderSyncService = {
  async syncOrderMetadata(order: ShopifyOrder & { line_items?: ShopifyLineItem[] }) {
    const ship = order.shipping_address as Record<string, string> | undefined;
    const customerState = ship?.province ?? ship?.state ?? null;

    const { error } = await supabase
      .from('commerce_orders')
      .update({
        customer_state: customerState,
        shipping_address: ship ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('shopify_order_id', String(order.id));
    throwIfSupabaseError(error, 'Order metadata sync');
  },

  async syncOrderLines(shopifyOrderId: string, order?: ShopifyOrder) {
    const { data: commerceOrder, error: orderErr } = await supabase
      .from('commerce_orders')
      .select('id, raw_payload')
      .eq('shopify_order_id', shopifyOrderId)
      .single();
    throwIfSupabaseError(orderErr, 'Commerce order');
    if (!commerceOrder) return;

    const raw = (order ?? commerceOrder.raw_payload) as Record<string, unknown> | null;
    const lineItems = (raw?.line_items ?? []) as ShopifyLineItem[];
    if (!lineItems.length) return;

    await supabase.from('commerce_order_lines').delete().eq('commerce_order_id', commerceOrder.id);

    for (const li of lineItems) {
      const sku = (li.sku ?? `VAR-${li.variant_id ?? li.id ?? 'unknown'}`).trim();
      const title = String(li.title ?? 'Product');
      const qty = Number(li.quantity) || 1;
      const unitPrice = parseFloat(String(li.price ?? '0')) || 0;

      const item = await inventoryService.upsertItemFromSku({
        sku,
        productTitle: title,
        shopifyVariantId: li.variant_id != null ? String(li.variant_id) : null,
      });

      const { data: intel } = await supabase
        .from('product_intelligence')
        .select('basic')
        .eq('shopify_product_id', String(li.variant_id ?? ''))
        .maybeSingle();

      const basic = (intel?.basic ?? {}) as Record<string, unknown>;
      const hsn = basic.hsnCode ? String(basic.hsnCode) : item.hsn_code;
      const gst = basic.gstPercent != null ? Number(basic.gstPercent) : Number(item.gst_percent);

      const shopifyLineId = li.id != null ? String(li.id) : null;
      const { error: lineErr } = await supabase.from('commerce_order_lines').insert({
        commerce_order_id: commerceOrder.id,
        shopify_line_id: shopifyLineId,
        inventory_item_id: item.id,
        sku,
        product_title: title,
        variant_title: li.variant_title ?? null,
        qty_ordered: qty,
        unit_price: unitPrice,
        hsn_code: hsn,
        gst_percent: gst,
      });
      throwIfSupabaseError(lineErr, 'Sync order line');
    }
  },
};
