import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import {
  telecallerFarmerOrdersService,
  type TelecallerOrderRow,
} from '../admin/telecaller-farmer-orders.service.js';

export type ReviewableLineItem = {
  productKey: string;
  title: string;
  quantity: number;
  imageUrl?: string | null;
  shopifyProductId?: string | null;
  shopifyVariantId?: string | null;
  sku?: string | null;
  review?: {
    id: string;
    rating: number;
    reviewText: string | null;
    createdAt: string;
  } | null;
};

function productKey(title: string, variantId?: string | null, sku?: string | null): string {
  if (variantId) return `var:${variantId}`;
  if (sku?.trim()) return `sku:${sku.trim().toLowerCase()}`;
  return `title:${title.trim().toLowerCase().slice(0, 120)}`;
}

function lineItemsWithKeys(order: TelecallerOrderRow): ReviewableLineItem[] {
  return order.lineItems.map((li) => {
    const variantId = (li as { shopifyVariantId?: string }).shopifyVariantId ?? null;
    const productId = (li as { shopifyProductId?: string }).shopifyProductId ?? null;
    const sku = (li as { sku?: string }).sku ?? null;
    const title = li.title;
    return {
      productKey: productKey(title, variantId, sku),
      title,
      quantity: li.quantity,
      imageUrl: li.imageUrl ?? null,
      shopifyProductId: productId,
      shopifyVariantId: variantId,
      sku,
      review: null,
    };
  });
}

function canReviewOrder(order: TelecallerOrderRow, omsStatus: string | null): boolean {
  if (order.status === 'cancelled') return false;
  if (order.status === 'delivered') return true;
  return omsStatus === 'delivered' || omsStatus === 'completed';
}

async function loadCommerceOms(order: TelecallerOrderRow): Promise<string | null> {
  const commerceId = order.commerceOrderId ?? (order.source === 'commerce' ? order.id : null);
  if (!commerceId) return null;
  const { data, error } = await supabase
    .from('commerce_orders')
    .select('oms_status')
    .eq('id', commerceId)
    .maybeSingle();
  throwIfSupabaseError(error, 'Could not load order status');
  return data?.oms_status ? String(data.oms_status) : null;
}

export const farmerProductReviewService = {
  productKey,

  async getReviewableLines(farmerId: string, orderId: string) {
    const order = await telecallerFarmerOrdersService.getDetail(farmerId, orderId);
    const omsStatus = await loadCommerceOms(order);
    const canReview = canReviewOrder(order, omsStatus);
    const lines = lineItemsWithKeys(order);

    if (!canReview || !lines.length) {
      return { canReview, orderSource: order.source, lines };
    }

    const { data, error } = await supabase
      .from('farmer_product_reviews')
      .select('id, product_key, rating, review_text, created_at')
      .eq('farmer_id', farmerId)
      .eq('order_source', order.source)
      .eq('order_id', orderId);
    throwIfSupabaseError(error, 'Could not load reviews');

    const byKey = new Map(
      (data ?? []).map((r) => [
        String(r.product_key),
        {
          id: String(r.id),
          rating: Number(r.rating),
          reviewText: r.review_text ? String(r.review_text) : null,
          createdAt: String(r.created_at),
        },
      ])
    );

    for (const line of lines) {
      line.review = byKey.get(line.productKey) ?? null;
    }

    return { canReview, orderSource: order.source, lines };
  },

  async submitReview(
    farmerId: string,
    orderId: string,
    input: {
      productKey: string;
      rating: number;
      reviewText?: string;
    }
  ) {
    const order = await telecallerFarmerOrdersService.getDetail(farmerId, orderId);
    const omsStatus = await loadCommerceOms(order);
    if (!canReviewOrder(order, omsStatus)) {
      throw new ValidationError('Reviews are available only after delivery');
    }

    const rating = Math.round(input.rating);
    if (rating < 1 || rating > 5) {
      throw new ValidationError('Rating must be between 1 and 5 stars');
    }

    const lines = lineItemsWithKeys(order);
    const line = lines.find((l) => l.productKey === input.productKey);
    if (!line) throw new NotFoundError('Product not found on this order');

    const reviewText = input.reviewText?.trim().slice(0, 2000) || null;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('farmer_product_reviews')
      .upsert(
        {
          farmer_id: farmerId,
          order_source: order.source,
          order_id: orderId,
          product_key: line.productKey,
          product_title: line.title,
          shopify_product_id: line.shopifyProductId ?? null,
          shopify_variant_id: line.shopifyVariantId ?? null,
          sku: line.sku ?? null,
          rating,
          review_text: reviewText,
          status: 'published',
          updated_at: now,
        },
        { onConflict: 'farmer_id,order_source,order_id,product_key' }
      )
      .select('id, rating, review_text, created_at, updated_at')
      .single();
    throwIfSupabaseError(error, 'Could not save review');
    if (!data) throw new NotFoundError('Review not saved');

    return {
      id: String(data.id),
      rating: Number(data.rating),
      reviewText: data.review_text ? String(data.review_text) : null,
      createdAt: String(data.created_at),
      productKey: line.productKey,
      productTitle: line.title,
    };
  },

  async aggregateForProduct(shopifyProductId: string) {
    const { data, error } = await supabase
      .from('farmer_product_reviews')
      .select('rating, review_text, product_title, created_at')
      .eq('shopify_product_id', shopifyProductId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50);
    throwIfSupabaseError(error, 'Could not load product reviews');

    const rows = data ?? [];
    const count = rows.length;
    const average = count
      ? Math.round((rows.reduce((s, r) => s + Number(r.rating), 0) / count) * 10) / 10
      : 0;

    return {
      averageRating: average,
      reviewCount: count,
      reviews: rows.map((r) => ({
        rating: Number(r.rating),
        reviewText: r.review_text ? String(r.review_text) : null,
        productTitle: String(r.product_title),
        createdAt: String(r.created_at),
      })),
    };
  },
};
