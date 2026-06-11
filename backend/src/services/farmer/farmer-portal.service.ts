import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import { farmerAuthService } from '../auth/farmer-auth.service.js';
import {
  telecallerFarmerOrdersService,
  type TelecallerOrderRow,
} from '../admin/telecaller-farmer-orders.service.js';
import { farmerProductReviewService } from './farmer-product-review.service.js';
import { farmerRoiAdminService } from '../admin/farmer-roi-admin.service.js';
import {
  advisoryImageStorageService,
  resolveAdvisoryImageUrl,
} from '../core/advisory-image-storage.service.js';
import { cropImageReviewService } from '../core/crop-image-review.service.js';
import { growthStageFromDap, cropCycleDays } from './crop-stage.service.js';
import { normalizeSoilMetrics } from '../soil/soil-lab-metrics.js';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(iso);
  }
}

function daysAfterPlanting(plantingDate: string | null | undefined): number | null {
  if (!plantingDate) return null;
  const d = new Date(plantingDate);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days >= 0 ? days : null;
}

function growthStageLabel(
  crop: string | null | undefined,
  stage: string | null | undefined,
  dap: number | null
): string {
  return growthStageFromDap(crop, dap, stage);
}

function scoreSoilReport(metrics: ReturnType<typeof normalizeSoilMetrics>): 'good' | 'monitor' | 'critical' {
  const ph = Number(metrics.macro.ph?.value);
  if (!Number.isNaN(ph) && ph > 0) {
    if (ph < 5.5 || ph > 8) return 'critical';
    if (ph < 6 || ph > 7.5) return 'monitor';
  }
  const filled = Object.values(metrics.macro).filter((m) => String(m.value ?? '').trim()).length;
  if (filled >= 5) return 'good';
  if (filled >= 2) return 'monitor';
  return 'monitor';
}

function parseRecommendationBullets(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n|•|·|;/)
    .map((s) => s.replace(/^[-*]\s*/, '').trim())
    .filter((s) => s.length > 3)
    .slice(0, 8);
}

const ACTIVE_OMS = new Set([
  'confirmed',
  'awb_generated',
  'picking',
  'packed',
  'ready_dispatch',
  'shipped',
  'delivered',
  'completed',
]);

