import { eventBus } from '../../events/bus.js';
import { supabase } from '../../lib/supabase.js';
import { farmerService } from '../farmer/farmer.service.js';
import { orderWhatsappService } from '../whatsapp/orders/order-whatsapp.service.js';
import { logger } from '../../lib/logger.js';
import type { ShopifyOrder } from './shopify.client.js';
import { omsWorkflowService } from '../oms/workflow.service.js';
import { leadService } from '../crm/lead.service.js';
import { isValidIndianPhone } from '../../lib/phone.js';

export interface ShopifyFulfillment {
  id: number;
  order_id: number;
  status: string;
  tracking_number?: string;
  tracking_company?: string;
  tracking_url?: string;
}

function phoneFromShopifyCustomer(payload: Record<string, unknown>): string | null {
  const direct = payload.phone ? String(payload.phone) : '';
  const addr = payload.default_address as Record<string, unknown> | undefined;
  const fromAddr = addr?.phone ? String(addr.phone) : '';
  const raw = direct || fromAddr;
  if (!raw || !isValidIndianPhone(raw)) return null;
  return raw;
}

function nameFromShopifyCustomer(payload: Record<string, unknown>): string | undefined {
  const first = String(payload.first_name ?? '').trim();
  const last = String(payload.last_name ?? '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || undefined;
}

export const shopifyWebhookService = {
  async handleCustomerUpsert(payload: Record<string, unknown>): Promise<void> {
    const shopifyCustomerId = payload.id != null ? String(payload.id) : null;
    const phone = phoneFromShopifyCustomer(payload);
    if (!shopifyCustomerId || !phone) {
      logger.info({ shopifyCustomerId }, 'Shopify customer webhook skipped — no valid Indian phone');
      return;
    }

    const farmer = await farmerService.upsertFromShopifyCustomer({
      shopifyCustomerId,
      phone,
      name: nameFromShopifyCustomer(payload),
    });

    const email = payload.email ? String(payload.email) : undefined;
    await leadService.upsertSignupLead({
      farmerId: String(farmer.id),
      phone,
      name: nameFromShopifyCustomer(payload),
      email,
      channel: 'shopify',
    });

    logger.info(
      { farmerId: farmer.id, shopifyCustomerId, phone },
      'Shopify customer synced to telecaller lead'
    );
  },

  async handleOrderCreate(order: ShopifyOrder): Promise<void> {
    await this.syncOrder(order);
    await eventBus.publish(
      'shopify.order.created',
      { shopifyOrderId: String(order.id), orderName: order.name },
      'shopify'
    );
  },

  async handleOrderPaid(order: ShopifyOrder): Promise<void> {
    await supabase
      .from('commerce_orders')
      .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
      .eq('shopify_order_id', String(order.id));

    if (order.customer?.id && order.phone) {
      await farmerService.upsertFromShopifyCustomer({
        shopifyCustomerId: String(order.customer.id),
        phone: order.phone,
        name: order.customer.first_name ?? undefined,
      });
      await orderWhatsappService.linkOrderToFarmer(String(order.id), order.phone);
    }

    await eventBus.publish(
      'shopify.order.paid',
      { shopifyOrderId: String(order.id), orderName: order.name, total: order.total_price },
      'shopify'
    );
  },

  async handleFulfillment(fulfillment: ShopifyFulfillment): Promise<void> {
    await supabase.from('shipment_events').insert({
      shopify_order_id: String(fulfillment.order_id),
      provider: 'shopify',
      shipment_id: String(fulfillment.id),
      awb: fulfillment.tracking_number ?? null,
      courier: fulfillment.tracking_company ?? null,
      status: fulfillment.status,
      event_type: 'fulfillment.update',
      raw_payload: fulfillment,
    });

    await supabase
      .from('commerce_orders')
      .update({
        fulfillment_status: fulfillment.status,
        updated_at: new Date().toISOString(),
      })
      .eq('shopify_order_id', String(fulfillment.order_id));

    const { data: orderRow } = await supabase
      .from('commerce_orders')
      .select('phone, order_name')
      .eq('shopify_order_id', String(fulfillment.order_id))
      .maybeSingle();

    if (fulfillment.tracking_number) {
      await orderWhatsappService.updateOrderTracking({
        shopifyOrderId: String(fulfillment.order_id),
        awb: fulfillment.tracking_number,
        trackingUrl: fulfillment.tracking_url,
        fulfillmentStatus: fulfillment.status,
        courier: fulfillment.tracking_company ?? 'Delhivery',
      });
    }

    if (fulfillment.status === 'success' || fulfillment.status === 'delivered') {
      await eventBus.publish(
        'shopify.order.fulfilled',
        {
          shopifyOrderId: String(fulfillment.order_id),
          trackingNumber: fulfillment.tracking_number,
          trackingUrl: fulfillment.tracking_url,
          phone: orderRow?.phone,
          orderName: orderRow?.order_name,
        },
        'shopify'
      );
    } else if (fulfillment.tracking_number && orderRow?.phone) {
      await eventBus.publish(
        'shipment.dispatched',
        {
          shopifyOrderId: String(fulfillment.order_id),
          awb: fulfillment.tracking_number,
          phone: orderRow.phone,
          orderName: orderRow.order_name,
        },
        'shopify'
      );
    }
  },

  async syncOrder(order: ShopifyOrder): Promise<void> {
    const { data: existing } = await supabase
      .from('commerce_orders')
      .select('id, deleted_at')
      .eq('shopify_order_id', String(order.id))
      .maybeSingle();
    if (existing?.deleted_at) {
      logger.info({ orderId: order.id }, 'Skipping Shopify sync for admin-deleted order');
      return;
    }

    const isCod =
      order.tags?.toLowerCase().includes('cod') ||
      order.financial_status === 'pending';

    const tags = (order.tags ?? '').toLowerCase();
    const orderSource = tags.includes('website')
      ? 'website'
      : tags.includes('telecaller') ||
          tags.includes('commerce_quote') ||
          tags.includes('razorpay-checkout')
        ? 'telecaller_quote'
        : tags.includes('commerce_hub')
          ? 'commerce_hub'
          : 'website';
    const paymentMethod = isCod ? 'COD' : order.financial_status === 'paid' ? 'Prepaid' : 'Pending';

    const { error } = await supabase.from('commerce_orders').upsert(
      {
        shopify_order_id: String(order.id),
        order_name: order.name,
        email: order.email,
        phone: order.phone,
        financial_status: order.financial_status,
        fulfillment_status: order.fulfillment_status,
        total_amount: parseFloat(order.total_price),
        currency: order.currency,
        is_cod: isCod,
        order_source: orderSource,
        payment_method: paymentMethod,
        raw_payload: order,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shopify_order_id' }
    );

    if (error) logger.error({ error, orderId: order.id }, 'Order sync failed');
    else {
      if (order.phone) {
        await orderWhatsappService.linkOrderToFarmer(String(order.id), order.phone);
      }
      await omsWorkflowService.onOrderPlaced(String(order.id), order).catch((err) => {
        logger.error({ err, orderId: order.id }, 'OMS workflow on order create failed');
      });
    }
  },
};
