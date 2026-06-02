import { eventBus } from './bus.js';
import { logger } from '../lib/logger.js';
import { shiprocketService } from '../services/shiprocket/shiprocket.service.js';
import { whatsappService } from '../services/whatsapp/whatsapp.service.js';
import { createTelecallerTask } from '../services/whatsapp/pipeline/telecaller-tasks.service.js';
import { env } from '../config/env.js';
import { supabase } from '../lib/supabase.js';
import { orderWhatsappService } from '../services/whatsapp/orders/order-whatsapp.service.js';
import { farmerEventCaptureService } from '../services/intelligence/farmer-event-capture.service.js';

/** Wire domain reactions — keep thin; logic lives in services */
export function registerEventHandlers(): void {
  eventBus.on('shopify.order.paid', async (event) => {
    const orderId = event.payload.shopifyOrderId as string | undefined;
    if (!orderId) return;

    const { data: orderRow } = await supabase
      .from('commerce_orders')
      .select('farmer_id, phone')
      .eq('shopify_order_id', orderId)
      .maybeSingle();

    let farmerId = orderRow?.farmer_id ? String(orderRow.farmer_id) : null;
    if (!farmerId && orderRow?.phone) {
      const { farmerId: resolved } = await orderWhatsappService.resolveFarmerByPhone(
        String(orderRow.phone)
      );
      farmerId = resolved;
    }

    if (farmerId) {
      await farmerEventCaptureService.trackOrderConverted({
        farmerId,
        shopifyOrderId: orderId,
        orderName: event.payload.orderName as string | undefined,
        total: event.payload.total as string | number | undefined,
      });
    }

    if (env.ENABLE_SHIPROCKET_AUTO_SHIP) {
      await shiprocketService.createShipmentForShopifyOrder(orderId).catch((err) => {
        logger.error({ err, orderId }, 'Auto-shipment failed');
      });
    }
  });

  /* Pipeline already sends OpenAI replies. Legacy handler used non-existent welcome_farmer template. */
  eventBus.on('whatsapp.message.received', async (event) => {
    logger.debug(
      { phone: event.payload.phone, farmerId: event.payload.farmerId },
      'WhatsApp message processed'
    );
  });

  eventBus.on('quotation.requested', async (event) => {
    logger.info({ eventId: event.id }, 'Quotation requested — telecaller queue (M2)');
  });

  eventBus.on('shopify.order.fulfilled', async (event) => {
    logger.info(
      { orderId: event.payload.shopifyOrderId, tracking: event.payload.trackingNumber },
      'Order fulfilled'
    );
    if (env.ENABLE_WHATSAPP_ORDER_ALERTS !== false) {
      await orderWhatsappService
        .notifyDispatchedFromEvent({
          shopifyOrderId: event.payload.shopifyOrderId as string,
          awb: event.payload.trackingNumber as string | undefined,
          phone: event.payload.phone as string | undefined,
          orderName: event.payload.orderName as string | undefined,
        })
        .catch((err) => logger.error({ err }, 'Order fulfilled WhatsApp failed'));
    }
  });

  eventBus.on('shipment.created', async (event) => {
    if (env.ENABLE_WHATSAPP_ORDER_ALERTS === false) return;
    await orderWhatsappService
      .notifyDispatchedFromEvent({
        shopifyOrderId: event.payload.shopifyOrderId as string,
        awb: event.payload.awb as string | undefined,
        phone: event.payload.phone as string | undefined,
        orderName: event.payload.orderName as string | undefined,
      })
      .catch((err) => logger.error({ err }, 'Shipment created WhatsApp failed'));
  });

  eventBus.on('shipment.dispatched', async (event) => {
    if (env.ENABLE_WHATSAPP_ORDER_ALERTS === false) return;
    await orderWhatsappService
      .notifyDispatchedFromEvent({
        shopifyOrderId: event.payload.shopifyOrderId as string | undefined,
        awb: event.payload.awb as string | undefined,
        phone: event.payload.phone as string | undefined,
      })
      .catch((err) => logger.error({ err }, 'Shipment dispatched WhatsApp failed'));
  });

  eventBus.on('order.payment.failed', async (event) => {
    if (env.ENABLE_WHATSAPP_ORDER_ALERTS === false) return;
    const phone = event.payload.phone as string | undefined;
    if (!phone) return;
    await orderWhatsappService
      .sendPaymentFailed({
        phone,
        checkoutSessionId: event.payload.checkoutSessionId as string | undefined,
        receipt: event.payload.receipt as string | undefined,
        amountPaise: event.payload.amountPaise as number | undefined,
        razorpayOrderId: event.payload.razorpayOrderId as string | undefined,
      })
      .catch((err) => logger.error({ err }, 'Payment failed WhatsApp failed'));
  });

  eventBus.on('advisory.escalated', async (event) => {
    const farmerId = event.payload.farmerId as string | undefined;
    const sessionId = event.payload.sessionId as string | undefined;
    const priority = (event.payload.priority as string) ?? 'normal';

    logger.warn(
      { sessionId, escalationId: event.payload.escalationId, priority },
      'Agronomist escalation created'
    );

    if (farmerId) {
      await createTelecallerTask({
        farmerId,
        title: 'Agronomist review — WhatsApp crop advisory',
        notes: `Session ${sessionId ?? 'n/a'}: ${event.payload.reason ?? 'escalation'}`,
        priority: priority === 'urgent' ? 'urgent' : priority === 'high' ? 'high' : 'normal',
      }).catch((err) => logger.error({ err }, 'Telecaller escalation task failed'));
    }
  });

  eventBus.on('advisory.completed', async (event) => {
    const farmerId = event.payload.farmerId as string | undefined;
    const escalated = Boolean(event.payload.escalated);
    const sessionId = event.payload.sessionId as string | undefined;
    if (farmerId) {
      await farmerEventCaptureService.trackAdvisorySessionCompleted({
        farmerId,
        sessionId: sessionId ?? '',
        escalated,
        confidence: event.payload.confidence as number | undefined,
      });
    }
    if (!farmerId || escalated) return;

    const { data: farmer } = await supabase
      .from('farmers')
      .select('phone, preferred_language')
      .eq('id', farmerId)
      .single();

    if (farmer?.phone && env.ENABLE_WHATSAPP_AUTO_REPLY) {
      const msg =
        farmer.preferred_language === 'ml'
          ? 'നിങ്ങളുടെ വിള വിശകലനം പൂർത്തിയായി. കൂടുതൽ വിവരങ്ങൾക്ക് മറുപടി നൽകുക.'
          : 'Your crop advisory is ready. Reply for more details or a callback.';
      await whatsappService.sendText(farmer.phone, msg).catch((err) => {
        logger.error({ err }, 'Advisory WhatsApp notify failed');
      });
    }
  });

  eventBus.on('lead.created', async (event) => {
    const farmerId = event.payload.farmerId as string | undefined;
    if (!farmerId) return;
    await farmerEventCaptureService.trackFarmerOnboarded({
      farmerId,
      leadId: event.payload.leadId as string | undefined,
      source: (event.payload.source as string) ?? 'api',
      intent: (event.payload.intent as string) ?? 'general',
      assignedTo: (event.payload.assignedTo as string | null) ?? null,
    });
  });

  eventBus.on('callback.requested', async (event) => {
    const farmerId = event.payload.farmerId as string | undefined;
    if (!farmerId) return;
    await farmerEventCaptureService.trackCallbackRequested({
      farmerId,
      sessionId: event.payload.sessionId as string | undefined,
    });
  });

  logger.info('Event handlers registered');
}
