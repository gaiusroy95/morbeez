import { NotFoundError } from '../../lib/errors.js';
import { shopifyProductsService } from '../shopify/shopify.products.service.js';

export type StoreVariant = {
  id: string;
  title: string;
  option1: string;
  packSize: string;
  unit: string;
  price: string;
  mrp: string;
  inventory: number;
};

export type StoreProduct = {
  id: string;
  title: string;
  handle: string;
  category: string;
  vendor: string;
  bodyHtml: string;
  imageUrl: string | null;
  images: Array<{ id: string; src: string; alt: string | null }>;
  price: string | null;
  inventory: number;
  variants: StoreVariant[];
};

function toStoreProduct(p: Awaited<ReturnType<typeof shopifyProductsService.get>>): StoreProduct {
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    category: p.category,
    vendor: p.vendor,
    bodyHtml: p.bodyHtml,
    imageUrl: p.imageUrl,
    images: p.images.map((img) => ({ id: img.id, src: img.src, alt: img.alt })),
    price: p.price,
    inventory: p.inventory,
    variants: p.variants.map((v) => ({
      id: v.id,
      title: v.title,
      option1: v.option1,
      packSize: v.packSize,
      unit: v.unit,
      price: v.price,
      mrp: v.mrp,
      inventory: v.inventory,
    })),
  };
}

export const storeCatalogService = {
  async list(query: { page?: number; limit?: number; search?: string; category?: string }) {
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const page = Math.max(1, query.page ?? 1);

    const result = await shopifyProductsService.list({
      page,
      limit,
      search: query.search,
      category: query.category,
      status: 'active',
    });

    return {
      products: result.products.map(toStoreProduct),
      categories: result.categories,
      pagination: result.pagination,
    };
  },

  async get(id: string): Promise<StoreProduct> {
    const product = await shopifyProductsService.get(id);
    if (product.status !== 'active') {
      throw new NotFoundError('Product not available');
    }
    return toStoreProduct(product);
  },
};
