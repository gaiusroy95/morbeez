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

export type StoreProductList = {
  products: StoreProduct[];
  categories: string[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export type ProductReviewAggregate = {
  averageRating: number;
  reviewCount: number;
  reviews: Array<{
    rating: number;
    reviewText: string | null;
    productTitle: string;
    createdAt: string;
  }>;
};

export type CartLine = {
  key: string;
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  imageUrl: string | null;
  pricePaise: number;
  quantity: number;
  maxQuantity: number;
  recoveryPurpose?: string;
  recommendationId?: string;
};

export type CheckoutCreateInput = {
  channel?: 'website' | 'mobile';
  lineItems: Array<{
    variantId: number;
    quantity: number;
    title?: string;
    price: number;
  }>;
  customer: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    newsletter?: boolean;
  };
  shipping: {
    address1: string;
    address2?: string;
    city: string;
    province: string;
    zip: string;
    country?: string;
  };
};

export type CheckoutCreateResult = {
  sessionId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  prefill: { name: string; email: string; contact: string };
};

export type CheckoutVerifyResult = {
  alreadyCompleted: boolean;
  shopifyOrderId: string;
  orderName?: string;
  orderStatusUrl?: string;
};
