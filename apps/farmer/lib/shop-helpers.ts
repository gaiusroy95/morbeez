import { fetchStoreProducts, priceToPaise, type CartLine, type RecommendationProduct, type StoreProduct } from '@morbeez/shared';

let catalogCache: StoreProduct[] | null = null;
let catalogLoadedAt = 0;

async function loadCatalog(): Promise<StoreProduct[]> {
  const stale = Date.now() - catalogLoadedAt > 60_000;
  if (catalogCache && !stale) return catalogCache;
  const data = await fetchStoreProducts({ limit: 100 });
  catalogCache = data.products;
  catalogLoadedAt = Date.now();
  return catalogCache;
}

export async function buildCartItemFromRecommendationProduct(
  p: RecommendationProduct,
  meta?: { recommendationId?: string; recoveryPurpose?: string }
): Promise<Omit<CartLine, 'key' | 'quantity'> & { quantity?: number } | null> {
  const catalog = await loadCatalog();
  if (p.variantId) {
    for (const prod of catalog) {
      const variant = prod.variants.find((v) => v.id === p.variantId || String(v.id) === p.variantId);
      if (variant) {
        return {
          productId: prod.id,
          variantId: variant.id,
          title: prod.title,
          variantTitle: variant.option1 || variant.title,
          imageUrl: prod.imageUrl,
          pricePaise: priceToPaise(variant.price),
          maxQuantity: Math.max(1, variant.inventory),
          quantity: p.quantity ?? 1,
          recommendationId: meta?.recommendationId,
          recoveryPurpose: meta?.recoveryPurpose,
        };
      }
    }
  }
  const match = catalog.find((x) => x.title.toLowerCase().includes(p.title.toLowerCase().slice(0, 12)));
  const variant = match?.variants.find((v) => v.inventory > 0) ?? match?.variants[0];
  if (!match || !variant) return null;
  return {
    productId: match.id,
    variantId: variant.id,
    title: match.title,
    variantTitle: variant.option1 || variant.title,
    imageUrl: match.imageUrl,
    pricePaise: priceToPaise(variant.price),
    maxQuantity: Math.max(1, variant.inventory),
    quantity: p.quantity ?? 1,
    recommendationId: meta?.recommendationId,
    recoveryPurpose: meta?.recoveryPurpose,
  };
}