function formatShippingAddress(addr: Record<string, unknown> | null | undefined): string | null {
  if (!addr || typeof addr !== 'object') return null;
  const parts = [
    addr.name,
    addr.line1 ?? addr.address1 ?? addr.address,
    addr.line2 ?? addr.address2,
    [addr.city, addr.state, addr.pincode ?? addr.zip].filter(Boolean).join(', '),
  ]
    .map((p) => (p ? String(p).trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function buildOrderTimeline(
  order: TelecallerOrderRow,
  commerce: Record<string, unknown> | null
): Array<{ key: string; label: string; at: string | null; done: boolean; pending?: boolean }> {
  const oms = commerce ? String(commerce.oms_status ?? '') : '';
  const status = order.status;
  const paid = order.paymentLabel === 'Paid';
  const hasAwb = Boolean(order.trackingAwb || commerce?.tracking_awb);
  const shipped =
    status === 'shipped' ||
    status === 'delivered' ||
    oms === 'shipped' ||
    oms === 'ready_dispatch' ||
    hasAwb;
  const packed =
    ['packed', 'ready_dispatch', 'shipped', 'delivered', 'completed'].includes(oms) || shipped;
  const confirmed = ACTIVE_OMS.has(oms) || status === 'processing' || packed || shipped;

  const placedAt = formatDateTime(order.createdAt);
  const paymentAt = paid ? placedAt : null;
  const confirmedAt = commerce?.confirmed_at ? formatDateTime(String(commerce.confirmed_at)) : paid ? placedAt : null;
  const packedAt = commerce?.packed_at ? formatDateTime(String(commerce.packed_at)) : null;
  const shippedAt = commerce?.awb_generated_at
    ? formatDateTime(String(commerce.awb_generated_at))
    : hasAwb
      ? order.dateLabel
      : null;
  const deliveredAt =
    status === 'delivered'
      ? formatDateTime(String(commerce?.updated_at ?? order.createdAt))
      : null;

  if (status === 'cancelled') {
    return [
      { key: 'placed', label: 'Order placed', at: placedAt, done: true },
      { key: 'cancelled', label: 'Order cancelled', at: deliveredAt, done: true },
    ];
  }

  const steps = [
    { key: 'placed', label: 'Order placed', at: placedAt, done: true },
    { key: 'payment', label: 'Payment received', at: paymentAt, done: paid },
    { key: 'confirmed', label: 'Order confirmed', at: confirmedAt, done: confirmed },
    { key: 'packed', label: 'Packed for dispatch', at: packedAt, done: packed },
    { key: 'shipped', label: 'Shipped', at: shippedAt, done: shipped },
    { key: 'delivered', label: 'Delivered', at: deliveredAt, done: status === 'delivered', pending: status !== 'delivered' },
  ];

  const firstPending = steps.findIndex((s) => !s.done);
  return steps.map((step, i) => ({
    ...step,
    pending: i === firstPending && !step.done,
  }));
}

function publicOrder(row: {
  id: string;
  orderId: string;
  orderRef: string | null;
  productTitle: string;
  productImageUrl: string | null;
  qty: number;
  amount: number;
  status: string;
  statusLabel: string;
  statusTone: string;
  dateLabel: string;
  deliveryDateLabel: string;
  trackingAwb?: string | null;
  trackingUrl?: string | null;
  lineItems: Array<{ title: string; quantity: number; imageUrl?: string | null }>;
}) {
  return {
    id: row.id,
    orderNumber: row.orderId,
    productTitle: row.productTitle,
    productImageUrl: row.productImageUrl,
    quantity: row.qty,
    amountInr: row.amount,
    status: row.status,
    statusLabel: row.statusLabel,
    statusTone: row.statusTone,
    orderedOn: row.dateLabel,
    deliveredOn: row.deliveryDateLabel,
    trackingAwb: row.trackingAwb ?? null,
    trackingUrl: row.trackingUrl ?? null,
    lineItems: row.lineItems.map((li) => ({
      title: li.title,
      quantity: li.quantity,
      imageUrl: li.imageUrl ?? null,
    })),
  };
}

export const farmerPortalService = {
  async getProfile(farmerId: string) {
    return farmerAuthService.me(farmerId);
  },

  async getSummary(farmerId: string) {
    const [profile, blocksRes, ordersRes, recsRes, soilRes, roiRes, notifRes] = await Promise.all([
      farmerAuthService.me(farmerId),
      supabase
        .from('farm_blocks')
        .select('id, name, crop_name, variety_name, area, planting_date, stage, soil_health, is_primary')
        .eq('farmer_id', farmerId)
        .is('archived_at', null)
        .order('is_primary', { ascending: false })
        .order('name'),
      telecallerFarmerOrdersService.listForFarmer(farmerId),
      supabase
        .from('crm_recommendations')
        .select('id, recommendation, products, dosage, follow_up_at, created_at, status, farm_blocks(crop_name, name)')
        .eq('farmer_id', farmerId)
        .or('status.is.null,status.eq.active,status.eq.pending')
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('crm_soil_reports')
        .select('id, reported_at')
        .eq('farmer_id', farmerId)
        .order('reported_at', { ascending: false })
        .limit(5),
      farmerRoiAdminService.listEntries(farmerId, 30),
      this.listNotifications(farmerId, 6),
    ]);

    throwIfSupabaseError(blocksRes.error, 'Could not load farm');
    throwIfSupabaseError(recsRes.error, 'Could not load advisory');
    throwIfSupabaseError(soilRes.error, 'Could not load soil reports');

    const blocks = blocksRes.data ?? [];
    const primary = blocks.find((b) => b.is_primary) ?? blocks[0] ?? null;
    const dap = primary ? daysAfterPlanting(String(primary.planting_date ?? '')) : null;
    const orders = ordersRes.orders ?? [];
    const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
    const latestRec = recsRes.data?.[0] as Record<string, unknown> | undefined;
    const blockJoin = latestRec?.farm_blocks as { crop_name?: string; name?: string } | null;
    const nextAdvisory =
      latestRec?.follow_up_at && new Date(String(latestRec.follow_up_at)) > new Date()
        ? formatDate(String(latestRec.follow_up_at))
        : latestRec
          ? 'Today'
          : 'Soon';

    const shippingLines = [
      profile.shippingAddress,
      profile.village,
      [profile.district, profile.state, profile.deliveryPincode || profile.pincode].filter(Boolean).join(', '),
    ].filter(Boolean);

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;
    const todayExpense = (roiRes.entries ?? [])
      .filter((e) => e.entryDate === today && e.creditInr == null)
      .reduce((s, e) => s + (e.amountInr ?? 0), 0);
    const monthExpense = (roiRes.entries ?? [])
      .filter((e) => e.entryDate >= monthStart && e.creditInr == null)
      .reduce((s, e) => s + (e.amountInr ?? 0), 0);

    const cropType = primary?.crop_name ? String(primary.crop_name).toLowerCase() : 'ginger';
    const { rows: priceRows, date: priceDate } = await (async () => {
      const { data: rows } = await supabase
        .from('crop_daily_prices')
        .select('market_name, price_per_kg, last_year_price_per_kg')
        .eq('crop_type', cropType)
        .eq('price_date', today)
        .eq('active', true)
        .order('market_name')
        .limit(1);
      if (rows?.length) return { date: today, rows };
      const { data: fb } = await supabase
        .from('crop_daily_prices')
        .select('market_name, price_per_kg, last_year_price_per_kg, price_date')
        .eq('crop_type', cropType)
        .eq('active', true)
        .order('price_date', { ascending: false })
        .limit(1);
      return { date: fb?.[0]?.price_date ? String(fb[0].price_date) : today, rows: fb ?? [] };
    })();

    const topPrice = priceRows?.[0];
    let marketTrend: 'up' | 'down' | 'flat' | null = null;
    if (topPrice?.last_year_price_per_kg != null) {
      const p = Number(topPrice.price_per_kg);
      const ly = Number(topPrice.last_year_price_per_kg);
      if (p > ly * 1.02) marketTrend = 'up';
      else if (p < ly * 0.98) marketTrend = 'down';
      else marketTrend = 'flat';
    }

    const tasks: Array<{ id: string; label: string; dueLabel: string; href: string }> = [];
    if (latestRec) {
      tasks.push({
        id: `rec-${latestRec.id}`,
        label: String(latestRec.problem ?? latestRec.recommendation ?? 'Apply recommendation').slice(0, 80),
        dueLabel: nextAdvisory,
        href: `/recommendations/${latestRec.id}`,
      });
    }
    if (latestRec?.follow_up_at && new Date(String(latestRec.follow_up_at)) > new Date()) {
      tasks.push({
        id: `follow-${latestRec.id}`,
        label: 'Follow-up check due',
        dueLabel: formatDate(String(latestRec.follow_up_at)),
        href: `/recommendations/${latestRec.id}`,
      });
    }

    return {
      greetingName: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.name || 'Farmer',
      crop: primary
        ? {
            name: String(primary.crop_name ?? 'Crop'),
            variety: primary.variety_name ? String(primary.variety_name) : null,
            fieldSize: primary.area ? String(primary.area) : null,
            blockName: String(primary.name ?? 'Field'),
            blockId: String(primary.id),
            stage: growthStageLabel(
              primary.crop_name ? String(primary.crop_name) : null,
              primary.stage ? String(primary.stage) : null,
              dap
            ),
            daysAfterPlanting: dap,
            cycleDays: cropCycleDays(primary.crop_name ? String(primary.crop_name) : null),
          }
        : null,
      shippingAddress: {
        name: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.name,
        phone: profile.phone,
        lines: shippingLines.length ? shippingLines : ['Add your delivery address'],
        verified: Boolean(profile.shippingAddress || profile.deliveryPincode),
      },
      atAGlance: {
        activeOrders,
        nextAdvisory,
        nextAdvisoryHint: latestRec?.products
          ? String(latestRec.products).split(',')[0]?.trim()
          : latestRec?.recommendation
            ? parseRecommendationBullets(String(latestRec.recommendation))[0] ?? null
            : null,
        newReports: (soilRes.data ?? []).filter((r) => {
          const at = new Date(String(r.reported_at));
          return Date.now() - at.getTime() < 14 * 86400000;
        }).length,
        estimatedProfitInr: Math.max(0, Math.round(roiRes.summary.balance)),
      },
      quickAccess: {
        ordersCount: orders.length,
        hasAdvisory: (recsRes.data ?? []).length > 0,
        reportsCount: soilRes.data?.length ?? 0,
        roiBalance: roiRes.summary.balance,
      },
      latestRecommendation: latestRec
        ? {
            id: String(latestRec.id),
            cropName: blockJoin?.crop_name ? String(blockJoin.crop_name) : primary?.crop_name ?? 'Crop',
            stage: primary
              ? growthStageLabel(
                  primary.crop_name ? String(primary.crop_name) : null,
                  primary.stage ? String(primary.stage) : null,
                  dap
                )
              : null,
            dateLabel: formatDate(String(latestRec.created_at)),
            dayLabel: dap != null ? `Day ${dap}` : null,
            bullets: parseRecommendationBullets(
              [latestRec.products, latestRec.dosage, latestRec.recommendation].filter(Boolean).join('\n')
            ),
            summary: latestRec.recommendation ? String(latestRec.recommendation).slice(0, 280) : null,
          }
        : null,
      recentOrder: orders[0] ? publicOrder(orders[0]) : null,
      notifications: notifRes,
      todayMarket: topPrice
        ? {
            crop: cropType,
            pricePerKg: Number(topPrice.price_per_kg),
            marketName: String(topPrice.market_name),
            trend: marketTrend,
            date: String(priceDate),
          }
        : null,
      finance: {
        todayExpenseInr: Math.round(todayExpense),
        monthExpenseInr: Math.round(monthExpense),
        projectedProfitInr: Math.max(0, Math.round(roiRes.summary.balance)),
      },
      tasks,
    };
  },

  async listOrders(farmerId: string) {
    const { orders } = await telecallerFarmerOrdersService.listForFarmer(farmerId);
    return { orders: orders.map(publicOrder) };
  },

  async getOrderTracking(farmerId: string, orderId: string) {
    const order = await telecallerFarmerOrdersService.getDetail(farmerId, orderId);

    let commerce: Record<string, unknown> | null = null;
    const commerceId = order.commerceOrderId ?? (order.source === 'commerce' ? order.id : null);
    if (commerceId) {
      const { data, error } = await supabase
        .from('commerce_orders')
        .select(
          'oms_status, confirmed_at, packed_at, awb_generated_at, expected_delivery_at, courier_name, shiprocket_error, tracking_awb, tracking_url, shipping_address, created_at, updated_at'
        )
        .eq('id', commerceId)
        .maybeSingle();
      throwIfSupabaseError(error, 'Could not load tracking');
      commerce = (data as Record<string, unknown> | null) ?? null;
    }

    const timeline = buildOrderTimeline(order, commerce);
    const expectedDelivery =
      order.deliveryDateLabel !== '—'
        ? order.deliveryDateLabel
        : commerce?.expected_delivery_at
          ? formatDateTime(String(commerce.expected_delivery_at))
          : null;

    const reviewState = await farmerProductReviewService.getReviewableLines(farmerId, orderId);

    return {
      order: publicOrder(order),
      tracking: {
        courier: order.courier ?? (commerce?.courier_name ? String(commerce.courier_name) : null) ?? order.deliveryBy,
        trackingAwb: order.trackingAwb ?? (commerce?.tracking_awb ? String(commerce.tracking_awb) : null),
        trackingUrl: order.trackingUrl,
        expectedDelivery,
        deliveryBy: order.deliveryBy,
        paymentLabel: order.paymentLabel,
        paymentSubtext: order.paymentSubtext,
        deliveryAddress:
          order.deliveryAddress ?? formatShippingAddress(commerce?.shipping_address as Record<string, unknown>),
        shiprocketNote: commerce?.shiprocket_error ? String(commerce.shiprocket_error) : null,
        omsStatus: commerce?.oms_status ? String(commerce.oms_status) : null,
      },
      timeline,
      lineItems: order.lineItems,
      canReview: reviewState.canReview,
      reviewLines: reviewState.lines,
    };
  },

  async submitOrderReview(
    farmerId: string,
    orderId: string,
    input: { productKey: string; rating: number; reviewText?: string }
  ) {
    return farmerProductReviewService.submitReview(farmerId, orderId, input);
  },

  async getAdvisory(farmerId: string) {
    const [blocksRes, recsRes, followUpsRes] = await Promise.all([
      supabase
        .from('farm_blocks')
        .select('id, name, crop_name, planting_date, stage, area')
        .eq('farmer_id', farmerId)
        .is('archived_at', null)
        .order('is_primary', { ascending: false }),
      supabase
        .from('crm_recommendations')
        .select('*, farm_blocks(name, crop_name)')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('recommendation_follow_ups')
        .select('id, due_at, status, recommendation_id, follow_up_type, notes')
        .eq('farmer_id', farmerId)
        .gte('due_at', new Date().toISOString())
        .order('due_at', { ascending: true })
        .limit(10),
    ]);

    throwIfSupabaseError(blocksRes.error, 'Could not load crop');
    throwIfSupabaseError(recsRes.error, 'Could not load recommendations');
    throwIfSupabaseError(followUpsRes.error, 'Could not load schedule');

    const primary = blocksRes.data?.[0] ?? null;
    const dap = primary ? daysAfterPlanting(String(primary.planting_date ?? '')) : null;

    const recommendations = (recsRes.data ?? []).map((r) => {
      const block = r.farm_blocks as { name?: string; crop_name?: string } | null;
      const text = [r.products, r.dosage, r.recommendation].filter(Boolean).join('\n');
      return {
        id: String(r.id),
        dateLabel: formatDate(String(r.created_at)),
        cropName: block?.crop_name ? String(block.crop_name) : primary?.crop_name ?? 'Crop',
        blockName: block?.name ? String(block.name) : null,
        stage: primary
          ? growthStageLabel(
              primary.crop_name ? String(primary.crop_name) : null,
              primary.stage ? String(primary.stage) : null,
              dap
            )
          : null,
        dayLabel: dap != null ? `Day ${dap}` : null,
        title: r.problem ? String(r.problem) : 'Crop recommendation',
        bullets: parseRecommendationBullets(text),
        applicationMethod: r.application_method ? String(r.application_method) : null,
        followUpLabel: r.follow_up_at ? formatDate(String(r.follow_up_at)) : null,
        status: r.status ? String(r.status) : 'active',
      };
    });

    const schedule = (followUpsRes.data ?? []).map((f) => ({
      id: String(f.id),
      dueLabel: formatDate(String(f.due_at)),
      type: f.follow_up_type ? String(f.follow_up_type) : 'follow_up',
      notes: f.notes ? String(f.notes).slice(0, 120) : null,
    }));

    return {
      crop: primary
        ? {
            name: String(primary.crop_name ?? 'Crop'),
            fieldSize: primary.area ? String(primary.area) : null,
            stage: growthStageLabel(
              primary.crop_name ? String(primary.crop_name) : null,
              primary.stage ? String(primary.stage) : null,
              dap
            ),
            daysAfterPlanting: dap,
          }
        : null,
      recommendations,
      schedule,
      alerts: schedule
        .filter((s) => s.type.toLowerCase().includes('spray') || s.notes?.toLowerCase().includes('spray'))
        .map((s) => ({ message: s.notes ?? 'Spray reminder', dueLabel: s.dueLabel })),
    };
  },

  async listSoilReports(farmerId: string) {
    const { data, error } = await supabase
      .from('crm_soil_reports')
      .select('id, reported_at, pdf_url, metrics, block_id, farm_blocks(name)')
      .eq('farmer_id', farmerId)
      .order('reported_at', { ascending: false })
      .limit(20);
    throwIfSupabaseError(error, 'Could not load soil reports');

    return {
      reports: (data ?? []).map((r) => {
        const metrics = normalizeSoilMetrics(r.metrics);
        const block = r.farm_blocks as { name?: string } | null;
        return {
          id: String(r.id),
          blockId: r.block_id ? String(r.block_id) : null,
          blockName: block?.name ? String(block.name) : 'Block',
          dateLabel: formatDate(String(r.reported_at)),
          health: scoreSoilReport(metrics),
          healthLabel:
            scoreSoilReport(metrics) === 'good'
              ? 'Good'
              : scoreSoilReport(metrics) === 'monitor'
                ? 'Monitor'
                : 'Needs attention',
          pdfUrl: r.pdf_url ? String(r.pdf_url) : null,
          highlights: [
            metrics.macro.ph?.value ? `pH ${metrics.macro.ph.value}` : null,
            metrics.macro.nitrogen?.value ? `N ${metrics.macro.nitrogen.value} ${metrics.macro.nitrogen.unit}` : null,
            metrics.macro.phosphorus?.value
              ? `P ${metrics.macro.phosphorus.value} ${metrics.macro.phosphorus.unit}`
              : null,
            metrics.macro.potassium?.value
              ? `K ${metrics.macro.potassium.value} ${metrics.macro.potassium.unit}`
              : null,
          ].filter(Boolean) as string[],
        };
      }),
    };
  },

  async getRoi(farmerId: string) {
    const [roi, blocksRes] = await Promise.all([
      farmerRoiAdminService.listEntries(farmerId, 50),
      supabase
        .from('farm_blocks')
        .select('crop_name, area, acreage_decimal')
        .eq('farmer_id', farmerId)
        .is('archived_at', null)
        .limit(5),
    ]);
    throwIfSupabaseError(blocksRes.error, 'Could not load farm');

    const inputCost = roi.summary.debits;
    const estimatedIncome = roi.summary.credits;
    const profit = roi.summary.balance;
    const acreage = (blocksRes.data ?? []).reduce(
      (sum, b) => sum + (Number(b.acreage_decimal) || 0),
      0
    );

    return {
      summary: {
        inputCostInr: Math.round(inputCost),
        estimatedYieldIncomeInr: Math.round(estimatedIncome),
        estimatedProfitInr: Math.round(profit),
        acreage: acreage > 0 ? acreage : null,
        marketNote: estimatedIncome > 0 ? 'Based on your logged harvest & sales entries' : 'Add harvest entries via WhatsApp or your agronomist',
      },
      recentEntries: roi.entries.slice(0, 8).map((e) => ({
        id: e.id,
        dateLabel: formatDate(e.entryDate),
        category: e.category,
        amountInr: e.amountInr,
        type: e.creditInr != null ? 'income' : 'expense',
        note: e.comments,
      })),
    };
  },

  async listNotifications(farmerId: string, limit = 12) {
    const items: Array<{ id: string; type: string; message: string; atLabel: string; tone: string }> = [];

    const [followUps, ordersRes, soilRes, recsRes] = await Promise.all([
      supabase
        .from('recommendation_follow_ups')
        .select('id, due_at, notes, follow_up_type')
        .eq('farmer_id', farmerId)
        .gte('due_at', new Date().toISOString())
        .lte('due_at', new Date(Date.now() + 3 * 86400000).toISOString())
        .order('due_at', { ascending: true })
        .limit(5),
      telecallerFarmerOrdersService.listForFarmer(farmerId),
      supabase
        .from('crm_soil_reports')
        .select('id, reported_at')
        .eq('farmer_id', farmerId)
        .gte('reported_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('reported_at', { ascending: false })
        .limit(3),
      supabase
        .from('crm_recommendations')
        .select('id, created_at, recommendation')
        .eq('farmer_id', farmerId)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    for (const f of followUps.data ?? []) {
      items.push({
        id: `fu-${f.id}`,
        type: 'spray',
        message: f.notes ? String(f.notes).slice(0, 100) : 'Crop care reminder due soon',
        atLabel: formatDate(String(f.due_at)),
        tone: 'warning',
      });
    }

    for (const o of (ordersRes.orders ?? []).filter((x) => x.status === 'delivered').slice(0, 2)) {
      items.push({
        id: `ord-${o.id}`,
        type: 'delivery',
        message: `${o.productTitle} delivered`,
        atLabel: o.deliveryDateLabel,
        tone: 'success',
      });
    }

    for (const s of soilRes.data ?? []) {
      items.push({
        id: `soil-${s.id}`,
        type: 'soil',
        message: 'Your soil report is ready to view',
        atLabel: formatDate(String(s.reported_at)),
        tone: 'info',
      });
    }

    for (const r of recsRes.data ?? []) {
      items.push({
        id: `rec-${r.id}`,
        type: 'advisory',
        message: 'New crop recommendation available',
        atLabel: formatDate(String(r.created_at)),
        tone: 'info',
      });
    }

    return items.slice(0, limit);
  },

  async listFieldPhotos(farmerId: string) {
    const { data, error } = await supabase
      .from('crop_images')
      .select('id, created_at, crop, source, review_status, ai_prediction, storage_path, external_url')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(12);
    throwIfSupabaseError(error, 'Could not load photos');

    const rows = await Promise.all(
      (data ?? []).map(async (r) => {
        const url = await resolveAdvisoryImageUrl(
          r.storage_path ? String(r.storage_path) : r.external_url ? String(r.external_url) : null
        );
        return {
          id: String(r.id),
          uploadedAt: formatDateTime(String(r.created_at)),
          crop: r.crop ? String(r.crop) : null,
          status:
            r.review_status === 'reviewed'
              ? 'Reviewed by agronomist'
              : r.ai_prediction
                ? 'AI analysis ready'
                : 'Under review',
          previewUrl: url,
        };
      })
    );

    return { photos: rows };
  },

  async uploadFieldPhoto(
    farmerId: string,
    input: { photoType: 'field' | 'leaf' | 'rhizome'; imageData: string; mimeType?: string; notes?: string }
  ) {
    const storagePath = await advisoryImageStorageService.uploadFromBase64(
      farmerId,
      input.imageData,
      input.mimeType ?? 'image/jpeg'
    );
    if (!storagePath) throw new NotFoundError('Could not save photo — try a smaller image (max 8MB)');

    const imageId = await cropImageReviewService.enqueue({
      farmerId,
      storagePath,
      source: 'api',
      metadata: {
        photo_type: input.photoType,
        farmer_notes: input.notes?.slice(0, 300) ?? null,
        portal_upload: true,
      },
    });

    return {
      ok: true,
      imageId,
      message: 'Photo received. Our agronomist will review and follow up on WhatsApp.',
    };
  },

  async updateShippingAddress(
    farmerId: string,
    input: {
      address1?: string;
      address2?: string;
      city?: string;
      state?: string;
      pincode?: string;
    }
  ) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const lines = [input.address1, input.address2, input.city, input.state, input.pincode]
      .filter(Boolean)
      .join(', ');
    if (lines) updates.shipping_address = lines;
    if (input.city) updates.district = input.city.trim();
    if (input.state) updates.state = input.state.trim();
    if (input.pincode) updates.delivery_pincode = input.pincode.replace(/\D/g, '').slice(0, 6);

    const { error } = await supabase.from('farmers').update(updates).eq('id', farmerId);
    throwIfSupabaseError(error, 'Could not update address');
    return farmerAuthService.me(farmerId);
  },
};
